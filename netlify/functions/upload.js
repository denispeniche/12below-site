const https = require('https');

exports.handler = async function(event) {
  const h = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: h, body: JSON.stringify({ error: 'POST only' }) };

  try {
    const { image, filename } = JSON.parse(event.body);
    if (!image || !filename) return { statusCode: 400, headers: h, body: JSON.stringify({ error: 'image and filename required' }) };

    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const zone = process.env.BUNNY_STORAGE_ZONE;
    const region = process.env.BUNNY_STORAGE_REGION || 'ny';
    const password = process.env.BUNNY_STORAGE_PASSWORD;
    const cdnUrl = process.env.BUNNY_CDN_URL;

    if (!zone || !password) return { statusCode: 500, headers: h, body: JSON.stringify({ error: 'BunnyCDN env vars not set' }) };

    const uniqueName = Date.now() + '_' + filename.replace(/[^a-zA-Z0-9._-]/g,'_');
    const storagePath = '/' + zone + '/photos/' + uniqueName;

    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: region + '.storage.bunnycdn.com', port: 443,
        path: storagePath, method: 'PUT',
        headers: { 'AccessKey': password, 'Content-Type': 'image/jpeg', 'Content-Length': imageBuffer.length }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => res.statusCode < 300 ? resolve() : reject(new Error('Bunny '+res.statusCode+': '+body)));
      });
      req.on('error', reject);
      req.write(imageBuffer);
      req.end();
    });

    const url = (cdnUrl || 'https://'+zone+'.b-cdn.net') + '/photos/' + uniqueName;
    return { statusCode: 200, headers: h, body: JSON.stringify({ url }) };
  } catch(e) {
    return { statusCode: 500, headers: h, body: JSON.stringify({ error: e.message }) };
  }
};