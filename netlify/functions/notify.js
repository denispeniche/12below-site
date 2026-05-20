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
        '<a href="' + confirmUrl + '&action=confirm" style="display:block;background:#22c55e;color:#fff;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;margin-bottom:10px;">Confirm Sale ÃÂ¢ÃÂÃÂ Receive $' + fmt(sellerReceives) + '</a>' +
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
      const r2 = await sendEmail(buyerEmail, 'Your funds are secured ÃÂ¢ÃÂÃÂ ' + car, buyerHtml);

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

      const r1 = await sendEmail(buyerEmail, 'Sale confirmed ÃÂ¢ÃÂÃÂ ' + car, confirmedHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({ok:true, status:r1.status})};
    }

    
    if(type === 'escrow_buyer_verify') {
      const verifyUrl = data.verify_url || '';
      const buyerName = data.buyer_name || 'there';
      const buyerEmailAddr = data.buyer_email;
      const carSummary = data.car_summary || 'your vehicle';
      const carPriceNum = Number(data.car_price || 0);
      const txnId = data.txn_id || '';
      const buyerHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#0a1f5c;">' +
        '<div style="max-width:560px;margin:0 auto;padding:32px 20px;">' +
          '<div style="text-align:center;margin-bottom:28px;">' +
            '<div style="display:inline-block;text-align:center;">' +
              '<div style="font-size:24px;font-weight:800;color:#0ea5e9;letter-spacing:-.5px;line-height:1;"><span style="color:#0ea5e9;">12</span><span style="color:#0a1f5c;">Below</span></div>' +
              '<div style="font-size:9px;font-weight:800;color:#0ea5e9;letter-spacing:3px;background:#f0f9ff;padding:2px 8px;border-radius:4px;border:1px solid #e0f2fe;margin-top:4px;display:inline-block;">CARS</div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(10,31,92,.06),0 4px 16px rgba(10,31,92,.04);">' +
            '<div style="padding:36px 36px 28px;">' +
              '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0ea5e9;margin-bottom:10px;">Escrow request received</div>' +
              '<h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#0a1f5c;letter-spacing:-.4px;line-height:1.25;">Hi ' + buyerName + ', here is what happens next</h1>' +
              '<p style="margin:0;color:#4a5570;font-size:15px;line-height:1.6;">Your safe transaction for the <strong style="color:#0a1f5c;">' + carSummary + '</strong> is set up. To unlock the next step, we need to verify your bank.</p>' +
            '</div>' +
            '<div style="margin:0 36px;border-top:1px solid #eef0f5;"></div>' +
            '<div style="padding:24px 36px;">' +
              '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px;">Transaction summary</div>' +
              '<table style="width:100%;border-collapse:collapse;">' +
                '<tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Vehicle</td><td style="padding:8px 0;color:#0a1f5c;font-size:14px;font-weight:600;text-align:right;">' + carSummary + '</td></tr>' +
                '<tr><td style="padding:8px 0;color:#64748b;font-size:13px;border-top:1px solid #eef0f5;">Agreed price</td><td style="padding:8px 0;color:#0a1f5c;font-size:18px;font-weight:800;text-align:right;border-top:1px solid #eef0f5;">$' + carPriceNum.toLocaleString() + '</td></tr>' +
                '<tr><td style="padding:8px 0;color:#64748b;font-size:13px;border-top:1px solid #eef0f5;">Transaction ID</td><td style="padding:8px 0;color:#94a3b8;font-size:12px;font-family:monospace;text-align:right;border-top:1px solid #eef0f5;">' + txnId + '</td></tr>' +
              '</table>' +
            '</div>' +
            '<div style="padding:8px 36px 32px;text-align:center;">' +
              '<a href="' + verifyUrl + '" style="display:inline-block;background:#0a1f5c;color:#ffffff;padding:16px 40px;border-radius:32px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.2px;box-shadow:0 4px 14px rgba(10,31,92,.25);">Verify my bank \u2192</a>' +
              '<p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">Takes about 60 seconds. We use Plaid.</p>' +
            '</div>' +
            '<div style="background:#f8fafc;padding:22px 36px;border-top:1px solid #eef0f5;">' +
              '<div style="display:table;width:100%;">' +
                '<div style="display:table-cell;width:32px;vertical-align:top;padding-right:12px;">' +
                  '<div style="width:28px;height:28px;background:#dcfce7;border-radius:50%;text-align:center;line-height:28px;color:#16a34a;font-weight:900;">\u2713</div>' +
                '</div>' +
                '<div style="display:table-cell;vertical-align:top;">' +
                  '<div style="font-weight:700;font-size:13px;color:#0a1f5c;margin-bottom:4px;">Your money does not move yet</div>' +
                  '<div style="font-size:12px;color:#64748b;line-height:1.6;">Verifying confirms you have the funds. We only release payment when you and the seller meet in person and you approve.</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:center;margin-top:24px;padding:0 20px;">' +
            '<p style="font-size:12px;color:#94a3b8;margin:0 0 6px;line-height:1.6;">Questions? Reply to this email or text <a href="tel:2405654169" style="color:#0a1f5c;text-decoration:none;font-weight:600;">(240) 565-4169</a>. We respond within 1 business hour.</p>' +
            '<p style="font-size:11px;color:#cbd5e1;margin:14px 0 0;">12Below Cars \u00B7 DMV peer-to-peer car marketplace and escrow</p>' +
          '</div>' +
        '</div></body></html>';
      await sendEmail(buyerEmailAddr, '12Below Escrow \u00B7 Verify your bank to start \u00B7 ' + carSummary, buyerHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({sent:true, type:type})};
    }

    if(type === 'escrow_seller_verify') {
      const verifyUrl = data.verify_url || '';
      const sellerName = data.seller_name || 'there';
      const sellerEmailAddr = data.seller_email;
      const buyerNameStr = data.buyer_name || 'A buyer';
      const carSummary = data.car_summary || 'your vehicle';
      const carPriceNum = Number(data.car_price || 0);
      const txnId = data.txn_id || '';
      const sellerHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#0a1f5c;">' +
        '<div style="max-width:560px;margin:0 auto;padding:32px 20px;">' +
          '<div style="text-align:center;margin-bottom:28px;">' +
            '<div style="display:inline-block;text-align:center;">' +
              '<div style="font-size:24px;font-weight:800;letter-spacing:-.5px;line-height:1;"><span style="color:#0ea5e9;">12</span><span style="color:#0a1f5c;">Below</span></div>' +
              '<div style="font-size:9px;font-weight:800;color:#0ea5e9;letter-spacing:3px;background:#f0f9ff;padding:2px 8px;border-radius:4px;border:1px solid #e0f2fe;margin-top:4px;display:inline-block;">CARS</div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(10,31,92,.06),0 4px 16px rgba(10,31,92,.04);">' +
            '<div style="padding:36px 36px 28px;">' +
              '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#16a34a;margin-bottom:10px;">Confirmed buyer for your car</div>' +
              '<h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#0a1f5c;letter-spacing:-.4px;line-height:1.25;">Hi ' + sellerName + ', a buyer is ready</h1>' +
              '<p style="margin:0;color:#4a5570;font-size:15px;line-height:1.6;"><strong style="color:#0a1f5c;">' + buyerNameStr + '</strong> wants to purchase your <strong style="color:#0a1f5c;">' + carSummary + '</strong> using 12Below Escrow. Their funds are already verified.</p>' +
            '</div>' +
            '<div style="margin:0 36px;border-top:1px solid #eef0f5;"></div>' +
            '<div style="padding:24px 36px;">' +
              '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px;">Deal summary</div>' +
              '<table style="width:100%;border-collapse:collapse;">' +
                '<tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Vehicle</td><td style="padding:8px 0;color:#0a1f5c;font-size:14px;font-weight:600;text-align:right;">' + carSummary + '</td></tr>' +
                '<tr><td style="padding:8px 0;color:#64748b;font-size:13px;border-top:1px solid #eef0f5;">Buyer agreed to pay</td><td style="padding:8px 0;color:#0a1f5c;font-size:18px;font-weight:800;text-align:right;border-top:1px solid #eef0f5;">$' + carPriceNum.toLocaleString() + '</td></tr>' +
                '<tr><td style="padding:8px 0;color:#64748b;font-size:13px;border-top:1px solid #eef0f5;">Buyer</td><td style="padding:8px 0;color:#0a1f5c;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #eef0f5;">' + buyerNameStr + ' \u00B7 funds verified</td></tr>' +
                '<tr><td style="padding:8px 0;color:#64748b;font-size:13px;border-top:1px solid #eef0f5;">Transaction ID</td><td style="padding:8px 0;color:#94a3b8;font-size:12px;font-family:monospace;text-align:right;border-top:1px solid #eef0f5;">' + txnId + '</td></tr>' +
              '</table>' +
            '</div>' +
            '<div style="padding:8px 36px 32px;text-align:center;">' +
              '<a href="' + verifyUrl + '" style="display:inline-block;background:#0a1f5c;color:#ffffff;padding:16px 40px;border-radius:32px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.2px;box-shadow:0 4px 14px rgba(10,31,92,.25);">Verify my bank \u2192</a>' +
              '<p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">Tells us where to send payment when the deal closes.</p>' +
            '</div>' +
            '<div style="background:#f8fafc;padding:22px 36px;border-top:1px solid #eef0f5;">' +
              '<div style="display:table;width:100%;">' +
                '<div style="display:table-cell;width:32px;vertical-align:top;padding-right:12px;">' +
                  '<div style="width:28px;height:28px;background:#dcfce7;border-radius:50%;text-align:center;line-height:28px;color:#16a34a;font-weight:900;">\u2713</div>' +
                '</div>' +
                '<div style="display:table-cell;vertical-align:top;">' +
                  '<div style="font-weight:700;font-size:13px;color:#0a1f5c;margin-bottom:4px;">No money moves until you hand over the car</div>' +
                  '<div style="font-size:12px;color:#64748b;line-height:1.6;">Funds release happens in person, after you sign the title and the buyer inspects the car. You stay in control.</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:center;margin-top:24px;padding:0 20px;">' +
            '<p style="font-size:12px;color:#94a3b8;margin:0 0 6px;line-height:1.6;">Not your car or not interested? Just ignore this email. Questions? Reply or text <a href="tel:2405654169" style="color:#0a1f5c;text-decoration:none;font-weight:600;">(240) 565-4169</a>.</p>' +
            '<p style="font-size:11px;color:#cbd5e1;margin:14px 0 0;">12Below Cars \u00B7 DMV peer-to-peer car marketplace and escrow</p>' +
          '</div>' +
        '</div></body></html>';
      await sendEmail(sellerEmailAddr, '12Below Escrow \u00B7 Buyer ready for your ' + carSummary, sellerHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({sent:true, type:type})};
    }

    if(type === 'escrow_admin_notification') {
      const adminEmail = process.env.ADMIN_EMAIL || 'denispeniche@gmail.com';
      const carSummary = ((data.car_year || '') + ' ' + (data.car_make_model || '')).trim() || 'Unknown vehicle';
      const carPriceNum = Number(data.car_price || 0);
      const adminUrl = data.admin_url || 'https://12belowcars.com/escrow/admin/';
      const adminHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#0a1f5c;">' +
        '<div style="max-width:600px;margin:0 auto;padding:32px 20px;">' +
          '<div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(10,31,92,.06),0 4px 16px rgba(10,31,92,.04);">' +
            '<div style="background:#0a1f5c;padding:24px 28px;color:#ffffff;">' +
              '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.7;margin-bottom:6px;">12Below Internal \u00B7 New escrow request</div>' +
              '<h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-.3px;">' + carSummary + '</h1>' +
              '<div style="margin-top:6px;font-size:20px;font-weight:800;color:#7dd3fc;">$' + carPriceNum.toLocaleString() + '</div>' +
            '</div>' +
            '<div style="padding:24px 28px 8px;">' +
              '<p style="margin:0;color:#0a1f5c;font-size:14px;line-height:1.6;">The buyer has been emailed their Plaid verification link. <strong>Vet the seller manually before sending them a verification link.</strong></p>' +
            '</div>' +
            '<div style="padding:18px 28px;">' +
              '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px;">Buyer</div>' +
              '<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;">' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;width:120px;">Name</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;">' + (data.buyer_name || '\u2014') + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">Email</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;">' + (data.buyer_email || '\u2014') + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">Phone</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;">' + (data.buyer_phone || '\u2014') + '</td></tr>' +
              '</table>' +
            '</div>' +
            '<div style="padding:6px 28px 18px;">' +
              '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px;">Seller (needs vetting)</div>' +
              '<table style="width:100%;border-collapse:collapse;background:#fef3c7;border-radius:10px;overflow:hidden;">' +
                '<tr><td style="padding:10px 14px;color:#92400e;font-size:12px;width:120px;">Name</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;">' + (data.seller_name || '\u2014 (not provided)') + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#92400e;font-size:12px;border-top:1px solid #fcd34d;">Contact</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #fcd34d;">' + (data.seller_contact || '\u2014') + '</td></tr>' +
              '</table>' +
            '</div>' +
            '<div style="padding:6px 28px 18px;">' +
              '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px;">Vehicle</div>' +
              '<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;">' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;width:120px;">Year &amp; Model</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;">' + carSummary + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">Agreed price</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;">$' + carPriceNum.toLocaleString() + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">State</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;">' + (data.car_state || '\u2014') + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">Found via</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;">' + (data.listing_source || '\u2014') + '</td></tr>' +
              '</table>' +
            '</div>' +
            (data.notes ? '<div style="padding:6px 28px 18px;"><div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:10px;">Notes from buyer</div><div style="background:#f8fafc;border-radius:10px;padding:14px;font-size:13px;color:#0a1f5c;line-height:1.6;">' + String(data.notes).replace(/</g, '&lt;') + '</div></div>' : '') +
            '<div style="padding:8px 28px 32px;text-align:center;">' +
              '<a href="' + adminUrl + '" style="display:inline-block;background:#0a1f5c;color:#ffffff;padding:14px 32px;border-radius:30px;text-decoration:none;font-weight:700;font-size:14px;">Open admin panel \u2192</a>' +
            '</div>' +
          '</div>' +
        '</div></body></html>';
      await sendEmail(adminEmail, '[12Below Escrow] ' + carSummary + ' \u00B7 $' + carPriceNum.toLocaleString(), adminHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({sent:true, type:type})};
    }


    if(type === 'dealer_application') {
      const adminEmail = process.env.ADMIN_EMAIL || 'denispeniche@gmail.com';
      const dealerName = data.dealership_name || 'Unknown dealership';
      const contactName = data.contact_name || '\u2014';
      const dealerHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#0a1f5c;">' +
        '<div style="max-width:600px;margin:0 auto;padding:32px 20px;">' +
          '<div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(10,31,92,.06),0 4px 16px rgba(10,31,92,.04);">' +
            '<div style="background:#0a1f5c;padding:24px 28px;color:#ffffff;">' +
              '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.7;margin-bottom:6px;">12Below Pilot \u00B7 New dealer application</div>' +
              '<h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-.3px;">' + dealerName + '</h1>' +
              '<div style="margin-top:6px;font-size:14px;color:#7dd3fc;">' + (data.monthly_volume || 'Volume not specified') + '</div>' +
            '</div>' +
            '<div style="padding:24px 28px 8px;">' +
              '<p style="margin:0;color:#0a1f5c;font-size:14px;line-height:1.6;">Review and respond within 1 business day. Submitted ' + (data.submitted_at || 'just now') + '.</p>' +
            '</div>' +
            '<div style="padding:18px 28px;">' +
              '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px;">Contact</div>' +
              '<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;">' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;width:120px;">Name</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;">' + contactName + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">Title</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;">' + (data.contact_title || '\u2014') + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">Email</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;"><a href="mailto:' + (data.contact_email || '') + '" style="color:#0a1f5c;">' + (data.contact_email || '\u2014') + '</a></td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">Phone</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;"><a href="tel:' + (data.contact_phone || '') + '" style="color:#0a1f5c;">' + (data.contact_phone || '\u2014') + '</a></td></tr>' +
              '</table>' +
            '</div>' +
            '<div style="padding:6px 28px 18px;">' +
              '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px;">Operations</div>' +
              '<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;">' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;width:160px;">DMS</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;">' + (data.dms || '\u2014') + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">Monthly disposition</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;">' + (data.monthly_volume || '\u2014') + '</td></tr>' +
                '<tr><td style="padding:10px 14px;color:#64748b;font-size:12px;border-top:1px solid #eef0f5;">Car types disposed</td><td style="padding:10px 14px;color:#0a1f5c;font-size:13px;font-weight:600;border-top:1px solid #eef0f5;">' + (data.car_types || '\u2014') + '</td></tr>' +
              '</table>' +
            '</div>' +
            (data.notes ? '<div style="padding:6px 28px 18px;"><div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:10px;">Notes from applicant</div><div style="background:#f8fafc;border-radius:10px;padding:14px;font-size:13px;color:#0a1f5c;line-height:1.6;">' + String(data.notes).replace(/</g, '&lt;') + '</div></div>' : '') +
            '<div style="padding:8px 28px 32px;text-align:center;">' +
              '<a href="mailto:' + (data.contact_email || '') + '?subject=12Below%20Dealer%20Pilot%20Application" style="display:inline-block;background:#0a1f5c;color:#ffffff;padding:14px 32px;border-radius:30px;text-decoration:none;font-weight:700;font-size:14px;">Reply to ' + dealerName + ' \u2192</a>' +
            '</div>' +
          '</div>' +
        '</div></body></html>';
      await sendEmail(adminEmail, '[12Below Pilot] Dealer application: ' + dealerName, dealerHtml);
      return {statusCode:200, headers:h, body:JSON.stringify({sent:true, type:type})};
    }
    return {statusCode:400, headers:h, body:JSON.stringify({error:'unknown type'})};
  } catch(e) {
    return {statusCode:500, headers:h, body:JSON.stringify({error:e.message, stack:e.stack})};
  }
};