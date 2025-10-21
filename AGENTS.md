# Repository Guidelines

## Project Structure & Module Organization
- The Next.js App Router lives in `src/app/`; keep top-level routes minimal and compose UI from smaller client components.
- `src/app/history/page.tsx` renders the saved-trade archive; keep data loading on the server and reuse Supabase helpers.
- Client-side history UI helpers (detail drawer, CSV export) sit under `src/components/history/`.
- Shared logic (math helpers, providers, hooks) belongs in `src/lib/` or `src/components/`; prefer colocating domain-specific helpers near their feature.
- `public/` serves static assets, while `supabase/` contains SQL migrations/policies. Document deployment quirks in `README.md` rather than ad-hoc notes.

## Build, Test, and Development Commands
- `npm install` — install dependencies; rerun after updating Supabase SDKs or Tailwind.
- `npm run dev` — start the local dev server with hot reload.
- `npm run lint` — run ESLint (includes type-aware rules); fix all errors before committing.
- `npm run build` — compile and type-check exactly as Vercel preview/production builds do.

## Coding Style & Naming Conventions
- Use TypeScript everywhere; export typed helpers from `src/lib/` and avoid `any`.
- React components and hooks follow `PascalCase` / `useCamelCase`; derived constants remain `camelCase` unless they are env keys (`UPPER_SNAKE_CASE`).
- Tailwind CSS powers styling: combine utility classes for state/spacing, keep class lists grouped by layout → color → effects for readability.
- Favor pure functions for calculations (`src/lib/calculator.ts`) and keep side effects inside React components or server actions.

## Testing Guidelines
- Add Vitest + Testing Library under `src/__tests__/` or feature-colocated folders when behaviour hardens.
- Start by snapshotting calculator edge cases (long/short, margin vs position, invalid inputs) so regression risk stays low as formulas evolve.
- Gate critical changes with `npm run build` until a dedicated test script exists; integrate into CI once tests land.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`); group cross-cutting updates by feature.
- PRs must outline intent, testing evidence, Supabase migration references (if any), and screenshots/GIFs for UI changes.

## Supabase & Configuration Tips
- Required env keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). Never expose the service role key in client bundles.
- Apply SQL in `supabase/schema.sql` through the dashboard or migrations, and keep Row Level Security enabled.
- Register redirect URLs such as `https://<domain>/auth/callback` so magic-link auth flows succeed in every environment.
