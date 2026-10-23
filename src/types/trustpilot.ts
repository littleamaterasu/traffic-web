export interface TrustpilotSliceError {
  code: string;
  message: string;
}

export interface TrustpilotSlice<T> {
  data: T | null;
  error: TrustpilotSliceError | null;
}

export interface TrustpilotRatingBucket {
  stars: 1 | 2 | 3 | 4 | 5;
  percent: number;
}

export interface TrustpilotBusiness {
  name: string;
  review_count: number | null;
  trust_score: number | null;
  stars: number | null;
  website: string | null;
  logo_url?: string | null;
  claimed_since?: string | null;
  categories?: string[];
  rating_distribution?: TrustpilotRatingBucket[];
}

export interface TrustpilotReview {
  id: string;
  author: string | null;
  heading: string | null;
  body: string | null;
  date: string | null;
  location: string | null;
  rating: number | null;
}

export interface TrustpilotProfile {
  target: string;
  trustpilot_url: string | null;
  business: TrustpilotBusiness;
  reviews: TrustpilotReview[];
}

export interface TrustpilotResult {
  fetched_at: string;
  profile: TrustpilotProfile | null;
}

export interface TrustpilotResponse {
  domain: string;
  trustpilot: TrustpilotSlice<TrustpilotResult>;
}
