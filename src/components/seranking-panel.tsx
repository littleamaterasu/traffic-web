"use client";

import { useEffect, useState } from "react";
import { EmptyCell, MetricCard, Panel } from "@/components/panel";
import type { PanelInfo } from "@/components/panel";
import { formatCompactNumber, formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type {
  SeRankingBacklinks,
  SeRankingBacklinksResponse,
  SeRankingCompetitor,
  SeRankingOverview,
  SeRankingResponse,
  SeRankingSlice,
} from "@/types/seranking";

const ANCHOR_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 20_000;
const FALLBACK_ERROR_MESSAGE = "Không thể tải dữ liệu SE Ranking lúc này.";
const TIMEOUT_MESSAGE = "Yêu cầu mất quá nhiều thời gian. Hãy kiểm tra kết nối và thử lại.";
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };

const SERANKING_INFO = {
  overview: {
    summary:
      "Bảng tổng hợp ước tính SEO và quảng cáo trả phí của SE Ranking cho phạm vi toàn cầu (worldwide): số từ khóa, traffic và giá trị traffic, song song với số liệu của TabAPI.",
    metrics: [
      { label: "Từ khóa tự nhiên", meaning: "Số từ khóa mà SE Ranking ghi nhận website xuất hiện trong kết quả tìm kiếm tự nhiên trên toàn cầu." },
      { label: "Traffic tự nhiên", meaning: "Lượt truy cập ước tính mỗi tháng đến từ tìm kiếm tự nhiên theo SE Ranking." },
      { label: "Giá trị traffic tự nhiên", meaning: "Chi phí quảng cáo ước tính (USD) cần bỏ ra mỗi tháng để mua lượng traffic tự nhiên tương đương." },
      { label: "Từ khóa quảng cáo", meaning: "Số từ khóa mà SE Ranking ghi nhận website đang chạy quảng cáo trả phí." },
      { label: "Traffic quảng cáo", meaning: "Lượt truy cập ước tính mỗi tháng đến từ quảng cáo trả phí." },
      { label: "Giá trị traffic quảng cáo", meaning: "Giá trị ước tính (USD) của traffic quảng cáo, tính theo CPC của từng từ khóa." },
    ],
    note: "SE Ranking là nguồn dữ liệu bổ sung độc lập với TabAPI và tính trên phạm vi toàn cầu; đây là các con số ước tính nên có thể khác với TabAPI và thay đổi theo thời điểm thu thập.",
  },
  competitors: {
    summary:
      "Các tên miền đối thủ đang cạnh tranh cùng nhóm từ khóa quảng cáo trả phí, do SE Ranking xác định trên cùng cơ sở dữ liệu khu vực.",
    metrics: [
      { label: "Tên miền", meaning: "Đối thủ đang cạnh tranh từ khóa quảng cáo với tên miền đang phân tích." },
      { label: "Từ khóa chung", meaning: "Số từ khóa quảng cáo mà cả hai bên cùng sử dụng." },
      { label: "Mức liên quan", meaning: "Điểm domain_relevance đo mức độ liên quan của đối thủ với tên miền." },
      { label: "Traffic", meaning: "Traffic ước tính của đối thủ đến từ nhóm từ khóa chung." },
    ],
    note: "Danh sách đối thủ là ước tính của SE Ranking, có thể khác với các nguồn dữ liệu khác và thay đổi theo thời gian.",
  },
  backlinks: {
    summary:
      "Bản tóm tắt hồ sơ backlink của tên miền theo SE Ranking: tổng backlink, tên miền trỏ về, tỷ lệ dofollow, điểm uy tín và các anchor được dùng nhiều nhất.",
    metrics: [
      { label: "Backlink", meaning: "Tổng số liên kết trỏ về tên miền mà SE Ranking ghi nhận." },
      { label: "Tên miền trỏ về", meaning: "Số tên miền khác nhau chứa liên kết trỏ về." },
      { label: "Dofollow", meaning: "Tỷ lệ backlink dofollow (truyền giá trị SEO) trên tổng số backlink." },
      { label: "Domain InLink Rank", meaning: "Điểm uy tín hồ sơ backlink của tên miền theo thang điểm SE Ranking." },
      { label: "Anchor", meaning: "Văn bản anchor xuất hiện nhiều nhất trong các backlink trỏ về." },
    ],
    note: "Mỗi lần tải tóm tắt backlink tốn credits của tài khoản SE Ranking nên nội dung chỉ được tải khi bấm nút. Số liệu backlink là ước tính và có thể khác với TabAPI.",
  },
} satisfies Record<string, PanelInfo>;

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

function isSliceShape(value: unknown): boolean {
  return typeof value === "object" && value !== null && ("data" in value || "error" in value);
}

function isSeRankingResponse(body: unknown): body is SeRankingResponse {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.domain === "string" &&
    typeof candidate.source === "string" &&
    isSliceShape(candidate.overview) &&
    isSliceShape(candidate.competitors)
  );
}

function isSeRankingBacklinksResponse(body: unknown): body is SeRankingBacklinksResponse {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.domain === "string" && isSliceShape(candidate.backlinks);
}

function formatDofollowShare(data: SeRankingBacklinks): string {
  if (data.backlinks == null || data.dofollow_backlinks == null || data.backlinks === 0) return "—";
  return formatPercent(data.dofollow_backlinks / data.backlinks);
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

function SliceState({ message }: { message: string }) {
  return (
    <div className="p-4 sm:p-5">
      <p role="alert" className="border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">
        {message}
      </p>
    </div>
  );
}

function OverviewPanel({ slice }: { slice: SeRankingSlice<SeRankingOverview> }) {
  const overview = slice.data;
  const hasData = overview?.organic != null || overview?.paid != null;

  return (
    <Panel
      title="SEO & quảng cáo trả phí (SE Ranking)"
      badge="SE Ranking · toàn cầu"
      info={SERANKING_INFO.overview}
    >
      {slice.error ? (
        <SliceState message={slice.error.message} />
      ) : hasData && overview ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          <MetricCard
            label="Từ khóa tự nhiên"
            value={formatNumber(overview.organic?.keywords_count)}
            accent="bg-[#b8f5cf]"
            hint="Số từ khóa tự nhiên SE Ranking ghi nhận trên toàn cầu."
          />
          <MetricCard
            label="Traffic tự nhiên"
            value={formatCompactNumber(overview.organic?.traffic_sum)}
            accent="bg-[#fffdf4]"
            hint="Lượt truy cập ước tính mỗi tháng từ tìm kiếm tự nhiên."
          />
          <MetricCard
            label="Giá trị traffic tự nhiên"
            value={formatCurrency(overview.organic?.price_sum)}
            accent="bg-[#ffdb1f]"
            hint="Chi phí quảng cáo ước tính (USD) để mua lượng traffic tương đương."
          />
          <MetricCard
            label="Từ khóa quảng cáo"
            value={formatNumber(overview.paid?.keywords_count)}
            accent="bg-[#b8f5cf]"
            hint="Số từ khóa trả phí SE Ranking ghi nhận."
          />
          <MetricCard
            label="Traffic quảng cáo"
            value={formatCompactNumber(overview.paid?.traffic_sum)}
            accent="bg-[#fffdf4]"
            hint="Lượt truy cập ước tính mỗi tháng từ quảng cáo."
          />
          <MetricCard
            label="Giá trị traffic quảng cáo"
            value={formatCurrency(overview.paid?.price_sum)}
            accent="bg-[#ffb3c7]"
            hint="Giá trị ước tính (USD) của traffic quảng cáo."
          />
        </div>
      ) : (
        <EmptyCell>SE Ranking chưa có dữ liệu tổng quan cho tên miền này.</EmptyCell>
      )}
    </Panel>
  );
}

function CompetitorsPanel({ slice }: { slice: SeRankingSlice<SeRankingCompetitor[]> }) {
  const competitors = slice.data ?? [];

  return (
    <Panel title="Đối thủ quảng cáo" badge="Nguồn: SE Ranking" info={SERANKING_INFO.competitors}>
      {slice.error ? (
        <SliceState message={slice.error.message} />
      ) : competitors.length ? (
        <div className="responsive-table-wrap p-4 sm:p-5">
          <table className="responsive-table border-2 border-[#171710] text-sm">
            <thead>
              <tr className="border-b-2 border-[#171710] bg-[#ffdb1f] text-left">
                <th scope="col" className="px-3 py-2 font-black uppercase">Tên miền</th>
                <th scope="col" className="px-3 py-2 font-black uppercase">Từ khóa chung</th>
                <th scope="col" className="px-3 py-2 font-black uppercase">Mức liên quan</th>
                <th scope="col" className="px-3 py-2 font-black uppercase">Traffic</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((competitor, index) => (
                <tr key={`${index}-${competitor.domain ?? ""}`} className="border-b-2 border-[#171710]/20">
                  <td data-label="Tên miền" className="px-3 py-2 font-black">{competitor.domain ?? "—"}</td>
                  <td data-label="Từ khóa chung" className="px-3 py-2 font-mono font-black">
                    {formatNumber(competitor.common_keywords)}
                  </td>
                  <td data-label="Mức liên quan" className="px-3 py-2 font-mono font-black">
                    {formatNumber(competitor.domain_relevance)}
                  </td>
                  <td data-label="Traffic" className="px-3 py-2 font-mono font-black">
                    {formatNumber(competitor.traffic_sum)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyCell>Chưa phát hiện đối thủ quảng cáo nào cho tên miền này.</EmptyCell>
      )}
    </Panel>
  );
}

type BacklinksState =
  | { requestedDomain: string | null; phase: "idle" }
  | { requestedDomain: string | null; phase: "loading" }
  | { requestedDomain: string | null; phase: "error"; message: string }
  | { requestedDomain: string | null; phase: "ready"; slice: SeRankingSlice<SeRankingBacklinks> };

const IDLE_BACKLINKS_STATE: BacklinksState = { requestedDomain: null, phase: "idle" };

function BacklinksPanel({ domain }: { domain: string }) {
  const [state, setState] = useState<BacklinksState>(IDLE_BACKLINKS_STATE);

  async function load() {
    setState({ requestedDomain: domain, phase: "loading" });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/seranking/backlinks?domain=${encodeURIComponent(domain)}`, {
        headers: NGROK_HEADERS,
        signal: controller.signal,
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok) {
        setState({ requestedDomain: domain, phase: "error", message: readErrorMessage(body, FALLBACK_ERROR_MESSAGE) });
        return;
      }
      if (!isSeRankingBacklinksResponse(body)) {
        setState({ requestedDomain: domain, phase: "error", message: FALLBACK_ERROR_MESSAGE });
        return;
      }
      if (body.backlinks.error) {
        setState({ requestedDomain: domain, phase: "error", message: body.backlinks.error.message });
        return;
      }
      setState({ requestedDomain: domain, phase: "ready", slice: body.backlinks });
    } catch (cause) {
      setState({
        requestedDomain: domain,
        phase: "error",
        message: isAbortError(cause) ? TIMEOUT_MESSAGE : FALLBACK_ERROR_MESSAGE,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const view = state.requestedDomain === domain ? state : IDLE_BACKLINKS_STATE;
  const slice = view.phase === "ready" ? view.slice : null;
  const data = slice?.data ?? null;

  return (
    <Panel title="Backlink (SE Ranking)" badge="Nguồn: SE Ranking" info={SERANKING_INFO.backlinks}>
      <div className="p-4 sm:p-5">
        <p className="text-xs font-bold leading-relaxed text-[#5e5b4d]">
          Bản tóm tắt backlink do SE Ranking cung cấp; mỗi lần tải tốn credits của tài khoản SE Ranking,
          vì vậy chỉ tải khi bạn cần xem số liệu này.
        </p>
        {view.phase === "error" ? (
          <p role="alert" className="mt-3 border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">
            {view.message}
          </p>
        ) : null}
        {view.phase === "loading" ? (
          <p role="status" className="mt-3 text-sm font-black uppercase">
            Đang tải dữ liệu backlink từ SE Ranking…
          </p>
        ) : null}
        {data ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Backlink" value={formatNumber(data.backlinks)} accent="bg-[#b8f5cf]" />
              <MetricCard label="Tên miền trỏ về" value={formatNumber(data.refdomains)} accent="bg-[#fffdf4]" />
              <MetricCard label="Dofollow" value={formatDofollowShare(data)} accent="bg-[#ffdb1f]" />
              <MetricCard
                label="Domain InLink Rank"
                value={formatNumber(data.domain_inlink_rank)}
                accent="bg-[#ffb3c7]"
              />
            </div>
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-black uppercase tracking-wider">Anchor hàng đầu</h3>
              {data.top_anchors_by_backlinks.length ? (
                <ul aria-label="Anchor hàng đầu" className="space-y-1.5">
                  {data.top_anchors_by_backlinks.slice(0, ANCHOR_LIMIT).map((anchor, index) => (
                    <li
                      key={`${index}-${anchor.anchor}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#171710]/20 pb-1.5 text-xs"
                    >
                      <span className="break-words font-bold">{anchor.anchor}</span>
                      <span className="font-mono font-black">{formatNumber(anchor.backlinks)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyCell>Chưa có anchor nào được ghi nhận.</EmptyCell>
              )}
            </div>
          </>
        ) : view.phase === "ready" ? (
          <EmptyCell>SE Ranking chưa có dữ liệu backlink cho tên miền này.</EmptyCell>
        ) : null}
        {view.phase !== "ready" ? (
          <div className="mt-3">
            <button type="button" onClick={() => void load()} disabled={view.phase === "loading"} className={buttonClass}>
              {view.phase === "error" ? "Thử lại" : "Tải backlink"}
            </button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

type SerankingFetchState =
  | { requestedDomain: string; status: "loading"; data: null; error: null }
  | { requestedDomain: string; status: "error"; data: null; error: string }
  | { requestedDomain: string; status: "ready"; data: SeRankingResponse; error: null };

function loadingState(domain: string): SerankingFetchState {
  return { requestedDomain: domain, status: "loading", data: null, error: null };
}

export function SerankingPanel({ domain }: { domain: string }) {
  const [state, setState] = useState<SerankingFetchState>(() => loadingState(domain));

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    void (async () => {
      try {
        const response = await fetch(`/api/seranking?domain=${encodeURIComponent(domain)}`, {
          headers: NGROK_HEADERS,
          signal: controller.signal,
        });
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        if (!response.ok) {
          setState({ requestedDomain: domain, status: "error", data: null, error: readErrorMessage(body, FALLBACK_ERROR_MESSAGE) });
          return;
        }
        if (!isSeRankingResponse(body)) {
          setState({ requestedDomain: domain, status: "error", data: null, error: FALLBACK_ERROR_MESSAGE });
          return;
        }
        setState({ requestedDomain: domain, status: "ready", data: body, error: null });
      } catch (cause) {
        setState({
          requestedDomain: domain,
          status: "error",
          data: null,
          error: isAbortError(cause) ? TIMEOUT_MESSAGE : FALLBACK_ERROR_MESSAGE,
        });
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [domain]);

  const view = state.requestedDomain === domain ? state : loadingState(domain);

  return (
    <div className="space-y-6" aria-live="polite">
      {view.status === "loading" ? (
        <Panel
          title="SEO & quảng cáo trả phí (SE Ranking)"
          badge="SE Ranking · toàn cầu"
          info={SERANKING_INFO.overview}
        >
          <div role="status" className="flex flex-col gap-3 p-5">
            <div className="loading-stripes h-5 border-2 border-[#171710]" />
            <p className="text-center font-black uppercase">Đang tải dữ liệu SE Ranking…</p>
          </div>
        </Panel>
      ) : view.status === "error" ? (
        <Panel
          title="SEO & quảng cáo trả phí (SE Ranking)"
          badge="SE Ranking · toàn cầu"
          info={SERANKING_INFO.overview}
        >
          <div className="p-4 sm:p-5">
            <p role="alert" className="border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">
              {view.error}
            </p>
          </div>
        </Panel>
      ) : (
        <>
          <OverviewPanel slice={view.data.overview} />
          <CompetitorsPanel slice={view.data.competitors} />
          <BacklinksPanel domain={domain} />
        </>
      )}
    </div>
  );
}
