const { getStore } = require('@netlify/blobs');
const ADM = process.env.ADMIN_KEY || '12below2026admin';
exports.handler = async function(event) {
  const h = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if (event.httpMethod==='OPTIONS') return {statusCode:200,headers:h,body:''};
  const q = event.queryStringParameters || {};
  const store = getStore('listings');
  if (event.httpMethod==='GET' && !q.action) {
    try {
      const {blobs} = await store.list({prefix:'listing_'});
      const items = await Promise.all(blobs.map(async b=>{
        try { return await store.get(b.key,{type:'json'}); } catch(e){return null;}
      }));
      let out = items.filter(Boolean);
      if (q.status) out = out.filter(x=>x.status===q.status);
      out.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      return {statusCode:200,headers:h,body:JSON.stringify(out)};
    } catch(e) { return {statusCode:200,headers:h,body:'[]'}; }
  }
  if (event.httpMethod==='POST') {
    try {
      const x = JSON.parse(event.body);
      x.id = x.id||Date.now().toString();
      x.status = x.status||'new';
      x.createdAt = x.createdAt||new Date().toISOString();
      await store.setJSON('listing_'+x.id, x);
      return {statusCode:200,headers:h,body:JSON.stringify({ok:true,listing:x})};
    } catch(e) { return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})}; }
  }
  if (event.httpMethod==='GET' && q.action && q.id) {
    if (q.adminKey!==ADM) return {statusCode:401,headers:h,body:JSON.stringify({error:'unauthorized'})};
    try {
      const key = 'listing_'+q.id;
      const x = await store.get(key,{type:'json'});
      if (q.action==='publish') x.status='active';
      else if (q.action==='unpublish') x.status='new';
      else if (q.action==='sold') x.status='sold';
      else if (q.action==='delete') { await store.delete(key); return {statusCode:200,headers:h,body:JSON.stringify({ok:true})}; }
      await store.setJSON(key,x);
      return {statusCode:200,headers:h,body:JSON.stringify({ok:true,listing:x})};
    } catch(e) { return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})}; }
  }
  return {statusCode:400,headers:h,body:JSON.stringify({error:'bad request'})};
};