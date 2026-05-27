// Get a "real market price" for a vehicle.
// Primary: MarketCheck Price API (ML prediction by VIN). Best when MarketCheck
//   can decode the VIN — usually works for newer / common vehicles.
// Fallback: MarketCheck active-listings search using year/make/model + mileage
//   band. Mean of currently-listed prices. Used when the VIN-based prediction
//   fails (older car, uncommon trim, etc).
//
// Designed to stay well under Netlify Functions' 10-second timeout:
// - Max 3 search attempts after the predict call
// - Per-request timeout of 4 seconds
// - Whole handler wrapped in try/catch so we always return a JSON error
//   (and never let Netlify wrap it with "Something went wrong")

const https = require('https');

function httpGet(path, timeoutMs) {
  const t = timeoutMs || 4000;
  return new Promise(function(resolve) {
    let settled = false;
    const safeResolve = function(v) { if (!settled) { settled = true; resolve(v); } };
    const req = https.request({
      hostname: 'api.marketcheck.com', port: 443, path: path, method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, function(res) {
      let body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try { safeResolve({ status: res.statusCode, data: JSON.parse(body), raw: body }); }
        catch(e) { safeResolve({ status: res.statusCode, data: null, raw: body, parseError: e.message }); }
      });
    });
    req.on('error', function(e) { safeResolve({ status: 0, data: null, raw: '', error: e.message }); });
    req.setTimeout(t, function() { req.destroy(); safeResolve({ status: 0, data: null, raw: '', error: 'timeout' }); });
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
  const trimN = Math.floor(prices.length * 0.1);
  const trimmed = prices.length > 10 ? prices.slice(trimN, prices.length - trimN) : prices;
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

  try {
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

    const predictResp = await httpGet(predictPath, 5000);
    if (predictResp.data && predictResp.data.marketcheck_price) {
      return {
        statusCode: 200, headers: h,
        body: JSON.stringify({
          marketcheck_price: predictResp.data.marketcheck_price,
          msrp: predictResp.data.msrp || 0,
          source: 'predict'
        })
      };
    }

    // ---- Attempt 2: Active-listings search (year/make/model + mileage band) ----
    // Max 3 calls, each with 3s timeout. Total worst case ~9s, safely under 10s.
    if (year && make && model) {
      const milesNum = parseInt(miles, 10) || 0;

      function buildSearch(opts) {
        let url = '/v2/search/car/active?api_key=' + key +
          '&year=' + encodeURIComponent(year) +
          '&make=' + encodeURIComponent(make) +
          '&model=' + encodeURIComponent(model) +
          '&rows=50&car_type=used';
        if (opts.zip)  url += '&zip=' + encodeURIComponent(opts.zip) + '&radius=200';
        if (opts.trim) url += '&trim=' + encodeURIComponent(opts.trim);
        if (opts.milesBand && milesNum > 0) {
          const lo = Math.max(0, milesNum - opts.milesBand);
          const hi = milesNum + opts.milesBand;
          url += '&miles_range=' + lo + '-' + hi;
        }
        return url;
      }

      const attempts = [
        { zip: zip,  trim: trim, milesBand: 25000, minCount: 3 },  // best: regional, same trim, similar miles
        { zip: zip,  trim: null, milesBand: 50000, minCount: 3 },  // broaden: drop trim, wider mileage
        { zip: null, trim: null, milesBand: 50000, minCount: 1 }   // nationwide, mileage-aware
      ];

      let mean = 0, numFound = 0, usedBand = null, lastResp = null;
      for (let i = 0; i < attempts.length; i++) {
        const a = attempts[i];
        lastResp = await httpGet(buildSearch(a), 3000);
        const listings = (lastResp.data && Array.isArray(lastResp.data.listings)) ? lastResp.data.listings : [];
        if (listings.length >= a.minCount) {
          mean = meanPriceFromListings(listings);
          numFound = (lastResp.data && lastResp.data.num_found) ? lastResp.data.num_found : listings.length;
          usedBand = a.milesBand;
          if (mean > 0) break;
        }
      }

      if (mean > 0) {
        return {
          statusCode: 200, headers: h,
          body: JSON.stringify({
            marketcheck_price: mean,
            msrp: 0,
            source: 'comparables',
            comparables_count: numFound,
            miles_band: usedBand
          })
        };
      }
    }

    // ---- Both attempts failed: return the best available error ----
    let errMsg = 'Could not determine market price for this vehicle.';
    if (predictResp.data && predictResp.data.message) {
      errMsg = typeof predictResp.data.message === 'string'
        ? predictResp.data.message
        : (predictResp.data.message.detail || JSON.stringify(predictResp.data.message));
    } else if (predictResp.error) {
      errMsg = predictResp.error;
    } else if (predictResp.raw) {
      errMsg = predictResp.raw.substring(0, 200);
    }
    return { statusCode: 200, headers: h, body: JSON.stringify({ error: errMsg }) };

  } catch (err) {
    // Always return JSON — never let Netlify wrap us with "Something went wrong"
    return {
      statusCode: 200, headers: h,
      body: JSON.stringify({ error: 'Internal: ' + (err && err.message ? err.message : 'unknown') })
    };
  }
};
