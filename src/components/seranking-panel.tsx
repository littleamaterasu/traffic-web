"use client";

import { useState } from "react";
import { EmptyCell, MetricCard, Panel } from "@/components/panel";
import type { PanelInfo } from "@/components/panel";
import { formatNumber, formatPercent } from "@/lib/format";
import { cleanAdTitle } from "@/lib/seranking-ad-title";
import type {
  SeRankingAdKeyword,
  SeRankingAdsResponse,
  SeRankingBacklinks,
  SeRankingBacklinksResponse,
  SeRankingCompetitor,
  SeRankingCompetitorsResponse,
  SeRankingSlice,
} from "@/types/seranking";

const ANCHOR_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 20_000;
const FALLBACK_ERROR_MESSAGE = "Không thể tải dữ liệu SE Ranking lúc này.";
const TIMEOUT_MESSAGE = "Yêu cầu mất quá nhiều thời gian. Hãy kiểm tra kết nối và thử lại.";
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };

const SERANKING_INFO = {
  ads: {
    summary:
      "Mẫu quảng cáo Google (tiêu đề, mô tả, đường dẫn hiển thị) và trang đích của các từ khóa trả phí mà SE Ranking ghi nhận cho tên miền.",
    metrics: [
      { label: "Từ khóa", meaning: "Từ khóa trả phí kích hoạt mẫu quảng cáo này." },
      { label: "Khối", meaning: "Vị trí khối quảng cáo trên trang kết quả: trên cùng hoặc cuối trang." },
      { label: "Vị trí", meaning: "Thứ hạng của quảng cáo trong khối tại thời điểm SE Ranking thu thập." },
      { label: "Trang đích", meaning: "Địa chỉ trang mà người dùng đến sau khi bấm vào quảng cáo." },
    ],
    note: "Nguồn là SE Ranking, chỉ là ảnh chụp ước tính trên cơ sở dữ liệu một quốc gia (us), không phải lịch sử đầy đủ và không có thông tin ngày chạy quảng cáo. Số liệu lượng tìm kiếm và giá thầu được cố ý không hiển thị vì TabAPI là nguồn tham chiếu cho các con số. Mỗi lần tải tốn credits của tài khoản SE Ranking nên nội dung chỉ được tải khi bấm nút.",
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
    note: "Mỗi lần tải danh sách đối thủ tốn credits của tài khoản SE Ranking nên nội dung chỉ được tải khi bấm nút. Danh sách là ước tính của SE Ranking, có thể khác với các nguồn dữ liệu khác và thay đổi theo thời gian.",
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

function isSeRankingAdsResponse(body: unknown): body is SeRankingAdsResponse {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.domain === "string" && isSliceShape(candidate.ads);
}

function isSeRankingCompetitorsResponse(body: unknown): body is SeRankingCompetitorsResponse {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.domain === "string" && isSliceShape(candidate.competitors);
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

const AD_LIMIT = 10;
const BLOCK_LABELS = { top: "Trên cùng", bottom: "Cuối trang" } as const;

function isHttpUrl(value: string | null): value is string {
  return value !== null && /^https?:\/\//i.test(value);
}

function AdCard({ ad }: { ad: SeRankingAdKeyword }) {
  return (
    <li className="space-y-1.5 border-2 border-[#171710] bg-[#fffdf4] p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-2 text-xs font-black uppercase">
        <span>{ad.keyword ?? "—"}</span>
        {ad.block ? <span className="bg-[#ffdb1f] px-1.5 py-0.5">{BLOCK_LABELS[ad.block]}</span> : null}
        {ad.position != null ? <span>Vị trí {ad.position}</span> : null}
      </div>
      <p className="break-words font-black">{cleanAdTitle(ad.snippet_title) ?? "—"}</p>
      <p className="break-words font-mono text-xs font-bold text-[#5e5b4d]">{ad.snippet_display_url ?? "—"}</p>
      <p className="break-words text-xs font-bold">{ad.snippet_description ?? "—"}</p>
      <p className="break-all text-xs font-bold">
        <span className="uppercase">Trang đích: </span>
        {isHttpUrl(ad.url) ? (
          <a href={ad.url} target="_blank" rel="noopener noreferrer" className="underline">
            {ad.url}
          </a>
        ) : (
          <span>{ad.url ?? "—"}</span>
        )}
      </p>
    </li>
  );
}

type AdsState =
  | { requestedDomain: string | null; phase: "idle" }
  | { requestedDomain: string | null; phase: "loading" }
  | { requestedDomain: string | null; phase: "error"; message: string }
  | { requestedDomain: string | null; phase: "ready"; slice: SeRankingSlice<SeRankingAdKeyword[]> };

const IDLE_ADS_STATE: AdsState = { requestedDomain: null, phase: "idle" };

function AdsPanel({ domain }: { domain: string }) {
  const [state, setState] = useState<AdsState>(IDLE_ADS_STATE);

  async function load() {
    setState({ requestedDomain: domain, phase: "loading" });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/seranking/ads?domain=${encodeURIComponent(domain)}`, {
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
      if (!isSeRankingAdsResponse(body)) {
        setState({ requestedDomain: domain, phase: "error", message: FALLBACK_ERROR_MESSAGE });
        return;
      }
      if (body.ads.error) {
        setState({ requestedDomain: domain, phase: "error", message: body.ads.error.message });
        return;
      }
      setState({ requestedDomain: domain, phase: "ready", slice: body.ads });
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

  const view = state.requestedDomain === domain ? state : IDLE_ADS_STATE;
  const ads = view.phase === "ready" ? (view.slice.data ?? []) : [];

  return (
    <Panel
      title="Mẫu quảng cáo & trang đích (SE Ranking)"
      badge="Nguồn: SE Ranking · cơ sở dữ liệu us"
      info={SERANKING_INFO.ads}
    >
      <div className="p-4 sm:p-5">
        <p className="text-xs font-bold leading-relaxed text-[#5e5b4d]">
          Mẫu quảng cáo và trang đích do SE Ranking cung cấp; mỗi lần tải tốn credits của tài khoản SE Ranking,
          vì vậy chỉ tải khi bạn cần xem nội dung này.
        </p>
        {view.phase === "error" ? (
          <p role="alert" className="mt-3 border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">
            {view.message}
          </p>
        ) : null}
        {view.phase === "loading" ? (
          <p role="status" className="mt-3 text-sm font-black uppercase">
            Đang tải mẫu quảng cáo từ SE Ranking…
          </p>
        ) : null}
        {view.phase === "ready" ? (
          ads.length ? (
            <ul aria-label="Mẫu quảng cáo" className="mt-3 space-y-3">
              {ads.slice(0, AD_LIMIT).map((ad, index) => (
                <AdCard key={`${index}-${ad.keyword ?? ""}`} ad={ad} />
              ))}
            </ul>
          ) : (
            <EmptyCell>SE Ranking chưa ghi nhận mẫu quảng cáo nào cho tên miền này.</EmptyCell>
          )
        ) : null}
        {view.phase !== "ready" ? (
          <div className="mt-3">
            <button type="button" onClick={() => void load()} disabled={view.phase === "loading"} className={buttonClass}>
              {view.phase === "error" ? "Thử lại" : "Tải mẫu quảng cáo"}
            </button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

type CompetitorsState =
  | { requestedDomain: string | null; phase: "idle" }
  | { requestedDomain: string | null; phase: "loading" }
  | { requestedDomain: string | null; phase: "error"; message: string }
  | { requestedDomain: string | null; phase: "ready"; slice: SeRankingSlice<SeRankingCompetitor[]> };

const IDLE_COMPETITORS_STATE: CompetitorsState = { requestedDomain: null, phase: "idle" };

function CompetitorsPanel({ domain }: { domain: string }) {
  const [state, setState] = useState<CompetitorsState>(IDLE_COMPETITORS_STATE);

  async function load() {
    setState({ requestedDomain: domain, phase: "loading" });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/seranking/competitors?domain=${encodeURIComponent(domain)}`, {
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
      if (!isSeRankingCompetitorsResponse(body)) {
        setState({ requestedDomain: domain, phase: "error", message: FALLBACK_ERROR_MESSAGE });
        return;
      }
      if (body.competitors.error) {
        setState({ requestedDomain: domain, phase: "error", message: body.competitors.error.message });
        return;
      }
      setState({ requestedDomain: domain, phase: "ready", slice: body.competitors });
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

  const view = state.requestedDomain === domain ? state : IDLE_COMPETITORS_STATE;
  const competitors = view.phase === "ready" ? (view.slice.data ?? []) : [];

  return (
    <Panel title="Đối thủ quảng cáo" badge="Nguồn: SE Ranking" info={SERANKING_INFO.competitors}>
      <div className="p-4 sm:p-5">
        <p className="text-xs font-bold leading-relaxed text-[#5e5b4d]">
          Danh sách đối thủ quảng cáo do SE Ranking cung cấp; mỗi lần tải tốn credits của tài khoản SE Ranking,
          vì vậy chỉ tải khi bạn cần xem số liệu này.
        </p>
        {view.phase === "error" ? (
          <p role="alert" className="mt-3 border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">
            {view.message}
          </p>
        ) : null}
        {view.phase === "loading" ? (
          <p role="status" className="mt-3 text-sm font-black uppercase">
            Đang tải danh sách đối thủ từ SE Ranking…
          </p>
        ) : null}
        {view.phase === "ready" ? (
          competitors.length ? (
            <div className="responsive-table-wrap mt-3">
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
          )
        ) : null}
        {view.phase !== "ready" ? (
          <div className="mt-3">
            <button type="button" onClick={() => void load()} disabled={view.phase === "loading"} className={buttonClass}>
              {view.phase === "error" ? "Thử lại" : "Tải đối thủ quảng cáo"}
            </button>
          </div>
        ) : null}
      </div>
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

export function SerankingPanel({ domain }: { domain: string }) {
  return (
    <div className="space-y-6" aria-live="polite">
      <AdsPanel domain={domain} />
      <CompetitorsPanel domain={domain} />
      <BacklinksPanel domain={domain} />
    </div>
  );
}
