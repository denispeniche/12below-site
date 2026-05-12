const https = require('https');

function dwollaReq(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api-sandbox.dwolla.com',
      path, method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/vnd.dwolla.v1.hal+json',
        'Accept': 'application/vnd.dwolla.v1.hal+json'
      }
    };
    if(data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d+=c); res.on('end', ()=>resolve({status:res.statusCode,body:d,headers:res.headers}));
    });
    req.on('error', reject);
    if(data) req.write(data);
    req.end();
  });
}

async function getToken() {
  const creds = Buffer.from(process.env.DWOLLA_KEY+':'+process.env.DWOLLA_SECRET).toString('base64');
  return new Promise((resolve, reject) => {
    const body = 'grant_type=client_credentials';
    const req = https.request({
      hostname: 'api-sandbox.dwolla.com',
      path: '/token', method: 'POST',
      headers: {
        'Authorization': 'Basic '+creds,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d).access_token)); });
    req.on('error', reject); req.write(body); req.end();
  });
}

exports.handler = async function(event) {
  const h = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers:h,body:''};
  
  try {
    const {action, listing_id, amount, buyer_name, buyer_email, routing, account_number} = JSON.parse(event.body||'{}');
    const token = await getToken();
    
    if(action === 'create_customer') {
      // Create a Dwolla customer for the buyer
      const result = await dwollaReq('/customers', 'POST', {
        firstName: buyer_name.split(' ')[0] || buyer_name,
        lastName: buyer_name.split(' ')[1] || 'User',
        email: buyer_email,
        type: 'personal'
      }, token);
      const location = result.headers.location || '';
      const customer_id = location.split('/').pop();
      return {statusCode:200,headers:h,body:JSON.stringify({ok:true,customer_id,location})};
    }
    
    if(action === 'status') {
      // Get account info
      const result = await dwollaReq('/accounts', 'GET', null, token);
      return {statusCode:200,headers:h,body:result.body};
    }
    
    return {statusCode:400,headers:h,body:JSON.stringify({error:'unknown action'})};
  } catch(e) {
    return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})};
  }
};