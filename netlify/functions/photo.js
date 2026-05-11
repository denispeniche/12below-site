const https = require('https');
exports.handler = async function(event) {
  const h = {'Access-Control-Allow-Origin':'*'};
  if (event.httpMethod==='OPTIONS') return {statusCode:200,headers:h,body:''};
  const path = (event.queryStringParameters||{}).path;
  if (!path) return {statusCode:400,headers:h,body:'missing path'};
  const password = process.env.BUNNY_STORAGE_PASSWORD;
  const zone = process.env.BUNNY_STORAGE_ZONE||'12below-cars';
  const region = process.env.BUNNY_STORAGE_REGION||'ny';
  return new Promise(resolve=>{
    const req=https.request({hostname:region+'.storage.bunnycdn.com',path:'/'+zone+'/'+path,method:'GET',headers:{'AccessKey':password}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{
        resolve({statusCode:res.statusCode,headers:{...h,'Content-Type':res.headers['content-type']||'image/jpeg','Cache-Control':'public,max-age=86400'},body:Buffer.concat(chunks).toString('base64'),isBase64Encoded:true});
      });
    });
    req.on('error',e=>resolve({statusCode:500,headers:h,body:e.message}));
    req.setTimeout(10000,()=>{req.destroy();resolve({statusCode:504,headers:h,body:'timeout'});});
    req.end();
  });
};