# Phase 10: Notes for the Trustpilot scraper owner

## Upstream contract currently used

- `POST {TRUSTPILOT_SCRAPER_URL}/api/reviews`
- Body (fixed): `{ "domain": "<normalized domain>", "max_pages": 1, "limit": 5 }`
- Response fields consumed: `success`, `target`, `trustpilot_url`, `business` (`name`, `review_count`, `trust_score`, `stars`, `website`), `reviews[]` (`id`, `author`, `heading`, `body`, `date`, `location`, `rating`).

## Optional business fields (delivered by scraper.py, 2026-10-24)

`scraper.py` now returns these extra keys inside `business`, read from the same Trustpilot `__NEXT_DATA__` JSON (`props.pageProps`) it already parses, with no extra requests:

- `business.logo_url`: https URL from `businessUnit.profileImageUrl` (the protocol-relative `//...` value gets an `https:` prefix)
- `business.claimed_since`: ISO date from `businessUnit.activity.claimedDate`, only when `businessUnit.isClaimed` is true (null otherwise)
- `business.categories`: string[] breadcrumb from `businessUnit.breadcrumb` (`topLevelDisplayName`, `midLevelDisplayName`, `bottomLevelDisplayName`)
- `business.rating_distribution`: counts object `{ total, one, two, three, four, five }` from `filters.reviewStatistics.ratings`; the web app converts it to percentage buckets per star level

The panel renders these automatically: logo, "Hồ sơ đã xác nhận • MM/YYYY", breadcrumb joined with "›" and a rating-distribution bar chart.

**The scraper process must be restarted** (`python app.py` or the container) to serve the new fields; a server started before the change keeps returning the old `business` object, which the panel handles by hiding the missing parts.

Not exposed on purpose: `businessUnit.contactInfo` (email, address). `numberOfReviewsLast12Months` is available in the same JSON if a future phase wants it.

## Failure shapes

Responses for domains with no Trustpilot page are not yet characterized. Any non-success response is shown as an error; `success: true` without `business` is shown as the empty state.

## Observed failure shapes (2026-10-23)

- Existing domain: HTTP 200 `{ success: true, business: { id, name, numberOfReviews, stars, trustScore, website }, reviews: [5 items], total, trustpilot_url, target }` in about 21 s.
- Non-existent Trustpilot page (for example `zzzz-no-such-site-98213.com`): HTTP 200 after about 31 s with `{ success: true, business: {}, reviews: [], total: 0, target, trustpilot_url }`. This maps to the empty state (profile null, "Chưa có hồ sơ Trustpilot cho tên miền này"), is cached only 10 minutes, and is why the server timeout is 45 s.
- Missing domain: HTTP 400 `{ error: "Missing required parameter: 'domain' or 'url' ...", success: false }`, mapped to `scraper_error` 502.
