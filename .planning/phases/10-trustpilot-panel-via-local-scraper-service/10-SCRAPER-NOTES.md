# Phase 10: Notes for the Trustpilot scraper owner

## Upstream contract currently used

- `POST {TRUSTPILOT_SCRAPER_URL}/api/reviews`
- Body (fixed): `{ "domain": "<normalized domain>", "max_pages": 1, "limit": 5 }`
- Response fields consumed: `success`, `target`, `trustpilot_url`, `business` (`name`, `review_count`, `trust_score`, `stars`, `website`), `reviews[]` (`id`, `author`, `heading`, `body`, `date`, `location`, `rating`).

## Fields the scraper owner should add to match the Trustpilot header exactly

- `business.logo_url` (string, https URL)
- `business.claimed_since` (string/date)
- `business.categories` (string[])
- `business.rating_distribution` (array of `{ stars, percent }`)

The panel renders these automatically when present; nothing in the app needs to change.

## Failure shapes

Responses for domains with no Trustpilot page are not yet characterized. Any non-success response is shown as an error; `success: true` without `business` is shown as the empty state.

## Observed failure shapes (2026-10-23)

- Existing domain: HTTP 200 `{ success: true, business: { id, name, numberOfReviews, stars, trustScore, website }, reviews: [5 items], total, trustpilot_url, target }` in about 21 s.
- Non-existent Trustpilot page (for example `zzzz-no-such-site-98213.com`): HTTP 200 after about 31 s with `{ success: true, business: {}, reviews: [], total: 0, target, trustpilot_url }`. This maps to the empty state (profile null, "Chưa có hồ sơ Trustpilot cho tên miền này"), is cached only 10 minutes, and is why the server timeout is 45 s.
- Missing domain: HTTP 400 `{ error: "Missing required parameter: 'domain' or 'url' ...", success: false }`, mapped to `scraper_error` 502.
