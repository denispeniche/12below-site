// Get a "real market price" for a vehicle.
// Primary: MarketCheck Price API (ML prediction by VIN). Best when MarketCheck
//   can decode the VIN — usually works for newer / common vehicles.
// Fallback: MarketCheck active-listings search using year/make/model. Computes
//   the mean of currently-listed prices within a 200-mile radius. Always works
//   for common cars; gives a fair "what cars like this are actually listed for
//   right now" number for older or less-common vehicles where the predictor fails.

const https = require('https');

function httpGet(path) {
  return new Promise(function(resolve) {
    const req = https.request({
      hostname: 'api.marketcheck.com', port: 443, path: path, method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, function(res) {
      let body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(body), raw: body }); }
        catch(e) { resolve({ status: res.statusCode, data: null, raw: body, parseError: e.message }); }
      });
    });
    req.on('error', function(e) { resolve({ status: 0, data: null, raw: '', error: e.message }); });
    req.setTimeout(12000, function() { req.destroy(); resolve({ status: 0, data: null, raw: '', error: 'timeout' }); });
    req.end();
  });
}

function meanPriceFromListings(listings) {
  if (!Array.isArray(listings) || listings.length === 0) return 0;
  const prices = listings
    .map(function(l){ return Number(l && l.price); })
    .filter(function(p){ return Number.isFinite(p) && p > 1000 && p < 500000; });
  if (prices.length === 0) return 0;
  prices.sort(function(a,b){ return a - b; });
  // Trim 10% from each end to drop extreme outliers (salvage / mispriced)
  const trim = Math.floor(prices.length * 0.1);
  const trimmed = prices.length > 10 ? prices.slice(trim, prices.length - trim) : prices;
  const sum = trimmed.reduce(function(s,v){ return s + v; }, 0);
  return Math.round(sum / trimmed.length);
}

exports.handler = async function(event) {
  const h = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };

  const q = event.queryStringParameters || {};
  const vin = q.vin, miles = q.miles, zip = q.zip;
  const year = q.year, make = q.make, model = q.model, trim = q.trim;
  const key = process.env.MARKETCHECK_API_KEY;

  if (!key) return { statusCode: 200, headers: h, body: JSON.stringify({ error: 'API key not configured' }) };
  if (!vin || !miles || !zip) return { statusCode: 200, headers: h, body: JSON.stringify({ error: 'vin, miles, zip required' }) };

  // ---- Attempt 1: VIN-based prediction (MarketCheck Price) ----
  const predictPath = '/v2/predict/car/us/marketcheck_price?api_key=' + key +
    '&vin=' + encodeURIComponent(vin) +
    '&miles=' + encodeURIComponent(miles) +
    '&dealer_type=independent&zip=' + encodeURIComponent(zip) + '&is_certified=false';

  const p = await httpGet(predictPath);
  if (p.data && p.data.marketcheck_price) {
    return {
      statusCode: 200, headers: h,
      body: JSON.stringify({
        marketcheck_price: p.data.marketcheck_price,
        msrp: p.data.msrp || 0,
        source: 'predict'
      })
    };
  }

  // ---- Attempt 2: Active-listings search fallback (year/make/model) ----
  if (year && make && model) {
    let searchPath = '/v2/search/car/active?api_key=' + key +
      '&year=' + encodeURIComponent(year) +
      '&make=' + encodeURIComponent(make) +
      '&model=' + encodeURIComponent(model) +
      '&zip=' + encodeURIComponent(zip) +
      '&radius=200&rows=50&car_type=used';
    if (trim) searchPath += '&trim=' + encodeURIComponent(trim);

    let s = await httpGet(searchPath);
    let mean = (s.data && Array.isArray(s.data.listings)) ? meanPriceFromListings(s.data.listings) : 0;

    // If no listings found with trim, retry without trim (broader match)
    if (mean === 0 && trim) {
      const broaderPath = '/v2/search/car/active?api_key=' + key +
        '&year=' + encodeURIComponent(year) +
        '&make=' + encodeURIComponent(make) +
        '&model=' + encodeURIComponent(model) +
        '&zip=' + encodeURIComponent(zip) +
        '&radius=200&rows=50&car_type=used';
      s = await httpGet(broaderPath);
      mean = (s.data && Array.isArray(s.data.listings)) ? meanPriceFromListings(s.data.listings) : 0;
    }

    // If still nothing, try expanding to nationwide
    if (mean === 0) {
      const natlPath = '/v2/search/car/active?api_key=' + key +
        '&year=' + encodeURIComponent(year) +
        '&make=' + encodeURIComponent(make) +
        '&model=' + encodeURIComponent(model) +
        '&rows=50&car_type=used';
      s = await httpGet(natlPath);
      mean = (s.data && Array.isArray(s.data.listings)) ? meanPriceFromListings(s.data.listings) : 0;
    }

    if (mean > 0) {
      const numFound = (s.data && s.data.num_found) ? s.data.num_found : (s.data.listings ? s.data.listings.length : 0);
      return {
        statusCode: 200, headers: h,
        body: JSON.stringify({
          marketcheck_price: mean,
          msrp: 0,
          source: 'comparables',
          comparables_count: numFound
        })
      };
    }
  }

  // ---- Both attempts failed: return the best available error ----
  let errMsg = 'Could not determine market price for this vehicle.';
  if (p.data && p.data.message) {
    errMsg = typeof p.data.message === 'string'
      ? p.data.message
      : (p.data.message.detail || JSON.stringify(p.data.message));
  } else if (p.raw) {
    errMsg = p.raw.substring(0, 200);
  }
  return { statusCode: 200, headers: h, body: JSON.stringify({ error: errMsg }) };
};
