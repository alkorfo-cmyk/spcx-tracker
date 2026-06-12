import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import { HOLDINGS, MAIN_FEE_RATE, AARON_FEE_RATE, AARON_NAME, IPO_PRICE } from "./holdings.js";

const C = {
  bg: "#0A0E1A", panel: "#10162A", panel2: "#0C1120", line: "#1C2742", line2: "#2A3656",
  text: "#E9EDF8", dim: "#8A97B8", faint: "#5A668A", accent: "#5B8DEF",
  gain: "#3DDC97", loss: "#F4708A", live: "#56D6FF", warn: "#F2B84B",
};
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const usd = (n, dp = 0) =>
  n == null || !isFinite(n)
    ? "—"
    : (n < 0 ? "-$" : "$") +
      Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const num = (n, dp = 0) =>
  n == null || !isFinite(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtCap = (n) =>
  n == null || !isFinite(n) ? "—"
    : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T`
    : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
    : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
    : usd(n);
const hhmm = (t) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const dayKey = () => "spcx-intraday-" + new Date().toISOString().slice(0, 10);

function compute(holding, price) {
  const marketValue = holding.shares * price;
  const profit = marketValue - holding.invested;
  const basis = Math.max(0, profit);
  const feeAaron = holding.noAaron ? 0 : basis * AARON_FEE_RATE; // 1.5% to Aaron Wolko
  const feeMain = basis * MAIN_FEE_RATE;                          // 20% main fee
  const fee = feeMain + feeAaron;
  const netValue = marketValue - fee;
  const netProfit = netValue - holding.invested;
  const multiple = holding.invested > 0 ? netProfit / holding.invested : 0;
  return { ...holding, price, marketValue, profit, feeMain, feeAaron, fee, netValue, netProfit, multiple };
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 8, padding: "8px 10px", fontFamily: MONO }}>
      <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{usd(d.p, 2)}</div>
      <div style={{ color: C.faint, fontSize: 10.5, marginTop: 2 }}>{hhmm(d.t)}</div>
    </div>
  );
}

export default function App() {
  const [price, setPrice] = useState(IPO_PRICE);
  const [meta, setMeta] = useState({});
  const [points, setPoints] = useState([]);
  const [source, setSource] = useState("IPO baseline");
  const [asOf, setAsOf] = useState("June 12, 2026");
  const [status, setStatus] = useState("idle"); // idle | loading | ok | error
  const [errorMsg, setErrorMsg] = useState("");
  const [lastFetched, setLastFetched] = useState(null);
  const [auto, setAuto] = useState(false);
  const [manual, setManual] = useState("");
  const [selected, setSelected] = useState(null);
  const timer = useRef(null);

  // Restore today's accumulated points (so the chart survives reloads).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(dayKey());
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) setPoints(arr); }
    } catch {}
  }, []);

  const addPoint = useCallback((t, p) => {
    if (!isFinite(t) || !isFinite(p)) return;
    setPoints((prev) => {
      let next = prev.slice();
      const last = next[next.length - 1];
      if (last && t - last.t < 15000) next[next.length - 1] = { t, p }; // collapse rapid live ticks
      else next.push({ t, p });
      next.sort((a, b) => a.t - b.t);
      if (next.length > 1000) next = next.slice(-1000);
      try { localStorage.setItem(dayKey(), JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/history");
      const d = await r.json();
      if (d && Array.isArray(d.points) && d.points.length) {
        setPoints((prev) => {
          const map = new Map(prev.map((x) => [x.t, x]));
          for (const pt of d.points) if (isFinite(pt.t) && isFinite(pt.p)) map.set(pt.t, pt);
          const arr = [...map.values()].sort((a, b) => a.t - b.t);
          try { localStorage.setItem(dayKey(), JSON.stringify(arr)); } catch {}
          return arr;
        });
      }
    } catch {}
  }, []);

  const fetchPrice = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/price");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Price service returned ${res.status}`);
      const p = Number(data.price);
      if (!p || !isFinite(p) || p <= 0) throw new Error("Price service returned no usable price.");
      setPrice(p);
      setMeta({
        open: data.open, high: data.high, low: data.low, prevClose: data.prevClose,
        marketCap: data.marketCap, pe: data.pe, week52High: data.week52High, week52Low: data.week52Low,
      });
      setSource(data.source || "live quote");
      setAsOf(data.asOf ? new Date(data.asOf).toLocaleString("en-US") : "latest available");
      addPoint(Date.now(), p);
      setManual("");
      setStatus("ok");
      setLastFetched(new Date());
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "Couldn't reach the price service.");
    }
  }, [addPoint]);

  useEffect(() => { fetchPrice(); fetchHistory(); }, [fetchPrice, fetchHistory]);

  useEffect(() => {
    if (auto) {
      timer.current = setInterval(fetchPrice, 60000);
      return () => clearInterval(timer.current);
    }
  }, [auto, fetchPrice]);

  const applyManual = () => {
    const p = Number(String(manual).replace(/[^0-9.]/g, ""));
    if (p > 0 && isFinite(p)) {
      setPrice(p); setSource("manual entry"); setAsOf("manual");
      addPoint(Date.now(), p);
      setStatus("ok"); setLastFetched(new Date());
    }
  };

  const rows = useMemo(
    () => HOLDINGS.map((h) => compute(h, price)).sort((a, b) => b.marketValue - a.marketValue),
    [price]
  );
  const selectedRow = useMemo(() => rows.find((r) => r.name === selected) || null, [rows, selected]);

  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => {
        acc.shares += r.shares; acc.invested += r.invested; acc.marketValue += r.marketValue;
        acc.fee += r.fee; acc.feeMain += r.feeMain; acc.feeAaron += r.feeAaron; acc.netValue += r.netValue;
        return acc;
      },
      { shares: 0, invested: 0, marketValue: 0, fee: 0, feeMain: 0, feeAaron: 0, netValue: 0 }
    );
    t.profit = t.marketValue - t.invested;
    t.netProfit = t.netValue - t.invested;
    t.multiple = t.invested > 0 ? t.netProfit / t.invested : 0;
    t.costBasis = t.shares > 0 ? t.invested / t.shares : 0;
    return t;
  }, [rows]);

  const refClose = meta.prevClose ?? IPO_PRICE;
  const dChange = price - refClose;
  const dPct = refClose ? (dChange / refClose) * 100 : 0;
  const up = dChange >= 0;

  const dayMetrics = [
    { l: "Open", v: usd(meta.open, 2) },
    { l: "High", v: usd(meta.high, 2) },
    { l: "Low", v: usd(meta.low, 2) },
    { l: "Prev close", v: usd(refClose, 2) },
    { l: "Mkt cap", v: fmtCap(meta.marketCap) },
    { l: "P/E ratio", v: meta.pe != null && isFinite(meta.pe) ? Number(meta.pe).toFixed(2) : "—" },
    { l: "52-wk high", v: usd(meta.week52High ?? meta.high, 2) },
    { l: "52-wk low", v: usd(meta.week52Low ?? meta.low, 2) },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100%", fontFamily: SANS, color: C.text }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:.35; transform:scale(.82)} }
        @keyframes sheen { 0%{background-position:-120% 0} 100%{background-position:220% 0} }
        .live-dot{ width:9px;height:9px;border-radius:50%;background:${C.live};box-shadow:0 0 12px ${C.live};animation:pulse 1.6s ease-in-out infinite; }
        .btn{ font-family:${SANS}; cursor:pointer; border-radius:8px; border:1px solid ${C.line2}; background:${C.panel}; color:${C.text}; transition:border-color .15s, background .15s; }
        .btn:hover{ border-color:${C.accent}; background:#141b32; }
        .btn:focus-visible{ outline:2px solid ${C.accent}; outline-offset:2px; }
        .btn:disabled{ opacity:.5; cursor:default; }
        input.px{ font-family:${MONO}; background:${C.panel2}; border:1px solid ${C.line2}; color:${C.text}; border-radius:8px; padding:8px 10px; width:120px; }
        input.px:focus{ outline:2px solid ${C.accent}; outline-offset:1px; }
        .row:hover{ background:#0e1426; }
        .row:focus-visible{ outline:2px solid ${C.accent}; outline-offset:-2px; }
        .skel{ background:linear-gradient(90deg,${C.panel} 25%, #1a2238 50%, ${C.panel} 75%); background-size:200% 100%; animation:sheen 1.2s linear infinite; border-radius:6px; }
        @media (prefers-reduced-motion: reduce){ .live-dot,.skel{ animation:none } }
        .tnum{ font-variant-numeric: tabular-nums; }
      `}</style>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 22px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.faint }}>SYNDICATE&nbsp;POSITION</span>
          <span style={{ flex: 1, height: 1, background: C.line }} />
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: C.faint }}>NASDAQ:SPCX&nbsp;·&nbsp;SPACEX</span>
        </div>

        {/* HERO */}
        <div style={{ position: "relative", border: `1px solid ${C.line2}`, borderRadius: 16,
          background: `radial-gradient(120% 160% at 80% -20%, rgba(86,214,255,.12), transparent 55%), ${C.panel}`,
          padding: "26px 26px 24px", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="live-dot" />
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.live }}>
                  {status === "loading" ? "FETCHING" : "LIVE PRICE"}
                </span>
              </div>
              {status === "loading" ? (
                <div className="skel" style={{ width: 180, height: 52 }} />
              ) : (
                <div style={{ fontFamily: MONO, fontSize: 52, fontWeight: 600, lineHeight: 1, letterSpacing: -1 }} className="tnum">
                  {usd(price, 2)}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: up ? C.gain : C.loss }} className="tnum">
                  {up ? "▲" : "▼"} {usd(Math.abs(dChange), 2)} ({up ? "+" : "−"}{Math.abs(dPct).toFixed(2)}%)
                </span>
                <span style={{ fontSize: 12, color: C.faint }}>today · prev close {usd(refClose, 2)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8, maxWidth: 340 }}>
                {source} · as of {asOf}
                {lastFetched && <> · pulled {lastFetched.toLocaleTimeString("en-US")}</>}
              </div>
            </div>

            <div style={{ textAlign: "right", minWidth: 240 }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.dim, marginBottom: 8 }}>POOL MARKET VALUE</div>
              {status === "loading" ? (
                <div className="skel" style={{ width: 240, height: 46, marginLeft: "auto" }} />
              ) : (
                <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 600, lineHeight: 1, color: C.gain, letterSpacing: -1 }} className="tnum">
                  {usd(totals.marketValue)}
                </div>
              )}
              <div style={{ fontSize: 12, color: C.dim, marginTop: 10 }} className="tnum">
                Net after fees:&nbsp;
                <span style={{ color: C.text, fontFamily: MONO }}>{usd(totals.netValue)}</span>
              </div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }} className="tnum">
                Invested&nbsp;<span style={{ color: C.text, fontFamily: MONO }}>{usd(totals.invested)}</span>
                &nbsp;·&nbsp;net return&nbsp;
                <span style={{ color: C.gain, fontFamily: MONO, fontWeight: 600 }}>{totals.multiple.toFixed(2)}×</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            <button className="btn" onClick={fetchPrice} disabled={status === "loading"} style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600 }}>
              {status === "loading" ? "Refreshing…" : "↻ Refresh price"}
            </button>
            <label className="btn" style={{ padding: "9px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} style={{ accentColor: C.accent }} />
              Auto-refresh (60s)
            </label>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.dim }}>SET PRICE</span>
            <input className="px tnum" placeholder="135.00" value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyManual()}
              aria-label="Set price manually" />
            <button className="btn" onClick={applyManual} style={{ padding: "9px 14px", fontSize: 13 }}>Apply</button>
          </div>

          {status === "error" && (
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.warn}`,
              background: "rgba(242,184,75,.08)", fontSize: 12.5, lineHeight: 1.6, color: C.warn, fontFamily: SANS }}>
              <strong>Couldn't fetch the live price.</strong> {errorMsg} The last known price is shown — retry, or type the
              current SPCX price into <span style={{ fontFamily: MONO }}>SET PRICE</span> above and everything recalculates.
            </div>
          )}
        </div>

        {/* PRICE CHART + DAY METRICS */}
        <div style={{ marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", background: C.panel }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.dim }}>SPCX · INTRADAY</span>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>
              {points.length > 1 ? `${points.length} points` : "building live"}
            </span>
          </div>

          <div style={{ padding: "12px 10px 4px" }}>
            {points.length > 1 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={points} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="spcxFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.gain} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.gain} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]}
                    tickFormatter={hhmm} minTickGap={48}
                    tick={{ fill: C.faint, fontSize: 10, fontFamily: MONO }} stroke={C.line} />
                  <YAxis domain={["auto", "auto"]} width={50} tickFormatter={(v) => "$" + v.toFixed(0)}
                    tick={{ fill: C.faint, fontSize: 10, fontFamily: MONO }} stroke={C.line} />
                  <ReferenceLine y={refClose} stroke={C.faint} strokeDasharray="4 4"
                    label={{ value: `prev close ${usd(refClose, 2)}`, fill: C.faint, fontSize: 10, position: "insideBottomRight" }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: C.line2 }} />
                  <Area type="monotone" dataKey="p" stroke={C.gain} strokeWidth={2} fill="url(#spcxFill)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: C.faint, fontSize: 12.5, lineHeight: 1.6, padding: "0 24px" }}>
                <div style={{ fontFamily: MONO, fontSize: 28, color: C.dim, marginBottom: 10 }}>—</div>
                The chart fills in as the price updates. Turn on <strong style={{ color: C.dim }}>&nbsp;Auto-refresh&nbsp;</strong> to build it
                automatically, or connect an intraday feed (see README) to backfill the full trading day on load.
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 1, background: C.line, borderTop: `1px solid ${C.line}` }}>
            {dayMetrics.map((m) => (
              <div key={m.l} style={{ background: C.panel, padding: "12px 14px" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.faint, marginBottom: 6 }}>{m.l.toUpperCase()}</div>
                <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600 }} className="tnum">{m.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pool stat strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 14 }}>
          {[
            { l: "Total shares", v: num(totals.shares, 0) },
            { l: "Blended cost / share", v: usd(totals.costBasis, 2) },
            { l: "Gross profit", v: usd(totals.profit) },
            { l: "Total fees", v: usd(totals.fee) },
            { l: `Owed to ${AARON_NAME} (1.5%)`, v: usd(totals.feeAaron), accent: true },
          ].map(({ l, v, accent }) => (
            <div key={l} style={{ border: `1px solid ${accent ? C.accent : C.line}`, borderRadius: 12, background: C.panel2, padding: "14px 16px" }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1, color: C.faint, marginBottom: 7 }}>{l.toUpperCase()}</div>
              <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 600, color: accent ? C.live : C.text }} className="tnum">{v}</div>
            </div>
          ))}
        </div>

        {/* Holder detail */}
        {selectedRow && (() => {
          const s = selectedRow;
          const poolShare = totals.marketValue > 0 ? s.marketValue / totals.marketValue : 0;
          const costPer = s.shares > 0 ? s.invested / s.shares : 0;
          const aaronVal = s.noAaron ? "$0 — exempt" : usd(s.feeAaron);
          const cells = [
            { l: "Invested", v: usd(s.invested) },
            { l: "Gross profit", v: usd(s.profit) },
            { l: "Fee — 20%", v: usd(s.feeMain) },
            { l: `Owed to ${AARON_NAME} (1.5%)`, v: aaronVal, accent: true },
            { l: "Net profit", v: usd(s.netProfit) },
            { l: "Net return", v: s.multiple.toFixed(2) + "×" },
            { l: "Share of pool", v: (poolShare * 100).toFixed(1) + "%" },
          ];
          return (
            <div style={{ marginTop: 26, border: `1px solid ${C.line2}`, borderRadius: 14, overflow: "hidden", background: C.panel }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
                <button className="btn" onClick={() => setSelected(null)} style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600 }}>‹ All holders</button>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>{(poolShare * 100).toFixed(1)}% OF POOL</span>
              </div>
              <div style={{ padding: "22px 22px 24px" }}>
                <div style={{ fontFamily: SANS, fontSize: 23, fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: C.faint, marginBottom: 22 }} className="tnum">
                  {num(s.shares, 0)} shares · cost basis {usd(costPer, 2)}/sh · live {usd(price, 2)}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 30, alignItems: "flex-end", marginBottom: 24 }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: C.dim, marginBottom: 7 }}>NET AFTER FEE</div>
                    <div style={{ fontFamily: MONO, fontSize: 42, fontWeight: 600, lineHeight: 1, color: C.gain, letterSpacing: -1 }} className="tnum">{usd(s.netValue)}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: C.dim, marginBottom: 7 }}>MARKET VALUE</div>
                    <div style={{ fontFamily: MONO, fontSize: 27, fontWeight: 600, lineHeight: 1.1, color: C.text }} className="tnum">{usd(s.marketValue)}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: 12 }}>
                  {cells.map(({ l, v, accent }) => (
                    <div key={l} style={{ border: `1px solid ${accent ? C.accent : C.line}`, borderRadius: 12, background: C.panel2, padding: "13px 15px" }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.faint, marginBottom: 6 }}>{l.toUpperCase()}</div>
                      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: accent ? C.live : C.text }} className="tnum">{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.faint, marginBottom: 8 }}>
                    <span>STAKE WITHIN POOL</span>
                    <span>{usd(s.marketValue)} / {usd(totals.marketValue)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: C.panel2, border: `1px solid ${C.line}`, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, poolShare * 100)}%`, height: "100%", background: C.accent }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Manifest table */}
        {!selectedRow && (
          <div style={{ marginTop: 26, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.dim }}>HOLDER MANIFEST</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>tap a holder to drill in · by market value</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820, fontFamily: MONO }} className="tnum">
                <thead>
                  <tr style={{ fontSize: 10.5, color: C.faint, letterSpacing: 1, textAlign: "right" }}>
                    <th style={{ textAlign: "left", padding: "12px 18px", fontWeight: 500 }}>HOLDER</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500 }}>SHARES</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500 }}>INVESTED</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500 }}>MKT VALUE</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500 }}>FEE 20%</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500, color: C.accent }}>AARON 1.5%</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500 }}>NET VALUE</th>
                    <th style={{ padding: "12px 18px", fontWeight: 500 }}>RETURN</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className="row"
                      onClick={() => setSelected(r.name)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(r.name))}
                      tabIndex={0} role="button" aria-label={`View ${r.name}'s position`}
                      style={{ borderTop: `1px solid ${C.line}`, fontSize: 13, textAlign: "right", cursor: "pointer" }}>
                      <td style={{ textAlign: "left", padding: "13px 18px", fontFamily: SANS, color: C.text }}>
                        <span style={{ color: C.faint, marginRight: 9, fontFamily: MONO }}>›</span>{r.name}
                      </td>
                      <td style={{ padding: "13px 10px", color: C.dim }}>{num(r.shares, 0)}</td>
                      <td style={{ padding: "13px 10px", color: C.dim }}>{usd(r.invested)}</td>
                      <td style={{ padding: "13px 10px", color: C.text }}>{usd(r.marketValue)}</td>
                      <td style={{ padding: "13px 10px", color: C.faint }}>{usd(r.feeMain)}</td>
                      <td style={{ padding: "13px 10px", color: r.noAaron ? C.faint : C.live }}>{r.noAaron ? "—" : usd(r.feeAaron)}</td>
                      <td style={{ padding: "13px 10px", color: C.gain, fontWeight: 600 }}>{usd(r.netValue)}</td>
                      <td style={{ padding: "13px 18px", color: C.text }}>{r.multiple.toFixed(1)}×</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${C.line2}`, fontSize: 13, textAlign: "right", background: C.panel2 }}>
                    <td style={{ textAlign: "left", padding: "14px 18px", fontFamily: SANS, fontWeight: 700 }}>Total</td>
                    <td style={{ padding: "14px 10px", color: C.text }}>{num(totals.shares, 0)}</td>
                    <td style={{ padding: "14px 10px", color: C.text }}>{usd(totals.invested)}</td>
                    <td style={{ padding: "14px 10px", color: C.text, fontWeight: 600 }}>{usd(totals.marketValue)}</td>
                    <td style={{ padding: "14px 10px", color: C.dim }}>{usd(totals.feeMain)}</td>
                    <td style={{ padding: "14px 10px", color: C.live, fontWeight: 600 }}>{usd(totals.feeAaron)}</td>
                    <td style={{ padding: "14px 10px", color: C.gain, fontWeight: 700 }}>{usd(totals.netValue)}</td>
                    <td style={{ padding: "14px 18px", color: C.gain, fontWeight: 700 }}>{totals.multiple.toFixed(1)}×</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Footnotes */}
        <div style={{ marginTop: 18, fontSize: 11.5, lineHeight: 1.7, color: C.faint, fontFamily: SANS }}>
          <p style={{ margin: "0 0 6px" }}>
            <strong style={{ color: C.dim }}>Fees.</strong> Each holder pays 20% of gross profit to the syndicate plus 1.5%
            to {AARON_NAME}, tracked separately so everyone sees what they owe him. Moshe Belinow's 2nd purchase is exempt
            from the 1.5% — it pays 20% only. Return is net profit ÷ invested.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong style={{ color: C.dim }}>Chart.</strong> Builds live from each price update and is saved per day. Connect an
            intraday feed (optional, see README) to backfill the full trading day automatically.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: C.dim }}>Price &amp; metrics.</strong> Fetched from a market-data provider via this app's own
            server and may be delayed relative to the exchange. Verify against your broker before acting.
          </p>
        </div>
      </div>
    </div>
  );
}
