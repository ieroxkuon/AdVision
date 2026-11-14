/**
 * =============================================================================
 * ADVISION AI - BỘ ĐỘNG CƠ SINH PROMPT TÁI THIẾT KẾ (REDESIGN PROMPT GENERATOR)
 * =============================================================================
 * Mô-đun chuyên biệt phục vụ nghiên cứu & tạo giải pháp thực thi trực quan.
 * Chuyển hóa các nhận xét thẩm định của Cố vấn Hoàng An thành câu lệnh Prompt
 * tiếng Anh chuẩn đồ họa cho Midjourney, DALL-E 3, ChatGPT hoặc Google Imagen.
 */

const RedesignGenerator = {
  // Các mẫu phong cách thị giác thịnh hành trong quảng cáo thương mại
  VISUAL_STYLES: {
    minimalist: "clean minimalist commercial photography, soft studio lighting, ample negative space, elegant composition",
    luxury: "high-end luxury brand aesthetic, cinematic lighting, deep rich contrast, sophisticated metallic and velvet textures",
    vibrant: "high-energy dynamic marketing visual, bold complementary colors, modern 3D depth, vivid crisp details",
    corporate: "clean modern corporate branding visual, 3x4 grid alignment, balanced typography space, sharp professional look"
  },

  /**
   * Tạo Prompt chuẩn hóa cho các công cụ AI sinh ảnh thế hệ mới
   * @param {Object} params - Tham số phân tích
   * @param {string} params.subject - Chủ thể sản phẩm chính
   * @param {string} params.industry - Ngành hàng
   * @param {string} params.styleKey - Khóa phong cách (minimalist, luxury...)
   * @param {string} params.focalRule - Quy tắc bố cục (Rule of Thirds, Golden Ratio)
   * @param {string} params.aspectRatio - Tỷ lệ khung hình (1:1, 16:9, 9:16)
   * @returns {string} Prompt tiếng Anh chuẩn
   */
  generatePrompt({ subject, industry = "commercial product", styleKey = "minimalist", focalRule = "rule of thirds", aspectRatio = "1:1" }) {
    const styleDesc = this.VISUAL_STYLES[styleKey] || this.VISUAL_STYLES.minimalist;
    const cleanSubject = subject || `premium advertising banner for ${industry}`;

    return [
      `Professional commercial advertising banner for ${cleanSubject}`,
      `composed with strict ${focalRule} visual hierarchy`,
      styleDesc,
      `Schopenhauer color harmony, balanced contrast for headline and CTA placement`,
      `clean breathing room, ultra-sharp focus, 8k resolution, shot on Hasselblad H6D-100c`,
      aspectRatio === "9:16" ? "--ar 9:16 --v 6.1" : (aspectRatio === "16:9" ? "--ar 16:9 --v 6.1" : "--ar 1:1 --v 6.1")
    ].join(', ');
  },

  /**
   * Trích xuất đoạn Prompt tiếng Anh từ câu trả lời của AI nếu có
   * @param {string} responseText - Toàn bộ nội dung văn bản AI trả về
   * @returns {string|null} Đoạn prompt nếu tìm thấy
   */
  extractPromptFromResponse(responseText) {
    if (!responseText) return null;
    const match = responseText.match(/\[GỢI Ý PROMPT.*?\][\r\n]+([\s\S]*?)(?=\n\[|$)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }
};

window.RedesignGenerator = RedesignGenerator;
