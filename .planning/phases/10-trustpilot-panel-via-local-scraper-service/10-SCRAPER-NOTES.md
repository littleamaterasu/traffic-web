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
