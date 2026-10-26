export interface ReferringSitesSliceError {
  code: string;
  message: string;
}

export interface ReferringSitesSlice<T> {
  data: T | null;
  error: ReferringSitesSliceError | null;
}

export interface ReferringOverview {
  domain_rating: number | null;
  backlinks: number | null;
  referring_domains: number | null;
  dofollow_backlinks_pct: number | null;
  dofollow_referring_domains_pct: number | null;
}

export interface ReferringBacklink {
  from_url: string | null;
  from_domain: string;
  to_url: string | null;
  to_path: string | null;
  title: string | null;
  anchor: string | null;
  domain_rating: number | null;
}

export interface ReferringSitesResult {
  fetched_at: string;
  overview: ReferringOverview | null;
  backlinks: ReferringBacklink[];
}

export interface ReferringSitesResponse {
  domain: string;
  referring_sites: ReferringSitesSlice<ReferringSitesResult>;
}
