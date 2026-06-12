// Serverless function (Vercel-style): GET /api/price
// Fetches the latest SPCX quote from a market-data provider using a key that
// stays on the server, so it never ships to the browser. Same-origin, so no
// CORS issues and no Claude session required — works for anyone with the link.
//
// Default provider: Finnhub (free tier covers US equities). Get a key at
// https://finnhub.io and set it as the FINNHUB_API_KEY environment variable.
// To swap providers, change the URL and the price field below.

export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Server is missing FINNHUB_API_KEY. Set it in your host's environment variables." });
    return;
  }

  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=SPCX&token=${key}`);
    if (!r.ok) throw new Error(`Price provider returned ${r.status}`);
    const q = await r.json();

    const price = Number(q.c); // Finnhub: c = current price
    if (!price || !isFinite(price)) {
      // A brand-new listing may not be covered yet, or the symbol is wrong.
      throw new Error("No SPCX price available from the provider yet.");
    }

    // Cache at the edge for 15s so a burst of viewers doesn't burn the rate limit.
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
    res.status(200).json({
      price,
      asOf: q.t ? new Date(q.t * 1000).toISOString() : "latest available",
      source: "Finnhub",
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "Price lookup failed." });
  }
}
