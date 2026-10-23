export interface WhoisSliceError {
  code: string;
  message: string;
}

export interface WhoisSlice<T> {
  data: T | null;
  error: WhoisSliceError | null;
}

export type WhoisAgeLevel = "very_new" | "new" | "established";

export interface WhoisAgeVerdict {
  level: WhoisAgeLevel;
  label: string;
}

export interface WhoisRecord {
  created_date: string | null;
  updated_date: string | null;
  expires_date: string | null;
  age_days: number | null;
  age_years: number | null;
  age_verdict: WhoisAgeVerdict | null;
  registrar: string | null;
  status: string[];
  name_servers: string[];
  registrant_organization: string | null;
  privacy_protected: boolean | null;
}

export interface WhoisResponse {
  domain: string;
  whois: WhoisSlice<WhoisRecord>;
}

export type WhoisChangeField = "registrar" | "name_servers" | "privacy";

export type WhoisPrivacyState = "private" | "public" | "unknown";

export interface WhoisChangeEvent {
  date: string;
  field: WhoisChangeField;
  from: string | null;
  to: string | null;
}

export interface WhoisHistorySummary {
  records: number;
  first_seen: string | null;
  changes_total: number;
  registrar_changes: number;
  nameserver_changes: number;
  privacy_changes: number;
}

export interface WhoisHistory {
  summary: WhoisHistorySummary;
  events: WhoisChangeEvent[];
  events_truncated: boolean;
}

export interface WhoisHistoryResponse {
  domain: string;
  history: WhoisSlice<WhoisHistory>;
}

export interface WhoisHistoryRecordInput {
  audit: string | null;
  registrar: string | null;
  name_servers: unknown;
  registrant_organization: string | null;
  expires_date: string | null;
}
