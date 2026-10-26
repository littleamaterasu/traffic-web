import { NextRequest, NextResponse } from "next/server";
import { isFakeDataEnabled } from "@/lib/config";
import { SeRankingApiError, getSeRankingKeywords } from "@/lib/seranking";
import { DomainValidationError, normalizeDomain } from "@/lib/domain";
import { getFakeSeRankingAds } from "@/lib/fake-domain-data";
import type { ApiErrorBody } from "@/types/traffic";
import type {
  SeRankingAdKeyword,
  SeRankingAdsResponse,
  SeRankingSlice,
} from "@/types/seranking";

export const runtime = "nodejs";

const SOURCE_PATTERN = /^[a-z]{2}$/;
const DEFAULT_SOURCE = "us";
const LIST_LIMIT = 10;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

function toErrorSlice(reason: unknown): SeRankingSlice<SeRankingAdKeyword[]> {
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

  const source = request.nextUrl.searchParams.get("source") ?? DEFAULT_SOURCE;
  if (!SOURCE_PATTERN.test(source)) {
    return errorResponse(400, "invalid_source", "Mã cơ sở dữ liệu khu vực không hợp lệ.");
  }

  if (isFakeDataEnabled()) {
    return NextResponse.json(getFakeSeRankingAds(domain, source), {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  }

  const apiKey = process.env.SE_RANKING_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "missing_api_key", "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ.");
  }

  let ads: SeRankingSlice<SeRankingAdKeyword[]>;
  try {
    ads = {
      data: await getSeRankingKeywords(domain, source, LIST_LIMIT, apiKey),
      error: null,
    };
  } catch (error) {
    ads = toErrorSlice(error);
  }

  return NextResponse.json<SeRankingAdsResponse>(
    { domain, source, ads },
    { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } },
  );
}
