// Serverless function: GET /api/history  (OPTIONAL)
// Returns intraday price history so the chart shows the full trading day on load.
// This is an optional upgrade: set TWELVEDATA_API_KEY (free key at
// https://twelvedata.com) to enable it. Without the key it returns an empty list
// and the chart simply builds live as prices update — no error.

export default async function handler(req, res) {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) {
    res.status(200).json({ points: [], note: "No TWELVEDATA_API_KEY set — chart builds live instead." });
    return;
  }
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=SPCX&interval=5min&outputsize=200&apikey=${key}`;
    const r = await fetch(url);
    const d = await r.json();
    if (!d || !Array.isArray(d.values)) {
      res.status(200).json({ points: [], note: (d && d.message) || "No intraday data returned." });
      return;
    }
    // Note: provider timestamps are in the exchange's local time; for precise axis
    // labels you may want to apply the market's UTC offset here.
    const points = d.values
      .map((v) => ({ t: Date.parse(v.datetime), p: Number(v.close) }))
      .filter((x) => isFinite(x.t) && isFinite(x.p))
      .sort((a, b) => a.t - b.t);
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.status(200).json({ points });
  } catch (e) {
    res.status(200).json({ points: [], note: e.message || "history lookup failed" });
  }
}
