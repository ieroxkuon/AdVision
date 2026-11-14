/**
 * =============================================================================
 * ANALYZE SERVICE — /api/analyze
 * =============================================================================
 * Chịu trách nhiệm DUY NHẤT: nhận ảnh + prompt từ client, gọi AI API
 * (Gemini hoặc GPT), và trả về kết quả phân tích.
 *
 * Nguyên lý SOA áp dụng:
 * - Abstraction: Client không cần biết AI nào đang chạy ở backend.
 * - Interoperability: Dễ dàng thêm model mới (Claude, Llama...) mà
 *   không ảnh hưởng tới frontend.
 * - Statelessness: Mỗi request mang đủ dữ liệu (ảnh + key + prompt),
 *   server không giữ state giữa các lần gọi.
 */

const express = require('express');
const router  = express.Router();

// ===========================================================================
// POST /api/analyze — Phân tích ảnh với Gemini hoặc OpenAI
// Body: { image: "base64...", mimeType, systemPrompt, model, apiKey }
// ===========================================================================
router.post('/', async (req, res) => {
  const { image, mimeType, systemPrompt, userText, model, apiKey } = req.body;

  if (!image || !apiKey) {
    return res.status(400).json({ error: 'Thiếu dữ liệu: image hoặc apiKey' });
  }

  try {
    let result = '';

    if (apiKey.startsWith('sk-')) {
      // --- OpenAI GPT-4o-mini ---
      result = await callOpenAI({ image, mimeType, systemPrompt, userText, model: model || 'gpt-4o-mini', apiKey });
    } else {
      // --- Google Gemini (mặc định) ---
      result = await callGemini({ image, mimeType, systemPrompt, userText, model: model || 'gemini-2.5-flash', apiKey });
    }

    res.json({ success: true, result });
  } catch (err) {
    console.error('[Analyze Service Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===========================================================================
// POST /api/analyze/chat — Hội thoại tiếp nối (không gửi lại ảnh)
// Body: { newText, systemPrompt, conversationHistory, activeImageData, apiKey }
// ===========================================================================
router.post('/chat', async (req, res) => {
  const { newText, systemPrompt, conversationHistory = [], activeImageData, apiKey } = req.body;

  if (!newText || !apiKey) {
    return res.status(400).json({ error: 'Thiếu dữ liệu: newText hoặc apiKey' });
  }

  try {
    let result = '';

    if (apiKey.startsWith('sk-')) {
      result = await callOpenAIChat({ newText, systemPrompt, conversationHistory, activeImageData, apiKey });
    } else {
      result = await callGeminiChat({ newText, systemPrompt, conversationHistory, activeImageData, apiKey });
    }

    res.json({ success: true, result });
  } catch (err) {
    console.error('[Analyze/Chat Service Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===========================================================================
// HELPERS — Gọi Gemini Vision API
// ===========================================================================
async function callGemini({ image, mimeType, systemPrompt, userText, model, apiKey }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: `${systemPrompt}\n\n${userText || ''}` },
          { inline_data: { mime_type: mimeType || 'image/jpeg', data: image } },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini HTTP ${resp.status}`);
  }

  const json = await resp.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ===========================================================================
// HELPERS — Gọi Gemini Chat (multi-turn)
// ===========================================================================
async function callGeminiChat({ newText, systemPrompt, conversationHistory, activeImageData, apiKey }) {
  const model = 'gemini-2.5-flash';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [];

  // Turn đầu: system prompt + ảnh (nếu có)
  if (activeImageData) {
    contents.push({
      role: 'user',
      parts: [
        { text: `${systemPrompt}\n\nHình ảnh quảng cáo:` },
        { inline_data: { mime_type: activeImageData.mimeType, data: activeImageData.base64 } },
      ],
    });
  } else {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
  }

  // Lịch sử hội thoại
  for (const item of conversationHistory) {
    contents.push({
      role: item.role === 'model' ? 'model' : 'user',
      parts: [{ text: item.text }],
    });
  }

  // Tin nhắn mới
  contents.push({ role: 'user', parts: [{ text: newText }] });

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini Chat HTTP ${resp.status}`);
  }

  const json = await resp.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ===========================================================================
// HELPERS — Gọi OpenAI Vision
// ===========================================================================
async function callOpenAI({ image, mimeType, systemPrompt, userText, model, apiKey }) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText || 'Hãy phân tích hình ảnh quảng cáo này.' },
            { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${image}` } },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI HTTP ${resp.status}`);
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content || '';
}

// ===========================================================================
// HELPERS — Gọi OpenAI Chat (multi-turn)
// ===========================================================================
async function callOpenAIChat({ newText, systemPrompt, conversationHistory, activeImageData, apiKey }) {
  const messages = [{ role: 'system', content: systemPrompt }];

  if (activeImageData) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Hình ảnh quảng cáo đang trao đổi:' },
        { type: 'image_url', image_url: { url: `data:${activeImageData.mimeType};base64,${activeImageData.base64}` } },
      ],
    });
  }

  for (const item of conversationHistory) {
    messages.push({ role: item.role === 'model' ? 'assistant' : 'user', content: item.text });
  }

  messages.push({ role: 'user', content: newText });

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 4096 }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI Chat HTTP ${resp.status}`);
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content || '';
}

module.exports = router;

