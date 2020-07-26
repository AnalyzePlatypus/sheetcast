// require("isomorphic-fetch");

//const get = require('lodash.get');
const AWS = require('aws-sdk');

const { respond, uploadJsonFile, asyncForEach, validateEnvVars, sendSlackNotification } = require("./global.js");

const GOOGLE_API_CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_API_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");


const REQUIRED_ENV_VARS = [
  "GOOGLE_API_CLIENT_EMAIL",
  "GOOGLE_API_PRIVATE_KEY",
  "AWS_S3_BUCKET",
  "SLACK_WEBHOOK_URL"
]

const RESPONSES = {
  "INTERNAL_SERVER_ERROR": {
    status: 500,
    message: "internal__server_error"
  }
}

// Runtime

validateEnvVars(REQUIRED_ENV_VARS);

exports.lambdaHandler = async function(event, context) {
  try {
    
  } catch (error) {
    return {
      status: 500,
      message: JSON.stringify(error)
    }
  }
};
