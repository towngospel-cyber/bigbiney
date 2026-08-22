// Vercel serverless function: POST /api/hubtel/send-sms
// Frontend still calls this with POST { to, message } — but internally we
// call Hubtel's Quick SMS API, which is a GET request with the credentials
// and message in the query string:
//   https://smsc.hubtel.com/v1/messages/send?clientid=...&clientsecret=...&from=...&to=...&content=...
//
// Credentials stay server-side here — never sent to the browser.
//
// Required env vars (Vercel → Project → Settings → Environment Variables):
//   HUBTEL_CLIENT_ID       <- the "Client ID" from Hubtel's Manage API Keys page
//   HUBTEL_CLIENT_SECRET   <- the matching "clientsecret" for that same key
//   HUBTEL_SENDER_ID       <- "BIGBINEY" (or a separate approved Sender ID if you want the print shop's texts to show a different name)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, message } = req.body || {};

  if (!to || !message) {
    return res.status(400).json({ error: 'to and message are required' });
  }

  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  const senderId = process.env.HUBTEL_SENDER_ID;

  if (!clientId || !clientSecret || !senderId) {
    return res.status(500).json({ error: 'Hubtel credentials not configured on the server' });
  }

  // Normalize Ghanaian numbers to 233 format if given as 0XXXXXXXXX
  const recipient = to.startsWith('0') ? `233${to.slice(1)}` : to;

  const params = new URLSearchParams({
    clientid: clientId,
    clientsecret: clientSecret,
    from: senderId,
    to: recipient,
    content: message,
  });

  try {
    const response = await fetch(`https://smsc.hubtel.com/v1/messages/send?${params.toString()}`, {
      method: 'GET',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || 'Hubtel error', details: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send SMS', details: String(err) });
  }
}
