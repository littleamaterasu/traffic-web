export interface SeRankingCompetitor {
  domain: string | null;
  common_keywords: number | null;
  domain_relevance: number | null;
  total_keywords: number | null;
  missing_keywords: number | null;
  traffic_sum: number | null;
  price_sum: number | null;
}

export interface SeRankingAnchor {
  anchor: string;
  backlinks: number | null;
  refdomains: number | null;
}

export interface SeRankingBacklinks {
  target: string | null;
  backlinks: number | null;
  refdomains: number | null;
  dofollow_backlinks: number | null;
  nofollow_backlinks: number | null;
  dofollow_refdomains: number | null;
  domain_inlink_rank: number | null;
  inlink_rank: number | null;
  top_anchors_by_backlinks: SeRankingAnchor[];
  top_anchors_by_refdomains: SeRankingAnchor[];
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

export interface SeRankingBacklinksResponse {
  domain: string;
  backlinks: SeRankingSlice<SeRankingBacklinks>;
}
