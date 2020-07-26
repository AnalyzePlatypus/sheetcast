// require("isomorphic-fetch");

const fs = require("fs");

const get = require('lodash.get');
const AWS = require('aws-sdk');

const { respond, readJSONFile, loadEnvVars, uploadFile, asyncForEach, validateEnvVars, sendSlackNotification } = require("./global.js");
const { getSheet } = require("./sheets.js");

const Podcast =  require('podcast');

const REQUIRED_ENV_VARS = [
  "GOOGLE_API_CLIENT_EMAIL",
  "GOOGLE_API_PRIVATE_KEY",
  "S3_BUCKET_NAME",
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
  "/view?usp=sharing"
]

const ONE_HOUR_IN_MINUTES = 60;

loadEnvVars("RegenerateFeed")

// Runtime
validateEnvVars(REQUIRED_ENV_VARS);

const credentials = { 
  GOOGLE_API_CLIENT_EMAIL: process.env.GOOGLE_API_CLIENT_EMAIL,
  GOOGLE_API_PRIVATE_KEY: process.env.GOOGLE_API_PRIVATE_KEY.replace(/\\n/g, "\n")
}

exports.lambdaHandler = async function(event, context) {
  try {
    const sheetId = get(event, "queryStringParameters.sheetId");

    if(!sheetId) return {
      status: 400,
      message: `Missing required query param "sheetId". (Got "${sheetId}")`
    }

    const doc = await getSheet(sheetId, credentials);
    const info = await doc.getInfo();
    console.log(doc.title);

    const sheets = doc.sheetsByIndex;
    const feedConfigSheet = sheets.find(({title}) => title == "feedConfig");
    const episodeSheet = sheets.find(({title}) => title == "episodes");

    if(!feedConfigSheet) throw {name: "INVALID_SHEET", message: "Missing worksheet with required title 'feedConfig'"}
    if(!episodeSheet) throw {name: "INVALID_SHEET", message: "Missing worksheet with required title 'episodes'"}

    console.log(feedConfigSheet.title);
    console.log(episodeSheet.title);

    console.log("🌀 Loading sheet data...");
    const promises = [feedConfigSheet.getRows(), episodeSheet.getRows()]
    await Promise.all(promises);
    const [feedConfigRows, episodesPromise] = promises;
    console.log("✅ Loaded sheet data");

    const [feedConfig] = await feedConfigRows;

    const feed = new Podcast({
      title: feedConfig.title,
      description: feedConfig.description,
      generator: "Sheetcast",
      feedUrl:  feedConfig.feed_url,
      siteUrl: feedConfig.site_url,
      imageUrl: feedConfig.image_url,
      docs: feedConfig.docs_url,
      author: feedConfig.author,
      managingEditor: feedConfig.managing_editor_name,
      webMaster: feedConfig.web_master_name,
      copyright: feedConfig.copyright,
      language: feedConfig.language,
      categories: feedConfig.categories,
      pubDate: new Date(),
      ttl: feedConfig.ttl || ONE_HOUR_IN_MINUTES,
      itunesAuthor: feedConfig.itunes_author,
      itunesSubtitle: feedConfig.itunes_subtitle,
      itunesSummary: feedConfig.itunes_summary,
      itunesOwner: {
        name: feedConfig.itunes_owner_name,
        email: feedConfig.itunes_owner_email,
      },
      itunesExplicit: feedConfig.itunes_explicit,
      itunesCategory: feedConfig.itunes_category,
      itunesImage: feedConfig.itunes_image_url,
      itunesType: feedConfig.itunes_type
    });

    const episodes = await episodesPromise;

    if(episodes.length > 0) {
      episodes.forEach(episode => {
        let episodeAudioUrl = isGoogleDriveGUIUrl(episode.url) ? googleDriveGetFileUrl(episode.url) : episode.url;
        feed.addItem({
          title: episode.title,
          description: episode.showNotes,
          url: episode.url, // link to the item
          author: episode.guestAuthor, // optional - defaults to feed author property
          date: episode.date,
          enclosure : {
            url: episodeAudioUrl, 
            type: "audio/mpeg"
          },
          itunesExplicit: episode.is_explicit,
          itunesSubtitle: episode.subtitle,
          itunesSummary: episode.summary,
          itunesDuration: episode.duration,
          itunesKeywords: episode.keywords,
        })
      })
    }


    
    const xml = feed.buildXml("\t");
    console.log(xml);

    var s3Bucket = new AWS.S3( { params: { Bucket: process.env.S3_BUCKET_NAME } } );

    console.log("🌀 Uploading regenerated RSS file...");
    await uploadFile({
      s3Key: sheetId + ".rss",
      s3Bucket,
      bucketName: process.env.S3_BUCKET_NAME,
      fileContents: xml,
      fileMimeType: "text/xml"
    })
    

    return {
      status: 200,
      body: `SheetID: ${sheetId} ${JSON.stringify(info)}`
    }
  } catch (error) {
    console.error(error);
    return {
      status: 500,
      message: JSON.stringify(error)
    }
  }
};


const event = readJSONFile("../events/event.json");
const results = exports.lambdaHandler(event);