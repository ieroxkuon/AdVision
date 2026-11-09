# NHẬT KÝ TIẾN ĐỘ: TỐI ƯU HÓA HIỆU NĂNG & CHUẨN HÓA CÂY HỘI THOẠI 6 VÒNG ART DIRECTOR

**Dự án:** AdVision - Hệ Thống Cố Vấn Thẩm Định Thị Giác Hình Ảnh Quảng Cáo  
**Chuyên gia:** Nguyễn Hoàng An (Art Director & Visual Marketing Advisor)  
**Ngày khởi tạo:** 09/11/2026  

---

## 1. MỤC TIÊU DỰ ÁN
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

---

## 2. BẢNG THEO DÕI TIẾN ĐỘ THỰC HIỆN

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
