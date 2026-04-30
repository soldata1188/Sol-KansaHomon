/**
 * SOL監査訪問 - Data Recovery & Upload Script
 * 
 * This script reads the local backup JSON file and pushes all enterprise data
 * directly to Google Apps Script from Node.js (no CORS restrictions).
 * 
 * Usage:
 *   1. Export your LocalStorage data from browser console:
 *      Copy output of: localStorage.getItem('sol_enterprises')
 *      Save it as: local_backup.json
 *   
 *   2. Run: node scripts/upload-to-gas.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwoaB1_RZ0nheTgUNptjVz-Cv6ysusph7C_LKl3HYC2__3EygtnIrdzxAXiatXCnI0jwg/exec';

// Try to load backup data
let enterprises = [];
let cache = {};

const backupPath = path.join(__dirname, 'local_backup.json');
if (fs.existsSync(backupPath)) {
  try {
    const raw = fs.readFileSync(backupPath, 'utf8');
    enterprises = JSON.parse(raw);
    console.log(`✅ Loaded ${enterprises.length} enterprises from local_backup.json`);
  } catch (e) {
    console.error('❌ Failed to parse local_backup.json:', e.message);
    process.exit(1);
  }
} else {
  console.error('❌ local_backup.json not found.');
  console.log('');
  console.log('To create it:');
  console.log('1. Open your app in the browser that has data');
  console.log('2. Press F12 → Console tab');
  console.log('3. Run: copy(localStorage.getItem("sol_enterprises"))');
  console.log('4. Paste the result into: scripts/local_backup.json');
  process.exit(1);
}

const payload = JSON.stringify({
  timestamp: new Date().toISOString(),
  enterprises,
  cache
});

console.log(`\n🔄 Uploading ${enterprises.length} enterprises to Google Sheets...`);

const urlObj = new URL(GAS_URL);
const options = {
  hostname: urlObj.hostname,
  path: urlObj.pathname + urlObj.search,
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain',
    'Content-Length': Buffer.byteLength(payload)
  }
};

function makeRequest(options, payload, redirectCount = 0) {
  if (redirectCount > 5) {
    console.error('❌ Too many redirects');
    return;
  }

  const req = https.request(options, (res) => {
    console.log(`📡 Status: ${res.statusCode}`);

    // Handle redirect
    if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
      console.log(`↪️  Redirecting to: ${res.headers.location}`);
      const newUrl = new URL(res.headers.location);
      const newOptions = {
        ...options,
        hostname: newUrl.hostname,
        path: newUrl.pathname + newUrl.search,
      };
      makeRequest(newOptions, payload, redirectCount + 1);
      return;
    }

    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log(`✅ Upload successful! GAS response: ${data}`);
        console.log('\n🎉 Done! Check your Google Sheet - data should now appear in:');
        console.log('   - JSON_BACKUP sheet (full data)');
        console.log('   - Enterprises sheet (list of companies)');
        console.log('   - Reports sheet (completed audits/visits)');
      } else {
        console.error(`❌ Upload failed. Response: ${data}`);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request error:', e.message);
  });

  req.write(payload);
  req.end();
}

makeRequest(options, payload);
