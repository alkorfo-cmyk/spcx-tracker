import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { HOLDINGS, FEE_RATE, IPO_PRICE } from "./holdings.js";

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

function compute(holding, price) {
  const marketValue = holding.shares * price;
  const profit = marketValue - holding.invested;
  const fee = holding.flatFee != null ? holding.flatFee : Math.max(0, profit * FEE_RATE);
  const netValue = marketValue - fee;
  const netProfit = netValue - holding.invested;
  const multiple = holding.invested > 0 ? netProfit / holding.invested : 0;
  return { ...holding, price, marketValue, profit, fee, netValue, netProfit, multiple };
}

export default function App() {
  const [price, setPrice] = useState(IPO_PRICE);
  const [source, setSource] = useState("IPO baseline");
  const [asOf, setAsOf] = useState("June 12, 2026");
  const [status, setStatus] = useState("idle"); // idle | loading | ok | error
  const [errorMsg, setErrorMsg] = useState("");
  const [lastFetched, setLastFetched] = useState(null);
  const [auto, setAuto] = useState(false);
  const [manual, setManual] = useState("");
  const [selected, setSelected] = useState(null);
  const timer = useRef(null);

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
      setSource(data.source || "live quote");
      setAsOf(data.asOf ? new Date(data.asOf).toLocaleString("en-US") : "latest available");
      setManual("");
      setStatus("ok");
      setLastFetched(new Date());
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "Couldn't reach the price service.");
    }
  }, []);

  useEffect(() => { fetchPrice(); }, [fetchPrice]);

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
        acc.fee += r.fee; acc.netValue += r.netValue; return acc;
      },
      { shares: 0, invested: 0, marketValue: 0, fee: 0, netValue: 0 }
    );
    t.profit = t.marketValue - t.invested;
    t.netProfit = t.netValue - t.invested;
    t.multiple = t.invested > 0 ? t.netProfit / t.invested : 0;
    t.costBasis = t.shares > 0 ? t.invested / t.shares : 0;
    return t;
  }, [rows]);

  const deltaVsIpo = price - IPO_PRICE;
  const deltaPct = (deltaVsIpo / IPO_PRICE) * 100;
  const up = deltaVsIpo >= 0;

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
                  {up ? "▲" : "▼"} {usd(Math.abs(deltaVsIpo), 2)} ({up ? "+" : "−"}{Math.abs(deltaPct).toFixed(2)}%)
                </span>
                <span style={{ fontSize: 12, color: C.faint }}>vs IPO ${IPO_PRICE}</span>
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
                Net after {Math.round(FEE_RATE * 100)}% fee:&nbsp;
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

        {/* Stat strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 14 }}>
          {[
            ["Total shares", num(totals.shares, 0)],
            ["Blended cost / share", usd(totals.costBasis, 2)],
            ["Gross profit", usd(totals.profit)],
            ["Fee owed (21.5%)", usd(totals.fee)],
          ].map(([label, val]) => (
            <div key={label} style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel2, padding: "14px 16px" }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1, color: C.faint, marginBottom: 7 }}>{label.toUpperCase()}</div>
              <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 600 }} className="tnum">{val}</div>
            </div>
          ))}
        </div>

        {/* Holder detail */}
        {selectedRow && (() => {
          const s = selectedRow;
          const poolShare = totals.marketValue > 0 ? s.marketValue / totals.marketValue : 0;
          const costPer = s.shares > 0 ? s.invested / s.shares : 0;
          const feeLabel = s.flatFee != null ? "Fee (flat $500)" : "Fee (21.5%)";
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
                  {[
                    ["Invested", usd(s.invested)],
                    ["Gross profit", usd(s.profit)],
                    [feeLabel, usd(s.fee)],
                    ["Net profit", usd(s.netProfit)],
                    ["Net return", s.multiple.toFixed(2) + "×"],
                    ["Share of pool", (poolShare * 100).toFixed(1) + "%"],
                  ].map(([l, v]) => (
                    <div key={l} style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel2, padding: "13px 15px" }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.faint, marginBottom: 6 }}>{l.toUpperCase()}</div>
                      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600 }} className="tnum">{v}</div>
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
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontFamily: MONO }} className="tnum">
                <thead>
                  <tr style={{ fontSize: 10.5, color: C.faint, letterSpacing: 1, textAlign: "right" }}>
                    <th style={{ textAlign: "left", padding: "12px 18px", fontWeight: 500 }}>HOLDER</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500 }}>SHARES</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500 }}>INVESTED</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500 }}>MKT VALUE</th>
                    <th style={{ padding: "12px 10px", fontWeight: 500 }}>FEE</th>
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
                      <td style={{ padding: "13px 10px", color: C.faint }}>{usd(r.fee)}</td>
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
                    <td style={{ padding: "14px 10px", color: C.dim }}>{usd(totals.fee)}</td>
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
            <strong style={{ color: C.dim }}>Fees.</strong> Net value applies a 21.5% fee on each holder's gross profit. Moshe Belinow's
            2nd purchase uses its flat $500 fee instead, exactly as in the sheet. Return is net profit ÷ invested.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong style={{ color: C.dim }}>Totals.</strong> Computed once per holder, correcting the original sheet's grand-total row,
            which double-counted Moshe Belinow's subtotal on top of his two purchases.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: C.dim }}>Price.</strong> Fetched from a market-data provider via this app's own server and may be
            delayed relative to the exchange. Verify against your broker before acting.
          </p>
        </div>
      </div>
    </div>
  );
}
