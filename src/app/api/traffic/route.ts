import { NextRequest, NextResponse } from "next/server";
import { getTrafficMonths, isFakeDataEnabled } from "@/lib/config";
import { DomainValidationError, normalizeDomain } from "@/lib/domain";
import { getFakeTraffic } from "@/lib/fake-traffic";
import { getTraffic, TrafficApiError } from "@/lib/tabapi";
import type { ApiErrorBody } from "@/types/traffic";

export const runtime = "nodejs";

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

    if (isFakeDataEnabled()) {
      return NextResponse.json(getFakeTraffic(domain), {
        headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
      });
    }

    const apiKey = process.env.TABAPI_KEY;
  if (!apiKey) {
    return errorResponse(500, "missing_api_key", "Chưa cấu hình TABAPI_KEY trên máy chủ.");
  }

  let months: number;
  try {
    months = getTrafficMonths();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cấu hình TRAFFIC_MONTHS không hợp lệ.";
    return errorResponse(500, "invalid_configuration", message);
  }

  try {
    const data = await getTraffic(domain, apiKey, months);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof TrafficApiError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(502, "unexpected_error", "Không thể lấy dữ liệu website lúc này.");
  }
}
