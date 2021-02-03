//process.env.RUN_LOCAL = true;

require("isomorphic-fetch");

const zlib = require('zlib');

const get = require('lodash.get');
const AWS = require('aws-sdk');

const { respond, readJSONFile, loadEnvVars, uploadFile, asyncForEach, parseBoolean, validateEnvVars, sendSlackNotification } = require("./global.js");
const { getSheet } = require("./sheets.js");

const Podcast =  require('podcast');

const REQUIRED_ENV_VARS = [
  "GOOGLE_API_CLIENT_EMAIL",
  "GOOGLE_API_PRIVATE_KEY",
  "S3_BUCKET_NAME",
  "CLOUDFRONT_DISTRIBUTION_ID",
  "CLOUDFRONT_PUBLIC_BASE_URL",
  "SLACK_WEBHOOK_URL"
]

const RESPONSES = {
  "INTERNAL_SERVER_ERROR": {
    status: 500,
    message: "internal__server_error"
  }
}

function googleDriveGetFileUrl(googleDriveUrl) {
  let driveItemId = googleDriveUrl; 
  GOOGLE_DRIVE_LINK_TOKENS_TO_STRIP.forEach(token => driveItemId = driveItemId.replace(token, ""));
  return GOOGLE_DRIVE_RAW_CONTENT_BASE_URL + driveItemId;
}

const GOOGLE_DRIVE_RAW_CONTENT_BASE_URL = "https://drive.google.com/uc?id=";

const isGoogleDriveGUIUrl = url => GOOGLE_DRIVE_GUI_URL_MATCHER.test(url);
const GOOGLE_DRIVE_GUI_URL_MATCHER = /https:\/\/drive.google.com\/file\/d\/|drive.google.com\/open\?id=/;

const GOOGLE_DRIVE_LINK_TOKENS_TO_STRIP = [
  "http://",
  "https://",
  "drive.google.com/open?id=",
  "drive.google.com/file/d/",
  "/view?usp=sharing",
  "/view?usp=drive_web"
]

const ONE_HOUR_IN_MINUTES = 60;

const XML_PRETTY_PRINT_DELIMITER = "";

function buildRssFeed(feedConfig, episodes) {
  console.log(feedConfig);
  console.log(feedConfig.title);
  const feed = new Podcast({
    title: feedConfig.title,
    description: feedConfig.description,
    generator: "Sheetcast: Google Sheet to Podcast",
    feedUrl:  feedConfig.feed_url,
    siteUrl: feedConfig.site_url,
    imageUrl: feedConfig.image_url,
    docs: feedConfig.docs_url,
    author: feedConfig.author,
    managingEditor: feedConfig.managing_editor_name,
    webMaster: feedConfig.web_master_name,
    copyright: feedConfig.copyright,
    language: feedConfig.language,
    categories: feedConfig.categories && feedConfig.categories.split(", "),
    pubDate: new Date(),
    ttl: feedConfig.ttl || ONE_HOUR_IN_MINUTES,
    itunesAuthor: feedConfig.itunes_author,
    itunesSubtitle: feedConfig.itunes_subtitle,
    itunesSummary: feedConfig.itunes_summary,
    itunesOwner: {
      name: feedConfig.itunes_owner_name,
      email: feedConfig.itunes_owner_email,
    },
    itunesExplicit: parseBoolean(feedConfig.itunes_explicit),
    itunesCategory: feedConfig.categories && feedConfig.categories.split(", ").map(category => { return {text: category}}),
    itunesImage: feedConfig.itunes_image_url,
    itunesType: feedConfig.itunes_type || "episodic",
    customElements: [ { 'itunes:block': feedConfig.is_private_feed || 'no' }]
  });

  console.log(feed);

  if(episodes.length > 0) {
    episodes.forEach(episode => {
      let episodeAudioUrl = isGoogleDriveGUIUrl(episode.url) ? googleDriveGetFileUrl(episode.url) : episode.url;

      if(feedConfig)

      feed.addItem({
        title: episode.title,
        description: episode.showNotes,
        url: episode.url, // link to the item
        author: episode.guestAuthor, // optional - defaults to feed author property
        date: episode.date,
        enclosure : {
          url: episodeAudioUrl, 
          size: episode.file_size_bytes.replace(",", "")
        },
        itunesExplicit: parseBoolean(episode.is_explicit),
        itunesSubtitle: episode.subtitle,
        itunesSummary: episode.summary,
        itunesDuration: episode.duration,
        itunesKeywords: episode.keywords,
        itunesSeason:	episode.itunes_season_number,
        itunesEpisode: episode.itunes_episode_number
      })
    })
  }
  return feed.buildXml(XML_PRETTY_PRINT_DELIMITER);
} 

async function triggerOvercastRecrawl(s3Key) {
  console.log("🌀 Triggering Overcast recrawl...");
  try {
    const publicUrl = process.env.CLOUDFRONT_PUBLIC_BASE_URL + "/" + s3Key;
    const overcastWebhooklUrl = "https://overcast.fm/ping?urlprefix=" + encodeURIComponent(publicUrl);
    const response = await fetch(overcastWebhooklUrl);
    const text = await response.text();
    console.log(text);
    if(!response.ok) throw {name: 'NonOKResponseError', responseCode: response.status, responseText: text};

    console.log("✅ Overcast recrawl triggered");
  } catch(e) {
    throw {name: "OVERCAST_TRIGGER_RECRAWL_FAILED", error: e}
  }
}

// Runtime

if(process.env.RUN_LOCAL) {
  loadEnvVars("RegenerateFeed")
}


const credentials = { 
  GOOGLE_API_CLIENT_EMAIL: process.env.GOOGLE_API_CLIENT_EMAIL,
  GOOGLE_API_PRIVATE_KEY: process.env.GOOGLE_API_PRIVATE_KEY.replace(/\\n/g, "\n")
}


validateEnvVars(REQUIRED_ENV_VARS);


exports.lambdaHandler = async function(event, context) {
  try {
    const sheetId = get(event, "queryStringParameters.sheetId");

    if(!sheetId) return {
      status: 400,
      message: `Missing required query param "sheetId". (Got "${sheetId}")`
    }

    let doc;
    // try {
      doc = await getSheet(sheetId, credentials);
    // } catch(e) {
    //   if(e.name = "Non")
    // }x
   
    const info = await doc.getInfo();
    console.log(doc.title);

    const sheets = doc.sheetsByIndex;
    const feedConfigSheet = sheets.find(({title}) => title == "feedConfig");
    const episodeSheet = sheets.find(({title}) => title == "episodes");

    if(!feedConfigSheet) throw {name: "INVALID_SHEET", message: "Missing worksheet with required title 'feedConfig'"}
    if(!episodeSheet) throw {name: "INVALID_SHEET", message: "Missing worksheet with required title 'episodes'"}

    console.log("🌀 Loading sheet data...");


    const feedConfig = await feedConfigSheet.getRows();
    const episodes = await episodeSheet.getRows();

    console.log("✅ Loaded sheet data");
  
    const xml = buildRssFeed(feedConfig[0], episodes)

    var s3Bucket = new AWS.S3( { params: { Bucket: process.env.S3_BUCKET_NAME } } );
    const s3FileKey = sheetId + ".rss";

    console.log("🌀 Uploading regenerated RSS file...");

    await uploadFile({
      s3Key: s3FileKey,
      bucketName: process.env.S3_BUCKET_NAME,
      contentMimeType: 'text/xml',
      fileContents: xml,
      s3Bucket,
    })

    console.log("✅ Upload complete");

    // Note - using a timestamp as a CallerReference defeats the Cloudfront 
    // anti-duplicate request preventer. As this will be called infrequently,
    // but will occasionally be called several times in rapid succession, it seems necessary to let every invalidation go through.
    // See https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_CreateInvalidation.html#API_CreateInvalidation_RequestSyntax
    const invalidationUniqueId = new Date().getTime().toString();

    var options = {
      DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
      InvalidationBatch: { 
        CallerReference: invalidationUniqueId,
        Paths: {
          Quantity: 1,
          Items: [
             "/" + s3FileKey
          ]
        }
      }
    };

    console.log(options);

    console.log("🌀 Invalidating CDN...");
    var cloudfront = new AWS.CloudFront();
    await cloudfront.createInvalidation(options).promise();
    console.log("✅ Invalidated");

    await triggerOvercastRecrawl(s3FileKey);

    await sendSlackNotification(`🚀 Regenerated "${doc.title}" (${episodes.length} episodes)`);
    
    const publicCdnUrl = process.env.CLOUDFRONT_PUBLIC_BASE_URL + "/" + s3FileKey;

    return {
      status: 200,
      body: {
        publicFeedUrl: publicCdnUrl,
        message: `Regenerateed feed for SheetID: ${sheetId}`
      }
    }
    
  } catch (error) {
    console.error(error);
    await sendSlackNotification(error);
    return {
      status: 500,
      message: JSON.stringify(error)
    }
  }
};



if(process.env.RUN_LOCAL) {
  const event = readJSONFile("../events/event.json");
  const results = exports.lambdaHandler(event);
}