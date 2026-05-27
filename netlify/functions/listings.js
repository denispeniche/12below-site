const https = require('https');

const TOKEN = process.env.AIRTABLE_TOKEN || '';
const BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE = process.env.AIRTABLE_TABLE || 'Listings';
const ADM = process.env.ADMIN_KEY || '12below2026admin';

function ar(method, path, body) {
  return new Promise(function(resolve, reject) {
    const url = 'https://api.airtable.com/v0/' + BASE_ID + '/' + path;
    const opts = {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(url, opts, function(res) {
      let data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({status: res.statusCode, data: data ? JSON.parse(data) : null}); }
        catch(e) { resolve({status: res.statusCode, data: data}); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function fromAirtable(rec) {
  const f = rec.fields || {};
  const photos = (f['Photos'] || '').split('\n').filter(function(p) { return p && p.trim(); });
  return {
    id: rec.id,
    vin: f['VIN'] || '',
    status: f['Status'] || 'pending',
    year: f['Year'] || '',
    make: f['Make'] || '',
    model: f['Model'] || '',
    trim: f['Trim'] || '',
    mileage: f['Mileage'] || 0,
    condition: f['Condition'] || '',
    askingPrice: f['Asking Price'] || 0,
    marketValue: f['Market Value'] || 0,
    photos: photos,
    name: f['Seller Name'] || '',
    email: f['Seller Email'] || '',
    phone: f['Seller Phone'] || '',
    location: f['Location'] || '',
    zip: f['Zip'] || '',
    notes: f['Notes'] || '',
    createdAt: rec.createdTime || ''
  };
}

function toAirtable(body) {
  return {
    'VIN': body.vin || '',
    'Status': body.status || 'pending',
    'Vehicle': [body.year, body.make, body.model].filter(Boolean).join(' '),
    'Year': String(body.year || ''),
    'Make': String(body.make || ''),
    'Model': String(body.model || ''),
    'Trim': String(body.trim || ''),
    'Mileage': Number(body.mileage) || 0,
    'Condition': body.condition || '',
    'Asking Price': Number(body.askingPrice) || 0,
    'Market Value': Number(body.marketValue) || 0,
    'Photos': (body.photos || []).join('\n'),
    'Seller Name': String(body.name || ''),
    'Seller Email': String(body.email || ''),
    'Seller Phone': String(body.phone || ''),
    'Location': String(body.location || ''),
    'Zip': String(body.zip || ''),
    'Notes': String(body.notes || '')
  };
}

exports.handler = async function(event) {
  const H = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return {statusCode: 200, headers: H, body: ''};
  if (!TOKEN || !BASE_ID) return {statusCode: 500, headers: H, body: JSON.stringify({error: 'AIRTABLE config missing'})};

  try {
    const q = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      // Fetch all then filter in code — robust to legacy status values
      // ('new', empty, mixed case) that Airtable's filterByFormula doesn't handle.
      const res = await ar('GET', TABLE + '?pageSize=100');
      if (res.status !== 200) return {statusCode: res.status, headers: H, body: JSON.stringify(res.data)};
      let records = (res.data.records || []).map(fromAirtable);

      if (q.status) {
        const target = String(q.status).toLowerCase();
        records = records.filter(function(r) {
          const s = String(r.status || '').toLowerCase();
          // ?status=active  -> show anything NOT explicitly inactive or pending
          //                    (so legacy 'new', empty, etc. are public by default)
          if (target === 'active') return s !== 'inactive' && s !== 'pending';
          // ?status=inactive / pending / new etc. -> exact (case-insensitive) match
          return s === target;
        });
      }

      records.sort(function(a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      return {statusCode: 200, headers: H, body: JSON.stringify(records)};
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      // Auto-publish: new listings go live immediately. Moderation happens
      // post-fact via the admin Unpublish/Delete buttons.
      if (!body.status) body.status = 'active';
      const res = await ar('POST', TABLE, {records: [{fields: toAirtable(body)}], typecast: true});
      if (res.status !== 200) return {statusCode: res.status, headers: H, body: JSON.stringify(res.data)};
      return {statusCode: 200, headers: H, body: JSON.stringify(fromAirtable(res.data.records[0]))};
    }

    const adminKey = (event.headers && (event.headers['x-admin-key'] || event.headers['X-Admin-Key'])) || q.admin_key || q.adminKey;
    if (adminKey !== ADM) return {statusCode: 401, headers: H, body: JSON.stringify({error: 'unauthorized'})};

    const recId = q.id || (event.body ? (JSON.parse(event.body).id || '') : '');
    if (!recId) return {statusCode: 400, headers: H, body: JSON.stringify({error: 'id required'})};

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const fields = {};
      if (body.status !== undefined) fields['Status'] = body.status;
      if (body.notes !== undefined) fields['Notes'] = body.notes;
      if (body.askingPrice !== undefined) fields['Asking Price'] = Number(body.askingPrice);
      if (body.photos !== undefined) fields['Photos'] = (body.photos || []).join('\n');
      const res = await ar('PATCH', TABLE + '/' + recId, {fields: fields, typecast: true});
      if (res.status !== 200) return {statusCode: res.status, headers: H, body: JSON.stringify(res.data)};
      return {statusCode: 200, headers: H, body: JSON.stringify(fromAirtable(res.data))};
    }

    if (event.httpMethod === 'DELETE') {
      const res = await ar('DELETE', TABLE + '/' + recId);
      return {statusCode: res.status, headers: H, body: JSON.stringify(res.data)};
    }

    return {statusCode: 405, headers: H, body: JSON.stringify({error: 'method not allowed'})};
  } catch(e) {
    return {statusCode: 500, headers: H, body: JSON.stringify({error: e.message})};
  }
};
