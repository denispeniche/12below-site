const https = require('https');

function sendEmail(to, subject, html) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: process.env.FROM_EMAIL || 'hello@12below.net',
      to,
      subject,
      html
    });
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({status: res.statusCode, body: d}));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  const h = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers:h,body:''};
  
  try {
    const {type, seller_email, seller_name, buyer_name, buyer_email, car, price, offer_id} = JSON.parse(event.body);
    const fee = 299;
    const seller_receives = price - fee;
    const base_url = 'https://12below.net';
    
    if(type === 'offer_received') {
      // Email to SELLER
      const sellerHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#1a3afa,#1228c8);padding:32px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;margin-bottom:4px;">12Below</div>
      <div style="color:rgba(255,255,255,.8);font-size:14px;">Secure Car Marketplace</div>
    </div>
    <div style="padding:32px;">
      <div style="font-size:22px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">Great news, ${seller_name}!</div>
      <div style="font-size:15px;color:#555;margin-bottom:28px;">Someone wants to buy your <strong>${car}</strong>. Review the offer below.</div>
      
      <div style="background:#f8f9ff;border-radius:14px;padding:24px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px;">Sale Summary</div>
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #ebebf0;font-size:15px;">
          <span style="color:#555;">Buyer's payment</span>
          <span style="font-weight:700;color:#1a1a2e;">$${Number(price).toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #ebebf0;font-size:15px;">
          <span style="color:#555;">12Below success fee</span>
          <span style="font-weight:700;color:#f87171;">- $${fee}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px;">
          <span style="font-weight:700;color:#1a1a2e;">You receive</span>
          <span style="font-weight:800;color:#22c55e;">$${Number(seller_receives).toLocaleString()}</span>
        </div>
      </div>

      <div style="background:#fff8e1;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#92400e;">
        <strong>Note:</strong> Buyer is responsible for paying Maryland title tax (6%) directly at the MVA upon title transfer.
      </div>

      <div style="margin-bottom:12px;">
        <a href="${base_url}/confirm?offer=${offer_id}&action=confirm" 
           style="display:block;background:#22c55e;color:#fff;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;margin-bottom:10px;">
          ✅ Confirm Sale — Receive $${Number(seller_receives).toLocaleString()}
        </a>
        <a href="${base_url}/confirm?offer=${offer_id}&action=decline"
           style="display:block;background:#f4f5f7;color:#666;text-align:center;padding:14px;border-radius:12px;font-weight:600;font-size:14px;text-decoration:none;">
          Decline Offer
        </a>
      </div>
      
      <div style="font-size:12px;color:#aaa;text-align:center;margin-top:20px;">
        Questions? Reply to this email or contact hello@12below.net
      </div>
    </div>
  </div>
</body>
</html>`;

      await sendEmail(seller_email, 'You have an offer on your ' + car + '!', sellerHtml);

      // Email to BUYER confirming escrow
      const buyerHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#1a3afa,#1228c8);padding:32px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;margin-bottom:4px;">12Below</div>
      <div style="color:rgba(255,255,255,.8);font-size:14px;">Secure Car Marketplace</div>
    </div>
    <div style="padding:32px;">
      <div style="font-size:22px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">Your funds are secured, ${buyer_name}!</div>
      <div style="font-size:15px;color:#555;margin-bottom:28px;">
        Your payment of <strong>$${Number(price).toLocaleString()}</strong> for the <strong>${car}</strong> is now held safely in escrow. The seller has been notified.
      </div>
      
      <div style="background:#e8f5e9;border-radius:14px;padding:24px;margin-bottom:24px;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">🔒</div>
        <div style="font-size:24px;font-weight:800;color:#166534;">$${Number(price).toLocaleString()}</div>
        <div style="font-size:13px;color:#166534;font-weight:600;">Secured in escrow</div>
      </div>

      <div style="background:#f0f4ff;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-weight:700;margin-bottom:12px;color:#1a1a2e;">What happens next:</div>
        <div style="font-size:14px;color:#555;line-height:2;">
          ✅ Contact the seller to arrange viewing<br>
          ✅ Inspect the car thoroughly<br>
          ✅ Get the keys and signed title<br>
          ✅ Confirm receipt — seller gets paid
        </div>
      </div>

      <div style="background:#fff8e1;border-radius:10px;padding:14px 18px;font-size:13px;color:#92400e;">
        <strong>Important:</strong> You'll need to pay Maryland title tax (6% = $${Number(price * 0.06).toLocaleString()}) directly at the MVA when transferring the title.
      </div>

      <div style="font-size:12px;color:#aaa;text-align:center;margin-top:20px;">
        Questions? Reply to this email or contact hello@12below.net
      </div>
    </div>
  </div>
</body>
</html>`;

      await sendEmail(buyer_email, 'Your funds are secured — ' + car, buyerHtml);

      return {statusCode:200, headers:h, body:JSON.stringify({ok:true, message:'Emails sent to seller and buyer'})};
    }

    if(type === 'sale_confirmed') {
      // Email to buyer that seller confirmed
      const confirmedHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#1a3afa,#1228c8);padding:32px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;">12Below</div>
    </div>
    <div style="padding:32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">🎉</div>
      <div style="font-size:22px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">Sale confirmed!</div>
      <div style="font-size:15px;color:#555;margin-bottom:24px;">The seller has confirmed. Funds will be released within 1-2 business days.</div>
      <div style="font-size:12px;color:#aaa;">Questions? contact hello@12below.net</div>
    </div>
  </div>
</body>
</html>`;
      await sendEmail(buyer_email, 'Sale confirmed — ' + car, confirmedHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({ok:true})};
    }

    return {statusCode:400, headers:h, body:JSON.stringify({error:'unknown type'})};
  } catch(e) {
    return {statusCode:500, headers:h, body:JSON.stringify({error:e.message})};
  }
};