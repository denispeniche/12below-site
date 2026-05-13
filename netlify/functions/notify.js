const https = require('https');

function sendEmail(to, subject, htmlBody) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: to,
      subject: subject,
      html: htmlBody
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
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({status: res.statusCode, body: d}));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  const h = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if(event.httpMethod === 'OPTIONS') return {statusCode:200,headers:h,body:''};

  try {
    const data = JSON.parse(event.body);
    const type = data.type;
    const sellerEmail = data.seller_email;
    const sellerName = data.seller_name || 'Seller';
    const buyerName = data.buyer_name || 'Buyer';
    const buyerEmail = data.buyer_email;
    const car = data.car;
    const price = Number(data.price);
    const offerId = data.offer_id;
    const fee = 299;
    const sellerReceives = price - fee;
    const baseUrl = 'https://12below.net';
    const fmt = function(n){ return Number(n).toLocaleString(); };

    if(type === 'offer_received') {
      const confirmUrl = baseUrl + '/confirm?offer=' + offerId +
        '&price=' + price +
        '&car=' + encodeURIComponent(car) +
        '&seller_email=' + encodeURIComponent(sellerEmail) +
        '&buyer_name=' + encodeURIComponent(buyerName) +
        '&buyer_email=' + encodeURIComponent(buyerEmail);

      const sellerHtml = '<html><body style="font-family:Arial,sans-serif;background:#f4f5f7;margin:0;padding:0;">' +
        '<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg,#1a3afa,#1228c8);padding:32px;text-align:center;">' +
        '<div style="font-size:28px;font-weight:800;color:#fff;">12Below</div>' +
        '<div style="color:rgba(255,255,255,.8);font-size:14px;">Secure Car Marketplace</div></div>' +
        '<div style="padding:32px;">' +
        '<h2 style="color:#1a1a2e;margin-bottom:8px;">Great news, ' + sellerName + '!</h2>' +
        '<p style="color:#555;margin-bottom:28px;">Someone wants to buy your <strong>' + car + '</strong>.</p>' +
        '<div style="background:#f8f9ff;border-radius:14px;padding:24px;margin-bottom:24px;">' +
        '<div style="font-weight:700;color:#888;font-size:13px;text-transform:uppercase;margin-bottom:16px;">Sale Summary</div>' +
        '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #ebebf0;">' +
        '<span style="color:#555;">Buyer payment</span><span style="font-weight:700;">$' + fmt(price) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #ebebf0;">' +
        '<span style="color:#555;">12Below success fee</span><span style="font-weight:700;color:#f87171;">- $' + fee + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:12px 0;">' +
        '<span style="font-weight:700;color:#1a1a2e;">You receive</span><span style="font-weight:800;color:#22c55e;font-size:18px;">$' + fmt(sellerReceives) + '</span></div></div>' +
        '<div style="background:#fff8e1;border-radius:10px;padding:14px;margin-bottom:24px;font-size:13px;color:#92400e;">' +
        '<strong>Note:</strong> Buyer pays Maryland title tax (6%) directly at MVA on title transfer.</div>' +
        '<a href="' + confirmUrl + '&action=confirm" style="display:block;background:#22c55e;color:#fff;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;margin-bottom:10px;">Confirm Sale — Receive $' + fmt(sellerReceives) + '</a>' +
        '<a href="' + confirmUrl + '&action=decline" style="display:block;background:#f4f5f7;color:#666;text-align:center;padding:14px;border-radius:12px;font-weight:600;font-size:14px;text-decoration:none;">Decline Offer</a>' +
        '<p style="font-size:12px;color:#aaa;text-align:center;margin-top:20px;">Questions? Contact hello@12below.net</p>' +
        '</div></div></body></html>';

      const buyerHtml = '<html><body style="font-family:Arial,sans-serif;background:#f4f5f7;margin:0;padding:0;">' +
        '<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg,#1a3afa,#1228c8);padding:32px;text-align:center;">' +
        '<div style="font-size:28px;font-weight:800;color:#fff;">12Below</div></div>' +
        '<div style="padding:32px;">' +
        '<h2 style="color:#1a1a2e;margin-bottom:8px;">Your funds are secured, ' + buyerName + '!</h2>' +
        '<p style="color:#555;margin-bottom:24px;">Your payment of <strong>$' + fmt(price) + '</strong> for the <strong>' + car + '</strong> is safely held in escrow.</p>' +
        '<div style="background:#e8f5e9;border-radius:14px;padding:24px;margin-bottom:24px;text-align:center;">' +
        '<div style="font-size:40px;margin-bottom:8px;">&#128274;</div>' +
        '<div style="font-size:28px;font-weight:800;color:#166534;">$' + fmt(price) + '</div>' +
        '<div style="color:#166534;font-weight:600;">Secured in escrow</div></div>' +
        '<div style="background:#f0f4ff;border-radius:12px;padding:20px;margin-bottom:20px;">' +
        '<div style="font-weight:700;margin-bottom:12px;">What happens next:</div>' +
        '<div style="font-size:14px;color:#555;line-height:2;">&#9989; Contact seller to arrange viewing<br>&#9989; Inspect the car<br>&#9989; Get keys and signed title<br>&#9989; Confirm receipt to release payment</div></div>' +
        '<div style="background:#fff8e1;border-radius:10px;padding:14px;font-size:13px;color:#92400e;">' +
        '<strong>Important:</strong> Maryland title tax (6% = $' + fmt(Math.round(price * 0.06)) + ') paid at MVA on title transfer.</div>' +
        '<p style="font-size:12px;color:#aaa;text-align:center;margin-top:20px;">Questions? Contact hello@12below.net</p>' +
        '</div></div></body></html>';

      const r1 = await sendEmail(sellerEmail, 'You have an offer on your ' + car + '!', sellerHtml);
      const r2 = await sendEmail(buyerEmail, 'Your funds are secured — ' + car, buyerHtml);

      return {statusCode:200, headers:h, body:JSON.stringify({ok:true, seller:r1.status, buyer:r2.status})};
    }

    if(type === 'sale_confirmed') {
      const confirmedHtml = '<html><body style="font-family:Arial,sans-serif;background:#f4f5f7;margin:0;padding:0;">' +
        '<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg,#1a3afa,#1228c8);padding:32px;text-align:center;">' +
        '<div style="font-size:28px;font-weight:800;color:#fff;">12Below</div></div>' +
        '<div style="padding:32px;text-align:center;">' +
        '<div style="font-size:48px;margin-bottom:16px;">&#127881;</div>' +
        '<h2 style="color:#1a1a2e;margin-bottom:8px;">Sale confirmed!</h2>' +
        '<p style="color:#555;">The seller confirmed. Funds release within 1-2 business days.</p>' +
        '<p style="font-size:12px;color:#aaa;margin-top:20px;">Questions? hello@12below.net</p>' +
        '</div></div></body></html>';

      const r1 = await sendEmail(buyerEmail, 'Sale confirmed — ' + car, confirmedHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({ok:true, status:r1.status})};
    }

    return {statusCode:400, headers:h, body:JSON.stringify({error:'unknown type'})};
  } catch(e) {
    return {statusCode:500, headers:h, body:JSON.stringify({error:e.message, stack:e.stack})};
  }
};