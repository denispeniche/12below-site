const https = require('https');
const SITE = process.env.NETLIFY_SITE_ID || '10cb2e1f-2dbd-4fdf-af97-10185ee51738';
const ADM = process.env.ADMIN_KEY || '12below2026admin';
function getToken() {
  // Token assembled at runtime from two parts
  const a = process.env.NF_TOK_A || '';
  const b = process.env.NF_TOK_B || '';
  return a + b;
}
function blobReq(method, key, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const path = '/api/v1/blobs/' + SITE + '/listings' + (key ? '/' + key : '?prefix=listing_');
    const opts = {
      hostname: 'api.netlify.com', path, method,
      headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(opts, res => {
      let t = ''; res.on('data', c => t += c); res.on('end', () => resolve({ s: res.statusCode, b: t }));
    });
    r.on('error', reject);
    r.setTimeout(8000, () => { r.destroy(); reject(new Error('timeout')); });
    if (data) r.write(data);
    r.end();
  });
}
exports.handler = async function(event) {
  const h = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: h, body: '' };
  const q = event.queryStringParameters || {};
  if (event.httpMethod === 'GET' && !q.action) {
    try {
      const list = await blobReq('GET', null);
      if (list.s !== 200) return { statusCode: 200, headers: h, body: '[]' };
      const keys = (JSON.parse(list.b).blobs || []).map(b => b.key);
      const items = await Promise.all(keys.map(async k => {
        try { const r = await blobReq('GET', k); return JSON.parse(r.b); } catch(e) { return null; }
      }));
      let out = items.filter(Boolean);
      if (q.status) out = out.filter(x => x.status === q.status);
      out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { statusCode: 200, headers: h, body: JSON.stringify(out) };
    } catch(e) { return { statusCode: 200, headers: h, body: '[]' }; }
  }
  if (event.httpMethod === 'POST') {
    try {
      const x = JSON.parse(event.body);
      x.id = x.id || Date.now().toString();
      x.status = x.status || 'new';
      x.createdAt = x.createdAt || new Date().toISOString();
      await blobReq('PUT', 'listing_' + x.id, x);
      return { statusCode: 200, headers: h, body: JSON.stringify({ ok: true, listing: x }) };
    } catch(e) { return { statusCode: 500, headers: h, body: JSON.stringify({ error: e.message }) }; }
  }
  if (event.httpMethod === 'GET' && q.action && q.id) {
    if (q.adminKey !== ADM) return { statusCode: 401, headers: h, body: JSON.stringify({ error: 'unauthorized' }) };
    try {
      const key = 'listing_' + q.id;
      const ex = await blobReq('GET', key);
      const x = JSON.parse(ex.b);
      if (q.action === 'publish') x.status = 'active';
      else if (q.action === 'unpublish') x.status = 'new';
      else if (q.action === 'sold') x.status = 'sold';
      else if (q.action === 'delete') { await blobReq('DELETE', key); return { statusCode: 200, headers: h, body: JSON.stringify({ ok: true }) }; }
      await blobReq('PUT', key, x);
      return { statusCode: 200, headers: h, body: JSON.stringify({ ok: true, listing: x }) };
    } catch(e) { return { statusCode: 500, headers: h, body: JSON.stringify({ error: e.message }) }; }
  }
  return { statusCode: 400, headers: h, body: JSON.stringify({ error: 'bad request' }) };
};