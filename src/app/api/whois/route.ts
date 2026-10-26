import { NextRequest, NextResponse } from "next/server";
import { isFakeDataEnabled } from "@/lib/config";
import { WhoisApiError, getWhoisRecord } from "@/lib/whois";
import { DomainValidationError, normalizeDomain } from "@/lib/domain";
import { getFakeWhois } from "@/lib/fake-domain-data";
import type { ApiErrorBody } from "@/types/traffic";
import type { WhoisRecord, WhoisResponse, WhoisSlice } from "@/types/whois";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

function toErrorSlice(reason: unknown): WhoisSlice<WhoisRecord> {
  if (reason instanceof WhoisApiError) {
    return { data: null, error: { code: reason.code, message: reason.message } };
  }
  return {
    data: null,
    error: { code: "unexpected_error", message: "Không thể lấy dữ liệu WHOIS lúc này." },
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
    return NextResponse.json(getFakeWhois(domain), {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  }

  const apiKey = process.env.WHOIS_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "missing_api_key", "Chưa cấu hình WHOIS_API_KEY trên máy chủ.");
  }

  let whois: WhoisSlice<WhoisRecord>;
  try {
    whois = { data: await getWhoisRecord(domain, apiKey), error: null };
  } catch (error) {
    whois = toErrorSlice(error);
  }

  return NextResponse.json<WhoisResponse>(
    { domain, whois },
    { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } },
  );
}
