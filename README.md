# lvcheck — Maximum Leverage Calculator

lvcheck is a serverless Next.js web application that estimates the maximum leverage you can take on a crypto perpetual trade from just three inputs: entry price, stop price, and loss limit. The UI guides traders through exchange/symbol selection, risk configuration, and instantly visualises the resulting leverage, expected loss, and (optionally) profit metrics for take-profit targets.

## Feature Highlights
- Direction auto-detection with price distance and percentage tracking.
- Dual risk modes: margin-based (loss amount or % of capital) and position-based checks.
- Maximum leverage, max position size, and loss-at-stop calculations using shared math in `src/lib/calculator.ts`.
- Optional take-profit metrics (R:R, projected PnL, return %) that mirror the selected exposure mode.
- One-click Binance price fetch for quick entry prefill (Bybit/OKX stubs included for future wiring).
- Authenticated traders can revisit saved calculations on `/history` with exchange, leverage, and PnL metrics summarised.
- History archive supports filtering (symbol, exchange, direction, date range), pagination, CSV export, and per-trade detail overlays.

## Quick Start
```bash
npm install
npm run dev
```
Visit `http://localhost:3000` and fill in the form. Results update in real time; warnings highlight invalid combinations (e.g. stop ≥ entry or risk limits that are too tight).

## Supabase Integration
1. [Create a Supabase project](https://supabase.com/dashboard) and enable Email OTP authentication.
2. Copy the project URL and anon key into `.env.local` (see `.env.example`). Restart `npm run dev` so the client picks them up.
3. Run `supabase/schema.sql` in the Supabase SQL editor (or through migrations) to create the `trade_entries` table and RLS policies.
4. Add `https://<your-domain>/auth/callback` to **Authentication ▸ URL Configuration ▸ Redirect URLs** so magic links land back in the app.

When authenticated, traders can save the latest calculation to Supabase (`trade_entries` captures raw inputs, derived leverage metrics, and optional notes). Row-Level Security keeps records siloed per user.

### Key Commands
- `npm run dev` – local development server with HMR.
- `npm run lint` – ESLint with the Next.js ruleset.
- `npm run build` – production build used by Vercel preview/production deployments.

## Project Structure
```
src/
  app/           # App Router entrypoints and page layout
  lib/           # Calculation utilities (pure functions with unit-friendly types)
public/          # Static assets
```
Tailwind CSS v4 drives styling (see `src/app/globals.css` for base tokens). All components live in the App Router so the build ships as static HTML + hydrated islands, ideal for Vercel’s serverless edge.

## Deployment Notes
- The project assumes Node.js 18+ (matches Vercel default).
- `npm run build` performs type-checking; failing builds block deployments.
- Current-price fetch uses the public Binance REST endpoint client-side. If you need authenticated or multi-exchange quotes, add an API route or edge function that proxies outbound requests.

## Next Steps
- Introduce persistent presets (localStorage) for preferred exchanges and risk templates.
- Add test coverage for `calculateMetrics` (Vitest + React Testing Library recommended).
- Expand current-price providers (Bybit, OKX) with CORS-safe proxies.
- Surface liquidation distance estimates once exchange maintenance margin rules are configured.
