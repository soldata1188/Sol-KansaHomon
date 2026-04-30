/**
 * Auto-extract localStorage from Edge browser and upload to Google Apps Script
 * Runs: node scripts/auto-upload.js
 */

const { execSync } = require('child_process');
const https = require('https');
const path = require('path');
const fs = require('fs');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwoaB1_RZ0nheTgUNptjVz-Cv6ysusph7C_LKl3HYC2__3EygtnIrdzxAXiatXCnI0jwg/exec';

async function main() {
  console.log('🔍 Đang tìm dữ liệu trong Edge localStorage...\n');

  // Install leveldown if not present
  try {
    require.resolve('leveldown');
  } catch {
    console.log('📦 Installing leveldown...');
    execSync('npm install leveldown --no-save', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  }

  const leveldown = require('leveldown');
  
  const leveldbPath = process.env.TEMP + '\\edge_ls_backup';

  if (!fs.existsSync(leveldbPath)) {
    console.error('❌ Edge localStorage không tìm thấy tại:', leveldbPath);
    process.exit(1);
  }

  console.log('📂 Đọc từ:', leveldbPath);

  const db = leveldown(leveldbPath);

  await new Promise((resolve, reject) => db.open({ createIfMissing: false }, (err) => {
    if (err) reject(err); else resolve();
  }));

  // Read all keys to find sol_enterprises
  const allData = {};
  const stream = db.iterator({ keyAsBuffer: false, valueAsBuffer: false });
  
  await new Promise((resolve) => {
    function next() {
      stream.next((err, key, value) => {
        if (err || key === undefined) return resolve();
        try {
          const keyStr = String(key);
          const valStr = String(value);
          if (keyStr.includes('sol_enterprises') || keyStr.includes('sol_cache')) {
            allData[keyStr] = valStr;
            console.log('✅ Found key:', keyStr.substring(0, 80));
          }
        } catch {}
        next();
      });
    }
    next();
  });

  await new Promise((resolve) => db.close(resolve));

  const enterprisesKey = Object.keys(allData).find(k => k.includes('sol_enterprises'));
  const cacheKey = Object.keys(allData).find(k => k.includes('sol_cache'));

  if (!enterprisesKey) {
    console.error('\n❌ Không tìm thấy sol_enterprises trong Edge localStorage');
    console.log('\n💡 Hãy mở ứng dụng trong Edge và đăng nhập một lần, sau đó chạy lại script này.');
    process.exit(1);
  }

  let enterprises = [];
  let cache = {};

  try {
    // LevelDB values for localStorage are prefixed with a type byte
    const raw = allData[enterprisesKey];
    // Try different parsing strategies
    let jsonStr = raw;
    if (raw.charCodeAt(0) === 1) jsonStr = raw.substring(1); // Strip type prefix
    enterprises = JSON.parse(jsonStr);
    console.log(`\n🏭 Tìm thấy ${enterprises.length} xí nghiệp!`);
  } catch (e) {
    console.error('❌ Không thể parse dữ liệu enterprises:', e.message);
    process.exit(1);
  }

  if (cacheKey) {
    try {
      const raw = allData[cacheKey];
      let jsonStr = raw;
      if (raw.charCodeAt(0) === 1) jsonStr = raw.substring(1);
      cache = JSON.parse(jsonStr);
    } catch {}
  }

  // Upload to GAS
  await uploadToGAS(enterprises, cache);
}

function uploadToGAS(enterprises, cache) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      enterprises,
      cache
    });

    console.log(`\n🔄 Đang upload ${enterprises.length} xí nghiệp lên Google Sheets...`);

    function doPost(url, data) {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
          console.log('↪️  Redirect ->', res.headers.location.substring(0, 80));
          return doPost(res.headers.location, data);
        }
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (body.includes('OK') || res.statusCode === 200) {
            console.log('\n✅ Upload thành công!');
            console.log('   GAS response:', body.substring(0, 100));
            console.log('\n🎉 Kiểm tra Google Sheet:');
            console.log('   - Sheet "Enterprises": danh sách xí nghiệp');
            console.log('   - Sheet "JSON_BACKUP": toàn bộ dữ liệu JSON');
          } else {
            console.log('⚠️  Status:', res.statusCode, '| Response:', body.substring(0, 200));
          }
          resolve();
        });
      });

      req.on('error', (e) => { console.error('❌ Error:', e.message); resolve(); });
      req.write(data);
      req.end();
    }

    doPost(GAS_URL, payload);
  });
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
