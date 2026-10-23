import { NextRequest, NextResponse } from "next/server";
import { SeRankingApiError, getSeRankingOverview } from "@/lib/seranking";
import { DomainValidationError, normalizeDomain } from "@/lib/domain";
import type { ApiErrorBody } from "@/types/traffic";
import type {
  SeRankingResponse,
  SeRankingSlice,
  SeRankingSliceError,
} from "@/types/seranking";

export const runtime = "nodejs";

const SOURCE_PATTERN = /^[a-z]{2}$/;
const DEFAULT_SOURCE = "us";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

function toSlice<T>(result: PromiseSettledResult<T>): SeRankingSlice<T> {
  if (result.status === "fulfilled") {
    return { data: result.value, error: null };
  }
  if (result.reason instanceof SeRankingApiError) {
    return { data: null, error: { code: result.reason.code, message: result.reason.message } };
  }
  const fallback: SeRankingSliceError = {
    code: "unexpected_error",
    message: "Không thể lấy dữ liệu SE Ranking lúc này.",
  };
  return { data: null, error: fallback };
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

  const apiKey = process.env.SE_RANKING_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "missing_api_key", "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ.");
  }

  const [overview] = await Promise.allSettled([getSeRankingOverview(domain, apiKey)]);

  return NextResponse.json<SeRankingResponse>(
    {
      domain,
      source,
      overview: toSlice(overview),
    },
    { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } },
  );
}
