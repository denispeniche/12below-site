// /.netlify/functions/escrow.js
// Handles escrow request creation, lookup, and status updates
// Persists to Airtable EscrowRequests table

const https = require('https');

function airtableReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!token || !baseId) return reject(new Error('Airtable not configured'));
    const options = {
      hostname: 'api.airtable.com',
      path: '/v0/' + baseId + path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) return reject(new Error('Airtable ' + res.statusCode + ': ' + data.substring(0, 300)));
          resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function genTxnId() {
  return 'txn_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(-6);
}

function callNotify(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: process.env.URL ? process.env.URL.replace(/^https?:\/\//, '') : '12belowcars.com',
      path: '/.netlify/functions/notify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({status: res.statusCode, body: data}));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // ===== POST: Create a new escrow request =====
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body || '{}');
      const txn_id = genTxnId();
      const fields = {
        txn_id: txn_id,
        status: 'pending_buyer',
        buyer_name: data.buyer_name || '',
        buyer_email: data.buyer_email || '',
        buyer_phone: data.buyer_phone || '',
        seller_name: data.seller_name || '',
        seller_contact: data.seller_contact || '',
        car_year: data.car_year || '',
        car_make_model: data.car_make_model || '',
        car_price: Number(String(data.car_price || '').replace(/[^0-9.]/g, '')) || 0,
        car_state: data.car_state || 'Maryland',
        listing_source: data.listing_source || '',
        notes: data.notes || '',
        created_at: new Date().toISOString()
      };
      const created = await airtableReq('POST', '/EscrowRequests', { fields: fields });

      // Build verification URL
      const baseUrl = process.env.URL || 'https://12belowcars.com';
      const verifyUrl = baseUrl + '/escrow/verify/?t=' + txn_id;

      // Fire-and-forget emails. Don't block response on email success.
      callNotify({
        type: 'escrow_buyer_verify',
        data: {
          buyer_name: fields.buyer_name,
          buyer_email: fields.buyer_email,
          car_summary: (fields.car_year + ' ' + fields.car_make_model).trim() || 'your car',
          car_price: fields.car_price,
          verify_url: verifyUrl,
          txn_id: txn_id
        }
      }).catch(() => {});

      callNotify({
        type: 'escrow_admin_notification',
        data: Object.assign({}, fields, { admin_url: baseUrl + '/admin/escrow/?t=' + txn_id })
      }).catch(() => {});

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, txn_id: txn_id }) };
    }

    // ===== GET: Look up a transaction by token =====
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const txn_id = params.t;
            // ===== LIST (admin only) or password CHECK =====
      if (params.list === '1' || txn_id === '__check__') {
        const adminKey = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
        if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
        if (txn_id === '__check__') {
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
        }
        const all = await airtableReq('GET', '/EscrowRequests?sort[0][field]=created_at&sort[0][direction]=desc&maxRecords=100', null);
        return { statusCode: 200, headers, body: JSON.stringify(all.records || []) };
      }

      if (!txn_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing token' }) };

      // Search by txn_id
      const filter = encodeURIComponent("{txn_id}='" + txn_id + "'");
      const result = await airtableReq('GET', '/EscrowRequests?filterByFormula=' + filter + '&maxRecords=1', null);
      if (!result.records || result.records.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
      }
      const r = result.records[0];
      const f = r.fields || {};

      // ADMIN VIEW (with X-Admin-Key header) gets all fields including PII
      const adminKey = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
      const isAdmin = adminKey && adminKey === process.env.ADMIN_KEY;

      const publicFields = {
        txn_id: f.txn_id,
        status: f.status,
        car_year: f.car_year,
        car_make_model: f.car_make_model,
        car_price: f.car_price,
        car_state: f.car_state,
        buyer_name: f.buyer_name,
        buyer_verified: f.buyer_verified || false,
        seller_verified: f.seller_verified || false
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(isAdmin ? Object.assign({ record_id: r.id }, f) : publicFields)
      };
    }

    // ===== PUT: Update a transaction (mark verified, save plaid token, etc.) =====
    if (event.httpMethod === 'PUT') {
      const data = JSON.parse(event.body || '{}');
      const txn_id = data.txn_id;
      if (!txn_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing txn_id' }) };

      // Find record id
      const filter = encodeURIComponent("{txn_id}='" + txn_id + "'");
      const result = await airtableReq('GET', '/EscrowRequests?filterByFormula=' + filter + '&maxRecords=1', null);
      if (!result.records || result.records.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
      }
      const record_id = result.records[0].id;
      const existing = result.records[0].fields || {};

      // Allowed updates
      const updates = {};
      const role = data.role; // 'buyer' or 'seller'
      if (data.verify === true && (role === 'buyer' || role === 'seller')) {
        updates[role + '_verified'] = true;
        if (data.plaid_token) updates[role + '_plaid_token'] = data.plaid_token;
      }

      // Auto-update status when both verified
      if (role === 'buyer' && updates.buyer_verified) {
        if (existing.seller_verified) updates.status = 'both_verified';
        else updates.status = 'pending_seller';
      }
      if (role === 'seller' && updates.seller_verified) {
        if (existing.buyer_verified) updates.status = 'both_verified';
      }

      // Admin-only updates
      const adminKey = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
      const isAdmin = adminKey && adminKey === process.env.ADMIN_KEY;
      if (isAdmin) {
        if (data.status) updates.status = data.status;
        if (data.send_seller_link === true) {
          // Send seller verification email
          const baseUrl = process.env.URL || 'https://12belowcars.com';
          const sellerVerifyUrl = baseUrl + '/escrow/verify/?t=' + txn_id + '&r=seller';
          callNotify({
            type: 'escrow_seller_verify',
            data: {
              seller_name: existing.seller_name || 'Seller',
              seller_email: existing.seller_contact,
              buyer_name: existing.buyer_name,
              car_summary: ((existing.car_year || '') + ' ' + (existing.car_make_model || '')).trim() || 'a car',
              car_price: existing.car_price,
              verify_url: sellerVerifyUrl,
              txn_id: txn_id
            }
          }).catch(() => {});
        }
      }

      if (Object.keys(updates).length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, updated: false }) };
      }

      await airtableReq('PATCH', '/EscrowRequests/' + record_id, { fields: updates });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, updates: updates }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
