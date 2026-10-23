"use client";

import { useEffect, useState } from "react";
import { EmptyCell, MetricCard, Panel } from "@/components/panel";
import type { PanelInfo } from "@/components/panel";
import { formatDate, formatNumber } from "@/lib/format";
import { WHOIS_FIELD_LABELS, summarizeVolatility } from "@/lib/whois-insights";
import type { WhoisHistory, WhoisHistoryResponse, WhoisRecord, WhoisResponse } from "@/types/whois";

const REQUEST_TIMEOUT_MS = 20_000;
const FALLBACK_ERROR_MESSAGE = "Không thể tải dữ liệu WhoisXML lúc này.";
const TIMEOUT_MESSAGE = "Yêu cầu mất quá nhiều thời gian. Hãy kiểm tra kết nối và thử lại.";
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };

const WHOIS_INFO = {
  summary:
    "Tuổi thọ và thông tin đăng ký của tên miền theo WhoisXML: tuổi domain, nhận định về độ mới, nhà đăng ký, các mốc ngày, trạng thái, name server và dấu hiệu dùng dịch vụ ẩn danh. Lịch sử thay đổi chỉ được tải khi bạn bấm nút.",
  metrics: [
    { label: "Tuổi domain", meaning: "Số năm kể từ ngày đăng ký tên miền lần đầu, kèm nhận định domain mới hay lâu năm." },
    { label: "Nhà đăng ký", meaning: "Đơn vị (registrar) đang quản lý đăng ký tên miền." },
    { label: "Ngày hết hạn", meaning: "Thời điểm tên miền hết hạn đăng ký nếu không được gia hạn." },
    { label: "Name server", meaning: "Máy chủ DNS đang phân giải tên miền; thay đổi name server thường đi kèm đổi hosting." },
    { label: "Trạng thái", meaning: "Các cờ trạng thái đăng ký như clientTransferProhibited, clientDeleteProhibited." },
    { label: "Quyền riêng tư", meaning: "Dấu hiệu chủ sở hữu dùng dịch vụ ẩn thông tin WHOIS." },
    { label: "Lịch sử thay đổi", meaning: "Số bản ghi và các lần đổi nhà đăng ký, name server, chủ sở hữu hoặc ngày hết hạn." },
  ],
  note: "Nguồn dữ liệu là WhoisXML. Chỉ báo quyền riêng tư là ước đoán dựa trên tên hoặc tổ chức chủ sở hữu, không phải kết luận chắc chắn. Tải lịch sử tốn credits nên chỉ chạy khi bấm nút và bị giới hạn ở một số bản ghi cố định. Văn bản WHOIS thô không bao giờ được hiển thị. Nhận định tuổi domain dùng ngưỡng 1 năm và 3 năm.",
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

function isWhoisResponse(body: unknown): body is WhoisResponse {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.domain === "string" && isSliceShape(candidate.whois);
}

function isWhoisHistoryResponse(body: unknown): body is WhoisHistoryResponse {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.domain === "string" && isSliceShape(candidate.history);
}

type RecordState =
  | { requestedDomain: string | null; phase: "loading" }
  | { requestedDomain: string | null; phase: "error"; message: string }
  | { requestedDomain: string | null; phase: "ready"; record: WhoisRecord | null };

const LOADING_STATE: RecordState = { requestedDomain: null, phase: "loading" };

async function requestRecord(domain: string, signal: AbortSignal): Promise<RecordState> {
  try {
    const response = await fetch(`/api/whois?domain=${encodeURIComponent(domain)}`, {
      headers: NGROK_HEADERS,
      signal,
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      return { requestedDomain: domain, phase: "error", message: readErrorMessage(body, FALLBACK_ERROR_MESSAGE) };
    }
    if (!isWhoisResponse(body)) {
      return { requestedDomain: domain, phase: "error", message: FALLBACK_ERROR_MESSAGE };
    }
    if (body.whois.error) {
      return { requestedDomain: domain, phase: "error", message: body.whois.error.message };
    }
    return { requestedDomain: domain, phase: "ready", record: body.whois.data };
  } catch (cause) {
    return {
      requestedDomain: domain,
      phase: "error",
      message: isAbortError(cause) ?TIMEOUT_MESSAGE : FALLBACK_ERROR_MESSAGE,
    };
  }
}

function privacyValue(record: WhoisRecord): { value: string; hint: string } {
  if (record.privacy_protected === true) {
    return { value: "Đã phát hiện", hint: "Phát hiện dịch vụ ẩn danh (ước đoán từ tên chủ sở hữu)" };
  }
  if (record.privacy_protected === false) {
    return { value: "Không phát hiện", hint: "Không thấy dấu hiệu dịch vụ ẩn danh (ước đoán)" };
  }
  return { value: "Chưa rõ", hint: "Không đủ thông tin chủ sở hữu để ước đoán" };
}

function TextList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-black uppercase tracking-wider">{label}</h3>
      {items.length ? (
        <ul aria-label={label} className="space-y-1.5">
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className="break-all border-b border-[#171710]/20 pb-1.5 font-mono text-xs font-bold">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyCell>Chưa có dữ liệu</EmptyCell>
      )}
    </div>
  );
}

function RecordView({ record }: { record: WhoisRecord }) {
  const privacy = privacyValue(record);
  const age = record.age_years == null ? "—" : `${formatNumber(Math.round(record.age_years * 10) / 10)} năm`;

  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Tuổi domain" value={age} accent="bg-[#b8f5cf]" hint={record.age_verdict?.label} />
        <MetricCard label="Nhà đăng ký" value={record.registrar ?? "—"} accent="bg-[#fffdf4]" />
        <MetricCard label="Ngày tạo" value={formatDate(record.created_date)} accent="bg-[#ffdb1f]" />
        <MetricCard label="Cập nhật lần cuối" value={formatDate(record.updated_date)} accent="bg-[#fffdf4]" />
        <MetricCard label="Ngày hết hạn" value={formatDate(record.expires_date)} accent="bg-[#ffb3c7]" />
        <MetricCard label="Quyền riêng tư" value={privacy.value} accent="bg-[#fffdf4]" hint={privacy.hint} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextList label="Name server" items={record.name_servers} />
        <TextList label="Trạng thái" items={record.status} />
      </div>
    </>
  );
}

type HistoryState =
  | { requestedDomain: string | null; phase: "idle" }
  | { requestedDomain: string | null; phase: "loading" }
  | { requestedDomain: string | null; phase: "error"; message: string }
  | { requestedDomain: string | null; phase: "ready"; history: WhoisHistory | null };

const IDLE_HISTORY_STATE: HistoryState = { requestedDomain: null, phase: "idle" };

function HistorySection({ domain }: { domain: string }) {
  const [state, setState] = useState<HistoryState>(IDLE_HISTORY_STATE);

  async function load() {
    setState({ requestedDomain: domain, phase: "loading" });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/whois/history?domain=${encodeURIComponent(domain)}`, {
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
      if (!isWhoisHistoryResponse(body)) {
        setState({ requestedDomain: domain, phase: "error", message: FALLBACK_ERROR_MESSAGE });
        return;
      }
      if (body.history.error) {
        setState({ requestedDomain: domain, phase: "error", message: body.history.error.message });
        return;
      }
      setState({ requestedDomain: domain, phase: "ready", history: body.history.data });
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

  const view = state.requestedDomain === domain ? state : IDLE_HISTORY_STATE;

  return (
    <div className="mt-6 border-t-[3px] border-[#171710] pt-4">
      <h3 className="text-sm font-black uppercase tracking-wider">Lịch sử thay đổi</h3>
      <p className="mt-2 text-xs font-bold leading-relaxed text-[#5e5b4d]">
        Lịch sử WHOIS tốn credits của tài khoản WhoisXML và giới hạn ở số bản ghi cố định, vì vậy chỉ tải khi bạn bấm nút.
      </p>
      {view.phase === "error" ? (
        <p role="alert" className="mt-3 border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">
          {view.message}
        </p>
      ) : null}
      {view.phase === "loading" ? (
        <p role="status" className="mt-3 text-sm font-black uppercase">
          Đang tải lịch sử domain từ WhoisXML…
        </p>
      ) : null}
      {view.phase === "ready" ? (
        view.history ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm font-bold">{summarizeVolatility(view.history.summary)}</p>
            {view.history.events.length ? (
              <ul aria-label="Dòng thời gian thay đổi" className="space-y-2">
                {view.history.events.map((event, index) => (
                  <li
                    key={`${index}-${event.date}-${event.field}`}
                    className="space-y-1 border-2 border-[#171710] bg-[#fffdf4] p-3 text-xs"
                  >
                    <p className="font-black uppercase">
                      {formatDate(event.date)} · {WHOIS_FIELD_LABELS[event.field]}
                    </p>
                    <p className="break-words font-bold">
                      {event.from ?? "—"} → {event.to ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {view.history.events_truncated ? (
              <p className="text-xs font-bold text-[#5e5b4d]">
                Chỉ hiển thị các thay đổi gần nhất; các thay đổi cũ hơn đã được lược bớt.
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyCell>WhoisXML chưa có lịch sử WHOIS cho tên miền này.</EmptyCell>
        )
      ) : null}
      {view.phase !== "ready" ? (
        <div className="mt-3">
          <button type="button" onClick={() => void load()} disabled={view.phase === "loading"} className={buttonClass}>
            {view.phase === "error" ? "Thử lại" : "Tải lịch sử domain"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function WhoisPanel({ domain }: { domain: string }) {
  const [state, setState] = useState<RecordState>(LOADING_STATE);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    void requestRecord(domain, controller.signal).then((next) => {
      window.clearTimeout(timeout);
      if (active) setState(next);
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [domain, reloadToken]);

  function retry() {
    setState({ requestedDomain: domain, phase: "loading" });
    setReloadToken((value) => value + 1);
  }

  const view: RecordState = state.requestedDomain === domain ? state : LOADING_STATE;

  return (
    <div aria-live="polite">
      <Panel title="Tuổi thọ & lịch sử domain (WhoisXML)" badge="Nguồn: WhoisXML" info={WHOIS_INFO}>
        <div className="p-4 sm:p-5">
          {view.phase === "loading" ? (
            <p role="status" className="text-sm font-black uppercase">
              Đang tải thông tin WHOIS từ WhoisXML…
            </p>
          ) : null}
          {view.phase === "error" ? (
            <div>
              <p role="alert" className="border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">
                {view.message}
              </p>
              <div className="mt-3">
                <button type="button" onClick={retry} className={buttonClass}>
                  Thử lại
                </button>
              </div>
            </div>
          ) : null}
          {view.phase === "ready" ? (
            view.record ? (
              <RecordView record={view.record} />
            ) : (
              <EmptyCell>WhoisXML chưa có dữ liệu WHOIS cho tên miền này.</EmptyCell>
            )
          ) : null}
          <HistorySection domain={domain} />
        </div>
      </Panel>
    </div>
  );
}
