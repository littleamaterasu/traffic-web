---
status: complete
phase: 01-groundwork-reusable-primitives-cache-factory
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-10-14T00:00:00Z
updated: 2026-10-14T00:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Dashboard render như cũ sau khi tách primitives
expected: Mở trang chủ và thực hiện một tìm kiếm domain. Các panel báo cáo, thẻ số liệu, bảng và bố cục hiển thị y như trước khi refactor — không đổi giao diện, không lỗi console, không mất mục nào.
result: pass

### 2. Dialog giải thích "i" hoạt động đúng
expected: Click nút "i" của một bảng → dialog giải thích mở ra. Nhấn Escape → dialog đóng, tiêu điểm quay lại nút "i". Click nền (backdrop) hoặc nút "Đóng giải thích bảng..." → dialog đóng.
result: pass

### 3. Ô không có dữ liệu hiện "Chưa có dữ liệu"
expected: Khi một chỉ số không có dữ liệu, ô hiển thị mặc định "Chưa có dữ liệu" thay vì trống trắng.
result: pass

### 4. Cache vẫn hoạt động qua factory mới (D1)
expected: Tìm một domain lần 1 → chờ kết quả bình thường. Tìm lại đúng domain đó ngay sau đó → kết quả trả về gần như tức thì (đọc từ cache 24h, không chờ upstream). rationale: factory createCachedStore phải tái hiện đúng chuỗi TTL 24h + dedup của cache cũ.
result: pass

### 5. Cache tách biệt theo domain, chữ ký getTraffic không đổi (D2)
expected: Tìm hai domain khác nhau liên tiếp → mỗi domain cho kết quả riêng đúng của nó, không lẫn dữ liệu. /api/traffic vẫn nhận domain dạng URL hoặc tên miền như trước.
result: pass

### 6. Ứng dụng chạy sạch, contract /api/traffic không đổi (D3)
expected: npm run lint, npm run build đều exit 0; chạy app, tìm một domain thật (nếu có TABAPI_KEY + mạng) → báo cáo đầy đủ như trước; đường ống API và định dạng dữ liệu không đổi.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
