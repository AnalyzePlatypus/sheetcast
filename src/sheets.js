const GoogleSpreadsheet = require("google-spreadsheet");


const GOOGLE_API_CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_API_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");


async function googleSheetsLogin(sheetId) {
  return new GoogleSpreadsheet(sheetId).
    useServiceAccountAuth({
      client_email: GOOGLE_API_CLIENT_EMAIL,
      private_key: GOOGLE_API_PRIVATE_KEY
    });
}

async function getSheet(sheetId) {
  console.log(`🌀 Accessing Google Sheet #${sheetId}...`);
  const doc = await googleSheetsLogin(sheetId)
  console.log(`✅ Access granted!`);
  return await doc.loadInfo();
}

exports.googleSheetsLogin = getSheet;