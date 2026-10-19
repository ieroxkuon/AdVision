# TÀI LIỆU 2: PHÂN TÍCH YÊU CẦU CHỨC NĂNG VÀ THIẾT KẾ KIẾN TRÚC HỆ THỐNG

**Đề tài:** Hệ thống cố vấn thẩm định & đánh giá tiêu chuẩn hình ảnh quảng cáo ứng dụng AI Agent Multimodal  
**Sinh viên:** Trần Thái Cương — MSSV: 2255010026  
**Thời gian:** Tuần 2

---

## 1. YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

### 1.1 Danh sách chức năng chính

| ID | Chức năng | Mô tả |
|----|-----------|-------|
| F01 | **Upload hình ảnh** | Người dùng tải lên ảnh banner quảng cáo (JPG/PNG/WebP, tối đa 10MB) |
| F02 | **Nhập thông tin ngữ cảnh** | Nhập tên/ngành hàng để cá nhân hóa bài phân tích |
| F03 | **Cấu hình AI Model** | Chọn mô hình AI (Gemini/GPT-4), nhập API Key tùy chỉnh |
| F04 | **Thẩm định hình ảnh** | Phân tích ảnh đối chiếu 22 quy chuẩn, trả về 5 khối đánh giá có cấu trúc |
| F05 | **Streaming hiển thị** | Kết quả hiển thị dần từng chữ (stream), không chờ toàn bộ |
| F06 | **Sinh Redesign Prompt** | Tự động tạo câu lệnh prompt tiếng Anh để tái thiết kế ảnh bằng AI GenImage |
| F07 | **1-Click Copy Prompt** | Sao chép nhanh Redesign Prompt ra clipboard |
| F08 | **Giao tiếp theo Persona** | AI Agent xưng hô theo tên người dùng, phong cách chuyên gia |
| F09 | **Fallback tự động** | Tự chuyển sang GPT-4 nếu Gemini không khả dụng |

### 1.2 Yêu cầu phi chức năng (Non-functional Requirements)

| Loại | Yêu cầu |
|------|---------|
| **Hiệu năng** | Thời gian đến ký tự đầu tiên (TTFT) < 3 giây |
| **Bảo mật** | API Key không lưu phía client, proxy qua backend |
| **Khả dụng** | Uptime > 99% nhờ Vercel Serverless |
| **Khả năng mở rộng** | Kiến trúc module — thêm tính năng mới không ảnh hưởng module cũ |
| **Khả năng sử dụng** | Giao diện trực quan, không cần hướng dẫn, mobile-friendly |

---

## 2. KIẾN TRÚC HỆ THỐNG

### 2.1 Sơ đồ kiến trúc tổng thể (3-Layer Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                        TẦNG TRÌNH BÀY (PRESENTATION)           │
│                         index.html + Tailwind CSS               │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────┐   │
│  │  Upload  │  │  Chat Panel  │  │  Config  │  │  Prompt   │   │
│  │   Zone   │  │  (Streaming) │  │  Modal   │  │   Card    │   │
│  └──────────┘  └──────────────┘  └──────────┘  └───────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / Fetch API
┌────────────────────────────▼────────────────────────────────────┐
│                      TẦNG LOGIC (APPLICATION)                   │
│                    Vanilla JavaScript Modules                    │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ config.js │  │  app.js      │  │    uiController.js      │   │
│  │ (Hằng số) │  │ (Controller) │  │  (DOM / Streaming UI)   │   │
│  └───────────┘  └──────┬───────┘  └─────────────────────────┘   │
│                         │                                        │
│  ┌──────────────┐  ┌────▼────────────┐  ┌────────────────────┐  │
│  │rulesService  │  │  apiService.js  │  │ redesignGenerator  │  │
│  │(22 quy chuẩn)│  │(Gemini/GPT Call)│  │  (Prompt Factory)  │  │
│  └──────────────┘  └─────────────────┘  └────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               personaPrompt.js                              │ │
│  │     (Persona Hoàng An · System Prompt Builder)              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS REST API
┌────────────────────────────▼────────────────────────────────────┐
│                      TẦNG DỊCH VỤ (SERVICE)                     │
│                     server.js (Node.js/Express)                  │
│                     Vercel Serverless Functions                   │
│  ┌──────────────────────┐         ┌────────────────────────┐     │
│  │  POST /api/analyze   │         │  POST /api/analyze-gpt │     │
│  │  (Gemini Proxy)      │         │  (OpenAI Proxy)        │     │
│  └──────────────────────┘         └────────────────────────┘     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
              ┌──────────────┴──────────────┐
              │                             │
   ┌──────────▼─────────┐       ┌───────────▼──────────┐
   │  Google Gemini API │       │    OpenAI GPT-4 API   │
   │  (Primary VLM)     │       │    (Fallback VLM)     │
   └────────────────────┘       └──────────────────────┘
```

### 2.2 Sơ đồ các module Frontend

```
js/
├── config.js           ← Hằng số, API endpoint, model mặc định
├── rulesService.js     ← Tải và cache 22 quy chuẩn từ design_rules.json
├── personaPrompt.js    ← Xây dựng System Prompt (Persona + Rules nhúng)
├── apiService.js       ← Gọi Gemini/GPT API, xử lý streaming SSE
├── redesignGenerator.js← Sinh Redesign Prompt từ kết quả phân tích
├── uiController.js     ← Quản lý DOM, modal, preview, copy-to-clipboard
└── app.js              ← Điều phối toàn bộ luồng (Controller chính)
```

---

## 3. MÔ TẢ CHI TIẾT CÁC MODULE

### 3.1 Module `config.js` — Cấu hình hệ thống

**Trách nhiệm:** Lưu trữ tất cả hằng số và cấu hình toàn cục.

| Hằng số | Giá trị | Mục đích |
|---------|---------|---------|
| `API_BASE_URL` | `/api` | Endpoint backend |
| `DEFAULT_MODEL` | `gemini-1.5-flash` | Mô hình AI mặc định |
| `RULES_JSON_PATH` | `data/design_rules.json` | Đường dẫn tới bộ quy chuẩn |
| `MAX_IMAGE_SIZE_MB` | `10` | Giới hạn dung lượng ảnh |

---

### 3.2 Module `rulesService.js` — Quản lý tri thức

**Trách nhiệm:** Tải, cache và cung cấp bộ 22 quy chuẩn thiết kế.

**Luồng hoạt động:**
```
Khởi động app
    → fetch('data/design_rules.json')
    → Cache vào memory
    → Cung cấp cho personaPrompt.js khi build prompt
```

**Hàm chính:**
- `loadRules()` — tải JSON một lần duy nhất, cache kết quả
- `getRules()` — trả về danh sách quy chuẩn đã cache
- `getRuleById(id)` — tra cứu quy chuẩn theo ID

---

### 3.3 Module `personaPrompt.js` — Xây dựng Persona & Prompt

**Trách nhiệm:** Tạo System Prompt hoàn chỉnh tích hợp Persona, bộ quy chuẩn và định dạng đầu ra.

**Cấu trúc System Prompt sinh ra:**
```
[PERSONA BLOCK]
Bạn là Nguyễn Hoàng An, Cố vấn Trưởng Thẩm định Thị giác...

[RULES BLOCK]
Bộ 22 quy chuẩn thiết kế:
- Quy chuẩn 1: ...
- Quy chuẩn 2: ...
...

[FORMAT BLOCK]
Hãy trả kết quả theo đúng 5 khối:
[KHỐI 1] Tổng quan & Ấn tượng đầu tiên
[KHỐI 2] Phân tích bố cục & phân cấp thị giác
[KHỐI 3] Màu sắc, typography & thương hiệu
[KHỐI 4] Vi phạm & khuyến nghị cụ thể
[KHỐI 5] Câu hỏi chiến lược mở
```

---

### 3.4 Module `apiService.js` — Kết nối AI API

**Trách nhiệm:** Gửi yêu cầu phân tích đến backend và xử lý streaming response.

**Luồng gọi API:**
```
1. Nhận: { imageBase64, systemPrompt, model, apiKey }
2. POST đến /api/analyze hoặc /api/analyze-gpt
3. Nhận Stream (Server-Sent Events)
4. Decode từng chunk → callback onChunk(text)
5. Khi kết thúc → callback onComplete()
6. Nếu lỗi → tự động retry với fallback model
```

---

### 3.5 Module `redesignGenerator.js` — Tạo Prompt tái thiết kế

**Trách nhiệm:** Phân tích kết quả đánh giá và sinh câu lệnh Prompt tiếng Anh để tạo ảnh mới bằng AI.

**Cấu trúc Prompt sinh ra:**
```
A high-quality advertising banner for [brand/product],
fixing: [danh sách vi phạm từ KHỐI 4],
style: [phong cách từ KHỐI 1],
layout: rule-of-thirds composition,
typography: high contrast, single focal point CTA,
color palette: [màu từ phân tích],
--ar 16:9 --v 6 --quality 2
```

---

### 3.6 Module `uiController.js` — Giao diện người dùng

**Trách nhiệm:** Quản lý toàn bộ DOM, render streaming text, modal cấu hình và prompt card.

**Tính năng chính:**
- **Drag & Drop Zone:** Kéo thả ảnh vào vùng upload
- **Image Preview:** Hiển thị thumbnail ảnh trước khi phân tích
- **Streaming Text Renderer:** Nối từng chunk text vào DOM mượt mà
- **Prompt Card:** Hiển thị Redesign Prompt với nút copy
- **Config Modal:** Popup cấu hình API Key và chọn model

---

### 3.7 Module `app.js` — Bộ điều phối chính (Controller)

**Trách nhiệm:** Điều phối luồng sự kiện và kết nối tất cả các module.

**Luồng chính (Happy Path):**
```
[1] Người dùng upload ảnh + nhập tên/ngành
        ↓
[2] app.js gọi rulesService.getRules()
        ↓
[3] app.js gọi personaPrompt.buildSystemPrompt(rules, userName, industry)
        ↓
[4] app.js gọi apiService.analyze(image, systemPrompt)
        ↓
[5] apiService stream chunks → uiController.appendChunk(text)
        ↓
[6] Khi complete: app.js gọi redesignGenerator.generate(analysisResult)
        ↓
[7] uiController.showPromptCard(redesignPrompt)
```

---

## 4. SƠ ĐỒ LUỒNG DỮ LIỆU (DATA FLOW)

```
design_rules.json
      │
      ▼ (fetch once, cache)
rulesService ──────────────────────────────────────────┐
                                                        │
User Input (image + name + industry)                    │
      │                                                 ▼
      ▼                                        personaPrompt.js
   app.js ─────────────────────────────────── [System Prompt]
      │                                                 │
      ▼                                                 │
apiService.js ◄─────────────────────────────────────────┘
      │
      │ POST /api/analyze (image + prompt)
      ▼
 server.js (Node.js Proxy)
      │
      │ HTTPS to Google AI API
      ▼
 Gemini 1.5 Flash
      │
      │ Streaming response (SSE)
      ▼
apiService.js → uiController.js (render từng chunk)
      │
      ▼ (khi complete)
redesignGenerator.js → uiController.showPromptCard()
```

---

## 5. THIẾT KẾ BACKEND (server.js)

### 5.1 API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/analyze` | POST | Proxy đến Gemini API, hỗ trợ streaming |
| `/api/analyze-gpt` | POST | Proxy đến OpenAI API, fallback |
| `/api/health` | GET | Kiểm tra trạng thái server |

### 5.2 Cấu trúc request /api/analyze

```json
{
  "image": "data:image/jpeg;base64,...",
  "systemPrompt": "Bạn là Nguyễn Hoàng An...",
  "model": "gemini-1.5-flash",
  "apiKey": "AIza..."
}
```

### 5.3 Lý do dùng Backend Proxy

- **Bảo mật:** API Key không lộ ra phía client (không thể xem qua DevTools).
- **CORS:** Tránh lỗi Cross-Origin khi gọi thẳng từ browser đến Google API.
- **Rate Limiting:** Có thể thêm throttling để tránh lạm dụng.

---

## 6. CẤU TRÚC DỮ LIỆU — design_rules.json

```json
{
  "rules": [
    {
      "id": "R01",
      "name": "Phân cấp thị giác rõ ràng",
      "category": "Bố cục",
      "description": "Ảnh phải có điểm nhìn chính (focal point) rõ ràng...",
      "violation_example": "Nhiều phần tử có kích thước tương đương nhau...",
      "weight": 0.1
    },
    ...
  ],
  "version": "1.0",
  "total_rules": 22,
  "source_documents": 16
}
```

---

## 7. KẾT LUẬN

Hệ thống được thiết kế theo nguyên tắc **Separation of Concerns** — mỗi module chịu trách nhiệm một việc duy nhất, dễ đọc, dễ test và dễ mở rộng. Kiến trúc 3 tầng (Presentation – Application – Service) kết hợp với Serverless Deployment trên Vercel đảm bảo hệ thống vừa nhẹ, vừa bảo mật, vừa sẵn sàng mở rộng các tính năng mới trong các tuần tiếp theo.
