# Sheetcast

Build a podcast feed using nothing but a Google Sheet!

## Usage

> You'll need to deploy the Lambda first, as described below.

1. Create a new Google sheet with the schema from _Appendixes > Sheet column reference_
2. Copy the sheet ID
3. Call the endpoint with the sheet ID

```
curl -X POST https://****.execute-api.us-east-1.amazonaws.com/default?sheetId=GOOGLE_SHEET_ID
```

That should return a URL to your new RSS podcast feed.
(the URL is `S3_BUCKET/<SHEET_ID>.rss`)

To update the feed with new items, call the endpoint again.

> If the Sheet is private, you'll need to share it with the service account email address from _First-time dev setup_ (`{account}@{iam_org}.iam.gserviceaccount.com`)

## Development


```bash
cd src
npm i
node app.js
```

Or run in Docker:
```bash
sam local invoke RegenerateFeed --env-vars=.env.json --event=events/event.json
```

### First-time dev setup

You will need:
* AWS bucket name (for storing RSS files)
* Google Sheets-enabled service account (See [my guide here](https://gist.github.com/AnalyzePlatypus/a486323a331c91f738f2245ff9a1c66f))

Create and populate `.env.json` with these values:

```json
{
  "RegenerateFeed": {
    "GOOGLE_API_CLIENT_EMAIL": "",
    "GOOGLE_API_PRIVATE_KEY": "",
    "S3_BUCKET_NAME": "",
    "SLACK_WEBHOOK_URL": ""
  }
}
```

> The bucket should allow public `getObject`, so the RSS files will be public, but should not allow any other actions to prevent enumeration of the bucket contents. (The 44-character alphanumeric Sheets ID used for the RSS file name has 7.3 quadrillion (e+78) possible values. Good luck, blackhats 😎!)

## Deployment

On AWS, create a new AWS function by following [my Lambda deployment guide](https://gist.github.com/AnalyzePlatypus/c2ae820a5ec2d2a0a92fe10212e5e72c).

Populate a `src/.env` with the values obtained by following the guide.

When ready to deploy;

```bash
cd src
./deploy.sh
```

## Appendix

### Link rewriting

If you use Google Drive urls for your episode audio, the URL will be rewritten to use the `https://drive.google.com/uc?id=` URL format, which will return the raw audio file and not the Google Drive UI. See [this StackOverflow answer](https://stackoverflow.com/a/62137958/6068782).

> While this works in many podcast players, some players will refuse the feed if the URLs do not end in a known audio file extension. For maximum compatibility, do not use Google Drive as a podcast file storage solution (Backblaze B2 is the most inexpensive option, at $0.005/GB-month storage and $0.01/GB download)

### Analytics

If you'd like to track popularity of your feed, set the `analytics_redirect_url` in `feedConfig`. All of the audio file URLs will be rewritten like so:

* Original audio URL: `https://my-bucket.s3.amazonaws.com/my-file.mp3`

* Analytics URL: `https://media.blubrry.com/my-show/`

* Generated URL: `https://media.blubrry.com/my-show/my-bucket.s3.amazonaws.com/my-file.mp3`

### Sheet column reference

The source Google sheet must contain 2 pages, named `feedConfig` and `episodes`. (The order does not matter).

`feedConfig` must have the following columns (The order doesn't matter).:

```
title	description	feed_url	site_url	image_url	docs_url	analytics_redirect_url	author	managing_editor_name	web_master_name	copyright	language	categories	ttl	itunes_author_name	itunes_subtitle	itunes_summary	itunes_owner_name	itunes_owner_email	itunes_explicit	itunes_categories	itunes_image_url
```

`episodes` must have the following columns:

```
title	url	duration	guestAuthor	is_explicit	subtitle	summary	showNotes	date	keywords
```

## Roadmap

- [x] `gzip` of RSS feed - Turns out iTunes will not validate GZIPed feeds
- [x] iTunes compliance
- [ ] Auto-regenerate the RSS feed when the Sheet is edited (https://developers.google.com/drive/api/v3/push)
- [ ] Analytics rewriting
- [ ] Cloudfront/Clouflare caching and invalidation
