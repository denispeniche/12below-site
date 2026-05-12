const https = require('https');
exports.handler = async function(event) {
  const h = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers:h,body:''};
  try {
    const {public_token, listing_id, buyer_name, buyer_email} = JSON.parse(event.body);
    
    // Exchange public token for access token
    const exchBody = JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SANDBOX_SECRET,
      public_token
    });
    const exchResult = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'sandbox.plaid.com',
        path: '/item/public_token/exchange',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(exchBody)}
      }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
      req.on('error', reject); req.write(exchBody); req.end();
    });
    
    const {access_token} = JSON.parse(exchResult.body);
    
    // Get auth (routing + account numbers)
    const authBody = JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SANDBOX_SECRET,
      access_token
    });
    const authResult = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'sandbox.plaid.com',
        path: '/auth/get',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(authBody)}
      }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
      req.on('error', reject); req.write(authBody); req.end();
    });
    
    const authData = JSON.parse(authResult.body);
    const account = authData.accounts[0];
    const numbers = authData.numbers.ach[0];
    
    return {statusCode:200, headers:h, body: JSON.stringify({
      ok: true,
      account_id: account.account_id,
      account_name: account.name,
      account_type: account.subtype,
      routing: numbers.routing,
      account_number: numbers.account,
      balance: account.balances.available,
      listing_id,
      buyer_name,
      buyer_email
    })};
  } catch(e) {
    return {statusCode:500, headers:h, body:JSON.stringify({error:e.message})};
  }
};