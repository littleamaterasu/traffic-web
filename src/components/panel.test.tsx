import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EmptyCell, InfoButton, MetricCard, Panel } from "./panel";
import type { PanelInfo } from "./panel";

const sampleInfo: PanelInfo = {
  summary: "Bảng mẫu dùng để kiểm thử các phần giải thích.",
  metrics: [
    { label: "Tháng", meaning: "Kỳ dữ liệu được dùng để tổng hợp." },
    { label: "Lượt truy cập", meaning: "Tổng số phiên truy cập ước tính." },
  ],
  note: "Đây là ghi chú kiểm thử.",
};

describe("Panel", () => {
  it("hiển thị tiêu đề ở h2 và renders children", () => {
    render(
      <Panel title="Lượt truy cập theo tháng">
        <p>Nội dung bảng tháng</p>
      </Panel>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Lượt truy cập theo tháng" })).toBeInTheDocument();
    expect(screen.getByText("Nội dung bảng tháng")).toBeInTheDocument();
  });

  it("chỉ hiển thị badge khi prop badge được truyền", () => {
    const { rerender } = render(
      <Panel title="Nguồn traffic" badge="Đơn vị: %">
        <p>Nội dung nguồn</p>
      </Panel>,
    );
    expect(screen.getByText("Đơn vị: %")).toBeInTheDocument();

    rerender(
      <Panel title="Nguồn traffic">
        <p>Nội dung nguồn</p>
      </Panel>,
    );
    expect(screen.queryByText("Đơn vị: %")).not.toBeInTheDocument();
  });

  it("chỉ hiển thị nút giải thích khi prop info được truyền", () => {
    const { rerender } = render(
      <Panel title="Từ khóa hàng đầu" info={sampleInfo}>
        <p>Nội dung từ khóa</p>
      </Panel>,
    );
    expect(screen.getByRole("button", { name: "Giải thích bảng Từ khóa hàng đầu" })).toBeInTheDocument();

    rerender(
      <Panel title="Từ khóa hàng đầu">
        <p>Nội dung từ khóa</p>
      </Panel>,
    );
    expect(screen.queryByRole("button", { name: "Giải thích bảng Từ khóa hàng đầu" })).not.toBeInTheDocument();
  });

  it("áp dụng className bổ sung lên phần tử section", () => {
    const { container } = render(
      <Panel title="Bảng thử nghiệm" className="mt-10">
        <p>Nội dung thử nghiệm</p>
      </Panel>,
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("mt-10", "bg-[#fffdf4]");
  });
});

describe("InfoButton", () => {
  it("mặc định đóng: aria-expanded false và chưa có dialog", () => {
    render(<InfoButton title="Nguồn traffic" info={sampleInfo} />);

    const trigger = screen.getByRole("button", { name: "Giải thích bảng Nguồn traffic" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mở dialog với aria-modal và aria-labelledby trỏ vào tiêu đề", async () => {
    const user = userEvent.setup();
    render(<InfoButton title="Nguồn traffic" info={sampleInfo} />);

    const trigger = screen.getByRole("button", { name: "Giải thích bảng Nguồn traffic" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const heading = screen.getByRole("heading", { level: 3, name: "Giải thích: Nguồn traffic" });
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
  });

  it("đóng khi nhấn Escape trong khi nút kích hoạt giữ focus", async () => {
    const user = userEvent.setup();
    render(<InfoButton title="Nguồn traffic" info={sampleInfo} />);

    const trigger = screen.getByRole("button", { name: "Giải thích bảng Nguồn traffic" });
    await user.click(trigger);
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("đóng qua nút × và qua nền mờ", async () => {
    const user = userEvent.setup();
    render(<InfoButton title="Nguồn traffic" info={sampleInfo} />);

    await user.click(screen.getByRole("button", { name: "Giải thích bảng Nguồn traffic" }));
    const closeButtons = screen.getAllByRole("button", { name: "Đóng giải thích bảng Nguồn traffic" });
    expect(closeButtons).toHaveLength(2);
    await user.click(closeButtons[1]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Giải thích bảng Nguồn traffic" }));
    await user.click(screen.getAllByRole("button", { name: "Đóng giải thích bảng Nguồn traffic" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hiển thị summary, từng cặp label/meaning và dòng Lưu ý", async () => {
    const user = userEvent.setup();
    render(<InfoButton title="Nguồn traffic" info={sampleInfo} />);

    await user.click(screen.getByRole("button", { name: "Giải thích bảng Nguồn traffic" }));

    expect(screen.getByText("Bảng mẫu dùng để kiểm thử các phần giải thích.")).toBeInTheDocument();
    expect(screen.getByText("Tháng:")).toBeInTheDocument();
    expect(screen.getByText("Kỳ dữ liệu được dùng để tổng hợp.")).toBeInTheDocument();
    expect(screen.getByText("Lượt truy cập:")).toBeInTheDocument();
    expect(screen.getByText("Tổng số phiên truy cập ước tính.")).toBeInTheDocument();
    expect(screen.getByText(/Lưu ý: Đây là ghi chú kiểm thử\./)).toBeInTheDocument();
  });
});

describe("EmptyCell", () => {
  it("hiển thị nhãn trống mặc định khi không truyền children", () => {
    render(<EmptyCell />);

    expect(screen.getByText("Chưa có dữ liệu")).toBeInTheDocument();
  });

  it("hiển thị children thay cho nhãn mặc định", () => {
    render(<EmptyCell>Chưa có dữ liệu referral từ AI assistants.</EmptyCell>);

    expect(screen.getByText("Chưa có dữ liệu referral từ AI assistants.")).toBeInTheDocument();
  });
});

describe("MetricCard", () => {
  it("hiển thị label, value và áp dụng accent class lên thẻ", () => {
    const { container } = render(
      <MetricCard label="Lượt truy cập / tháng" value="1,2 triệu lượt" accent="bg-[#ffdb1f]" />,
    );

    expect(screen.getByText("Lượt truy cập / tháng")).toBeInTheDocument();
    expect(screen.getByText("1,2 triệu lượt")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("bg-[#ffdb1f]", "border-[3px]");
  });
});
