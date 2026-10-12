# Traffic Check

Dashboard Next.js local để tra cứu traffic website qua TabAPI. Giao diện hiển thị tổng quan, lịch sử traffic theo số tháng cấu hình, nguồn traffic, quốc gia, từ khóa và AI referrals.

## Yêu cầu

- Node.js 22.13 trở lên
- Một API key của [TabAPI](https://tabapi.com/)

## Cài đặt

```bash
npm install
```

Sao chép `.env.example` thành `.env.local`, sau đó thay giá trị mẫu:

```env
TABAPI_KEY=sk_your_key_here
TRAFFIC_MONTHS=3
```

`TRAFFIC_MONTHS` nhận số nguyên từ `3` đến `12`; nếu bỏ trống, ứng dụng mặc định dùng `3`. Khởi động lại server sau khi thay đổi giá trị. Không commit `.env.local`. API key chỉ được đọc bởi route backend `/api/traffic` và không được gửi xuống trình duyệt.

## Chạy local

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000), nhập domain hoặc URL rồi chọn **Phân tích ngay**. Mỗi domain thành công được cache trong bộ nhớ tiến trình 24 giờ để hạn chế tiêu credits. Khởi động lại server sẽ xóa cache.

Để mở từ điện thoại cùng mạng Wi-Fi, chạy:

```bash
npm run dev:lan
```

Sau đó truy cập `http://<IPv4-của-máy>:3000` trên điện thoại. Cấu hình development cũng cho phép tunnel `*.ngrok-free.app`.

## Kiểm tra chất lượng

```bash
npm test
npm run lint
npm run build
```

Test dùng mock response và không gọi TabAPI thật.

## Lưu ý dữ liệu

- Mỗi lần lấy dữ liệu mới yêu cầu số tháng trong `TRAFFIC_MONTHS`. TabAPI tính credits theo số tháng thực tế trả về, trong phạm vi 3–12 tháng.
- Các chỉ số là dữ liệu ước tính theo tháng, phù hợp để so sánh và theo dõi xu hướng; không thay thế Google Analytics hoặc dữ liệu first-party.
