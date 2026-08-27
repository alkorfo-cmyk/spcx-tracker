// Syndicate holdings, parsed from Spacex.xlsx → "Contribution" sheet.
// shares = final post-split share count; invested = amount contributed (USD).
//
// Fees on each holder's gross profit:
//   • 20.0% to the syndicate (main fee)
//   • 1.5% to Aaron Wolko (tracked separately)
// Fees on each holder's gross profit: 20% to the syndicate + 1.5% to Aaron Wolko.
export const MAIN_FEE_RATE = 0.20;    // 20% main fee
export const AARON_FEE_RATE = 0.015;  // 1.5% to Aaron Wolko
export const AARON_NAME = "Aaron Wolko";
export const IPO_PRICE = 135.0;       // baseline price at IPO (June 12, 2026)

// Total shares outstanding, per SpaceX filings and reporting (as of Aug 2026).
// Updated from the ~13.076B IPO-day count to reflect dilution since: ~13.18B by
// mid-August plus ~391M shares issued in the Aug 14, 2026 Cursor/Anysphere
// acquisition (fully diluted, incl. options/RSUs, is ~13.65B).
// Market cap is computed as price × this, so it always matches the live price.
export const SHARES_OUTSTANDING = 13.57e9;

// ── Long-term ("Since 2020") chart anchors ────────────────────────────────────
// SPCX did NOT trade publicly before the June 12, 2026 IPO. The pre-IPO curve is
// built from SpaceX's documented private funding-round valuations, scaled to the
// syndicate's April 2020 entry price — so it passes through the real $135 IPO.
export const ENTRY_2020 = { date: "2020-04-01", price: 6.06 }; // syndicate cost basis
export const VAL_BASE_B = 36;   // SpaceX ≈ $36B valuation around April 2020
export const IPO_DATE = "2026-06-12";
export const VALUATION_HISTORY = [ // date → SpaceX post-money valuation ($B)
  { date: "2020-08-01", valB: 46 },
  { date: "2021-02-01", valB: 74 },
  { date: "2021-10-01", valB: 100 },
  { date: "2022-06-01", valB: 127 },
  { date: "2023-01-01", valB: 137 },
  { date: "2024-06-01", valB: 210 },
  { date: "2024-12-01", valB: 350 },
  { date: "2025-07-01", valB: 400 },
  { date: "2025-12-01", valB: 800 },
];

export const HOLDINGS = [
  { name: "Yossi Pinson", shares: 9935, invested: 60194.0 },
  { name: "Moshe Belinow — 1st", shares: 3400, invested: 20599.82 }, // includes Zalman Korf's 150 sh / $908.82, acquired from him
  { name: "Ta", shares: 800, invested: 4847.0 },
  { name: "Mushky Korf", shares: 600, invested: 3635.28 },
  { name: "AK", shares: 500, invested: 3029.0 },
  { name: "Miki Dahan", shares: 500, invested: 3029.0 },
  { name: "Moshe Korf", shares: 400, invested: 2423.2 },
  { name: "Mayer", shares: 300, invested: 1817.4 },
  { name: "Mendel Korf", shares: 250, invested: 1515.0 },
  { name: "Mendy Mochkin", shares: 150, invested: 909.0 },
];
