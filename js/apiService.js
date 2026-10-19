/**
 * =============================================================================
 * ADVISION AI - DỊCH VỤ KẾT NỐI MÔ HÌNH THỊ GIÁC NGÔN NGỮ (VLM API SERVICE)
 * =============================================================================
 * Đảm nhiệm giao tiếp với Google Gemini Vision API (Mô hình chính: gemini-2.5-flash)
 * và OpenAI Vision API (gpt-4o-mini).
 * 
 * CÔNG NGHỆ NHẬN DẠNG ĐẶC TRƯNG HÌNH ẢNH:
 * - Tận dụng bộ mã hóa Vision Transformer (ViT) tích hợp trong VLM để chuyển đổi
 *   ma trận điểm ảnh (pixel matrix) thành các véc-tơ đặc trưng ngữ nghĩa (multimodal embeddings).
 * - Kết hợp tiền xử lý từ ImageFeatureExtractor để phân tích kích thước và tỷ lệ khung hình.
 */

const ApiService = {
  // 1. GỌI GEMINI VISION API ĐỂ THẨM ĐỊNH HÌNH ẢNH (VLM ENGINE)
  async callGeminiVisionApi(apiKey, base64Data, mimeType, userText, systemPrompt) {
    const models = AdvConfig.GEMINI_MODELS;
    let lastErr = null;

    for (const modelName of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: `${systemPrompt}\n\n${userText}` },
                { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
            }]
          })
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${resp.status}`);
        }

        const json = await resp.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Không thể kết nối với Gemini Vision API");
  },

  // 2. GỌI GEMINI MULTI-TURN CHAT (HỘI THOẠI ĐA LƯỢT)
  async callGeminiMultiTurnChat(apiKey, newText, systemPrompt, conversationHistory = [], activeImageData = null) {
    const models = AdvConfig.GEMINI_MODELS;
    let lastErr = null;

    const contents = [];

    if (activeImageData) {
      const firstTurnParts = [
        { text: `${systemPrompt}\n\nBức ảnh quảng cáo người dùng đã tải lên:` },
        { inline_data: { mime_type: activeImageData.mimeType, data: activeImageData.base64 } }
      ];
      contents.push({ role: 'user', parts: firstTurnParts });
    } else {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    }

    for (let i = 0; i < conversationHistory.length; i++) {
      const item = conversationHistory[i];
      contents.push({
        role: item.role === 'model' ? 'model' : 'user',
        parts: [{ text: item.text }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{
        text: `${newText}\n(Lưu ý: Bạn là Hoàng An, tự xưng là mình, gọi đối phương bằng tên, giữ vững phong cách vui tính, tư duy logic, tuyệt đối không dùng ký tự mũi tên, trích dẫn căn cứ khoa học từ tài liệu thiết kế và chủ động hỏi thông tin khách hàng nếu cần thiết)`
      }]
    });

    for (const modelName of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: contents })
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${resp.status}`);
        }

        const json = await resp.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Không thể kết nối với Gemini Chat API");
  },

  // 3. GỌI OPENAI VISION API (GPT-4o-mini)
  async callOpenAiVisionApi(apiKey, base64Data, mimeType, userText, systemPrompt) {
    const resp = await fetch(AdvConfig.OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: AdvConfig.OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
            ]
          }
        ],
        max_tokens: AdvConfig.OPENAI_MAX_TOKENS
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error?.message || "OpenAI API Error");
    }

    const json = await resp.json();
    return json.choices?.[0]?.message?.content || "";
  },

  // 4. GỌI OPENAI MULTI-TURN CHAT
  async callOpenAiMultiTurnChat(apiKey, newText, systemPrompt, conversationHistory = [], activeImageData = null) {
    const messages = [{ role: 'system', content: systemPrompt }];

    if (activeImageData) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Đây là hình ảnh quảng cáo đang trao đổi:' },
          { type: 'image_url', image_url: { url: `data:${activeImageData.mimeType};base64,${activeImageData.base64}` } }
        ]
      });
    }

    for (const item of conversationHistory) {
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.text
      });
    }

    messages.push({ role: 'user', content: newText });

    const resp = await fetch(AdvConfig.OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: AdvConfig.OPENAI_MODEL,
        messages: messages,
        max_tokens: AdvConfig.OPENAI_MAX_TOKENS
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error?.message || "OpenAI Chat Error");
    }

    const json = await resp.json();
    return json.choices?.[0]?.message?.content || "";
  },

  // HÀM ĐIỀU PHỐI VISION: TỰ ĐỘNG CHỌN GEMINI HOẶC OPENAI THEO ĐỊNH DẠNG KEY
  async analyzeImage({ apiKey, base64, mimeType, prompt, systemPrompt }) {
    if (apiKey.startsWith('sk-')) {
      return this.callOpenAiVisionApi(apiKey, base64, mimeType, prompt, systemPrompt);
    }
    return this.callGeminiVisionApi(apiKey, base64, mimeType, prompt, systemPrompt);
  },

  // HÀM ĐIỀU PHỐI CHAT TIẾP NỐI
  async chatNextTurn({ apiKey, text, systemPrompt, conversationHistory, activeImageData }) {
    if (apiKey.startsWith('sk-')) {
      return this.callOpenAiMultiTurnChat(apiKey, text, systemPrompt, conversationHistory, activeImageData);
    }
    return this.callGeminiMultiTurnChat(apiKey, text, systemPrompt, conversationHistory, activeImageData);
  }
};

window.ApiService = ApiService;
