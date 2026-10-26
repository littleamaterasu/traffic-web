import { NextRequest, NextResponse } from "next/server";
import { isFakeDataEnabled } from "@/lib/config";
import { DomainValidationError, normalizeDomain } from "@/lib/domain";
import { getFakeReferringSites } from "@/lib/fake-domain-data";
import { getReferringSites, ReferringSitesApiError } from "@/lib/referring-sites";
import type { ReferringSitesResponse } from "@/types/referring-sites";
import type { ApiErrorBody } from "@/types/traffic";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

function toErrorSlice(reason: unknown): ReferringSitesResponse["referring_sites"] {
  if (reason instanceof ReferringSitesApiError) {
    return { data: null, error: { code: reason.code, message: reason.message } };
  }
  return {
    data: null,
    error: { code: "unexpected_error", message: "Không thể tải dữ liệu backlink lúc này." },
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

  if (isFakeDataEnabled()) {
    return NextResponse.json(getFakeReferringSites(domain), {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  }

  const apiKey = process.env.TABAPI_KEY;
  if (!apiKey) {
    return errorResponse(500, "missing_api_key", "Chưa cấu hình TABAPI_KEY trên máy chủ.");
  }

  let referringSites: ReferringSitesResponse["referring_sites"];
  try {
    referringSites = { data: await getReferringSites(domain, apiKey), error: null };
  } catch (error) {
    referringSites = toErrorSlice(error);
  }

  return NextResponse.json<ReferringSitesResponse>(
    { domain, referring_sites: referringSites },
    { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } },
  );
}
