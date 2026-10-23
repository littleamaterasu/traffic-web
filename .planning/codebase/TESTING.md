# Testing Patterns

**Analysis Date:** 2026-10-13

## Test Framework

**Runner:**
- Vitest 5.0.4
- Config: `vitest.config.ts` — jsdom environment, `globals: true`, React plugin (`@vitejs/plugin-react`), `css: true`, path alias `@` → `./src`
- Setup file: `vitest.setup.ts` — single line: `import "@testing-library/jest-dom/vitest";` (adds jest-dom matchers)

**Assertion Library:**
- Vitest `expect` + `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveAttribute`, `toHaveClass`, `toHaveTextContent`)

**Component testing:**
- `@testing-library/react` 16.3.3 (`render`, `screen`)
- `@testing-library/user-event` 14.6.7 (`userEvent.setup()`)
- `jsdom` 27.4.0 as DOM environment

**Run Commands:**
```bash
npm test            # vitest run — all tests, single pass (CI-style)
npm run test:watch  # vitest — watch mode
npm run lint        # eslint . (companion quality gate)
```

**Current state:** 16 test files, 136 tests, all passing (`npx vitest run`, verified 2026-10-23; originally 6 files / 37 tests on 2026-10-13). Test files: `src/app/api/traffic/route.test.ts`, `src/app/api/seranking/{ads,competitors,backlinks}/route.test.ts`, `src/components/{panel,seranking-panel,traffic-dashboard}.test.tsx`, `src/lib/{ads-insights,ads-transparency,cached-store,config,domain,format,seranking-ad-title,seranking,tabapi}.test.ts`. Not covered by tests: `src/components/ads-panel.tsx`, `src/app/api/ads/route.ts`, `src/app/api/ads/detail/route.ts`. Most suite time is jsdom environment startup.

## Test File Organization

**Location:** Co-located with source — every test sits next to the code it tests:
```
src/
├── app/api/traffic/
│   ├── route.ts
│   └── route.test.ts          # API route tests
├── components/
│   ├── traffic-dashboard.tsx
│   └── traffic-dashboard.test.tsx  # component tests
├── lib/
│   ├── config.ts / config.test.ts
│   ├── domain.ts  / domain.test.ts
│   ├── format.ts  / format.test.ts
│   └── tabapi.ts  / tabapi.test.ts
└── test/
    └── fixture.ts             # shared typed fixture
```

**Naming:** Same basename as the source file plus `.test` — `route.test.ts`, `tabapi.test.ts`. Shared test assets go in `src/test/` (currently only `fixture.ts`).

**Structure:** New unit → create `src/lib/<name>.ts` + `src/lib/<name>.test.ts` side by side. New component → `src/components/<name>.tsx` + `.test.tsx`.

## Test Structure

**Suite Organization (standard pattern — `src/lib/tabapi.test.ts`):**
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTrafficCache, fetchTrafficFromTabApi, getTraffic, TrafficApiError } from "./tabapi";
import { trafficFixture } from "@/test/fixture";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TabAPI client", () => {
  beforeEach(() => clearTrafficCache());

  it("gọi đúng endpoint và chỉ gửi key trong Authorization header", async () => { ... });
});
```

**Patterns:**
- One `describe` per exported unit; test names in Vietnamese describing observable behavior
- **Table-driven tests with `it.each`** — the house style for validation/mapping logic:
```typescript
// src/lib/domain.test.ts — input/expected tuples
it.each([
  ["Example.COM", "example.com"],
  ["https://www.example.com/blog?q=1", "www.example.com"],
])("chuẩn hóa %s", (input, expected) => {
  expect(normalizeDomain(input)).toBe(expected);
});

// src/lib/tabapi.test.ts — status/code/message triples
it.each([
  [400, "invalid_domain", "Tên miền không hợp lệ."],
  [402, "insufficient_credits", "Tài khoản TabAPI không đủ credits."],
])("ánh xạ lỗi %s", async (status, code, message) => { ... });
```
- **Setup/teardown via Vitest env stubs:**
```typescript
beforeEach(() => clearTrafficCache());          // reset module-singleton cache
afterEach(() => {
  vi.unstubAllEnvs();                           // restore process.env
  vi.unstubAllGlobals();                        // restore global fetch
});
```
- Async assertions: `await expect(...).rejects.toMatchObject({ status, code, message })`, `.rejects.toBeInstanceOf(TrafficApiError)`, `await expect(...).resolves.toMatchObject(...)`
- No snapshot tests anywhere. Assert on concrete values.

## Mocking

**Framework:** Vitest `vi` utilities only — no MSW, no `nock`.

**Patterns:**

1. **Inject fetch into lib functions** (preferred for `src/lib/` code — the modules accept a defaulted `fetchImpl` parameter):
```typescript
const fetchMock = vi.fn().mockResolvedValue(jsonResponse(trafficFixture));
await fetchTrafficFromTabApi("vercel.com", "sk_test", 6, fetchMock as unknown as typeof fetch);
```

2. **Stub global fetch** (for route handlers and client components, which call plain `fetch`):
```typescript
vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
  new Response(JSON.stringify(trafficFixture), { status: 200, headers: { "Content-Type": "application/json" } }),
));
// in component tests, a plain object suffices:
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => trafficFixture }));
```

3. **Stub env vars** (never touch real `.env.local`):
```typescript
vi.stubEnv("TABAPI_KEY", "sk_test");
vi.stubEnv("TRAFFIC_MONTHS", "6");
```

**What to Mock:**
- `fetch` (global or injected) — the only I/O boundary; tests never hit TabAPI (stated in `README.md`: "Test dùng mock response và không gọi TabAPI thật")
- `process.env` via `vi.stubEnv`
- Module-singleton state reset through exported reset functions (`clearTrafficCache()` in `beforeEach`)

**What NOT to Mock:**
- Pure functions: formatters (`src/lib/format.ts`), validators (`src/lib/domain.ts`), config parser (`src/lib/config.ts`) are tested directly with real inputs
- Real `Response` objects for route-level tests so `response.json()`/`response.text()` behave authentically
- React internals — interact through `userEvent` and assert via `screen` queries

## Fixtures and Factories

**Test Data (`src/test/fixture.ts`):**
- One shared typed literal fixture: `export const trafficFixture: TrafficResponse = { ... }` — a realistic full `TrafficResponse` (vercel.com data)
- Variants are derived by spreading and overriding, keeping a single source of truth:
```typescript
const emptyFixture = {
  ...trafficFixture,
  overview: { global_rank: null, /* ... all null */ },
  monthly_visits: [],
  top_keywords: [],
  top_regions: [],
  ai_traffic: null,
};
```

**Location:** `src/test/fixture.ts`. Add new fixtures here as typed constants, never inline magic objects in multiple tests.

**Secrets-in-tests convention:** fixtures use obviously fake keys (`"sk_test"`, `"sk_route_secret"`), and tests assert the key never leaks into URLs or response bodies: `expect(body).not.toContain(secret)` (`src/app/api/traffic/route.test.ts:58`).

## Coverage

**Requirements:** None enforced — no `@vitest/coverage-v8` provider installed and no `coverage` block in `vitest.config.ts`.

**View Coverage:**
```bash
npx vitest run --coverage   # requires installing @vitest/coverage-v8 first
```
(`coverage/**` is already gitignored in `eslint.config.mjs` global ignores.)

## Test Types

**Unit Tests:**
- `src/lib/*.test.ts` — pure functions and the upstream client (cache behavior, error mapping, header handling). 4 files.

**Integration Tests:**
- `src/app/api/traffic/route.test.ts` — exercises the full GET handler: validation → env config → injected fetch → response body, using real `NextRequest` and real `Response` objects.
- `src/components/traffic-dashboard.test.tsx` — full client flow: type/click → mocked fetch → rendered results, error states, empty states, modal behavior.

**E2E Tests:** Not used. No Playwright/Cypress.

## Common Patterns

**Async UI Testing (`src/components/traffic-dashboard.test.tsx`):**
```typescript
const user = userEvent.setup();
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => trafficFixture }));

render(<TrafficDashboard />);
await user.type(screen.getByLabelText("Tên miền hoặc URL website"), "vercel.com");
await user.click(screen.getByRole("button", { name: /phân tích ngay/i }));

expect(await screen.findByText("Agentic Infrastructure - Vercel")).toBeInTheDocument();  // findBy* for async settle
```

**Error Testing:**
```typescript
// Throwing code — assert class and message
expect(() => getTrafficMonths("13")).toThrow(new RegExp(`${MIN}.*${MAX}`));

// Rejected promises — assert error shape
await expect(getTraffic(...)).rejects.toMatchObject({ status: 402, message: "..." });

// UI errors — role-based
expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản TabAPI không đủ credits.");
```

**Route Handler Testing (`src/app/api/traffic/route.test.ts`):**
```typescript
const response = await GET(new NextRequest("http://localhost/api/traffic?domain=localhost"));
expect(response.status).toBe(400);
await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
```

**Structural/DOM assertions** (used deliberately for the responsive-table contract):
```typescript
expect(container.querySelectorAll(".responsive-table")).toHaveLength(4);
expect(container.querySelectorAll("td[data-label]").length).toBeGreaterThan(0);
```

## Gaps Worth Knowing

- **No coverage tooling** — install `@vitest/coverage-v8` before enforcing thresholds
- **Untested paths:** `AbortController` timeout branch in `src/components/traffic-dashboard.tsx:434-435`; cache eviction (`pruneCache`) and in-flight de-duplication in `src/lib/tabapi.ts:75-113`; `src/app/layout.tsx` / `src/app/page.tsx` render
- **No CI pipeline** (no `.github/workflows`) — `npm test` + `npm run lint` + `npm run build` are the local quality gates per `README.md`
- **No E2E layer** — full-stack behavior (real route → real component) is only covered through separately-mocked halves

---

*Testing analysis: 2026-10-13*
