export interface SeRankingCompetitor {
  domain: string | null;
  common_keywords: number | null;
  domain_relevance: number | null;
  total_keywords: number | null;
  missing_keywords: number | null;
  traffic_sum: number | null;
  price_sum: number | null;
}

export interface SeRankingSliceError {
  code: string;
  message: string;
}

export interface SeRankingSlice<T> {
  data: T | null;
  error: SeRankingSliceError | null;
}

export interface SeRankingAdKeyword {
  keyword: string | null;
  position: number | null;
  block: "top" | "bottom" | null;
  url: string | null;
  snippet_title: string | null;
  snippet_description: string | null;
  snippet_display_url: string | null;
}

export interface SeRankingAdsResponse {
  domain: string;
  source: string;
  ads: SeRankingSlice<SeRankingAdKeyword[]>;
}

export interface SeRankingCompetitorsResponse {
  domain: string;
  source: string;
  competitors: SeRankingSlice<SeRankingCompetitor[]>;
}
