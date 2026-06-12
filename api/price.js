// Serverless function: GET /api/price
// Returns the live SPCX quote plus day stats and key metrics. The API key stays
// server-side, so it never ships to the browser; same-origin, no CORS, no Claude
// session needed. Default provider: Finnhub (free tier). Key at https://finnhub.io.

export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Server is missing FINNHUB_API_KEY. Set it in your host's environment variables." });
    return;
  }

  const base = "https://finnhub.io/api/v1";
  try {
    // Quote is required; profile (market cap) and metric (P/E, 52-week) are best-effort.
    const [qr, pr, mr] = await Promise.all([
      fetch(`${base}/quote?symbol=SPCX&token=${key}`),
      fetch(`${base}/stock/profile2?symbol=SPCX&token=${key}`).catch(() => null),
      fetch(`${base}/stock/metric?symbol=SPCX&metric=all&token=${key}`).catch(() => null),
    ]);

    if (!qr.ok) throw new Error(`Price provider returned ${qr.status}`);
    const q = await qr.json();
    const price = Number(q.c); // c = current price
    if (!price || !isFinite(price)) throw new Error("No SPCX price available from the provider yet.");

    let marketCap = null, pe = null, week52High = null, week52Low = null;
    try {
      if (pr && pr.ok) {
        const p = await pr.json();
        if (p && p.marketCapitalization) marketCap = p.marketCapitalization * 1e6; // provider gives millions
      }
    } catch {}
    try {
      if (mr && mr.ok) {
        const m = (await mr.json()).metric || {};
        week52High = m["52WeekHigh"] ?? null;
        week52Low = m["52WeekLow"] ?? null;
        pe = m.peTTM ?? m.peNormalizedAnnual ?? null;
      }
    } catch {}

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
    res.status(200).json({
      price,
      open: q.o ?? null,
      high: q.h ?? null,
      low: q.l ?? null,
      prevClose: q.pc ?? null,
      marketCap,
      pe,
      week52High,
      week52Low,
      asOf: q.t ? new Date(q.t * 1000).toISOString() : "latest available",
      source: "Finnhub",
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "Price lookup failed." });
  }
}
