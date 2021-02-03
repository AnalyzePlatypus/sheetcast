# Just in case we forgot to install a prod dep...
./npmDuo.sh i

export $(egrep -v '^#' .env | xargs)

echo $LAMBDA_FUNCTION_NAME
rm function.zip 

# Swap prod & dev deps, so only prod get deployed in the bundle
mv node_modules node_modules__stash_while_building
mv node_modules__prod node_modules

zip -r function.zip \
  app.js \
  node_modules \
  package.json

# Unswap; back to dev mode. Prod deps are safely inside the ZIP
mv node_modules node_modules__prod
mv node_modules__stash_while_building node_modules

echo "🌀 Uploading..."
aws lambda update-function-code \
  --cli-connect-timeout 0 \
  --function-name=$LAMBDA_FUNCTION_NAME \
  --zip-file=fileb://function.zip \
  --profile=$AWS_UPLOAD_CODE_PROFILE \
  --region='us-east-1' && \
terminal-notifier -title $LAMBDA_FUNCTION_NAME -message '✅ Deploy Complete' -open "https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/${LAMBDA_FUNCTION_NAME}" -appIcon $NOTIFICATION_ICON_PATH && \
curl -X POST -H 'Content-type: application/json' --data '{"text":"🚀 IngestNewMail redeployed"}' $SLACK_DEV_NOTIFICATIONS_WEBHOOK_URL

