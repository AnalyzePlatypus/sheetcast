require("isomorphic-fetch");

const AWS = require('aws-sdk');

const fs  = require("fs");
const path = require("path");

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

function validateEnvVars(envVars) {
  envVars.forEach(envVar => {
    if(!process.env[envVar]) throw `Missing required env var "${envVar}".\nIn development, is the var present in .env.json and whitelisted in template.yml?`;
  })
}

async function sendSlackNotification(text) {
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
  if(!SLACK_WEBHOOK_URL) return;  
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'post',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({"text": text})
  }) 
}


// -----------

function parseBoolean(str) {
  if(str === undefined) throw `Must be called with String or Boolean but got \`${str}\``
  if (typeof str === "boolean") return str;
  const normalized = normalizeToken(str);
  if (normalized == 'true') return true;
  if (normalized == 'yes') return true;
  if (normalized == 'false') return false;
  if (normalized == 'no') return true;
  throw `parseBoolean failed. Unable to convert string "${str}" to Boolean.`;
}

const normalizeToken = str => str.trim().toLowerCase();


// ------------


const cloudwatchRoot = 'https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/'

function cloudWatchURLEncode(str) {
  return str.
    replace(/\$/g, '$2524').
    replace(/\//g, '$252F').
    replace(/\[/g, '$255B').
    replace(/\]/g, '$255D')
}

function getCloudWatchLogDeeplink() {
  if(!process.env.AWS_LAMBDA_LOG_GROUP_NAME || !process.env.AWS_LAMBDA_LOG_STREAM_NAME) return "";
  let encodedUrl = [
    cloudwatchRoot,
    cloudWatchURLEncode(process.env.AWS_LAMBDA_LOG_GROUP_NAME),
    '/log-events/',
    cloudWatchURLEncode(process.env.AWS_LAMBDA_LOG_STREAM_NAME)
  ].join("");
  return encodedUrl;
}

// ------------

async function respond(response, args, messageHash) {
  if(response.logMessage) {
    console[response.logLevel || "log"](response.logMessage, args || '');
  }
  if(!process.env.IS_TEST_MODE && response.slackNotification) {
    await sendSlackNotification(response.slackNotification.
        replace("%s", args).
        replace('%log', `<${getCloudWatchLogDeeplink()}|Logs ›>`))
  }

  return response.httpResponse;
}

// ------


async function uploadFile({s3Key, bucketName, fileContents, contentMimeType, contentEncoding, s3Bucket}) {
  var uploadRequest = {
    Bucket: bucketName,
    Key: s3Key, 
    Body: fileContents,
    ContentType: contentMimeType,
    ContentEncoding: contentEncoding,
    Tagging: buildTagString({})
  };
  console.log(`🌀 Uploading file "${s3Key}"`);
  const response = await s3Bucket.putObject(uploadRequest).promise();
  console.log(response);
  console.log(`✅ Uploaded file "${s3Key}"`);
}

function buildTagString(tagObject) {
  Object.entries(tagObject).
      map(([key, value]) => `${key}=${value}`).
      join("&")
}

// ------

const pipe = (...fns) => x => fns.reduce((y, f) => f(y), x);
const resolveFilePath = filepath => path.resolve(process.cwd(), filepath)

const readJSONFile = pipe(
  resolveFilePath,
  fs.readFileSync,
  buffer => buffer.toString(),
  JSON.parse
)

function loadEnvVars(functionName) {
  if(!functionName) throw 'functionName is require (expected 1 argument but got undefined)'
  const envVars = readJSONFile("../.env.json");
  Object.entries(envVars[functionName]).forEach(([key, value])=>{
    process.env[key] = value;
  });
}
//

exports.respond = respond;
exports.asyncForEach = asyncForEach;
exports.validateEnvVars = validateEnvVars;
exports.sendSlackNotification = sendSlackNotification;
exports.getCloudWatchLogDeeplink = getCloudWatchLogDeeplink;
exports.parseBoolean = parseBoolean;
exports.uploadFile = uploadFile;
exports.loadEnvVars = loadEnvVars;
exports.readJSONFile = readJSONFile;