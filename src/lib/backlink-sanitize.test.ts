import {
  capString,
  clampCount,
  clampScore,
  displayPath,
  domainInitial,
  extractHostname,
  safeHttpUrl,
} from "./backlink-sanitize";

describe("clampScore", () => {
  it("giới hạn điểm trong khoảng 0-100", () => {
    expect(clampScore(250)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(93)).toBe(93);
  });

  it("trả về null với giá trị không phải số hữu hạn", () => {
    expect(clampScore("93")).toBeNull();
    expect(clampScore(NaN)).toBeNull();
    expect(clampScore(Infinity)).toBeNull();
  });
});

describe("clampCount", () => {
  it("làm tròn xuống và không âm", () => {
    expect(clampCount(58347754.9)).toBe(58347754);
    expect(clampCount(-3)).toBe(0);
  });

  it("giới hạn ở số nguyên an toàn lớn nhất", () => {
    expect(clampCount(1e300)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("trả về null với giá trị không phải số", () => {
    expect(clampCount("x")).toBeNull();
    expect(clampCount(NaN)).toBeNull();
  });
});

describe("capString", () => {
  it("cắt khoảng trắng hai đầu", () => {
    expect(capString("  abc  ", 10)).toBe("abc");
  });

  it("giới hạn độ dài chuỗi", () => {
    expect(capString("x".repeat(500), 200)?.length).toBe(200);
  });

  it("trả về null với chuỗi rỗng hoặc không phải chuỗi", () => {
    expect(capString("   ", 5)).toBeNull();
    expect(capString(5, 5)).toBeNull();
  });
});

describe("safeHttpUrl", () => {
  it("chấp nhận URL http và https", () => {
    expect(safeHttpUrl("https://a.com/x?y=1")).toBe("https://a.com/x?y=1");
    expect(safeHttpUrl("http://a.com/")).toBe("http://a.com/");
  });

  it("từ chối scheme javascript:", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
  });

  it("từ chối scheme data:", () => {
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
  });

  it("từ chối scheme ftp:", () => {
    expect(safeHttpUrl("ftp://a.com")).toBeNull();
  });

  it("từ chối URL không có scheme và giá trị rỗng hoặc không phải chuỗi", () => {
    expect(safeHttpUrl("//a.com")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });

  it("từ chối URL chứa thông tin đăng nhập", () => {
    expect(safeHttpUrl("https://user:pw@a.com/")).toBeNull();
  });

  it("từ chối URL dài hơn 2000 ký tự", () => {
    expect(safeHttpUrl(`https://a.com/${"x".repeat(2000)}`)).toBeNull();
  });
});

describe("extractHostname", () => {
  it("chuẩn hóa chữ thường và bỏ www.", () => {
    expect(extractHostname("https://WWW.Blog.Example.com/a/b?c#d")).toBe("blog.example.com");
  });

  it("trả về null với URL không an toàn hoặc không hợp lệ", () => {
    expect(extractHostname("javascript:alert(1)")).toBeNull();
    expect(extractHostname("not a url")).toBeNull();
  });
});

describe("displayPath", () => {
  it("hiển thị / cho trang gốc", () => {
    expect(displayPath("https://acme.com/")).toBe("/");
  });

  it("giữ đường dẫn và query, bỏ hash", () => {
    expect(displayPath("https://acme.com/pricing?plan=pro#top")).toBe("/pricing?plan=pro");
  });

  it("cắt đường dẫn quá 80 ký tự và thêm dấu …", () => {
    const result = displayPath(`https://acme.com/${"a".repeat(200)}`);
    expect(result?.length).toBe(80);
    expect(result?.endsWith("…")).toBe(true);
  });

  it("trả về null với URL không an toàn", () => {
    expect(displayPath("javascript:x")).toBeNull();
  });
});

describe("domainInitial", () => {
  it("lấy ký tự chữ-số đầu tiên viết hoa", () => {
    expect(domainInitial("canva.com")).toBe("C");
    expect(domainInitial("9gag.com")).toBe("9");
  });

  it("trả về ? khi không có giá trị", () => {
    expect(domainInitial(null)).toBe("?");
    expect(domainInitial("")).toBe("?");
  });
});
