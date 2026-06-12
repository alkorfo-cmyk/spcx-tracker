# SPCX Syndicate Tracker

A live value tracker for a syndicate's SpaceX (NASDAQ: SPCX) position. The price
is fetched by the app's own server endpoint, so the market-data API key never
reaches the browser and **anyone with the link can use it — no Claude account needed.**

## What's inside

```
spcx-app/
├─ api/price.js        Serverless endpoint — fetches the live SPCX quote (key stays server-side)
├─ src/
│  ├─ App.jsx          The tracker UI (hero price, totals, per-holder drill-down)
│  ├─ holdings.js      The 12 holdings + fee rate + IPO baseline — edit here
│  └─ main.jsx         React entry point
├─ index.html
├─ package.json
└─ .env.example        Where the API key goes
```

To change holdings, shares, or amounts invested, edit `src/holdings.js` only.

## 1. Get a free price API key

The default provider is [Finnhub](https://finnhub.io). Sign up (free) and copy your
API key. To use a different provider, edit the URL and the `price` field in `api/price.js`.

> New listings can take time to appear in some data feeds. If the provider doesn't
> have SPCX yet, the **SET PRICE** box in the app still lets anyone enter the price
> manually — that always works.

## 2. Run it locally

```bash
npm install
cp .env.example .env.local      # then paste your key into .env.local
npm install -g vercel           # the api/ function runs on Vercel's dev server
vercel dev                      # serves the app AND the /api/price endpoint
```

`npm run dev` (plain Vite) runs the UI but **not** the `/api/price` endpoint — use
`vercel dev` so the price fetch works locally.

## 3. Deploy (Vercel, free tier)

```bash
vercel            # first run links/creates the project
vercel --prod     # deploys to your public URL
```

Then add the key in the Vercel dashboard: **Project → Settings → Environment
Variables → `FINNHUB_API_KEY`**, and redeploy. Any host that supports static
sites plus serverless functions (Netlify, Cloudflare Pages) works with minor tweaks.

## 4. Let Claude Code do steps 2–3 for you

From this folder:

```bash
claude
```

Then ask: *"Install dependencies, set up my Finnhub key in .env.local, run it
locally with vercel dev to confirm the live price loads, then deploy to Vercel."*
Claude Code will run the commands, wire up the env var, and hand back the URL.

## Heads-up on privacy

The deployed URL is public — anyone with the link sees the holders and amounts,
same as a published artifact. Since this is real financial data, consider gating it:
Vercel offers password protection / SSO on deployments, or Claude Code can add a
simple access check. Ask if you'd like that added.

## Notes

- Totals are computed once per holder, correcting the original spreadsheet's
  grand-total row (it double-counted Moshe Belinow's subtotal).
- Prices may be delayed relative to the exchange; verify against your broker before acting.
