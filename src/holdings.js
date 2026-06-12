// Syndicate holdings, parsed from Spacex.xlsx → "Contribution" sheet.
// shares = final post-split share count; invested = amount contributed (USD).
// Moshe Belinow's 2nd purchase carries a flat $500 fee instead of the 21.5% profit fee.
export const HOLDINGS = [
  { name: "Yossi Pinson", shares: 9935, invested: 60194.0 },
  { name: "Moshe Belinow — 1st", shares: 3250, invested: 19691.0 },
  { name: "Moshe Belinow — 2nd", shares: 2917.8338, invested: 25000.0, flatFee: 500 },
  { name: "Ta", shares: 800, invested: 4847.0 },
  { name: "Mushky Korf", shares: 600, invested: 3635.28 },
  { name: "AK", shares: 500, invested: 3029.0 },
  { name: "Miki Dahan", shares: 500, invested: 3029.0 },
  { name: "Moshe Korf", shares: 400, invested: 2423.2 },
  { name: "Mayer", shares: 300, invested: 1817.4 },
  { name: "Mendel Korf", shares: 250, invested: 1515.0 },
  { name: "Zalman Korf", shares: 150, invested: 908.82 },
  { name: "Mendy Mochkin", shares: 150, invested: 909.0 },
];

export const FEE_RATE = 0.215; // 21.5% of profit
export const IPO_PRICE = 135.0; // baseline price at IPO (June 12, 2026)
