"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyCell, Panel } from "@/components/panel";
import type { PanelInfo } from "@/components/panel";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { computeStarFills } from "@/lib/trustpilot-stars";
import type {
  TrustpilotBusiness,
  TrustpilotRatingBucket,
  TrustpilotResponse,
  TrustpilotResult,
  TrustpilotReview,
} from "@/types/trustpilot";

const REQUEST_TIMEOUT_MS = 60_000;
const FALLBACK_ERROR_MESSAGE = "Không thể tải đánh giá Trustpilot lúc này.";
const TIMEOUT_MESSAGE = "Yêu cầu mất quá nhiều thời gian. Hãy kiểm tra kết nối và thử lại.";
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };
const TRUSTPILOT_GREEN = "#00b67a";
const TRUSTPILOT_GREY = "#dcdce6";

const TRUSTPILOT_INFO = {
  summary:
    "Hồ sơ đánh giá công khai của tên miền trên Trustpilot: điểm TrustScore, tổng số đánh giá và tối đa 5 đánh giá gần nhất. Dữ liệu chỉ được tải khi bạn bấm nút.",
  metrics: [
    { label: "TrustScore", meaning: "Điểm tin cậy trên thang 5 mà Trustpilot hiển thị cho doanh nghiệp." },
    { label: "Số đánh giá", meaning: "Tổng số đánh giá công khai của doanh nghiệp trên Trustpilot." },
    { label: "Đánh giá gần nhất", meaning: "Tối đa 5 đánh giá mới nhất gồm tiêu đề, nội dung, tác giả, quốc gia và ngày." },
  ],
  note: "Dữ liệu được lấy từ trang Trustpilot công khai thông qua dịch vụ scraper chạy cục bộ của bạn, có thể không khả dụng hoặc đã cũ. Chỉ hiển thị 5 đánh giá mới nhất và được lưu cache 24 giờ. Việc thu thập dữ liệu có thể chịu ràng buộc theo điều khoản của Trustpilot.",
} satisfies PanelInfo;

const buttonClass =
  "border-[3px] border-[#171710] bg-[#171710] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#fff8dc] shadow-[4px_4px_0_#ff7139] transition-transform hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-wait disabled:opacity-70";

function readErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error: unknown }).error;
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string" &&
      (error as { message: string }).message.length > 0
    ) {
      return (error as { message: string }).message;
    }
  }
  return fallback;
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

function isSliceShape(value: unknown): boolean {
  return typeof value === "object" && value !== null && ("data" in value || "error" in value);
}

function isTrustpilotResponse(body: unknown): body is TrustpilotResponse {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.domain === "string" && isSliceShape(candidate.trustpilot);
}

function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function formatScore(value: number | null | undefined): string {
  return value == null ? "—" : formatNumber(Math.round(value * 10) / 10);
}

function StarBoxes({ fills, label, size }: { fills: number[]; label: string; size: number }) {
  if (!fills.length) return null;
  return (
    <div role="img" aria-label={label} className="flex gap-0.5">
      {fills.map((fill, index) => (
        <span
          key={index}
          data-fill={fill}
          className="flex items-center justify-center font-black leading-none text-white"
          style={{
            width: size,
            height: size,
            fontSize: Math.round(size * 0.65),
            background:
              fill >= 1
                ? TRUSTPILOT_GREEN
                : fill > 0
                  ? `linear-gradient(90deg, ${TRUSTPILOT_GREEN} 50%, ${TRUSTPILOT_GREY} 50%)`
                  : TRUSTPILOT_GREY,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function formatClaimedSince(value: string | null | undefined): string | null {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})/.exec(value) : null;
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[2]}/${match[1]}`;
}

function RatingDistribution({ buckets }: { buckets: TrustpilotRatingBucket[] }) {
  const rows = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    percent: buckets.find((bucket) => bucket.stars === stars)?.percent ?? 0,
  }));
  return (
    <ul aria-label="Phân bố đánh giá" className="mt-4 space-y-1.5">
      {rows.map((row) => (
        <li key={row.stars} className="flex items-center gap-2 text-xs font-bold">
          <span className="w-14 shrink-0">{row.stars} sao</span>
          <span className="h-3 flex-1 bg-[#dcdce6]">
            <span
              className="block h-3"
              style={{ width: `${Math.min(Math.max(row.percent, 0), 100)}%`, background: TRUSTPILOT_GREEN }}
            />
          </span>
          <span className="w-12 shrink-0 text-right">{formatNumber(row.percent)}%</span>
        </li>
      ))}
    </ul>
  );
}

function BusinessHeader({
  business,
  trustpilotUrl,
}: {
  business: TrustpilotBusiness;
  trustpilotUrl: string | null;
}) {
  const fills = computeStarFills(business.stars, business.trust_score);
  const shownScore = business.stars && business.stars > 0 ? business.stars : business.trust_score;
  const logo = safeHref(business.logo_url);
  const profileHref = safeHref(trustpilotUrl);
  const websiteHref = safeHref(business.website);
  const categories = business.categories ?? [];
  const distribution = business.rating_distribution ?? [];
  const claimed = formatClaimedSince(business.claimed_since);
  const linkClass = "border-2 border-[#171710] bg-[#fff8dc] px-3 py-1.5 text-xs font-black uppercase underline";

  return (
    <div className="border-[3px] border-[#171710] bg-[#fffdf4] p-4 shadow-[5px_5px_0_#171710]">
      <div className="flex flex-wrap items-start gap-4">
        {logo ? (
          <img src={logo} alt={business.name} referrerPolicy="no-referrer" className="h-16 w-16 border-2 border-[#171710] object-contain" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-2xl font-black tracking-[-0.03em]">{business.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm font-black">
              TrustScore <span className="text-xl">{formatScore(business.trust_score)}</span>
            </p>
            <StarBoxes fills={fills} label={`Điểm ${formatScore(shownScore)} trên 5`} size={24} />
            <p className="text-sm font-bold">{formatNumber(business.review_count)} đánh giá</p>
          </div>
          {claimed ? <p className="mt-2 break-words text-xs font-bold">Hồ sơ đã xác nhận • {claimed}</p> : null}
          {categories.length ? (
            <p className="mt-1 break-words text-xs font-bold text-[#5e5b4d]">Danh mục: {categories.join(" › ")}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {profileHref ? (
              <a href={profileHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Xem trên Trustpilot
              </a>
            ) : null}
            {websiteHref ? (
              <a href={websiteHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Truy cập website
              </a>
            ) : null}
          </div>
        </div>
      </div>
      {distribution.length ? <RatingDistribution buckets={distribution} /> : null}
    </div>
  );
}

function ReviewCard({ review }: { review: TrustpilotReview }) {
  const fills = computeStarFills(review.rating);
  return (
    <li className="space-y-2 border-2 border-[#171710] bg-[#fffdf4] p-3">
      {fills.length ? (
        <StarBoxes fills={fills} label={`Đánh giá ${formatScore(review.rating)} trên 5`} size={20} />
      ) : null}
      {review.heading ? <h4 className="break-words text-sm font-black">{review.heading}</h4> : null}
      {review.body ? <p className="break-words text-sm font-semibold leading-relaxed">{review.body}</p> : null}
      <p className="break-words text-xs font-bold text-[#5e5b4d]">
        {[review.author, review.location, review.date ? formatDate(review.date) : null].filter(Boolean).join(" · ")}
      </p>
    </li>
  );
}

function SourceFooter({ fetchedAt }: { fetchedAt: string }) {
  return (
    <p className="mt-4 text-xs font-bold text-[#5e5b4d]">
      Nguồn: Trustpilot qua scraper nội bộ · Cập nhật {formatDateTime(fetchedAt)}
    </p>
  );
}

type LoadState =
  | { requestedDomain: string | null; phase: "idle" }
  | { requestedDomain: string | null; phase: "loading" }
  | { requestedDomain: string | null; phase: "error"; message: string }
  | { requestedDomain: string | null; phase: "ready"; result: TrustpilotResult };

const IDLE_STATE: LoadState = { requestedDomain: null, phase: "idle" };

export function TrustpilotPanel({ domain }: { domain: string }) {
  const [state, setState] = useState<LoadState>(IDLE_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current = null;
    };
  }, [domain]);

  async function load() {
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrent = () => mountedRef.current && controllerRef.current === controller;
    setState({ requestedDomain: domain, phase: "loading" });
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/trustpilot?domain=${encodeURIComponent(domain)}`, {
        headers: NGROK_HEADERS,
        signal: controller.signal,
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!isCurrent()) return;
      if (!response.ok) {
        setState({ requestedDomain: domain, phase: "error", message: readErrorMessage(body, FALLBACK_ERROR_MESSAGE) });
        return;
      }
      if (!isTrustpilotResponse(body)) {
        setState({ requestedDomain: domain, phase: "error", message: FALLBACK_ERROR_MESSAGE });
        return;
      }
      if (body.trustpilot.error) {
        setState({ requestedDomain: domain, phase: "error", message: body.trustpilot.error.message });
        return;
      }
      if (!body.trustpilot.data) {
        setState({ requestedDomain: domain, phase: "error", message: FALLBACK_ERROR_MESSAGE });
        return;
      }
      setState({ requestedDomain: domain, phase: "ready", result: body.trustpilot.data });
    } catch (cause) {
      if (!isCurrent()) return;
      setState({
        requestedDomain: domain,
        phase: "error",
        message: isAbortError(cause) ? TIMEOUT_MESSAGE : FALLBACK_ERROR_MESSAGE,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const view = state.requestedDomain === domain ? state : IDLE_STATE;

  return (
    <div aria-live="polite">
      <Panel title="Đánh giá Trustpilot" badge="Nguồn: Trustpilot (scraper nội bộ)" info={TRUSTPILOT_INFO}>
        <div className="p-4 sm:p-5">
          {view.phase === "idle" ? (
            <p className="text-sm font-bold leading-relaxed text-[#5e5b4d]">
              Việc lấy đánh giá từ Trustpilot khá chậm, có thể mất tới khoảng một phút, nên chỉ tải khi bạn bấm nút.
            </p>
          ) : null}
          {view.phase === "loading" ? (
            <p role="status" className="text-sm font-black uppercase">
              Đang tải đánh giá Trustpilot… có thể mất tới khoảng một phút.
            </p>
          ) : null}
          {view.phase === "error" ? (
            <p role="alert" className="border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">
              {view.message}
            </p>
          ) : null}
          {view.phase === "ready" ? (
            view.result.profile ? (
              <div className="space-y-4">
                <BusinessHeader business={view.result.profile.business} trustpilotUrl={view.result.profile.trustpilot_url} />
                {view.result.profile.reviews.length ? (
                  <ul aria-label="Đánh giá gần nhất" className="space-y-3">
                    {view.result.profile.reviews.slice(0, 5).map((review, index) => (
                      <ReviewCard key={`${index}-${review.id}`} review={review} />
                    ))}
                  </ul>
                ) : null}
                <SourceFooter fetchedAt={view.result.fetched_at} />
              </div>
            ) : (
              <div>
                <EmptyCell>Chưa có hồ sơ Trustpilot cho tên miền này.</EmptyCell>
                <SourceFooter fetchedAt={view.result.fetched_at} />
              </div>
            )
          ) : null}
          {view.phase !== "ready" || !view.result.profile ? (
            <div className="mt-3">
              <button type="button" onClick={() => void load()} disabled={view.phase === "loading"} className={buttonClass}>
                {view.phase === "error" || view.phase === "ready" ? "Thử lại" : "Tải đánh giá Trustpilot"}
              </button>
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
