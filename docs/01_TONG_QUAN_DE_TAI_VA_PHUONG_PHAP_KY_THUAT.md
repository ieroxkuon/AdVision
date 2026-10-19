# TÀI LIỆU 1: NGHIÊN CỨU TỔNG QUAN ĐỀ TÀI VÀ PHƯƠNG PHÁP KỸ THUẬT ÁP DỤNG

**Đề tài:** Hệ thống cố vấn thẩm định & đánh giá tiêu chuẩn hình ảnh quảng cáo ứng dụng AI Agent Multimodal  
**Sinh viên:** Trần Thái Cương — MSSV: 2255010026  
**Thời gian:** Tuần 1–2

---

## 1. KHẢO SÁT BÀI TOÁN

### 1.1 Bối cảnh và động lực

Trong lĩnh vực marketing và truyền thông, hình ảnh quảng cáo (banner, poster) đóng vai trò cốt lõi trong việc thu hút người dùng và chuyển đổi doanh thu. Tuy nhiên, việc thẩm định chất lượng hình ảnh quảng cáo hiện nay chủ yếu dựa vào:

- **Đánh giá chủ quan** của chuyên gia thiết kế, dễ bị ảnh hưởng bởi gu thẩm mỹ cá nhân.
- **Quy trình thủ công** tốn nhiều thời gian, đặc biệt khi khối lượng ảnh lớn.
- **Thiếu chuẩn hóa** — mỗi doanh nghiệp/agency có bộ tiêu chí riêng, khó thống nhất.

**Bài toán đặt ra:** Xây dựng một hệ thống AI có khả năng phân tích hình ảnh quảng cáo một cách tự động, khách quan, đối chiếu với bộ quy chuẩn thiết kế chuẩn hóa, và đưa ra phản hồi chi tiết, có tính hành động cao.

### 1.2 Phạm vi bài toán

| Yếu tố | Mô tả |
|--------|-------|
| **Đầu vào** | Hình ảnh banner/poster quảng cáo (JPG, PNG, WebP) |
| **Đầu ra** | Bài phân tích bóc tách theo 5 khối tiêu chuẩn + Prompt tái thiết kế |
| **Người dùng** | Nhà thiết kế, marketer, doanh nghiệp vừa và nhỏ |
| **Ngữ cảnh** | Web-based, không cần cài đặt, dùng được ngay trên trình duyệt |

### 1.3 Thách thức kỹ thuật

- Hình ảnh quảng cáo rất đa dạng về phong cách, ngành hàng, tỷ lệ khung hình.
- Cần kết hợp hiểu biết thị giác (màu sắc, bố cục, typography) với ngữ nghĩa thương hiệu.
- Phản hồi phải đủ chuyên sâu nhưng dễ hiểu với người dùng không chuyên kỹ thuật.
- Tốc độ phản hồi phải đủ nhanh để trải nghiệm người dùng mượt mà (streaming).

---

## 2. TÌM HIỂU MÔ HÌNH THỊ GIÁC NGÔN NGỮ (VISION-LANGUAGE MODEL)

### 2.1 Định nghĩa VLM

**Vision-Language Model (VLM)** là lớp mô hình AI kết hợp khả năng hiểu hình ảnh (Computer Vision) và xử lý ngôn ngữ tự nhiên (NLP) trong cùng một kiến trúc thống nhất. Mô hình nhận đầu vào là cặp (ảnh, văn bản) và sinh ra văn bản mô tả, phân tích, hoặc trả lời câu hỏi về nội dung hình ảnh.

### 2.2 Khảo sát các mô hình VLM phổ biến

| Mô hình | Nhà phát triển | Điểm mạnh | Hạn chế |
|---------|---------------|-----------|---------|
| **Gemini 1.5 Pro / Flash** | Google DeepMind | Hỗ trợ đa phương thức tốt, context dài, API miễn phí (free tier), tốc độ cao | Cần API Key |
| **GPT-4o / GPT-4 Vision** | OpenAI | Chất lượng phân tích cao, sinh ngôn ngữ tự nhiên tốt | Chi phí cao, không có free tier rộng rãi |
| **Claude 3.5 Sonnet** | Anthropic | Phân tích chi tiết, an toàn nội dung tốt | API có phí, ít phổ biến hơn tại VN |
| **LLaVA / MiniGPT-4** | Mã nguồn mở | Chạy local, không phụ thuộc API | Chất lượng thấp hơn, cần GPU mạnh |
| **Qwen-VL** | Alibaba | Tốt cho ngôn ngữ châu Á | Hỗ trợ tiếng Việt còn hạn chế |

### 2.3 Lý do chọn Gemini Vision API

Dự án lựa chọn **Google Gemini 1.5 Flash** làm mô hình chính với các lý do:

1. **Miễn phí tier rộng rãi:** 15 RPM / 1 triệu token/ngày — phù hợp nghiên cứu sinh viên.
2. **Đa phương thức mạnh:** Hiểu tốt bố cục, màu sắc, typography trong hình ảnh quảng cáo.
3. **Streaming response:** Hỗ trợ sinh văn bản từng đoạn, cải thiện UX đáng kể.
4. **Tích hợp dễ:** REST API đơn giản, không cần SDK phức tạp.
5. **Dự phòng (Fallback):** Hệ thống cũng hỗ trợ GPT-4 Vision nếu Gemini gặp sự cố.

---

## 3. CƠ SỞ TRI THỨC: 22 QUY CHUẨN THIẾT KẾ

Bộ quy chuẩn là nền tảng đánh giá của hệ thống, được chưng cất từ **16 tài liệu nghiên cứu chuyên ngành** về thiết kế đồ họa và quảng cáo.

### 3.1 Phương pháp xây dựng tri thức

- **Thu thập:** 16 tài liệu PDF chuyên ngành (sách giáo khoa thiết kế, nghiên cứu UX/UI, guidelines quảng cáo quốc tế).
- **Chưng cất:** Trích xuất và hệ thống hóa các nguyên tắc lặp lại trong nhiều nguồn.
- **Chuẩn hóa:** Định nghĩa 22 quy chuẩn với ID, tên, mô tả, và ví dụ vi phạm cụ thể.
- **Lưu trữ:** File `data/design_rules.json` — nguồn sự thật duy nhất (Single Source of Truth).

### 3.2 Phân loại 22 quy chuẩn (5 nhóm chính)

| Nhóm | Số quy chuẩn | Ví dụ tiêu chí |
|------|-------------|---------------|
| **Bố cục & Phân cấp thị giác** | ~5 | Quy tắc 1/3, điểm nhìn, vùng trắng |
| **Màu sắc & Tương phản** | ~5 | Tỷ lệ tương phản WCAG, bảng màu hài hòa |
| **Typography & Văn bản** | ~4 | Tương phản chữ-nền, cỡ chữ CTA, số lượng font |
| **Hình ảnh & Đồ họa** | ~4 | Chất lượng ảnh, sự nhất quán phong cách |
| **Thông điệp & CTA** | ~4 | Độ rõ ràng CTA, trật tự đọc F-pattern/Z-pattern |

---

## 4. PHƯƠNG PHÁP KỸ THUẬT ÁP DỤNG

### 4.1 Prompt Engineering nâng cao

Thay vì fine-tuning mô hình (tốn kém), dự án áp dụng kỹ thuật **Prompt Engineering** nâng cao:

- **System Prompt với Persona:** Định nghĩa AI Agent "Nguyễn Hoàng An" — chuyên gia thẩm định thị giác, tạo phong cách giao tiếp nhất quán và chuyên nghiệp.
- **Few-shot Examples:** Cung cấp ví dụ phân tích mẫu trong prompt để định hướng cấu trúc đầu ra.
- **Chain-of-Thought:** Yêu cầu mô hình phân tích lần lượt từng quy chuẩn, không bỏ qua.
- **Structured Output:** Ép buộc đầu ra theo 5 khối định sẵn (`[KHỐI 1]` đến `[KHỐI 5]`).

### 4.2 RAG-lite (Retrieval-Augmented Generation)

Hệ thống áp dụng phiên bản đơn giản hóa của RAG:

- **Retrieval:** Tải toàn bộ 22 quy chuẩn từ `design_rules.json` vào context prompt.
- **Augmentation:** Nhúng bộ quy chuẩn vào System Prompt trước khi gửi ảnh cho VLM.
- **Generation:** Mô hình VLM sinh ra bài phân tích đối chiếu ảnh với quy chuẩn.

Phương pháp này đảm bảo mô hình luôn đánh giá dựa trên chuẩn cụ thể, không dựa thuần vào "kiến thức nền" của mô hình.

### 4.3 Agentic Workflow

Quy trình hoạt động của hệ thống theo mô hình Agent:

```
Người dùng upload ảnh
        ↓
[Agent] Nạp 22 quy chuẩn từ Knowledge Base
        ↓
[Agent] Xây dựng System Prompt (Persona + Rules + Format)
        ↓
[Agent] Gửi (ảnh + prompt) đến Gemini Vision API
        ↓
[Agent] Nhận streaming response → hiển thị từng đoạn
        ↓
[Agent] Tự động sinh Redesign Prompt (Midjourney/DALL-E)
        ↓
Người dùng nhận kết quả 5 khối + 1-click copy prompt
```

### 4.4 Công nghệ sử dụng

| Tầng | Công nghệ | Mục đích |
|------|-----------|---------|
| **Frontend** | HTML5, Tailwind CSS, Vanilla JS | Giao diện web không cần framework nặng |
| **Backend** | Node.js + Express | API proxy bảo vệ API Key |
| **AI Model** | Gemini 1.5 Flash (primary), GPT-4o (fallback) | Phân tích hình ảnh |
| **Deployment** | Vercel Serverless | Hosting miễn phí, tự động scale |
| **Data** | JSON | Lưu trữ bộ quy chuẩn thiết kế |

---

## 5. KẾT LUẬN TUẦN 1–2

Qua khảo sát, đề tài xác định được:

- **Bài toán rõ ràng** với đầu vào/đầu ra cụ thể, có giá trị thực tiễn.
- **VLM phù hợp** là Gemini 1.5 Flash — cân bằng giữa chất lượng, chi phí và tốc độ.
- **Phương pháp Prompt Engineering + RAG-lite** là hướng tiếp cận phù hợp, không cần GPU/fine-tuning.
- **Bộ tri thức 22 quy chuẩn** là yếu tố khác biệt, tạo ra đánh giá có chiều sâu chuyên môn.

Hệ thống đã có phiên bản demo chạy được tại: https://ai-ad-image-analyzer-web.vercel.app
