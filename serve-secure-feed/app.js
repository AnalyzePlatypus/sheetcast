const AWS = require('aws-sdk');


const { sendSlackNotification, asyncForEach } = require("./global.js");

// URI "sheetId/userId/feed.rss"
// split

const MS_IN_MINUTE = 60 * 1000;
const CACHE_TTL_MS = MS_IN_MINUTE;

const USER_LIST_CACHE = {}

exports.lambdaHandler = async function(event, context) {
  try {
    console.log(event);
    await asyncForEach(event.Records, processRecord);
  } catch (error) {
    console.error(error);
    await sendSlackNotification("❗️ Root error" + error);
    return {
      status: 500,
      message: JSON.stringify(error)
    }
  }
};


    // Extract sheetId, userId from event url
    // Check if sheetId is in cache
    //   No -> load sheet json, then proceed
    //   Yes -> proceed
    // 
    // Is userId whitelisted?
    //   No -> Serve "Access Denied" RSS feed
    //   Yes -> Signal Cloudfront to proceed with serving
    

function processRecord(record, i, allRecords) {
  try {
    console.log(`ℹ️ Processing record ${i}/${allRecords.length}`);
    const {sheetId, userId} = extractUriComponents(record);
    const userIdWhiteList = await retrieveSheetUserListWithCache(sheetId);
    if(userIdWhiteList.includes(userId)) {
      return redirectToRssFeed(sheetId);
    } else {
      return redirectToAccessDeniedFeed(sheetId);
    }
  } catch(error) {
    console.error(error);
    await sendSlackNotification(error);
  }
}

// Example URI "/sheetId/userId/feed.rss"
function extractUriComponents(record) {
  const [leadingSlash, sheetId, userId, _] = record.cf.request.uri.split("/");
  return {sheetId, userId}
}

async function retrieveSheetUserListWithCache(sheetId) {
  // Check if sheetId is in cache
  //   No -> load sheet json, then proceed
  //   Yes -> check if cache is expired
  //     Yes -> load sheet json, then proceed
  //     No -> proceed
  // Return results from cache
}

function redirectToRssFeed(sheetId) {
  // Create redirect response
}

function redirectToAccessDeniedFeed(sheetId) {
  // Create redirect response
}