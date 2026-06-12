// Syndicate holdings, parsed from Spacex.xlsx → "Contribution" sheet.
// shares = final post-split share count; invested = amount contributed (USD).
//
// Fees on each holder's gross profit:
//   • 20.0% to the syndicate (main fee)
//   • 1.5% to Aaron Wolko (tracked separately)
// Moshe Belinow's 2nd purchase is exempt from the 1.5% — it pays 20% only (noAaron).
export const MAIN_FEE_RATE = 0.20;    // 20% main fee
export const AARON_FEE_RATE = 0.015;  // 1.5% to Aaron Wolko
export const AARON_NAME = "Aaron Wolko";
export const IPO_PRICE = 135.0;       // baseline price at IPO (June 12, 2026)

// Total shares outstanding (~13.076B), per FactSet and SpaceX's S-1 filing.
// Market cap is computed as price × this, so it always matches the live price.
export const SHARES_OUTSTANDING = 13.076e9;

export const HOLDINGS = [
  { name: "Yossi Pinson", shares: 9935, invested: 60194.0 },
  { name: "Moshe Belinow — 1st", shares: 3400, invested: 20599.82 }, // includes Zalman Korf's 150 sh / $908.82, acquired from him
  { name: "Moshe Belinow — 2nd", shares: 2917.8338, invested: 25000.0, noAaron: true },
  { name: "Ta", shares: 800, invested: 4847.0 },
  { name: "Mushky Korf", shares: 600, invested: 3635.28 },
  { name: "AK", shares: 500, invested: 3029.0 },
  { name: "Miki Dahan", shares: 500, invested: 3029.0 },
  { name: "Moshe Korf", shares: 400, invested: 2423.2 },
  { name: "Mayer", shares: 300, invested: 1817.4 },
  { name: "Mendel Korf", shares: 250, invested: 1515.0 },
  { name: "Mendy Mochkin", shares: 150, invested: 909.0 },
];
