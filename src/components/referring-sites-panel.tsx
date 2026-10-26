"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyCell, MetricCard, Panel } from "@/components/panel";
import type { PanelInfo } from "@/components/panel";
import { domainInitial, safeHttpUrl } from "@/lib/backlink-sanitize";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  ReferringBacklink,
  ReferringSitesResponse,
  ReferringSitesResult,
} from "@/types/referring-sites";

const REQUEST_TIMEOUT_MS = 45_000;
const VISIBLE_BACKLINKS = 10;
const FALLBACK_ERROR_MESSAGE = "Không thể tải dữ liệu backlink lúc này.";
const TIMEOUT_MESSAGE = "Yêu cầu mất quá nhiều thời gian. Hãy kiểm tra kết nối và thử lại.";
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };

const REFERRING_SITES_INFO = {
  summary:
    "Dữ liệu dựa trên liên kết (backlink) do TabAPI cung cấp, cho biết những trang web nào đang trỏ liên kết về tên miền này. Đây không phải lượt truy cập theo trọng số và khác với tỷ lệ \"Giới thiệu\" trong bảng Nguồn traffic.",
  metrics: [
    { label: "Domain Rating", meaning: "Điểm uy tín của tên miền trên thang 0-100, càng cao càng có nhiều liên kết chất lượng trỏ về." },
    { label: "Backlinks", meaning: "Tổng số liên kết từ các trang khác trỏ về tên miền." },
    { label: "Tên miền giới thiệu", meaning: "Số tên miền riêng biệt đang trỏ liên kết về tên miền này." },
    { label: "Dofollow", meaning: "Tỷ lệ liên kết dofollow trong tổng số backlink và trong số tên miền giới thiệu." },
    { label: "Top backlink", meaning: "Danh sách mẫu các backlink tiêu biểu, gồm tên miền nguồn, tiêu đề trang, anchor và trang đích." },
  ],
  note: "Danh sách chỉ là mẫu 20 backlink, không phải toàn bộ chỉ mục backlink. Mỗi lần tải tốn 5 credit TabAPI và được lưu cache 24 giờ.",
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

function isReferringSitesResponse(body: unknown): body is ReferringSitesResponse {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.domain === "string" && isSliceShape(candidate.referring_sites);
}

function formatPercentValue(value: number | null): string {
  return value == null ? "—" : `${formatNumber(value)}%`;
}

function BacklinkItem({ item }: { item: ReferringBacklink }) {
  const fromHref = safeHttpUrl(item.from_url);
  const toHref = safeHttpUrl(item.to_url);
  const title = item.title ?? item.from_domain;

  return (
    <li className="border-2 border-[#171710] bg-[#fffdf4] p-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#171710] bg-[#ffdb1f] font-black"
        >
          {domainInitial(item.from_domain)}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-black">{item.from_domain}</span>
            {item.domain_rating != null ? (
              <span className="border-2 border-[#171710] bg-[#fff8dc] px-2 py-0.5 text-xs font-black">
                DR {item.domain_rating}
              </span>
            ) : null}
          </div>
          <p className="break-words text-sm font-semibold">
            {fromHref ? (
              <a href={fromHref} target="_blank" rel="noopener noreferrer" className="underline">
                {title}
              </a>
            ) : (
              title
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            {item.anchor ? (
              <span className="break-words border-2 border-[#171710] bg-[#b8f5cf] px-2 py-0.5">{item.anchor}</span>
            ) : null}
            <span aria-hidden="true">→</span>
            {toHref ? (
              <a href={toHref} target="_blank" rel="noopener noreferrer" className="break-all underline">
                {item.to_path ?? item.to_url}
              </a>
            ) : (
              <span className="break-all">{item.to_path ?? "—"}</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

type LoadState =
  | { requestedDomain: string | null; phase: "idle" }
  | { requestedDomain: string | null; phase: "loading" }
  | { requestedDomain: string | null; phase: "error"; message: string }
  | { requestedDomain: string | null; phase: "ready"; result: ReferringSitesResult };

const IDLE_STATE: LoadState = { requestedDomain: null, phase: "idle" };

export function ReferringSitesPanel({ domain }: { domain: string }) {
  const [state, setState] = useState<LoadState>(IDLE_STATE);
  const [expanded, setExpanded] = useState(false);
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
    setExpanded(false);
    setState({ requestedDomain: domain, phase: "loading" });
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/referring-sites?domain=${encodeURIComponent(domain)}`, {
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
      if (!isReferringSitesResponse(body)) {
        setState({ requestedDomain: domain, phase: "error", message: FALLBACK_ERROR_MESSAGE });
        return;
      }
      if (body.referring_sites.error) {
        setState({ requestedDomain: domain, phase: "error", message: body.referring_sites.error.message });
        return;
      }
      if (!body.referring_sites.data) {
        setState({ requestedDomain: domain, phase: "error", message: FALLBACK_ERROR_MESSAGE });
        return;
      }
      setState({ requestedDomain: domain, phase: "ready", result: body.referring_sites.data });
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
  const result = view.phase === "ready" ? view.result : null;
  const hasData = result !== null && (result.overview !== null || result.backlinks.length > 0);
  const backlinks = result?.backlinks ?? [];
  const shown = expanded ? backlinks : backlinks.slice(0, VISIBLE_BACKLINKS);
  const remaining = backlinks.length - VISIBLE_BACKLINKS;
  const overview = result?.overview ?? null;

  return (
    <div aria-live="polite">
      <Panel title="Tên miền giới thiệu" badge="Backlink — không phải lượt truy cập" info={REFERRING_SITES_INFO}>
        <div className="p-4 sm:p-5">
          {view.phase === "idle" ? (
            <p className="text-sm font-bold leading-relaxed text-[#5e5b4d]">
              Dữ liệu backlink chỉ được tải khi bạn bấm nút, tốn 5 credit TabAPI và được lưu cache 24 giờ.
            </p>
          ) : null}
          {view.phase === "loading" ? (
            <div role="status">
              <div className="loading-stripes h-5 border-2 border-[#171710]" />
              <p className="mt-3 text-center font-black uppercase">Đang tải backlink…</p>
            </div>
          ) : null}
          {view.phase === "error" ? (
            <p role="alert" className="border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">
              {view.message}
            </p>
          ) : null}
          {result && !hasData ? (
            <EmptyCell>
              Chưa phát hiện backlink nào cho tên miền này — có thể trang quá mới hoặc chưa được thu thập dữ liệu liên kết.
            </EmptyCell>
          ) : null}
          {result && hasData ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MetricCard label="Domain Rating" value={formatNumber(overview?.domain_rating ?? null)} accent="bg-[#b8f5cf]" />
                <MetricCard label="Backlinks" value={formatNumber(overview?.backlinks ?? null)} accent="bg-[#fffdf4]" />
                <MetricCard
                  label="Tên miền giới thiệu"
                  value={formatNumber(overview?.referring_domains ?? null)}
                  accent="bg-[#ffdb1f]"
                />
                <MetricCard
                  label="Dofollow backlink"
                  value={formatPercentValue(overview?.dofollow_backlinks_pct ?? null)}
                  accent="bg-[#fff8dc]"
                />
                <MetricCard
                  label="Dofollow tên miền"
                  value={formatPercentValue(overview?.dofollow_referring_domains_pct ?? null)}
                  accent="bg-[#ffb3c7]"
                />
              </div>
              <h3 className="text-base font-black uppercase">Top backlink</h3>
              {backlinks.length ? (
                <>
                  <ul aria-label="Top backlink" className="space-y-3">
                    {shown.map((item, index) => (
                      <BacklinkItem key={`${index}-${item.from_domain}`} item={item} />
                    ))}
                  </ul>
                  {remaining > 0 ? (
                    <button type="button" onClick={() => setExpanded((value) => !value)} className={buttonClass}>
                      {expanded ? "Ẩn bớt" : `Xem thêm ${remaining} backlink`}
                    </button>
                  ) : null}
                </>
              ) : (
                <EmptyCell>Chưa có backlink mẫu nào được ghi nhận.</EmptyCell>
              )}
              <p className="text-xs font-bold text-[#5e5b4d]">
                Nguồn: TabAPI · Cập nhật {formatDateTime(result.fetched_at)}
              </p>
            </div>
          ) : null}
          {!hasData ? (
            <div className="mt-3">
              <button type="button" onClick={() => void load()} disabled={view.phase === "loading"} className={buttonClass}>
                {view.phase === "error" || view.phase === "ready" ? "Thử lại" : "Tải backlink"}
              </button>
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
