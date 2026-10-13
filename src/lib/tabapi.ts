import { createCachedStore } from "@/lib/cached-store";
import type { ApiErrorBody, TrafficResponse } from "@/types/traffic";

const TABAPI_BASE_URL = "https://tabapi.com/api/v1";

export class TrafficApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TrafficApiError";
  }
}

function vietnameseError(status: number, months: number, code?: string): string {
  if (status === 400 || code === "invalid_domain") return "Tên miền không hợp lệ.";
  if (status === 402 || code === "insufficient_credits") return "Tài khoản TabAPI không đủ credits.";
  if (status === 422 || code === "unprocessable") return `Tên miền chưa có đủ ${months} tháng dữ liệu.`;
  if (status === 502 || code === "upstream_error") return "TabAPI đang gặp sự cố. Vui lòng thử lại sau.";
  return "Không thể lấy dữ liệu website lúc này.";
}

async function readError(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

export async function fetchTrafficFromTabApi(
  domain: string,
  apiKey: string,
  months: number,
  fetchImpl: typeof fetch = fetch,
): Promise<TrafficResponse> {
  let response: Response;

  try {
    response = await fetchImpl(
      `${TABAPI_BASE_URL}/domains/${encodeURIComponent(domain)}/traffic?months=${months}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      },
    );
  } catch {
    throw new TrafficApiError(502, "network_error", "Không thể kết nối đến TabAPI.");
  }

  if (!response.ok) {
    const body = await readError(response);
    const code = body?.error?.code ?? "tabapi_error";
    const status = [400, 402, 422, 502].includes(response.status) ? response.status : 502;
    throw new TrafficApiError(status, code, vietnameseError(response.status, months, code));
  }

  return (await response.json()) as TrafficResponse;
}

const trafficStore = createCachedStore<TrafficResponse>();

export async function getTraffic(
  domain: string,
  apiKey: string,
  months: number,
  fetchImpl: typeof fetch = fetch,
): Promise<TrafficResponse> {
  const cacheKey = `${domain}:${months}`;
  return trafficStore.get(cacheKey, () =>
    fetchTrafficFromTabApi(domain, apiKey, months, fetchImpl),
  );
}

export function clearTrafficCache(): void {
  trafficStore.clear();
}
