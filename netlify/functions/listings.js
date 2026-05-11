const https = require('https');
const SITE_ID = '10cb2e1f-2dbd-4fdf-af97-10185ee51738';
const ADMIN_KEY = process.env.ADMIN_KEY || '12below2026admin';
function blobReq(method, key, body) {
  return new Promise((resolve, reject) => {
    const tok = process.env.NF_API_TOKEN;
    const data = body ? JSON.stringify(body) : null;
    const p = '/api/v1/blobs/' + SITE_ID + '/listings' + (key ? '/' + key : '?prefix=listing_');
    const opts = {hostname:'api.netlify.com',path:p,method,headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json'}};
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(opts, res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>resolve({status:res.statusCode,body:t}));});
    r.on('error',reject);r.setTimeout(8000,()=>{r.destroy();reject(new Error('timeout'));});
    if(data)r.write(data);r.end();
  });
}
exports.handler = async function(event) {
  const h={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if(event.httpMethod==='OPTIONS')return{statusCode:200,headers:h,body:''};
  const q=event.queryStringParameters||{};
  if(event.httpMethod==='GET'&&!q.action){
    try{
      const list=await blobReq('GET',null);
      if(list.status!==200)return{statusCode:200,headers:h,body:'[]'};
      const keys=(JSON.parse(list.body).blobs||[]).map(b=>b.key);
      const items=await Promise.all(keys.map(async k=>{try{const r=await blobReq('GET',k);return JSON.parse(r.body);}catch(e){return null;}}));
      let results=items.filter(Boolean);
      if(q.status)results=results.filter(l=>l.status===q.status);
      results.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      return{statusCode:200,headers:h,body:JSON.stringify(results)};
    }catch(e){return{statusCode:200,headers:h,body:'[]'};}
  }
  if(event.httpMethod==='POST'){
    try{
      const listing=JSON.parse(event.body);
      listing.id=listing.id||Date.now().toString();listing.status=listing.status||'new';listing.createdAt=listing.createdAt||new Date().toISOString();
      await blobReq('PUT','listing_'+listing.id,listing);
      return{statusCode:200,headers:h,body:JSON.stringify({ok:true,listing})};
    }catch(e){return{statusCode:500,headers:h,body:JSON.stringify({error:e.message})};}
  }
  if(event.httpMethod==='GET'&&q.action&&q.id){
    if(q.adminKey!==ADMIN_KEY)return{statusCode:401,headers:h,body:JSON.stringify({error:'unauthorized'})};
    try{
      const key='listing_'+q.id;
      const ex=await blobReq('GET',key);const listing=JSON.parse(ex.body);
      if(q.action==='publish')listing.status='active';
      else if(q.action==='unpublish')listing.status='new';
      else if(q.action==='sold')listing.status='sold';
      else if(q.action==='delete'){await blobReq('DELETE',key);return{statusCode:200,headers:h,body:JSON.stringify({ok:true})};}
      await blobReq('PUT',key,listing);
      return{statusCode:200,headers:h,body:JSON.stringify({ok:true,listing})};
    }catch(e){return{statusCode:500,headers:h,body:JSON.stringify({error:e.message})};}
  }
  return{statusCode:400,headers:h,body:JSON.stringify({error:'bad request'})};
};