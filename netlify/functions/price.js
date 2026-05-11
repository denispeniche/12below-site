const https = require('https');

exports.handler = async function(event) {
  const h = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };

  const q = event.queryStringParameters || {};
  const { vin, miles, zip } = q;
  const key = process.env.MARKETCHECK_API_KEY;
  if (!key) return { statusCode: 200, headers: h, body: JSON.stringify({ error: 'API key not configured' }) };
  if (!vin || !miles || !zip) return { statusCode: 200, headers: h, body: JSON.stringify({ error: 'vin, miles, zip required' }) };

  const path = '/v2/predict/car/us/marketcheck_price?api_key=' + key +
    '&vin=' + encodeURIComponent(vin) +
    '&miles=' + encodeURIComponent(miles) +
    '&dealer_type=independent&zip=' + encodeURIComponent(zip) + '&is_certified=false';

  return new Promise(function(resolve) {
    const req = https.request({
      hostname: 'api.marketcheck.com', port: 443, path: path, method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, function(res) {
      let body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try {
          const d = JSON.parse(body);
          if (d.marketcheck_price) {
            resolve({ statusCode: 200, headers: h, body: JSON.stringify({ marketcheck_price: d.marketcheck_price, msrp: d.msrp || 0 }) });
          } else {
            resolve({ statusCode: 200, headers: h, body: JSON.stringify({ error: body.substring(0, 300) }) });
          }
        } catch(e) {
          resolve({ statusCode: 200, headers: h, body: JSON.stringify({ error: 'parse:' + e.message }) });
        }
      });
    });
    req.on('error', function(e) { resolve({ statusCode: 200, headers: h, body: JSON.stringify({ error: e.message }) }); });
    req.setTimeout(12000, function() { req.destroy(); resolve({ statusCode: 200, headers: h, body: JSON.stringify({ error: 'timeout' }) }); });
    req.end();
  });
};