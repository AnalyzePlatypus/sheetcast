const { GoogleSpreadsheet } = require("google-spreadsheet");

async function googleSheetsLogin(sheetId, credentials) {
  const doc = new GoogleSpreadsheet(sheetId);
  await doc.useServiceAccountAuth({
      client_email: credentials.GOOGLE_API_CLIENT_EMAIL,
      private_key: credentials.GOOGLE_API_PRIVATE_KEY
    });
  return doc;
}

async function getSheet(sheetId, credentials) {
  console.log(`🌀 Accessing Google Sheet #${sheetId}...`);
  const doc = await googleSheetsLogin(sheetId, credentials)
  console.log(`✅ Access granted!`);
  await doc.getInfo();
  return doc; 
}

exports.getSheet = getSheet;