import { NextRequest, NextResponse } from "next/server";
import { TrustpilotApiError, getTrustpilotProfile } from "@/lib/trustpilot";
import { DomainValidationError, normalizeDomain } from "@/lib/domain";
import type { ApiErrorBody } from "@/types/traffic";
import type { TrustpilotResponse, TrustpilotResult, TrustpilotSlice } from "@/types/trustpilot";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

function toErrorSlice(reason: unknown): TrustpilotSlice<TrustpilotResult> {
  if (reason instanceof TrustpilotApiError) {
    return { data: null, error: { code: reason.code, message: reason.message } };
  }
  return {
    data: null,
    error: { code: "unexpected_error", message: "Không thể lấy đánh giá Trustpilot lúc này." },
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

  const baseUrl = process.env.TRUSTPILOT_SCRAPER_URL?.trim();
  if (!baseUrl) {
    return errorResponse(
      500,
      "missing_scraper_url",
      "Chưa cấu hình TRUSTPILOT_SCRAPER_URL trên máy chủ.",
    );
  }

  let trustpilot: TrustpilotSlice<TrustpilotResult>;
  try {
    trustpilot = { data: await getTrustpilotProfile(domain, baseUrl), error: null };
  } catch (error) {
    trustpilot = toErrorSlice(error);
  }

  return NextResponse.json<TrustpilotResponse>(
    { domain, trustpilot },
    { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } },
  );
}
