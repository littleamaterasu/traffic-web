# Technology Stack

**Analysis Date:** 2026-10-13

## Languages

**Primary:**
- TypeScript 6.0.3 (`typescript` in `package.json`) — all application code under `src/`; JS is disallowed (`allowJs: false` in `tsconfig.json`); `strict: true`
- CSS (Tailwind v4 syntax) — styling via `src/app/globals.css` and utility classes in components

**Secondary:**
- None. No server-side or client-side JavaScript sources exist.

## Runtime

**Environment:**
- Node.js ≥ 22.13 (documented in `README.md`; local dev machine runs Node v25.9.0)
- Browser runtime for the client dashboard (`src/components/traffic-dashboard.tsx` is a `"use client"` component)

**Package Manager:**
- npm (bundled with Node; npm 11.12.1 on dev machine)
- Lockfile: `package-lock.json` present (commit it; no `.npmrc` in repo)

## Frameworks

**Core:**
- Next.js 16.4.0 — App Router (`src/app/`), server API route `src/app/api/traffic/route.ts` (`export const runtime = "nodejs"`), static root page `src/app/page.tsx`
- React 19.3.0 + React DOM 19.3.0 — single client component `src/components/traffic-dashboard.tsx`
- Tailwind CSS 4.3.3 — via the PostCSS plugin `@tailwindcss/postcss` (`postcss.config.mjs`); imported with `@import "tailwindcss"` in `src/app/globals.css`; v4 inline config, no `tailwind.config` file

**Testing:**
- Vitest 5.0.4 — runner with jsdom environment and globals enabled (`vitest.config.ts`)
- @testing-library/react 16.3.3, @testing-library/user-event 14.6.7, @testing-library/jest-dom 7.0.1 — DOM component testing
- jsdom 27.4.0 — browser-like test environment

**Build/Dev:**
- Next.js built-in compiler (Turbopack-era Next 16) — `npm run dev` / `npm run build`
- ESLint 9.39.5 (flat config) with `eslint-config-next` core-web-vitals + TypeScript presets (`eslint.config.mjs`)
- TypeScript type-checking via `tsconfig.json` (no separate `tsc` script; type errors surface in `next build`)

## Key Dependencies

**Critical:**
- `next` 16.4.0 — the entire application framework (routing, API routes, build, dev server)
- `react` / `react-dom` 19.3.0 — UI runtime for the dashboard component

**Infrastructure:**
- None. There is no ORM, database driver, HTTP client library, state manager, or UI component library. All data fetching uses the platform-native `fetch` API (`src/lib/tabapi.ts`, `src/components/traffic-dashboard.tsx`) and URL/domain utilities from `node:net` (`src/lib/domain.ts`).

## Configuration

**Environment:**
- `.env.local` file present — contains local environment configuration (existence noted only; never commit it; it is gitignored via `.gitignore`)
- `.env.example` file present — template copied to `.env.local` during setup
- Two server-side env vars are read in code (values are secrets — never quote them):
  - `TABAPI_KEY` — TabAPI bearer token, read only in `src/app/api/traffic/route.ts:23` (server-side)
  - `TRAFFIC_MONTHS` — history window (integer 3–12, default 3), read in `src/lib/config.ts:5`; validated by `getTrafficMonths()`
- No `NEXT_PUBLIC_*` variables exist; no secrets reach the browser bundle

**Build:**
- `next.config.ts` — `reactStrictMode: true`, `agentRules: false`, `allowedDevOrigins: ["192.168.2.12", "*.ngrok-free.app"]` (LAN phone testing and ngrok tunneling)
- `tsconfig.json` — ES2017 target, `moduleResolution: "bundler"`, strict, path alias `@/* → ./src/*`
- `eslint.config.mjs` — ESLint 9 flat config extending `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`; ignores `.next/**`, `coverage/**`
- `postcss.config.mjs` — Tailwind v4 PostCSS plugin
- `vitest.config.ts` — jsdom environment, `globals: true`, setup file `vitest.setup.ts`, `@` alias mirrors tsconfig

**Scripts (`package.json`):**
```bash
npm run dev        # Next dev server (localhost)
npm run dev:lan    # next dev --hostname 0.0.0.0 (phone/LAN access)
npm run build      # production build
npm start          # serve production build
npm run lint       # eslint .
npm test           # vitest run (single pass)
npm run test:watch # vitest (watch mode)
```

## Platform Requirements

**Development:**
- Node.js ≥ 22.13 with npm
- A TabAPI API key in `.env.local` as `TABAPI_KEY` (required for `/api/traffic` to return data; requests without it get a 500 `missing_api_key` response from `src/app/api/traffic/route.ts`)
- Optional: `ngrok` for tunneling — already whitelisted in `next.config.ts`

**Production:**
- Local/self-hosted Node server: `npm run build` then `npm start` (standard Next.js server). No deployment platform config detected (no Vercel/Docker/CI files in repo)
- Note: the traffic cache in `src/lib/tabapi.ts` is an in-process `Map` (24h TTL, max 100 entries) — it resets on restart and is per-instance; a single server instance is the current operating assumption

---

*Stack analysis: 2026-10-13*
