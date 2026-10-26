import { NextRequest, NextResponse } from "next/server";
import { AdsApiError, getAds } from "@/lib/ads-transparency";
import { isFakeDataEnabled } from "@/lib/config";
import { DomainValidationError, normalizeDomain } from "@/lib/domain";
import { getFakeAds } from "@/lib/fake-domain-data";
import type { ApiErrorBody } from "@/types/traffic";

export const runtime = "nodejs";

const PAGE_TOKEN = /^[A-Za-z0-9_\-=+/.]{1,2048}$/;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  let domain: string;

  try {
    domain = normalizeDomain(request.nextUrl.searchParams.get("domain"));
  } catch (error) {
    const message = error instanceof DomainValidationError ? error.message : "Tên miền không hợp lệ.";
    return errorResponse(400, "invalid_domain", message);
  }

  const pageToken = request.nextUrl.searchParams.get("page_token");
  if (pageToken !== null && !PAGE_TOKEN.test(pageToken)) {
    return errorResponse(400, "invalid_page_token", "Mã trang không hợp lệ.");
  }

  if (isFakeDataEnabled()) {
    return NextResponse.json(getFakeAds(domain), {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return errorResponse(500, "missing_api_key", "Chưa cấu hình SERPAPI_KEY trên máy chủ.");
  }

  try {
    const data = await getAds(domain, apiKey, pageToken);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  } catch (error) {
    if (error instanceof AdsApiError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(502, "unexpected_error", "Không thể lấy dữ liệu quảng cáo lúc này.");
  }
}
