const https = require('https');
const SITE = '10cb2e1f-2dbd-4fdf-af97-10185ee51738';
function getToken(){const a=process.env.NF_TOK_A||'';const b=process.env.NF_TOK_B||'';return a+b;}
function put(key,body){
  return new Promise((res,rej)=>{
    const data=JSON.stringify(body);
    const opts={hostname:'api.netlify.com',path:'/api/v1/blobs/'+SITE+'/listings/'+key,method:'PUT',headers:{'Authorization':'Bearer '+getToken(),'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
    const r=https.request(opts,x=>{let t='';x.on('data',c=>t+=c);x.on('end',()=>res({s:x.statusCode,b:t}));});
    r.on('error',rej);r.setTimeout(8000,()=>{r.destroy();rej(new Error('timeout'));});r.write(data);r.end();
  });
}
exports.handler = async function(event) {
  const h={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  const bmw={id:'1778537365555',make:'BMW',model:'X3',year:'2019',mileage:'70000',condition:'excellent',askingPrice:17100,marketValue:19400,name:'Denis',email:'denispeniche@gmail.com',phone:'2405654169',location:'Ellicott City, MD',zip:'21043',vin:'5UXTR9C57KLP95322',notes:'',photos:[],status:'active',createdAt:'2026-05-11T22:09:36.000Z'};
  try {
    const r = await put('listing_'+bmw.id, bmw);
    return {statusCode:200,headers:h,body:JSON.stringify({ok:true,status:r.s})};
  } catch(e) {
    return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})};
  }
};