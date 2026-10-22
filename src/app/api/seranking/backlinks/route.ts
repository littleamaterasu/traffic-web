import { NextRequest, NextResponse } from "next/server";
import { SeRankingApiError, getSeRankingBacklinks } from "@/lib/seranking";
import { DomainValidationError, normalizeDomain } from "@/lib/domain";
import type { ApiErrorBody } from "@/types/traffic";
import type {
  SeRankingBacklinks,
  SeRankingBacklinksResponse,
  SeRankingSlice,
} from "@/types/seranking";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

function toErrorSlice(reason: unknown): SeRankingSlice<SeRankingBacklinks> {
  if (reason instanceof SeRankingApiError) {
    return { data: null, error: { code: reason.code, message: reason.message } };
  }
  return {
    data: null,
    error: { code: "unexpected_error", message: "Không thể lấy dữ liệu SE Ranking lúc này." },
  };
}

export async function GET(request: NextRequest) {
  let domain: string;

  try {
    domain = normalizeDomain(request.nextUrl.searchParams.get("domain"));
  } catch (error) {
    const message = error instanceof DomainValidationError ? error.message : "Tên miền không hợp lệ.";
    return errorResponse(400, "invalid_domain", message);
  }

  const apiKey = process.env.SE_RANKING_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "missing_api_key", "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ.");
  }

  let backlinks: SeRankingSlice<SeRankingBacklinks>;
  try {
    backlinks = { data: await getSeRankingBacklinks(domain, apiKey), error: null };
  } catch (error) {
    backlinks = toErrorSlice(error);
  }

  return NextResponse.json<SeRankingBacklinksResponse>(
    { domain, backlinks },
    { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } },
  );
}
