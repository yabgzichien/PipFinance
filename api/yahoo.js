// api/yahoo.js
// Vercel serverless proxy for Yahoo Finance on web prototype deployments.

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    return res.status(204).end();
  }

  const { url: targetUrl } = req.query;
  if (
    !targetUrl ||
    (!targetUrl.startsWith('https://query1.finance.yahoo.com') &&
      !targetUrl.startsWith('https://query2.finance.yahoo.com'))
  ) {
    return res.status(400).json({ error: 'Missing or invalid target url' });
  }

  const headers = {
    Accept: 'application/json',
  };

  try {
    let upstream = await fetch(targetUrl, { headers });
    if (!upstream.ok && targetUrl.includes('query1.finance.yahoo.com')) {
      const fallback = targetUrl.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com');
      try {
        const fb = await fetch(fallback, { headers });
        if (fb.ok) upstream = fb;
      } catch {}
    }
    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.status(upstream.status).send(text);
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
}
