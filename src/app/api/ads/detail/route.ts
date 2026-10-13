import { NextRequest, NextResponse } from "next/server";
import { AdsApiError, getAdDetail } from "@/lib/ads-transparency";
import type { ApiErrorBody } from "@/types/traffic";

export const runtime = "nodejs";

const ADVERTISER_ID = /^AR\d{1,40}$/;
const CREATIVE_ID = /^CR\d{1,40}$/;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  const advertiserId = request.nextUrl.searchParams.get("advertiser_id") ?? "";
  const creativeId = request.nextUrl.searchParams.get("creative_id") ?? "";

  if (!ADVERTISER_ID.test(advertiserId) || !CREATIVE_ID.test(creativeId)) {
    return errorResponse(400, "invalid_id", "Mã nhà quảng cáo hoặc creative không hợp lệ.");
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return errorResponse(500, "missing_api_key", "Chưa cấu hình SERPAPI_KEY trên máy chủ.");
  }

  try {
    const data = await getAdDetail(advertiserId, creativeId, apiKey);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  } catch (error) {
    if (error instanceof AdsApiError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(502, "unexpected_error", "Không thể lấy chi tiết creative lúc này.");
  }
}
