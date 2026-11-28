/**
 * =============================================================================
 * ADVISION AI - AUTOMATED DIALOGUE EVALUATION & STRESS TEST SUITE
 * =============================================================================
 * Bộ kiểm thử tự động chất lượng hội thoại và rào chắn ngôn ngữ của AI Agent.
 * Mô phỏng hàng loạt kịch bản người dùng cộc lốc, từ khóa dị thường, hỏi tắt
 * để phát hiện sớm các lỗi: loop vô tận, xưng hô sai, phô trương sách vở,
 * nhận nhầm intent, parse điểm JSON lỗi...
 *
 * Chạy kiểm thử: npm test  HOẶC  node tests/dialogue_stress_test.js
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. NẠP CÁC MODULE CLIENT TRONG MÔI TRƯỜNG SANDBOX NODE.JS
function loadClientModules() {
  const sandbox = {
    window: {},
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; }
    },
    console: console,
    Math: Math,
    Date: Date
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  const baseDir = path.resolve(__dirname, '..');
  const files = [
    'client/js/config.js',
    'client/js/personaPrompt.js',
    'client/js/scoringService.js'
  ];

  for (const f of files) {
    const fullPath = path.join(baseDir, f);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      vm.runInContext(code, sandbox);
    } else {
      throw new Error(`Không tìm thấy file: ${fullPath}`);
    }
  }

  return sandbox;
}

// 2. MÀU SẮC TERMINAL TRỰC QUAN (ANSI CODES)
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};

// 3. FRAMEWORK TEST NHỎ GỌN (ZERO-DEPENDENCY)
class TestRunner {
  constructor() {
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.suiteName = '';
  }

  suite(name) {
    this.suiteName = name;
    console.log(`\n${C.bold}${C.cyan}▸ [SUITE] ${name}${C.reset}`);
  }

  test(description, fn) {
    this.total++;
    try {
      fn();
      this.passed++;
      console.log(`  ${C.green}✓ PASS${C.reset} ${description}`);
    } catch (err) {
      this.failed++;
      console.log(`  ${C.red}✗ FAIL${C.reset} ${description}`);
      console.log(`    ${C.red}↳ Lỗi: ${err.message}${C.reset}`);
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed");
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Giá trị không khớp'} | Mong đợi: "${expected}" | Thực tế: "${actual}"`);
    }
  }

  printSummary(startTime) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const passRate = ((this.passed / this.total) * 100).toFixed(1);
    const statusColor = this.failed === 0 ? C.green : C.red;

    console.log(`\n${C.bold}======================================================${C.reset}`);
    console.log(`${C.bold}  TỔNG KẾT KIỂM THỬ HỘI THOẠI AI AGENT (EVALS REPORT)${C.reset}`);
    console.log(`${C.bold}======================================================${C.reset}`);
    console.log(`  Tổng số ca kiểm thử (Test cases): ${C.bold}${this.total}${C.reset}`);
    console.log(`  Thành công (Passed):             ${C.green}${C.bold}${this.passed}${C.reset}`);
    console.log(`  Thất bại (Failed):               ${statusColor}${C.bold}${this.failed}${C.reset}`);
    console.log(`  Tỷ lệ vượt qua (Pass Rate):      ${statusColor}${C.bold}${passRate}%${C.reset}`);
    console.log(`  Thời gian thực thi:              ${duration}s`);
    console.log(`${C.bold}======================================================${C.reset}\n`);

    if (this.failed > 0) {
      process.exitCode = 1;
    }
  }
}

// 4. BỘ KIỂM THỬ CHÍNH (MAIN TEST SUITES)
function runAllDialogueTests() {
  const startTime = Date.now();
  const runner = new TestRunner();
  const env = loadClientModules();
  const PersonaPrompt = env.window.PersonaPrompt;
  const ScoringService = env.window.ScoringService;

  console.log(`${C.bold}${C.blue}======================================================${C.reset}`);
  console.log(`${C.bold}${C.blue}  ADVISION AI - BỘ TEST STRESS HỘI THOẠI & EVALUATION  ${C.reset}`);
  console.log(`${C.bold}${C.blue}======================================================${C.reset}`);

  // ---------------------------------------------------------------------------
  // SUITE 1: CHỐNG NHẬN NHẦM TỪ NGÀNH / TỪ LÓNG THÀNH TÊN NGƯỜI DÙNG
  // ---------------------------------------------------------------------------
  runner.suite("1. Name Extraction & Addressing Guardrails (Rào chắn xưng hô)");

  const badInputs = [
    { text: "food", desc: "Từ ngữ ngành hàng tiếng Anh đơn lẻ" },
    { text: "đồ ăn", desc: "Từ ngữ ngành hàng tiếng Việt đơn lẻ" },
    { text: "quán ăn", desc: "Loại hình kinh doanh F&B" },
    { text: "shop", desc: "Từ ngữ bán hàng chung chung" },
    { text: "fb", desc: "Tên viết tắt nền tảng quảng cáo" },
    { text: "quán gà rán vỉa hè", desc: "Cụm từ mô tả quán ăn dài" },
    { text: "áo thun unisex", desc: "Tên mặt hàng thời trang" },
    { text: "son môi dưỡng ẩm", desc: "Tên mặt hàng mỹ phẩm" }
  ];

  badInputs.forEach(({ text, desc }) => {
    runner.test(`Không được nhận nhầm "${text}" (${desc}) thành Tên người dùng`, () => {
      const detected = PersonaPrompt.detectContextFromText(text);
      runner.assert(!detected.userName, `Bị nhận nhầm thành tên: "${detected.userName}"`);

      // Kiểm tra getDynamicCallName không bao giờ trả về từ cấm
      const callName = PersonaPrompt.getDynamicCallName([text], "bạn");
      runner.assertEqual(callName, "bạn", `getDynamicCallName bị trả về tên cấm: "${callName}"`);
    });
  });

  const validNameInputs = [
    { text: "mình tên là Tuấn", expected: "Tuấn" },
    { text: "tên mình là Mai Phương", expected: "Phương" },
    { text: "cứ gọi mình là Minh nhé", expected: "Minh" },
    { text: "tôi tên là Nguyễn Thái Cương", expected: "Cương" }
  ];

  validNameInputs.forEach(({ text, expected }) => {
    runner.test(`Trích xuất đúng tên chuẩn khi người dùng giới thiệu: "${text}"`, () => {
      const detected = PersonaPrompt.detectContextFromText(text);
      runner.assert(detected.userName, `Không nhận diện được tên từ câu: "${text}"`);
      runner.assertEqual(detected.userName, expected, `Tên nhận diện không khớp`);
    });
  });

  // ---------------------------------------------------------------------------
  // SUITE 2: NHẬN DIỆN ĐÚNG NGÀNH HÀNG & NỀN TẢNG (SEMANTIC CONTEXT DETECTION)
  // ---------------------------------------------------------------------------
  runner.suite("2. Semantic Context Detection (Nhận diện ngành hàng & kênh)");

  const industryCases = [
    { text: "food", expected: "F&B / Ẩm thực" },
    { text: "quán gà rán giòn rụm", expected: "F&B / Ẩm thực" },
    { text: "quán trà sữa trân châu đường đen", expected: "F&B / Ẩm thực" },
    { text: "shop quần áo váy đầm thiết kế", expected: "Thời trang" },
    { text: "kem chống nắng nâng tone cho da dầu", expected: "Mỹ phẩm & Làm đẹp" },
    { text: "tai nghe bluetooth chống ồn chủ động", expected: "Công nghệ" },
    { text: "bán căn hộ chung cư 2 phòng ngủ", expected: "Bất động sản" }
  ];

  industryCases.forEach(({ text, expected }) => {
    runner.test(`Nhận diện đúng ngành hàng cho "${text}" → "${expected}"`, () => {
      const detected = PersonaPrompt.detectContextFromText(text);
      runner.assertEqual(detected.userIndustry, expected, `Ngành hàng nhận diện sai`);
    });
  });

  const platformCases = [
    { text: "chạy bảng tin facebook feed 1:1", expected: "Facebook & Instagram" },
    { text: "chạy story tiktok dọc 9:16", expected: "TikTok" },
    { text: "chạy quảng cáo tìm kiếm google ads", expected: "Google Ads" },
    { text: "bán trên sàn shopee lazada", expected: "E-commerce" }
  ];

  platformCases.forEach(({ text, expected }) => {
    runner.test(`Nhận diện đúng nền tảng cho "${text}" → "${expected}"`, () => {
      const detected = PersonaPrompt.detectContextFromText(text);
      runner.assertEqual(detected.userPlatform, expected, `Nền tảng nhận diện sai`);
    });
  });

  // ---------------------------------------------------------------------------
  // SUITE 3: NHẬN DIỆN Ý ĐỊNH YÊU CẦU BÁO CÁO THẨM ĐỊNH (INTENT DETECTION)
  // ---------------------------------------------------------------------------
  runner.suite("3. Conversational Intent Detection (Nhận diện ý định Báo cáo)");

  const reportRegex = /\b(xuất báo cáo|cho mình xin báo cáo|lấy báo cáo|tổng hợp báo cáo|báo cáo thẩm định|tải báo cáo|in báo cáo|file pdf|xuất pdf|báo cáo chi tiết)\b/i;

  const validReportQueries = [
    "cho mình xin báo cáo thẩm định",
    "xuất báo cáo để mình gửi sếp",
    "tổng hợp báo cáo chi tiết cho mình nhé",
    "mình muốn in báo cáo này",
    "tải file pdf báo cáo thẩm định được không",
    "xuất pdf giúp mình với"
  ];

  validReportQueries.forEach(query => {
    runner.test(`Bắt trúng ý định xuất báo cáo: "${query}"`, () => {
      runner.assert(reportRegex.test(query), `Không nhận diện được intent xuất báo cáo cho câu: "${query}"`);
    });
  });

  const normalQueries = [
    "làm sao để tăng điểm cho bức ảnh này?",
    "nút CTA nên đặt ở đâu thì chuẩn?",
    "màu đỏ và vàng có hợp với F&B không?",
    "ảnh này chạy quảng cáo có bị phạt lỗi nhiều chữ không?",
    "chỗ nào chưa ổn chỉ mình với"
  ];

  normalQueries.forEach(query => {
    runner.test(`Không kích hoạt nhầm xuất báo cáo với câu hỏi nghiệp vụ: "${query}"`, () => {
      runner.assert(!reportRegex.test(query), `Bị false positive với câu: "${query}"`);
    });
  });

  // ---------------------------------------------------------------------------
  // SUITE 4: KIỂM ĐỊNH RÀO CHẮN NGÔN NGỮ (LANGUAGE & JARGON GUARDRAILS)
  // ---------------------------------------------------------------------------
  runner.suite("4. Jargon & Academic Theory Guardrails (Chống phô trương sách vở)");

  const forbiddenJargons = [
    "Schopenhauer",
    "RGB 8-bit",
    "Đường treo ngang",
    "Tỷ lệ vàng 1:1.618",
    "Hang Lines"
  ];

  runner.test("Conversational System Prompt không chứa các thuật ngữ hàn lâm cấm", () => {
    const prompt = PersonaPrompt.getConversationalSystemPrompt("Tuấn", "F&B / Ẩm thực", "Facebook", "sales");
    forbiddenJargons.forEach(jargon => {
      runner.assert(!prompt.includes(jargon), `System Prompt bị nhiễm từ hàn lâm: "${jargon}"`);
    });
  });

  runner.test("Conversational System Prompt tuyệt đối không chứa ký tự mũi tên (->, -->, →)", () => {
    const prompt = PersonaPrompt.getConversationalSystemPrompt("Tuấn");
    runner.assert(!/->|-->|→|⇒/.test(prompt), "System Prompt chứa ký tự mũi tên cấm");
  });

  runner.test("Follow-up Prompts không dùng từ ngữ cứng nhắc hay 'Chào food!'", () => {
    const followUp = PersonaPrompt.buildFollowUpPrompt("food", "weaknesses");
    runner.assert(!followUp.includes("Chào food"), `Bị gọi người dùng là Chào food: "${followUp}"`);
  });

  // ---------------------------------------------------------------------------
  // SUITE 5: KIỂM THỬ SCHEMA CHẤM ĐIỂM RUBRIC ĐỊNH LƯỢNG (SCORING PARSER)
  // ---------------------------------------------------------------------------
  runner.suite("5. Scoring Rubric Parser & JSON Schema Validation");

  runner.test("Parse chuẩn xác JSON phản hồi hợp lệ đầy đủ 6 tiêu chí", () => {
    const mockJson = JSON.stringify({
      scores: {
        visual_impact:     { score: 8.5, reason: "Chủ thể bát salad nổi bật ngay trong 2s đầu" },
        message_clarity:   { score: 7.0, reason: "Thông điệp giảm giá 30% rõ nhưng hơi nhỏ" },
        text_hierarchy:    { score: 6.5, reason: "Cụm tiêu đề và phụ đề đang hơi dính nhau" },
        layout_space:      { score: 7.5, reason: "Bố cục cân đối theo quy tắc 1/3" },
        brand_identity:    { score: 6.0, reason: "Logo thương hiệu đặt ở góc trên hơi mờ" },
        cta_effectiveness: { score: 5.5, reason: "Nút Đặt món màu vàng bị chìm vào nền" }
      },
      total: 7.0
    });

    const parsed = ScoringService.parseScoreResponse(mockJson);
    runner.assert(parsed !== null, "Không parse được JSON hợp lệ");
    runner.assertEqual(parsed.scores.visual_impact.score, 8.5, "Điểm visual_impact không khớp");
    runner.assert(parsed.total >= 6.5 && parsed.total <= 7.5, "Điểm tổng tính toán sai");
    runner.assert(parsed.verdict.length > 0, "Thiếu nhãn Verdict");
  });

  runner.test("Bóc tách thành công JSON nằm bên trong khối Markdown (```json ... ```)", () => {
    const markdownWrapper = `
Dưới đây là kết quả chấm điểm định lượng:
\`\`\`json
{
  "scores": {
    "visual_impact":     { "score": 9.0, "reason": "Cực kỳ bắt mắt" },
    "message_clarity":   { "score": 8.0, "reason": "Rõ ràng" },
    "text_hierarchy":    { "score": 7.0, "reason": "Ổn" },
    "layout_space":      { "score": 8.0, "reason": "Thoáng" },
    "brand_identity":    { "score": 7.5, "reason": "Nhận diện tốt" },
    "cta_effectiveness": { "score": 8.5, "reason": "CTA nổi bật" }
  }
}
\`\`\`
Hy vọng bảng điểm này hữu ích cho bạn!
    `;

    const parsed = ScoringService.parseScoreResponse(markdownWrapper);
    runner.assert(parsed !== null, "Không bóc tách được JSON trong markdown block");
    runner.assertEqual(parsed.scores.visual_impact.score, 9.0, "Điểm visual_impact sai");
    runner.assert(parsed.total >= 8.0, "Điểm tổng phải >= 8.0 cho ca xuất sắc");
  });

  runner.test("Tự động giới hạn điểm (Clamp) khi AI trả về điểm vượt quá 10 (vd: 12/10)", () => {
    const overflowJson = JSON.stringify({
      scores: {
        visual_impact: { score: 14.5 },
        message_clarity: { score: -3 }
      }
    });
    const parsed = ScoringService.parseScoreResponse(overflowJson);
    runner.assert(parsed !== null, "Parse thất bại");
    runner.assertEqual(parsed.scores.visual_impact.score, 10, "Điểm 14.5 phải được clamp về 10");
    runner.assertEqual(parsed.scores.message_clarity.score, 0, "Điểm -3 phải được clamp về 0");
  });

  // ---------------------------------------------------------------------------
  // SUITE 6: MÔ PHỎNG ĐOẠN HỘI THOẠI THỰC TẾ (SIMULATED CONVERSATION RUN)
  // ---------------------------------------------------------------------------
  runner.suite("6. End-to-End Dialogue Multi-Turn Simulation");

  runner.test("Mô phỏng chuỗi 5 lượt nói cộc lốc không bao giờ sinh lỗi 'food' hay kẹt lặp", () => {
    const turns = ["food", "quán ăn", "đồ ăn", "fb", "làm sao để tăng điểm"];
    let detectedIndustry = "";
    let detectedPlatform = "";

    turns.forEach((turn, idx) => {
      const detected = PersonaPrompt.detectContextFromText(turn);
      if (detected.userIndustry) detectedIndustry = detected.userIndustry;
      if (detected.userPlatform) detectedPlatform = detected.userPlatform;

      const callName = PersonaPrompt.getDynamicCallName([], "bạn");
      runner.assertEqual(callName, "bạn", `Lượt ${idx + 1} (${turn}) bị xưng hô sai thành "${callName}"`);

      const prompt = PersonaPrompt.getConversationalSystemPrompt(callName, detectedIndustry, detectedPlatform);
      runner.assert(!prompt.includes("Chào food"), `Lượt ${idx + 1}: Prompt bị nhiễm 'Chào food'`);
      runner.assert(!prompt.includes("- Tên người dùng: food"), `Lượt ${idx + 1}: Prompt gán tên người dùng là food`);
    });

    runner.assertEqual(detectedIndustry, "F&B / Ẩm thực", "Chuỗi hội thoại phải chốt được ngành F&B");
    runner.assertEqual(detectedPlatform, "Facebook & Instagram", "Chuỗi hội thoại phải chốt được kênh Facebook");
  });

  // In kết quả tổng kết
  runner.printSummary(startTime);
}

// Chạy test nếu gọi trực tiếp qua Node
if (require.main === module) {
  runAllDialogueTests();
}

module.exports = { runAllDialogueTests, TestRunner };
