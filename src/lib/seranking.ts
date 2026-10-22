import type {
  SeRankingAdKeyword,
  SeRankingBacklinks,
  SeRankingCompetitor,
  SeRankingOverview,
} from "@/types/seranking";

export class SeRankingApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SeRankingApiError";
  }
}

export async function fetchSeRankingOverview(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingOverview> {
  void domain;
  void apiKey;
  void fetchImpl;
  throw new SeRankingApiError(502, "seranking_error", "Chưa triển khai.");
}

export async function fetchSeRankingKeywords(
  domain: string,
  source: string,
  limit: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingAdKeyword[]> {
  void domain;
  void source;
  void limit;
  void apiKey;
  void fetchImpl;
  throw new SeRankingApiError(502, "seranking_error", "Chưa triển khai.");
}

export async function fetchSeRankingCompetitors(
  domain: string,
  source: string,
  limit: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingCompetitor[]> {
  void domain;
  void source;
  void limit;
  void apiKey;
  void fetchImpl;
  throw new SeRankingApiError(502, "seranking_error", "Chưa triển khai.");
}

export async function fetchSeRankingBacklinks(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingBacklinks | null> {
  void domain;
  void apiKey;
  void fetchImpl;
  throw new SeRankingApiError(502, "seranking_error", "Chưa triển khai.");
}

export function getSeRankingOverview(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingOverview> {
  void domain;
  void apiKey;
  void fetchImpl;
  throw new SeRankingApiError(502, "seranking_error", "Chưa triển khai.");
}

export function getSeRankingKeywords(
  domain: string,
  source: string,
  limit: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingAdKeyword[]> {
  void domain;
  void source;
  void limit;
  void apiKey;
  void fetchImpl;
  throw new SeRankingApiError(502, "seranking_error", "Chưa triển khai.");
}

export function getSeRankingCompetitors(
  domain: string,
  source: string,
  limit: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingCompetitor[]> {
  void domain;
  void source;
  void limit;
  void apiKey;
  void fetchImpl;
  throw new SeRankingApiError(502, "seranking_error", "Chưa triển khai.");
}

export function getSeRankingBacklinks(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingBacklinks | null> {
  void domain;
  void apiKey;
  void fetchImpl;
  throw new SeRankingApiError(502, "seranking_error", "Chưa triển khai.");
}

export function clearSeRankingCache(): void {}
