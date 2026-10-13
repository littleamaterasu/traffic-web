import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCachedStore } from "./cached-store";

let currentTime: number;

beforeEach(() => {
  currentTime = 0;
});

describe("createCachedStore", () => {
  it("trả về dữ liệu đã cache cho cùng key và chỉ gọi loader một lần", async () => {
    const load = vi.fn().mockResolvedValue("dữ-liệu");
    const store = createCachedStore<string>({ now: () => currentTime });

    const first = await store.get("key-1", load);
    const second = await store.get("key-1", load);

    expect(first).toBe("dữ-liệu");
    expect(second).toBe("dữ-liệu");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("gọi loader riêng cho mỗi key khác nhau", async () => {
    const load = vi.fn(async (key: string) => `dữ-liệu-${key}`);
    const store = createCachedStore<string>({ now: () => currentTime });

    await store.get("key-1", () => load("key-1"));
    await store.get("key-2", () => load("key-2"));

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("gọi lại loader khi entry hết hạn — expiresAt bằng thời điểm hiện tại coi như đã hết hạn", async () => {
    const ttlMs = 100;
    const load = vi.fn().mockResolvedValue("dữ-liệu");
    const store = createCachedStore<string>({ ttlMs, now: () => currentTime });

    await store.get("key-1", load);
    currentTime = ttlMs - 1;
    await store.get("key-1", load);
    expect(load).toHaveBeenCalledTimes(1);

    currentTime = ttlMs;
    await store.get("key-1", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("gộp các lời gọi đồng thời cùng key trong khi loader đang chạy — cả hai nhận cùng kết quả", async () => {
    let resolveLoad!: (value: string) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const store = createCachedStore<string>({ now: () => currentTime });

    const first = store.get("key-1", load);
    const second = store.get("key-1", load);

    expect(load).toHaveBeenCalledTimes(1);

    resolveLoad("dữ-liệu-chung");
    await expect(first).resolves.toBe("dữ-liệu-chung");
    await expect(second).resolves.toBe("dữ-liệu-chung");
  });

  it("các lời gọi đồng thời cùng key cùng nhận lỗi khi loader thất bại", async () => {
    let rejectLoad!: (reason: Error) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((_resolve, reject) => {
          rejectLoad = reject;
        }),
    );
    const store = createCachedStore<string>({ now: () => currentTime });

    const first = store.get("key-1", load);
    const second = store.get("key-1", load);

    expect(load).toHaveBeenCalledTimes(1);

    rejectLoad(new Error("lỗi-xảy-ra"));
    await expect(first).rejects.toThrow("lỗi-xảy-ra");
    await expect(second).rejects.toThrow("lỗi-xảy-ra");
  });

  it("không cache lỗi — loader được gọi lại ở lần get sau", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("thất-bại")).mockResolvedValueOnce("thành-công");
    const store = createCachedStore<string>({ now: () => currentTime });

    await expect(store.get("key-1", load)).rejects.toThrow("thất-bại");
    await expect(store.get("key-1", load)).resolves.toBe("thành-công");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("đuổi key cũ nhất theo thứ tự chèn khi vượt maxEntries", async () => {
    const load = vi.fn(async (key: string) => `dữ-liệu-${key}`);
    const store = createCachedStore<string>({ maxEntries: 2, now: () => currentTime });

    await store.get("a", () => load("a"));
    await store.get("b", () => load("b"));
    await store.get("c", () => load("c"));

    expect(load).toHaveBeenCalledTimes(3);

    await store.get("b", () => load("b"));
    await store.get("c", () => load("c"));
    expect(load).toHaveBeenCalledTimes(3);

    await store.get("a", () => load("a"));
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("clear() xóa cache — loader chạy lại cho key đã cache", async () => {
    const load = vi.fn().mockResolvedValue("dữ-liệu");
    const store = createCachedStore<string>({ now: () => currentTime });

    await store.get("key-1", load);
    expect(load).toHaveBeenCalledTimes(1);

    store.clear();
    await store.get("key-1", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("tính thời hạn từ thời điểm load hoàn tất, không phải từ lúc đọc cache", async () => {
    const ttlMs = 100;
    let resolveLoad!: (value: string) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const store = createCachedStore<string>({ ttlMs, now: () => currentTime });

    const pending = store.get("key-1", load);
    currentTime = 90;
    resolveLoad("dữ-liệu");
    await pending;

    currentTime = 189;
    await store.get("key-1", load);
    expect(load).toHaveBeenCalledTimes(1);

    currentTime = 190;
    const reloaded = store.get("key-1", load);
    expect(load).toHaveBeenCalledTimes(2);
    resolveLoad("dữ-liệu-mới");
    await expect(reloaded).resolves.toBe("dữ-liệu-mới");
  });

  it("hai store độc lập — cache ở store này không phục vụ store kia", async () => {
    const load = vi.fn(async (source: string) => `dữ-liệu-${source}`);
    const storeA = createCachedStore<string>({ now: () => currentTime });
    const storeB = createCachedStore<string>({ now: () => currentTime });

    await expect(storeA.get("key-1", () => load("a"))).resolves.toBe("dữ-liệu-a");
    await expect(storeB.get("key-1", () => load("b"))).resolves.toBe("dữ-liệu-b");

    expect(load).toHaveBeenCalledTimes(2);
  });
});
