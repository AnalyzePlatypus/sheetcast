const cloudwatchRoot = 'https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/'



exports.asyncForEach = async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

exports.validateEnvVars = function validateEnvVars(envVars) {
  envVars.forEach(envVar => {
    if(!process.env[envVar]) throw `Missing required env var "${envVar}".\nIn development, is the var present in .env.json and whitelisted in template.yml?`;
  })
}


exports.sendSlackNotification = async function sendSlackNotification(text) {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'post',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({"text": text + ' ' + getCloudWatchLogDeeplink() })
  }) 
}

function getCloudWatchLogDeeplink() {
  if(!process.env.AWS_LAMBDA_LOG_GROUP_NAME || !process.env.AWS_LAMBDA_LOG_STREAM_NAME) return "<cloudwatch_log_url__dev_placeholder>";
  return [
    cloudwatchRoot,
    cloudWatchURLEncode(process.env.AWS_LAMBDA_LOG_GROUP_NAME),
    '/log-events/',
    cloudWatchURLEncode(process.env.AWS_LAMBDA_LOG_STREAM_NAME)
  ].join("");
}



// const cloudWatchURLEncode = str => cloudWatchURLReplaceTable.reduce(applyReplacement, str);

// const applyReplacement = ([target, replacement], str) => str.replace(target, replacement);

// const cloudWatchURLReplaceTable = [
//   [/\$/g, '$2524'],
//   [/\//g, '$252F'],
//   [/\[/g, '$255B'],
//   [/\]/g, '$255D']
// ]



function cloudWatchURLEncode(str) {
  return str.
    replace(/\$/g, '$2524').
    replace(/\//g, '$252F').
    replace(/\[/g, '$255B').
    replace(/\]/g, '$255D')
}