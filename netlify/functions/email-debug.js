exports.handler = async (event) => {
  try {
    const fromEmail = process.env.FROM_EMAIL || 'NOT_SET';
    const hasApiKey = !!process.env.RESEND_API_KEY;
    const apiKeyLen = (process.env.RESEND_API_KEY || '').length;
    
    if(!hasApiKey){
      return {statusCode: 200, body: JSON.stringify({error: 'No RESEND_API_KEY env var', from: fromEmail})};
    }
    
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: ['denispeniche@gmail.com'],
        subject: 'DEBUG email from 12Below at ' + new Date().toISOString(),
        html: '<p>This is a diagnostic test email. If you got this, sending works.</p>'
      })
    });
    
    const body = await res.text();
    
    return {
      statusCode: 200,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        from_email_used: fromEmail,
        api_key_present: hasApiKey,
        api_key_length: apiKeyLen,
        resend_status_code: res.status,
        resend_ok: res.ok,
        resend_response: body
      })
    };
  } catch(e) {
    return {statusCode: 500, body: JSON.stringify({error: e.message, stack: e.stack})};
  }
};