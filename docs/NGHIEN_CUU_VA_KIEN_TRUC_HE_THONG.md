# 🏛️ TÀI LIỆU THIẾT KẾ KIẾN TRÚC & PHƯƠNG PHÁP NGHIÊN CỨU HỆ THỐNG
> **Đề tài:** Hệ Thống Cố Vấn Thẩm Định & Đánh Giá Tiêu Chuẩn Hình Ảnh Quảng Cáo Ứng Dụng AI Multimodal  
> **Sinh viên:** Trần Thái Cương — MSSV: 2255010026  

---

## 1. MỤC TIÊU NGHIÊN CỨU VÀ TỔNG QUAN HỆ THỐNG

Dự án hướng tới việc giải quyết bài toán: **Làm thế nào để ứng dụng Trí tuệ Nhân tạo Đa phương thức (Multimodal Vision AI) nhằm tự động hóa quá trình thẩm định, đánh giá chất lượng hình ảnh quảng cáo theo các quy chuẩn thiết kế khoa học, đồng thời đề xuất giải pháp tái thiết kế trực quan.**

### 2 Trụ cột cốt lõi:
1. **Thẩm định Thị giác Khoa học (Objective Visual Audit):** Sử dụng hệ tri thức 22 quy chuẩn chưng cất từ 16 tài liệu chuyên ngành đồ họa làm thước đo định lượng, tránh đánh giá cảm tính.
2. **Vòng lặp Tái sinh Thiết kế (Generative Redesign Loop):** Sau khi phát hiện lỗi bố cục/màu sắc/chữ viết, hệ thống tự động sinh ra **Prompt tiếng Anh chuẩn đồ họa** để người dùng có thể tạo lại hình ảnh đạt chuẩn bằng ChatGPT / Midjourney / DALL-E 3.

---

## 2. MÔ HÌNH KIẾN TRÚC PHẦN MỀM PHÂN TẦNG (LAYERED ARCHITECTURE)

Hệ thống được thiết kế theo nguyên lý phân tách trách nhiệm (Separation of Concerns - SoC), làm rõ hai nhiệm vụ cốt lõi:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TẦNG TRÌNH DIỄN (UI LAYER)                      │
│   • index.html (Semantic SPA)                                          │
│   • uiController.js (DOM, Modal, Multi-Image Preview, Streaming Text)  │
│   • Redesign Prompt Card với nút [📋 Sao chép Prompt cho ChatGPT]      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    TẦNG ĐIỀU PHỐI (CONTROLLER LAYER)                   │
│   • app.js (Orchestrator kết nối State, UI, API và Persona)           │
│   • Quản lý phiên làm việc, lịch sử hội thoại, tên riêng, ngành hàng   │
└──────────────┬──────────────────────────────────────────┬──────────────┘
               │                                          │
┌──────────────▼──────────────────────────┐  ┌────────────▼──────────────┐
│  TẦNG 1: PHÂN TÍCH NỘI DUNG & ĐẶC TRƯNG │  │ TẦNG 2: TÁC TỬ & NGHIỆP VỤ│
│  (CONTENT ANALYSIS & FEATURE EXTRACTOR) │  │  (TASK & AGENT WORKFLOW)  │
│                                         │  │                           │
│  • imageFeatureExtractor.js             │  │  • rulesService.js        │
│    (Kích thước, Tỷ lệ khung hình, Canvas│  │    (22 Quy chuẩn thiết kế)│
│     tiền xử lý độ phân giải)            │  │  • personaPrompt.js       │
│  • apiService.js (Vision Transformer ViT│  │    (Quy trình thẩm định)  │
│    Bộ mã hóa thị giác Gemini 2.5 Flash) │  │  • redesignGenerator.js   │
│  • Bóc tách: Sản phẩm, Typography, CTA  │  │    (Sinh Prompt Gen AI)   │
└─────────────────────────────────────────┘  └───────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                      TẦNG DỮ LIỆU (DATA & PIPELINE LAYER)              │
│   • data/design_rules.json (Single Source of Truth)                    │
│   • scripts/compile_master_knowledge.py (Biên dịch tri thức)          │
│   • docs/SO_TAY_QUY_CHUAN_THIET_KE.md (Đưa lên Drive & NotebookLM)     │
│   • 16 Tài liệu PDF chuyên ngành trong trainingdocs/                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CHU TRÌNH VÒNG LẶP THẨM ĐỊNH & TÁI SINH (AUDIT -> REDESIGN LOOP)

Quy trình xử lý hoàn chỉnh từ khi người dùng tải ảnh lên đến khi nhận được hình ảnh mới hoàn hảo:

```
[Người dùng tải ảnh quảng cáo]
              │
              ▼
   [Trích xuất Bối cảnh] ─── (Tên người dùng + Ngành hàng sản phẩm)
              │
              ▼
    [Thẩm định Đa phương thức] (Gemini Vision API đối chiếu 22 Quy chuẩn)
              │
              ▼
    [Xuất bản Đánh giá 5 Khối]
       ├─ Khối 1: Kết luận Đạt/Chưa đạt & Chấm điểm (X/10)
       ├─ Khối 2: Bóc tách Thị giác & Typography
       ├─ Khối 3: Ưu điểm & Điểm hạn chế
       ├─ Khối 4: Đề xuất chỉnh sửa thực tế
       └─ Khối 5: Lời khuyên cá tính Hoàng An
              │
              ▼
    [Khối 6: BỘ ĐỘNG CƠ TÁI THIẾT KẾ (REDESIGN GENERATOR)]
       ├─ Tự động dịch chuyển các lỗi vi phạm thành tiêu chuẩn kỹ thuật
       ├─ Cấu trúc Prompt tiếng Anh: Subject + 1/3 Rule + Studio Lighting + Palette
       └─ Render Card UI với 1-Click [Sao chép Prompt cho ChatGPT / Midjourney]
              │
              ▼
[Người dùng dán Prompt vào ChatGPT/DALL-E ──► TẠO ẢNH MỚI ĐẠT CHUẨN 100%]
```

---

## 4. CHIẾN LƯỢC TÍCH HỢP GOOGLE NOTEBOOKLM & GOOGLE DRIVE

* **Mục tiêu:** Tận dụng công nghệ AI Grounding tiên tiến của Google để phục vụ nghiên cứu và kiểm thử hệ thống.
* **Quy trình:**
  1. Sử dụng tài liệu `docs/SO_TAY_QUY_CHUAN_THIET_KE.md` làm bản tổng hợp tri thức duy nhất.
  2. Đưa tài liệu lên thư mục Google Drive của đồ án (mở quyền truy cập cho nhóm nghiên cứu).
  3. Liên kết trực tiếp vào Google NotebookLM để tạo bộ tra cứu ngữ nghĩa chuyên sâu và tự động phát hiện các ca kiểm thử phức tạp (Edge Cases).

---

## 5. ĐÁNH GIÁ TÍNH CHUYÊN NGHIỆP & KHẢ NĂNG MỞ RỘNG (EXTENSIBILITY)

* **Chuẩn Clean Code:** Không có file nào quá 350 dòng. Mỗi file có mục đích duy nhất và có chú thích JSDoc chuẩn mực.
* **Không phụ thuộc thư viện nặng nề:** Chạy thuần Vanilla ES JavaScript và Tailwind CSS hiện đại, tương thích hoàn hảo trên cả máy cá nhân (Localhost), server Express và Serverless Vercel Cloud.
* **Sẵn sàng cho các module tương lai:** Khi tích hợp thêm tính năng mới (chấm điểm Radar Chart, Bounding Box hoặc lưu Database), chỉ cần thêm module vào `js/` mà không phải viết lại mã nguồn cũ.
