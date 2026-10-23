import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { whoisFixture, whoisHistoryFixture } from "@/test/whois-fixture";
import type { WhoisHistoryResponse, WhoisResponse } from "@/types/whois";
import { WhoisPanel } from "./whois-panel";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

function routedFetch(routes: { record?: unknown; history?: unknown; recordOk?: boolean; historyOk?: boolean }) {
  return vi.fn(async (url: string) => {
    if (url.startsWith("/api/whois/history")) {
      return jsonResponse(routes.history ?? whoisHistoryFixture, routes.historyOk ?? true);
    }
    return jsonResponse(routes.record ?? whoisFixture, routes.recordOk ?? true);
  });
}

const NGROK_OPTIONS = expect.objectContaining({
  headers: { "ngrok-skip-browser-warning": "true" },
  signal: expect.any(AbortSignal),
});

describe("WhoisPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gọi fetch đúng một lần khi mount, hiển thị trạng thái tải, tiêu đề, badge và nút giải thích", async () => {
    const fetchMock = routedFetch({});
    vi.stubGlobal("fetch", fetchMock);

    render(<WhoisPanel domain="acme.com" />);

    expect(screen.getByRole("status")).toHaveTextContent("Đang tải");
    expect(screen.getByRole("heading", { level: 2, name: "Tuổi thọ & lịch sử domain (WhoisXML)" })).toBeInTheDocument();
    expect(screen.getByText("Nguồn: WhoisXML")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Giải thích bảng Tuổi thọ & lịch sử domain (WhoisXML)" }),
    ).toBeInTheDocument();
    await screen.findByText("GoDaddy.com, LLC");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/whois?domain=acme.com", NGROK_OPTIONS);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/history"))).toBe(false);
  });

  it("hiển thị tuổi, nhận định, nhà đăng ký, các mốc ngày, name server, trạng thái và quyền riêng tư", async () => {
    vi.stubGlobal("fetch", routedFetch({}));

    render(<WhoisPanel domain="acme.com" />);

    expect(await screen.findByText("9,8 năm")).toBeInTheDocument();
    expect(screen.getByText("Domain lâu năm (trên 3 năm)")).toBeInTheDocument();
    expect(screen.getByText("GoDaddy.com, LLC")).toBeInTheDocument();
    expect(screen.getByText("11/01/2017")).toBeInTheDocument();
    expect(screen.getByText("02/12/2025")).toBeInTheDocument();
    expect(screen.getByText("11/01/2027")).toBeInTheDocument();
    const nameServers = screen.getByRole("list", { name: "Name server" });
    expect(within(nameServers).getByText("ns1.acme.com")).toBeInTheDocument();
    expect(within(nameServers).getByText("ns2.acme.com")).toBeInTheDocument();
    const statuses = screen.getByRole("list", { name: "Trạng thái" });
    expect(within(statuses).getByText("clientTransferProhibited")).toBeInTheDocument();
    expect(within(statuses).getByText("clientDeleteProhibited")).toBeInTheDocument();
    expect(screen.getByText("Đã phát hiện")).toBeInTheDocument();
    expect(screen.getByText(/Phát hiện dịch vụ ẩn danh \(ước đoán/)).toBeInTheDocument();
  });

  it("hiển thị Không phát hiện khi privacy_protected là false và Chưa rõ khi là null", async () => {
    const falseBody = clone<WhoisResponse>(whoisFixture);
    falseBody.whois.data!.privacy_protected = false;
    vi.stubGlobal("fetch", routedFetch({ record: falseBody }));
    const first = render(<WhoisPanel domain="acme.com" />);
    expect(await screen.findByText("Không phát hiện")).toBeInTheDocument();
    first.unmount();

    const nullBody = clone<WhoisResponse>(whoisFixture);
    nullBody.whois.data!.privacy_protected = null;
    vi.stubGlobal("fetch", routedFetch({ record: nullBody }));
    render(<WhoisPanel domain="acme.com" />);
    expect(await screen.findByText("Chưa rõ")).toBeInTheDocument();
  });

  it("hiển thị lỗi role=alert với nút Thử lại và tải lại bản ghi hiện tại", async () => {
    const user = userEvent.setup();
    const errorBody = clone<WhoisResponse>(whoisFixture);
    errorBody.whois = { data: null, error: { code: "upstream_error", message: "WhoisXML tạm thời không phản hồi." } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(errorBody))
      .mockResolvedValueOnce(jsonResponse(whoisFixture));
    vi.stubGlobal("fetch", fetchMock);

    render(<WhoisPanel domain="acme.com" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("WhoisXML tạm thời không phản hồi.");
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("GoDaddy.com, LLC")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hiển thị thông báo từ máy chủ khi phản hồi không ok và thông báo dự phòng khi body sai dạng", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "missing_api_key", message: "Thiếu khóa WhoisXML." } }, false)),
    );
    const first = render(<WhoisPanel domain="acme.com" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Thiếu khóa WhoisXML.");
    first.unmount();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })));
    render(<WhoisPanel domain="acme.com" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải dữ liệu WhoisXML lúc này.");
  });

  it("hiển thị ô trống khi WhoisXML chưa có dữ liệu", async () => {
    vi.stubGlobal("fetch", routedFetch({ record: { domain: "acme.com", whois: { data: null, error: null } } }));

    render(<WhoisPanel domain="acme.com" />);

    expect(await screen.findByText("WhoisXML chưa có dữ liệu WHOIS cho tên miền này.")).toBeInTheDocument();
  });

  it("không gọi lịch sử khi mount; bấm Tải lịch sử domain gọi đúng một lần và hiển thị trạng thái tải", async () => {
    const user = userEvent.setup();
    let resolveHistory: (value: unknown) => void = () => {};
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith("/api/whois/history")) {
        return new Promise((resolve) => {
          resolveHistory = resolve;
        });
      }
      return Promise.resolve(jsonResponse(whoisFixture));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WhoisPanel domain="acme.com" />);
    await screen.findByText("GoDaddy.com, LLC");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Tải lịch sử domain" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/whois/history?domain=acme.com", NGROK_OPTIONS);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải lịch sử domain");
    expect(screen.getByRole("button", { name: "Tải lịch sử domain" })).toBeDisabled();
    resolveHistory(jsonResponse(whoisHistoryFixture));
    await screen.findByRole("list", { name: "Dòng thời gian thay đổi" });
  });

  it("hiển thị tóm tắt biến động và dòng thời gian, rồi ẩn nút tải lịch sử", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", routedFetch({}));

    render(<WhoisPanel domain="acme.com" />);
    await screen.findByText("GoDaddy.com, LLC");
    await user.click(screen.getByRole("button", { name: "Tải lịch sử domain" }));

    const timeline = await screen.findByRole("list", { name: "Dòng thời gian thay đổi" });
    expect(screen.getByText(/5 bản ghi, theo dõi từ 02\/03\/2018/)).toBeInTheDocument();
    const items = within(timeline).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("10/06/2024");
    expect(items[0]).toHaveTextContent("Quyền riêng tư WHOIS");
    expect(items[0]).toHaveTextContent("Công khai → Ẩn thông tin");
    expect(items[0]).not.toHaveTextContent("public");
    expect(items[0]).not.toHaveTextContent("private");
    expect(items[1]).toHaveTextContent("Name server");
    expect(items[1]).toHaveTextContent("ns1.old-host.net, ns2.old-host.net → ns1.acme.com, ns2.acme.com");
    expect(items[2]).toHaveTextContent("Nhà đăng ký");
    expect(items[2]).toHaveTextContent("Namecheap, Inc. → GoDaddy.com, LLC");
    expect(screen.queryByRole("button", { name: "Tải lịch sử domain" })).not.toBeInTheDocument();
  });

  it("chỉ hiển thị tóm tắt khi có bản ghi nhưng không có sự kiện thay đổi", async () => {
    const user = userEvent.setup();
    const body = clone<WhoisHistoryResponse>(whoisHistoryFixture);
    body.history.data = {
      summary: {
        records: 4,
        first_seen: "2018-03-02T00:00:00Z",
        changes_total: 0,
        registrar_changes: 0,
        nameserver_changes: 0,
        privacy_changes: 0,
      },
      events: [],
      events_truncated: false,
    };
    vi.stubGlobal("fetch", routedFetch({ history: body }));

    render(<WhoisPanel domain="acme.com" />);
    await screen.findByText("GoDaddy.com, LLC");
    await user.click(screen.getByRole("button", { name: "Tải lịch sử domain" }));

    expect(await screen.findByText(/thông tin đăng ký ổn định/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Dòng thời gian thay đổi" })).not.toBeInTheDocument();
  });

  it("hiển thị lỗi lịch sử too_many_records và cho phép thử lại thành công", async () => {
    const user = userEvent.setup();
    const errorBody = clone<WhoisHistoryResponse>(whoisHistoryFixture);
    errorBody.history = {
      data: null,
      error: { code: "too_many_records", message: "Lịch sử quá dài, không tải để tiết kiệm credits." },
    };
    let historyCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/whois/history")) {
        historyCalls += 1;
        return jsonResponse(historyCalls === 1 ? errorBody : whoisHistoryFixture);
      }
      return jsonResponse(whoisFixture);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WhoisPanel domain="acme.com" />);
    await screen.findByText("GoDaddy.com, LLC");
    await user.click(screen.getByRole("button", { name: "Tải lịch sử domain" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Lịch sử quá dài");
    expect(screen.getByText("GoDaddy.com, LLC")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("list", { name: "Dòng thời gian thay đổi" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hiển thị chuỗi nhà đăng ký chứa HTML dưới dạng văn bản thuần", async () => {
    const body = clone<WhoisResponse>(whoisFixture);
    body.whois.data!.registrar = "<img src=x onerror=alert(1)>";
    vi.stubGlobal("fetch", routedFetch({ record: body }));

    const { container } = render(<WhoisPanel domain="acme.com" />);

    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("đặt lại lịch sử về trạng thái chờ và tải lại bản ghi khi đổi tên miền", async () => {
    const user = userEvent.setup();
    const fetchMock = routedFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<WhoisPanel domain="acme.com" />);
    await screen.findByText("GoDaddy.com, LLC");
    await user.click(screen.getByRole("button", { name: "Tải lịch sử domain" }));
    await screen.findByRole("list", { name: "Dòng thời gian thay đổi" });

    rerender(<WhoisPanel domain="other.org" />);

    expect(await screen.findByRole("button", { name: "Tải lịch sử domain" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Dòng thời gian thay đổi" })).not.toBeInTheDocument();
    await screen.findByText("GoDaddy.com, LLC");
    expect(fetchMock).toHaveBeenCalledWith("/api/whois?domain=other.org", NGROK_OPTIONS);
  });
});
