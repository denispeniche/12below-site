const https = require('https');
const ZONE = process.env.BUNNY_STORAGE_REGION || 'ny';
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || '12below-cars';

function getBunnyPassword() {
  const a = process.env.NF_TOK_A || '';
  const b = process.env.NF_TOK_B || '';
  // Storage password is separate from Netlify token
  return process.env.BUNNY_STORAGE_PASSWORD || '';
}

exports.handler = async function(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const p = (event.queryStringParameters || {}).p || '';
  if (!p || p.includes('..') || p.includes('//')) {
    return { statusCode: 400, headers: cors, body: 'bad path' };
  }

  const pw = getBunnyPassword();
  if (!pw) return { statusCode: 500, headers: cors, body: 'no auth' };

  return new Promise((resolve) => {
    const path = '/' + STORAGE_ZONE + '/' + p;
    const opts = {
      hostname: ZONE + '.storage.bunnycdn.com',
      path: path,
      method: 'GET',
      headers: { 'AccessKey': pw }
    };

    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          resolve({ statusCode: res.statusCode, headers: cors, body: 'upstream error ' + res.statusCode });
          return;
        }
        resolve({
          statusCode: 200,
          headers: {
            ...cors,
            'Content-Type': res.headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400'
          },
          body: buf.toString('base64'),
          isBase64Encoded: true
        });
      });
    });
    req.on('error', (e) => resolve({ statusCode: 500, headers: cors, body: 'error: ' + e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ statusCode: 504, headers: cors, body: 'timeout' }); });
    req.end();
  });
};
