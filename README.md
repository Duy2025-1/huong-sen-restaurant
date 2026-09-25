# HỆ THỐNG QUẢN LÝ VÀ VẬN HÀNH NHÀ HÀNG TOÀN DIỆN (RESTAURANT MANAGEMENT SYSTEM - RMS)

Hệ thống kết hợp chặt chẽ giữa 3 phân hệ: **Khách hàng (Client/Customer)**, **Vận hành nội bộ (POS/KDS/Phục vụ)** và **Quản trị cấp cao (Admin/Dashboard)** với cơ chế đồng bộ **Thời gian thực (Real-time WebSockets)**.

---

## 🌟 1. CÁC PHÂN HỆ VÀ TÍNH NĂNG NỔI BẬT

### A. Phân Hệ Khách Hàng (Customer Portal)
- **Trang chủ (`/`)**: Banner giới thiệu nhà hàng, món ăn nổi bật, đặt bàn nhanh, hotline và thông tin chi nhánh.
- **Thực đơn đầy đủ (`/menu`)**: Lọc món theo danh mục, tìm kiếm theo tên/nguyên liệu, xem thời gian chế biến định mức.
- **Gọi món tại bàn qua QR Code (`/table/:qrToken`)**:
  - Tự động nhận diện bàn ăn (Ví dụ: `Bàn 01 - Tầng Trệt`).
  - Chọn món, chọn tùy chọn topping, size, mức cay, ghi chú cho bếp.
  - Giỏ hàng nổi (Floating Cart) & nút **"Gửi Vào Bếp Nấu"**.
  - **Theo dõi trực tiếp trạng thái món ăn (Live KDS Tracker)**: *Chờ nhận -> Đang nấu trên bếp -> Món đã xong (Đang bưng ra)* được cập nhật tự động không cần tải lại trang.
  - Nút **"Gọi Tính Tiền"**: Phát chuông cảnh báo tới quầy Thu ngân POS.
- **Đặt bàn trước (`/reserve`)**: Chọn ngày giờ, số lượng khách, thông tin liên hệ và ghi chú đặc biệt.

### B. Phân Hệ Vận Hành & Phục Vụ (Staff POS & Kitchen KDS)
- **POS Thu Ngân (`/pos`)**:
  - Sơ đồ bàn trực quan theo từng khu vực (*Tầng trệt, Tầng 1 VIP, Sân thượng*).
  - Màu sắc trạng thái bàn chuẩn xác: **Xanh lá (Trống)**, **Đỏ (Có khách/đang gọi món)**, **Vàng (Đã đặt trước)**, **Xám (Đang dọn dẹp)**.
  - Quản lý bàn: Mở bàn mới, gọi thêm món (đợt 2, 3), chuyển bàn trống (`Move Table`).
  - Thanh toán & Chốt bàn: Tiền mặt, chuyển khoản **VietQR động** hoặc quẹt thẻ POS. Tự động tính tiền thừa, trừ voucher và đưa bàn về trạng thái dọn dẹp.
  - Nhận chuông cảnh báo thời gian thực khi có bàn bấm gọi tính tiền.
- **Màn Hình Bếp / Bar (KDS - Kitchen Display System) (`/kds`)**:
  - Phân luồng đơn theo trạm chế biến (*Bếp Nóng, Bếp Khai Vị, Quầy Bar*).
  - Thẻ món ăn hiển thị: Số bàn, món, số lượng, tùy chọn topping, ghi chú đầu bếp, số đợt gọi.
  - Đồng hồ đếm thời gian làm món (**SLA Timer**): Tự động đổi màu và cảnh báo đỏ khi món bị chậm trễ quá định mức.
  - Thao tác 1 chạm: **Bắt đầu nấu** -> **Nấu xong (Báo ra món)** -> **Đã bưng lên bàn**.
  - Âm thanh chuông báo (Chime audio) tự động vang lên mỗi khi có món mới được gửi vào bếp.

### C. Phân Hệ Quản Trị Cấp Cao (Admin Dashboard) (`/admin`)
- **Báo cáo kinh doanh**: Doanh thu trong ngày, số lượng đơn hoàn thành, tỉ lệ lấp đầy bàn ăn.
- **Top 5 món bán chạy nhất (Best Sellers)** kèm số lượng phần và doanh thu cụ thể.
- **Tính năng Khóa món / Báo hết (86 Items)**: Gạt công tắc để lập tức tắt/bật món trên menu QR khách và màn hình POS khi bếp hết nguyên liệu đột xuất.
- **Quản lý danh sách đặt bàn**: Theo dõi khách đặt trước và check-in vào bàn.

---

## 🛠️ 2. TECH STACK

| Thành phần | Công nghệ sử dụng |
| :--- | :--- |
| **Backend API** | Node.js + Express + TypeScript (Kiến trúc Module hóa) |
| **Database & ORM** | PostgreSQL / SQLite + Prisma ORM (3NF Schema chuẩn) |
| **Real-time Engine** | Socket.io (WebSockets đồng bộ đa chiều giữa POS, KDS và Client) |
| **Frontend Web** | React 19 + Vite + TypeScript + Tailwind CSS |
| **Icons & UI** | Lucide React + Canvas Confetti |

---

## 🚀 3. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG

### Khởi chạy Backend:
```bash
cd backend
npm install
npm run prisma:migrate   # Đồng bộ bảng CSDL
npm run prisma:seed      # Nạp dữ liệu mẫu ban đầu (nếu cần nạp lại)
npm run dev              # Chạy server tại http://localhost:5000
```

### Khởi chạy Frontend:
```bash
cd frontend
npm install
npm run dev              # Chạy web app tại http://localhost:5173
```

---

## 🔑 4. TÀI KHOẢN TRUY CẬP DEMO (Mật khẩu chung: `123456`)

Trang đăng nhập: `http://localhost:5173/login` (Có sẵn 4 nút đăng nhập nhanh 1 chạm):

1. **Quản trị viên (Admin)**: `admin@rms.com`
2. **Thu ngân (Cashier POS)**: `cashier@rms.com`
3. **Bếp trưởng (Chef KDS)**: `chef@rms.com`
4. **Nhân viên phục vụ (Waiter)**: `waiter@rms.com`

---

## 🎬 5. KỊCH BẢN DEMO NỔI BẬT ĐỂ THUYẾT TRÌNH

1. **Kịch bản 1: Khách quét QR Bàn 01 gọi món & Bếp nhận realtime:**
   - Mở 2 tab trình duyệt cạnh nhau:
     - Tab 1: `http://localhost:5173/table/table-b01-token` (Khách tại Bàn 01).
     - Tab 2: `http://localhost:5173/kds` (Màn hình Bếp KDS).
   - Trên Tab 1: Chọn món (ví dụ: *Lẩu Thái Hải Sản*, chọn thêm Topping Bò và Cay vừa) -> Nhấn **"Gửi Vào Bếp Nấu"**.
   - Quan sát Tab 2: Lập tức phát âm thanh chuông báo và xuất hiện thẻ order Bàn 01.
   - Đầu bếp nhấn **"Bắt Đầu Nấu"** -> Tab 1 của khách lập tức chuyển trạng thái sang *"Đang nấu trên bếp (màu cam)"*.
   - Đầu bếp nhấn **"Nấu Xong"** -> Tab 1 của khách chuyển sang *"Món đã xong (màu xanh)"*.

2. **Kịch bản 2: Gọi tính tiền & POS thanh toán:**
   - Mở thêm Tab 3: `http://localhost:5173/pos` (POS Thu ngân).
   - Bàn 01 trên POS đang có màu đỏ (Có khách).
   - Tại Tab khách, nhấn nút **"Gọi Tính Tiền"** -> POS lập tức xuất hiện thông báo chuông kêu.
   - Thu ngân bấm vào Bàn 01 -> Chọn **"Thanh Toán & In Hóa Đơn"** -> Chọn VietQR/Tiền mặt -> Xác nhận -> Pháo hoa confetti nổ, bàn tự động chuyển sang trạng thái xám *"Chờ Dọn Dẹp"*.

3. **Kịch bản 3: Báo hết món (86 Item):**
   - Vào `/admin` -> Tab *"Quản lý thực đơn"*.
   - Gạt tắt một món (ví dụ: *Tôm Sú Nướng Muối Ớt*).
   - Mở tab `/table/table-b01-token` hoặc `/menu` -> Món đó lập tức bị mờ và hiển thị nhãn đỏ *"HẾT MÓN (86)"*, khách không thể đặt nhầm.
