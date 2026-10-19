/**
 * =============================================================================
 * ADVISION AI - CẤU HÌNH HỆ THỐNG & ĐẶC TẢ MÔ HÌNH VLM (SYSTEM CONFIGURATION)
 * =============================================================================
 * 1. CÔNG CỤ VLM (VISION-LANGUAGE MODEL):
 *    - Mô hình chính: Google Gemini 2.5 Flash (API Multimodal thế hệ mới nhất).
 *    - Công nghệ thị giác: Vision Encoder tích hợp sẵn dựa trên kiến trúc Vision Transformer (ViT).
 *    - Mô hình dự phòng: OpenAI GPT-4o-mini Vision.
 * 2. ĐỊNH HƯỚNG CHỦ ĐỀ CHUYÊN SÂU:
 *    - Trọng tâm: Thẩm định & tối ưu hình ảnh quảng cáo F&B và Thương mại điện tử.
 */

const AdvConfig = {
  // THÔNG TIN KIẾN TRÚC MÔ HÌNH VLM (THEO YÊU CẦU ĐỒ ÁN TỐT NGHIỆP)
  VLM_SPECIFICATION: {
    ENGINE_TYPE: "Vision-Language Model (VLM) Multimodal",
    PRIMARY_MODEL: "gemini-2.5-flash",
    VISION_ENCODER_TECH: "Vision Transformer (ViT) kết hợp Multimodal Joint Embedding",
    SECONDARY_MODEL: "gpt-4o-mini",
    FOCUS_DOMAIN: "Hình ảnh quảng cáo thương mại (F&B, E-commerce, Retail)"
  },

  // Danh sách các phiên bản Gemini được ưu tiên thử nghiệm tuần tự
  GEMINI_MODELS: [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-pro'
  ],

  // Cấu hình mô hình OpenAI Vision
  OPENAI_MODEL: 'gpt-4o-mini',
  OPENAI_API_URL: 'https://api.openai.com/v1/chat/completions',
  OPENAI_MAX_TOKENS: 2500,

  // Khóa API mặc định hệ thống (phục vụ mục đích demo nghiên cứu)
  DEFAULT_API_KEY: ["AQ", "Ab8RN6KzrZ4IXmVghFLkZfB7BQjXq-cuo5nsJde35fm6u_3CQQ"].join('.'),

  // Các định danh lưu trữ trong LocalStorage
  STORAGE_KEYS: {
    API_KEY: 'GEMINI_API_KEY',
    USER_NAME: 'ADVISION_USER_NAME',
    USER_INDUSTRY: 'ADVISION_USER_INDUSTRY',
    NAME_VARIATIONS: 'ADVISION_NAME_VARIATIONS'
  },

  // Lấy API Key khả dụng (ưu tiên key người dùng tự nhập, nếu không dùng key hệ thống)
  getEffectiveApiKey() {
    const customKey = localStorage.getItem(this.STORAGE_KEYS.API_KEY);
    if (customKey && customKey.trim().length > 0) {
      return customKey.trim();
    }
    return this.DEFAULT_API_KEY;
  }
};

window.AdvConfig = AdvConfig;
