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
        '<a href="' + confirmUrl + '&action=confirm" style="display:block;background:#22c55e;color:#fff;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;margin-bottom:10px;">Confirm Sale â Receive $' + fmt(sellerReceives) + '</a>' +
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
      const r2 = await sendEmail(buyerEmail, 'Your funds are secured â ' + car, buyerHtml);

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

      const r1 = await sendEmail(buyerEmail, 'Sale confirmed â ' + car, confirmedHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({ok:true, status:r1.status})};
    }

    
    if(type === 'escrow_buyer_verify') {
      const buyerHtml = '<html><body style="font-family:Arial,sans-serif;background:#f4f5f7;margin:0;padding:0;">' +
        '<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(10,31,92,.08);">' +
          '<div style="background:linear-gradient(135deg,#0a1f5c 0%,#0ea5e9 100%);padding:32px 28px;color:#fff;">' +
            '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.8;margin-bottom:8px;">12BELOW ESCROW</div>' +
            '<h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-.5px;">Verify your bank to start escrow</h1>' +
          '</div>' +
          '<div style="padding:32px 28px;color:#0a1f5c;line-height:1.6;font-size:15px;">' +
            '<p style="margin:0 0 18px;">Hi ' + (data.buyer_name || 'there') + ',</p>' +
            '<p style="margin:0 0 18px;">Your escrow request for the <b>' + data.car_summary + '</b> at <b>$' + Number(data.car_price || 0).toLocaleString() + '</b> is set up.</p>' +
            '<p style="margin:0 0 24px;">Next step: <b>verify your bank account</b> via Plaid. This confirms you have the funds, takes 60 seconds, and is the same secure flow used by Venmo. <b>No money moves until you and the seller both approve in person.</b></p>' +
            '<div style="text-align:center;margin:28px 0;">' +
              '<a href="' + data.verify_url + '" style="background:#0a1f5c;color:#fff;padding:16px 32px;border-radius:30px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Verify my bank &rarr;</a>' +
            '</div>' +
            '<p style="margin:0 0 8px;font-size:13px;color:#64748b;">Transaction ID: <code style="background:#f4f5f7;padding:2px 8px;border-radius:4px;font-size:12px;">' + data.txn_id + '</code></p>' +
            '<p style="margin:18px 0 0;font-size:13px;color:#64748b;line-height:1.6;">Questions? Reply to this email or text us at (240) 565-4169. We respond within 1 business hour.</p>' +
          '</div>' +
          '<div style="background:#f8fafc;padding:18px 28px;font-size:12px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;">12Below Cars &middot; DMV peer-to-peer car marketplace &amp; escrow</div>' +
        '</div></body></html>';
      await sendEmail(data.buyer_email, '12Below Escrow: verify your bank to start - ' + data.car_summary, buyerHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({sent:true, type:type})};
    }

    if(type === 'escrow_seller_verify') {
      const sellerHtml = '<html><body style="font-family:Arial,sans-serif;background:#f4f5f7;margin:0;padding:0;">' +
        '<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(10,31,92,.08);">' +
          '<div style="background:linear-gradient(135deg,#0a1f5c 0%,#0ea5e9 100%);padding:32px 28px;color:#fff;">' +
            '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.8;margin-bottom:8px;">12BELOW ESCROW</div>' +
            '<h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-.5px;">A buyer wants to purchase your car safely</h1>' +
          '</div>' +
          '<div style="padding:32px 28px;color:#0a1f5c;line-height:1.6;font-size:15px;">' +
            '<p style="margin:0 0 18px;">Hi ' + (data.seller_name || 'there') + ',</p>' +
            '<p style="margin:0 0 18px;"><b>' + (data.buyer_name || 'A buyer') + '</b> wants to purchase your <b>' + data.car_summary + '</b> at <b>$' + Number(data.car_price || 0).toLocaleString() + '</b> using 12Below Escrow. The buyer has already verified their bank and the funds are confirmed real.</p>' +
            '<p style="margin:0 0 24px;">Next step: <b>verify your bank account</b> via Plaid so we know where to send funds when the deal closes. Takes 60 seconds. No money moves until you hand over the car and the buyer approves in person.</p>' +
            '<div style="text-align:center;margin:28px 0;">' +
              '<a href="' + data.verify_url + '" style="background:#0a1f5c;color:#fff;padding:16px 32px;border-radius:30px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Verify my bank &rarr;</a>' +
            '</div>' +
            '<p style="margin:0 0 8px;font-size:13px;color:#64748b;">Transaction ID: <code style="background:#f4f5f7;padding:2px 8px;border-radius:4px;font-size:12px;">' + data.txn_id + '</code></p>' +
            '<p style="margin:18px 0 0;font-size:13px;color:#64748b;line-height:1.6;">Not your car or not interested? Just ignore this email. Questions? Reply or text (240) 565-4169.</p>' +
          '</div>' +
          '<div style="background:#f8fafc;padding:18px 28px;font-size:12px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;">12Below Cars &middot; DMV peer-to-peer car marketplace &amp; escrow</div>' +
        '</div></body></html>';
      await sendEmail(data.seller_email, '12Below Escrow: buyer ready for your ' + data.car_summary, sellerHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({sent:true, type:type})};
    }

    if(type === 'escrow_admin_notification') {
      const adminEmail = process.env.ADMIN_EMAIL || 'denispeniche@gmail.com';
      const rows = Object.keys(data).filter(function(k){ return k !== 'admin_url' && data[k]; }).map(function(k){
        return '<tr><td style="padding:6px 12px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.3px;font-weight:700;background:#f8fafc;border-right:1px solid #e2e8f0;width:160px;">' + k.replace(/_/g, ' ') + '</td><td style="padding:8px 12px;color:#0a1f5c;font-size:14px;">' + String(data[k]).replace(/</g, '&lt;') + '</td></tr>';
      }).join('');
      const adminHtml = '<html><body style="font-family:Arial,sans-serif;background:#f4f5f7;margin:0;padding:0;">' +
        '<div style="max-width:640px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(10,31,92,.08);">' +
          '<div style="background:#0a1f5c;padding:24px 28px;color:#fff;">' +
            '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7;margin-bottom:6px;">NEW ESCROW REQUEST</div>' +
            '<h1 style="margin:0;font-size:20px;font-weight:800;">' + (data.car_year || '') + ' ' + (data.car_make_model || '') + ' &mdash; $' + Number(data.car_price || 0).toLocaleString() + '</h1>' +
          '</div>' +
          '<div style="padding:24px 28px;">' +
            '<p style="margin:0 0 16px;color:#0a1f5c;font-size:14px;line-height:1.6;">The buyer has been emailed a Plaid verification link. <b>You need to vet the seller manually</b> before sending them a verification link.</p>' +
            (data.admin_url ? '<div style="text-align:center;margin:18px 0 24px;"><a href="' + data.admin_url + '" style="background:#0a1f5c;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:700;font-size:14px;">Open admin panel &rarr;</a></div>' : '') +
            '<table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">' + rows + '</table>' +
          '</div>' +
        '</div></body></html>';
      await sendEmail(adminEmail, '[12Below Escrow] New request: ' + (data.car_make_model || 'car') + ' - $' + Number(data.car_price || 0).toLocaleString(), adminHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({sent:true, type:type})};
    }

    return {statusCode:400, headers:h, body:JSON.stringify({error:'unknown type'})};
  } catch(e) {
    return {statusCode:500, headers:h, body:JSON.stringify({error:e.message, stack:e.stack})};
  }
};