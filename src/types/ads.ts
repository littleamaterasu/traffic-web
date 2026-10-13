export interface AdCreative {
  advertiser_id: string;
  advertiser: string;
  ad_creative_id: string;
  format: string | null;
  target_domain: string | null;
  image: string | null;
  width: number | null;
  height: number | null;
  preview_link: string | null;
  details_link: string | null;
  total_days_shown: number | null;
  first_shown: string | null;
  last_shown: string | null;
}

export interface AdsResponse {
  domain: string;
  total_results: number | null;
  creatives: AdCreative[];
  next_page_token: string | null;
}

export interface AdDetailItem {
  snippet: string | null;
  image: string | null;
}

export interface AdDetailRegion {
  name: string;
  last_shown: string | null;
}

export interface AdDetail {
  advertiser_id: string;
  creative_id: string;
  funded_by: string | null;
  regions: AdDetailRegion[];
  items: AdDetailItem[];
}
