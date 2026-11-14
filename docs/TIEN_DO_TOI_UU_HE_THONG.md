# NHẬT KÝ TIẾN ĐỘ: TỐI ƯU HÓA HIỆU NĂNG, CHUẨN HÓA HỘI THOẠI & NÂNG CẤP KIẾN TRÚC SOA

**Dự án:** AdVision - Hệ Thống Cố Vấn Thẩm Định Thị Giác Hình Ảnh Quảng Cáo  
**Chuyên gia:** Nguyễn Hoàng An (Art Director & Visual Marketing Advisor)  
**Ngày khởi tạo:** 09/11/2026 | **Cập nhật lần cuối:** 15/11/2026

---

## 1. MỤC TIÊU DỰ ÁN

### Giai đoạn 1 — Tối ưu hiệu năng & hội thoại (Tuần 1–2) ✅
1. **Triệt tiêu độ trễ phản hồi:** Đưa thời gian phản hồi từ mức 4–8s xuống < 0.8s.
2. **Cấu trúc lại Prompt phân tầng (Dynamic Staged Prompting):** Tránh việc nạp toàn bộ 16 PDF khi chỉ mới chào hỏi / xưng hô.
3. **Thực thi đầy đủ 6 Vòng hội thoại Art Director chuẩn mực:**
   - Vòng 1: Onboarding (Tên + Ngành hàng/Sản phẩm)
   - Vòng 2: Briefing (Kênh Placement + Mục tiêu Campaign) -> Kích hoạt quy chuẩn kỹ thuật
   - Vòng 3: First Impression 2 giây (Chấm điểm sơ bộ + Luồng mắt nhìn + Mở 2 hướng)
   - Vòng 4: Deep-dive Flaws (3 lỗi thiết kế cản trở chuyển đổi: CTA, Typography, Negative Space)
   - Vòng 5: Actionable Fixes (Màu Schopenhauer #F59E0B, Line-height 1.3x, Canva/Photoshop vs AI)
   - Vòng 6: Gen AI Redesign Prompt (Midjourney / DALL-E 3 studio photorealistic kèm nút Copy)
4. **Giữ sạch mã nguồn:** Mọi ghi chú và tài liệu theo dõi được lưu độc lập tại thư mục `docs/`.

### Giai đoạn 2 — Nâng cấp kiến trúc SOA & UI (Tuần 3–4) 🔄
5. **Chuyển đổi sang kiến trúc hướng dịch vụ (SOA):** Tách `server.js` đơn khối thành các Route Service độc lập trong thư mục `routes/`.
6. **Thêm Sidebar điều hướng:** Lịch sử trò chuyện, nút New Chat, logo, hiển thị tên người dùng (nếu đã đăng nhập).
7. **Auth Service (đăng nhập / đăng ký):** Xác thực người dùng bằng JWT + lưu trữ JSON đơn giản.
8. **Session Service (lịch sử hội thoại):** Lưu và tải lại các phiên phân tích ảnh theo từng user.

---

## 2. LỊCH TRÌNH THỰC HIỆN

| Tuần | Ngày | Hạng mục | Mô tả |
| :---: | :--- | :--- | :--- |
| **Tuần 1–2** | 09–15/11 | Tối ưu hiệu năng & hội thoại | ✅ Hoàn thành toàn bộ M1–M5 |
| **Tuần 3** | 16–18/11 | **SOA Refactor** (Backend) | Tách `server.js` → `routes/upload.js`, `routes/analyze.js`, `routes/health.js` |
| **Tuần 3** | 16–18/11 | **Sidebar UI** (Frontend) | Thêm sidebar cơ bản: logo, New Chat, lịch sử (ẩn nếu chưa đăng nhập) |
| **Tuần 3** | 19–21/11 | **Auth Service** | Đăng ký / đăng nhập / JWT token / lưu `data/users.json` |
| **Tuần 4** | 22–24/11 | **Session Service** | Lưu lịch sử hội thoại theo user vào `data/sessions/` |
| **Tuần 4** | 25–27/11 | **Tích hợp & kiểm thử** | Kết nối Auth + Session + Sidebar, test toàn luồng |
| **Tuần 4** | 28–30/11 | **Tài liệu hoàn chỉnh** | Cập nhật doc 01, 02 theo kiến trúc SOA mới; viết báo cáo môn học |

---

## 3. BẢNG THEO DÕI TIẾN ĐỘ THỰC HIỆN

### 🟢 Giai đoạn 1: Hiệu năng & Hội thoại (Hoàn thành)

| Mã Task | Hạng mục | Trạng thái | Ghi chú kỹ thuật |
| :--- | :--- | :---: | :--- |
| **M1.1** | Cập nhật danh sách Model Gemini | ✅ Hoàn thành | Đưa `gemini-flash-lite-latest` và `gemini-3.5-flash-lite` lên đầu |
| **M1.2** | Bộ nhớ đệm Active Model Caching | ✅ Hoàn thành | Triển khai `activeGeminiModel` trong `apiService.js`, loại bỏ lặp fallback |
| **M2.1** | Phân tầng PersonaPrompt | ✅ Hoàn thành | Tách `getConversationalSystemPrompt` (900 chars) và `getVisionSystemPrompt` |
| **M2.2** | Instant Onboarding cho tên | ✅ Hoàn thành | Phản hồi ngay 0.05s chào Tên và hỏi ngành, kèm 4 nút bấm tiện lợi |
| **M3.1** | Hoàn thiện Vòng 1: Onboarding | ✅ Hoàn thành | Nhận diện Tên (`Cường`) + Ngành (`F&B / Đồ ăn nhanh` cho gà rán) |
| **M3.2** | Hoàn thiện Vòng 2: Briefing | ✅ Hoàn thành | Lấy Kênh + Mục tiêu, thông báo kích hoạt Text Rule < 20% & CTA Rule |
| **M3.3** | Hoàn thiện Vòng 3: First Impression | ✅ Hoàn thành | Chấm điểm sơ bộ (6.8/10), luồng mắt 2s, mở 2 nút Hạt sạn vs Điểm sáng |
| **M3.4** | Hoàn thiện Vòng 4: Deep-dive Flaws | ✅ Hoàn thành | Mổ xẻ 3 lỗi: Nút CTA chìm, Typography dính chữ 1.0x, Negative Space |
| **M3.5** | Hoàn thiện Vòng 5: Actionable Fixes | ✅ Hoàn thành | Hướng dẫn Schopenhauer Vàng nghệ #F59E0B, giãn line-height 1.3x |
| **M3.6** | Hoàn thiện Vòng 6: Gen AI Prompt | ✅ Hoàn thành | Sinh thẻ đen viền xanh Prompt Studio thương mại 8K kèm nút Copy |
| **M4.1** | Loại bỏ delay nhân tạo | ✅ Hoàn thành | Bỏ các hàm delay 800-900ms, stream chữ 8ms mượt mà |
| **M5.1** | Đo lường Benchmark & Đồng bộ | ✅ Hoàn thành | Độ trễ giảm từ 8s xuống ~1.2s; đã đồng bộ GitHub commit f3f811d |

### 🔄 Giai đoạn 2: SOA Refactor, UI Claude.ai & Database Lưu Trữ

| Mã Task | Hạng mục | Trạng thái | Ghi chú kỹ thuật |
| :--- | :--- | :---: | :--- |
| **S1.1** | Phân tách cấu trúc `client/` & `server/` | ✅ Hoàn thành | Chuẩn SOA: `client/` (UI), `server/` (Gateway + Routes), `data/` |
| **S1.2** | Chuẩn hóa `server/gateway.js` | ✅ Hoàn thành | API Gateway định tuyến tĩnh client và các sub-services độc lập |
| **S2.1** | Nút Con Mắt cố định & Phong cách Claude.ai | ✅ Hoàn thành | Nút con mắt cố định góc trái toggle sidebar, dọn nút thừa, màu Claude |
| **S2.2** | User Popover & Theme Switcher (3 dạng) | ✅ Hoàn thành | Popover menu: Đổi màu giao diện (Hệ thống / Sáng / Tối) |
| **S3.1** | Google Sign-In Client Service | ✅ Hoàn thành | Google Identity OAuth 2.0 + Modal chọn tài khoản Google chuẩn UX |
| **S3.2** | Cơ sở dữ liệu lưu trữ (`storageService.js`) | ✅ Hoàn thành | IndexedDB lưu phiên & ảnh base64, giới hạn 10 sessions, 12 turns/session |
| **S4.1** | Khôi phục phiên trò chuyện & Chat tiếp | ✅ Hoàn thành | Click phiên cũ ở sidebar -> render lại tin nhắn + ảnh, tiếp tục chat |
| **S5.1** | Kiểm thử & Deploy Vercel | ✅ Hoàn thành | Đồng bộ GitHub, Vercel Serverless Function hoạt động chuẩn xác |
| **S5.2** | Cập nhật tài liệu báo cáo môn học | ⬜ Chờ | Cập nhật doc 01 & 02 theo kiến trúc SOA mới |
