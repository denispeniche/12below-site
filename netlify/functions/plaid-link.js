const https = require('https');
exports.handler = async function(event) {
  const h = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers:h,body:''};
  try {
    const body = JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SANDBOX_SECRET,
      client_name: '12Below',
      country_codes: ['US'],
      language: 'en',
      products: ['auth'],
      user: { client_user_id: Date.now().toString() }
    });
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'sandbox.plaid.com',
        path: '/link/token/create',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({status: res.statusCode, body: data}));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
      req.write(body);
      req.end();
    });
    return {statusCode: result.status, headers: h, body: result.body};
  } catch(e) {
    return {statusCode:500, headers:h, body:JSON.stringify({error:e.message})};
  }
};