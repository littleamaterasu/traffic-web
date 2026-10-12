# Traffic Check

Dashboard Next.js local để tra cứu traffic website qua TabAPI. Giao diện hiển thị tổng quan, lịch sử traffic theo số tháng cấu hình, nguồn traffic, quốc gia, từ khóa và AI referrals.

## Chức năng

- Tra cứu bằng tên miền hoặc URL đầy đủ; hệ thống tự chuẩn hóa về domain hợp lệ.
- Hiển thị các chỉ số tổng quan: lượt truy cập tháng, thứ hạng toàn cầu/quốc gia, tỷ lệ thoát, số trang mỗi phiên và thời gian trung bình mỗi phiên.
- Theo dõi lịch sử lượt truy cập và mức thay đổi so với tháng trước.
- Phân tích tỷ trọng traffic theo các nguồn như direct, search, social, referral, email, affiliate và AI.
- Hiển thị quốc gia và từ khóa mang lại traffic hàng đầu, bao gồm volume, CPC và giá trị traffic ước tính.
- Theo dõi tỷ trọng referral từ các AI assistant qua từng tháng.
- Cung cấp nút **i** tại mỗi bảng để giải thích ý nghĩa và cách đọc từng thông số.
- Cho phép cấu hình số tháng lịch sử từ `3` đến `12` qua biến môi trường `TRAFFIC_MONTHS`.
- Cache kết quả thành công trong bộ nhớ 24 giờ theo domain và số tháng để hạn chế tiêu tốn TabAPI credits.
- Giao diện responsive, sử dụng được trên máy tính và điện thoại.

## Yêu cầu

- Node.js 22.13 trở lên
- npm đi kèm Node.js
- Một API key của [TabAPI](https://tabapi.com/)

## Cài đặt

### 1. Mở thư mục dự án

```bash
cd Traffic
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Tạo file cấu hình môi trường

Trên Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Trên macOS hoặc Linux:

```bash
cp .env.example .env.local
```

Mở `.env.local` và thay API key mẫu:

```env
TABAPI_KEY=sk_your_key_here
TRAFFIC_MONTHS=3
```

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| `TABAPI_KEY` | Có | — | API key dùng để gọi TabAPI từ backend. |
| `TRAFFIC_MONTHS` | Không | `3` | Số tháng lịch sử cần lấy, nhận số nguyên từ `3` đến `12`. |

Không commit `.env.local`. `TABAPI_KEY` chỉ được đọc bởi route backend `/api/traffic` và không được gửi xuống trình duyệt. Khởi động lại server sau khi thay đổi cấu hình.

### 4. Chạy ứng dụng

Chế độ phát triển:


```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000), nhập domain hoặc URL rồi chọn **Phân tích ngay**. Mỗi domain thành công được cache trong bộ nhớ tiến trình 24 giờ để hạn chế tiêu credits. Khởi động lại server sẽ xóa cache.

Để mở từ điện thoại cùng mạng Wi-Fi, chạy:

```bash
npm run dev:lan
```

Sau đó truy cập `http://<IPv4-của-máy>:3000` trên điện thoại. Cấu hình development cũng cho phép tunnel `*.ngrok-free.app`.

## Chạy production

```bash
npm run build
npm start
```

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
