/**
 * =============================================================================
 * ADVISION AI - DỊCH VỤ QUẢN LÝ QUY CHUẨN THIẾT KẾ (RULES SERVICE)
 * =============================================================================
 * Đảm nhiệm nạp, tra cứu và hiển thị 22 quy chuẩn thẩm định thị giác
 * Trích xuất từ 16 tài liệu nghiên cứu chuyên ngành đồ họa & quảng cáo số.
 */

const RulesService = {
  // Danh mục phân loại và màu sắc đại diện (Tailwind style)
  CATEGORIES: {
    layout_composition: {
      label: "Bố cục & Lưới",
      color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    },
    color_contrast: {
      label: "Màu sắc & Tương phản",
      color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    },
    typography: {
      label: "Kiểu chữ & Phân cấp",
      color: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
    },
    cta_optimization: {
      label: "Nút Kêu gọi CTA",
      color: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
    },
    branding: {
      label: "Thương hiệu & Logo",
      color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    }
  },

  // Bộ 22 quy chuẩn thẩm định chuẩn hóa (Single Source of Truth)
  rules: [
    {
      "rule_id": "layout_rule_of_thirds",
      "category": "layout_composition",
      "title": "Quy tắc một phần ba trong bố cục thị giác",
      "description": "Chia khu vực thiết kế thành một lưới 3x3 gồm 9 ô vuông bằng nhau bằng 2 đường ngang và 2 đường dọc. Đặt điểm nhấn chính (focal point) của hình ảnh hoặc thông điệp quảng cáo tại hoặc gần các giao điểm lưới để tạo độ cân bằng thị giác tự nhiên.",
      "threshold": "Lưới 3x3, điểm nhấn tại 4 điểm giao cắt",
      "severity": "critical",
      "source_book": "The Graphic Design Book- A Comprehensive Guide for Beginners.pdf",
      "source_location": "Section 3: Layout and Composition - The Rule of Thirds"
    },
    {
      "rule_id": "layout_3x4_grid_partition",
      "category": "layout_composition",
      "title": "Cấu trúc lưới 3x4 phân chia bố cục",
      "description": "Sử dụng hệ thống lưới cơ sở 3 cột x 4 hàng với các phương án phân chia duy nhất để tổ chức các khối nội dung, tiêu đề và hình ảnh trên trang quảng cáo.",
      "threshold": "Lưới 3 x 4 (12 ô cơ sở)",
      "severity": "moderate",
      "source_book": "Designing for Clarity.pdf",
      "source_location": "Layout - The 892 unique ways to partition a 3 x 4 grid"
    },
    {
      "rule_id": "layout_golden_ratio_section",
      "category": "layout_composition",
      "title": "Tỷ lệ vàng trong phân chia không gian thiết kế",
      "description": "Áp dụng tỷ lệ hằng số vàng (Golden Ratio ~ 1 : 1.618) để tính toán tỷ lệ khung hình, kích thước tỷ lệ giữa các phần tử và xác định độ rộng của vùng nội dung so với khoảng trắng bao quanh.",
      "threshold": "Tỷ lệ 1 : 1.618",
      "severity": "moderate",
      "source_book": "Graphic Design and Print Production Fundamentals.pdf",
      "source_location": "Chapter 3: Types of Grids (The Golden Section)"
    },
    {
      "rule_id": "layout_hang_lines_rule",
      "category": "layout_composition",
      "title": "Quy tắc đường treo nằm ngang (Hang Lines)",
      "description": "Chia mặt phẳng thiết kế theo chiều ngang thành 3 phần bằng nhau để tạo các đường treo (hang lines), phân định ranh giới riêng biệt giữa vùng dành cho hình ảnh và vùng dành cho văn bản.",
      "threshold": "Phân chia mặt phẳng ngang thành 3 phần",
      "severity": "moderate",
      "source_book": "Graphic Design and Print Production Fundamentals.pdf",
      "source_location": "Chapter 3: Hang Lines"
    },
    {
      "rule_id": "layout_single_vs_multicolumn_grid",
      "category": "layout_composition",
      "title": "Phân bổ lưới đơn cột và đa cột theo độ phức tạp nội dung",
      "description": "Áp dụng lưới 1 cột đối với thông điệp đơn giản; đối với quảng cáo phức tạp hợp nhất nhiều hình ảnh và văn bản, bắt buộc sử dụng lưới đa cột (multi-column) để phân vùng các cấp bậc thông tin.",
      "threshold": "1 cột cho nội dung đơn giản; đa cột cho bố cục phức hợp",
      "severity": "moderate",
      "source_book": "Graphic Design and Print Production Fundamentals.pdf",
      "source_location": "Chapter 3.4: Single-Column & Multi-Column Grid"
    },
    {
      "rule_id": "layout_modular_grid_consistency",
      "category": "layout_composition",
      "title": "Hệ thống lưới module cố định vị trí thông tin",
      "description": "Sử dụng lưới ô module (modular grid) để khóa vị trí nhất quán cho logo, tiêu đề, hình ảnh và nút kêu gọi hành động giữa các biến thể thiết kế cùng chiến dịch.",
      "threshold": "Hệ thống lưới module cố định vị trí",
      "severity": "critical",
      "source_book": "Graphic Design and Print Production Fundamentals.pdf",
      "source_location": "Chapter 3.4: Modular Grid"
    },
    {
      "rule_id": "color_schopenhauer_light_balance",
      "category": "color_contrast",
      "title": "Cân bằng diện tích màu sắc theo độ sáng Schopenhauer",
      "description": "Phân bổ tỷ lệ diện tích màu sắc tỷ lệ nghịch với độ phản xạ ánh sáng (Tím:Vàng = 3:1, Lam:Cam = 2:1, Đỏ:Lục = 1:1) để đạt độ hài hòa thị giác tối ưu.",
      "threshold": "Tím:Vàng = 3:1 | Lam:Cam = 2:1 | Đỏ:Lục = 1:1",
      "severity": "critical",
      "source_book": "Understanding Color - An Introduction for Designers.pdf",
      "source_location": "Chapter 4: Light Values - Schopenhauer's Area Proportions"
    },
    {
      "rule_id": "color_rgb_space_8bit_depth",
      "category": "color_contrast",
      "title": "Không gian màu số RGB và độ sâu 8-bit",
      "description": "Hình ảnh quảng cáo hiển thị trên màn hình số bắt buộc sử dụng không gian màu sRGB với 3 kênh Đỏ, Lục, Lam theo thang độ sáng 0 - 255 (24-bit TrueColor) để tối ưu hiển thị trên di động.",
      "threshold": "Hệ màu RGB, 0 - 255 mỗi kênh",
      "severity": "moderate",
      "source_book": "The Graphic Design Book- A Comprehensive Guide for Beginners.pdf",
      "source_location": "Section 4: Color Theory - The RGB Color Space"
    },
    {
      "rule_id": "color_simultaneous_contrast_balance",
      "category": "color_contrast",
      "title": "Kiểm soát hiệu ứng tương phản đồng thời (Simultaneous Contrast)",
      "description": "Khi đặt chữ hoặc nút CTA lên nền có màu sắc rực rỡ, phải chọn màu có độ sáng (value) hoặc độ bão hòa (saturation) cách biệt rõ rệt để tránh làm người xem hoa mắt.",
      "threshold": "Tương phản rõ nét giữa màu nền và chữ",
      "severity": "critical",
      "source_book": "Understanding Color - An Introduction for Designers.pdf",
      "source_location": "Chapter 4: Simultaneous Contrast"
    },
    {
      "rule_id": "color_monochromatic_hierarchy",
      "category": "color_contrast",
      "title": "Cấu trúc màu đơn sắc kết hợp sắc độ sáng tối (Monochromatic)",
      "description": "Sử dụng biến thể sắc độ sáng (tint) và tối (shade) của một màu chủ đạo duy nhất để tạo phân cấp thị giác tinh tế và sang trọng mà không gây rối màu.",
      "threshold": "1 màu chủ đạo + các dải sắc độ (tints/shades)",
      "severity": "moderate",
      "source_book": "Understanding Color - An Introduction for Designers.pdf",
      "source_location": "Chapter 5: Monochromatic Color Schemes"
    },
    {
      "rule_id": "color_warm_cool_temperature_contrast",
      "category": "color_contrast",
      "title": "Tương phản nhiệt độ màu nóng - lạnh (Warm vs Cool)",
      "description": "Sử dụng màu nóng (đỏ, cam, vàng) cho chủ thể hoặc nút CTA để tạo cảm giác tiến gần về phía mắt người xem; sử dụng màu lạnh (xanh lam, xanh lục) cho nền để lùi xa vào hậu cảnh.",
      "threshold": "Màu nóng cho chủ thể/CTA; màu lạnh cho hậu cảnh",
      "severity": "moderate",
      "source_book": "Understanding Color - An Introduction for Designers.pdf",
      "source_location": "Chapter 5: Warm and Cool Contrast"
    },
    {
      "rule_id": "typo_typeface_quantity_limit",
      "category": "typography",
      "title": "Giới hạn số lượng Typeface trong một thiết kế",
      "description": "Chỉ chọn tối đa 2 (hoặc không quá 3) font chữ: kết hợp 1 Serif (cho tiêu đề) và 1 Sans Serif (cho văn bản nội dung), hoặc ngược lại. Tránh dùng quá nhiều kiểu chữ gây rối mắt.",
      "threshold": "Số lượng Typeface ≤ 2 (1 Serif + 1 Sans Serif)",
      "severity": "critical",
      "source_book": "Designing for Clarity.pdf",
      "source_location": "Using Typefaces Together - 1 Serif 1 Sans Serif"
    },
    {
      "rule_id": "typo_leading_ratio",
      "category": "typography",
      "title": "Tỷ lệ khoảng cách dòng văn bản (Leading Ratio)",
      "description": "Khoảng cách giữa các dòng (leading) trong đoạn văn bản nội dung phải lớn hơn kích thước font chữ (font size) từ 1.25 đến 1.5 lần để đảm bảo độ dễ đọc và không bị dính dòng.",
      "threshold": "Leading = 1.25x - 1.5x Font Size (125% - 150%)",
      "severity": "critical",
      "source_book": "The Graphic Design Book- A Comprehensive Guide for Beginners.pdf",
      "source_location": "Section 3: Typography - Leading"
    },
    {
      "rule_id": "typo_point_pica_unit_standard",
      "category": "typography",
      "title": "Tiêu chuẩn hệ thống đo lường Typography",
      "description": "Áp dụng hệ thống typographic chuẩn: 1 Point = 1/72 inch (đo chiều cao font) và 12 Points = 1 Pica (đo độ rộng cột văn bản). Khi ghép font chữ, căn chỉnh theo chiều cao x (x-height).",
      "threshold": "1 Point = 1/72 inch; 1 Pica = 12 Points",
      "severity": "moderate",
      "source_book": "The Graphic Design Book- A Comprehensive Guide for Beginners.pdf",
      "source_location": "Section 3: Typography - Size & Point System"
    },
    {
      "rule_id": "typo_font_size_contrast_noticeable",
      "category": "typography",
      "title": "Tương phản kích thước Font phân cấp rõ rệt",
      "description": "Sự chênh lệch kích thước font chữ giữa tiêu đề và văn bản nội dung phải đủ lớn để nhận biết lập tức (Headline 28pt - 72pt, Body 12pt - 18pt). Tránh dùng kích thước quá gần nhau.",
      "threshold": "Chênh lệch kích thước rõ rệt (12pt vs 28pt+)",
      "severity": "critical",
      "source_book": "Designing for Clarity.pdf",
      "source_location": "Size - Make Font Sizes Noticeably Different"
    },
    {
      "rule_id": "typo_kerning_pairs_quality",
      "category": "typography",
      "title": "Tiêu chuẩn cặp Kerning lập trình sẵn trong Font",
      "description": "Font chữ chất lượng cao phải có từ 600 đến 800 giá trị kerning được lập trình sẵn để tự động xử lý khoảng hở thô giữa các ký tự.",
      "threshold": "600 - 800 kerning pairs",
      "severity": "moderate",
      "source_book": "Graphic Design and Print Production Fundamentals.pdf",
      "source_location": "Chapter 3.4: Kerning Values in Fonts"
    },
    {
      "rule_id": "cta_copy_congruency_interaction",
      "category": "cta_optimization",
      "title": "Tương thích thông điệp CTA với mức độ nhận diện thương hiệu",
      "description": "Đối với thương hiệu đã có độ nhận diện cao, thông điệp kêu gọi cảm xúc mang lại thái độ tích cực cao hơn hẳn khi hình ảnh có tính tương thích (Congruent: Mean=3.53 vs Incongruent: Mean=2.60; p < 0.012).",
      "threshold": "Thái độ M=3.53 (Congruent) vs M=2.60 (Incongruent), p < 0.012",
      "severity": "critical",
      "source_book": "ABSTRACTICCMI2017TsiotsouHatzithomas.pdf",
      "source_location": "Banner Advertising Effectiveness Study - Experiment 2"
    },
    {
      "rule_id": "cta_aida_model_attention",
      "category": "cta_optimization",
      "title": "Mô hình phễu AIDA dẫn dắt ánh nhìn đến nút CTA",
      "description": "Thiết kế phải tuân thủ dòng chảy thị giác 4 giai đoạn: Gây chú ý (Attention) -> Gợi thích thú (Interest) -> Thúc đẩy khao khát (Desire) -> Nút hành động (Action). Nút CTA phải là điểm rơi cuối cùng.",
      "threshold": "Trình tự thị giác AIDA 4 bước",
      "severity": "critical",
      "source_book": "Graphic Design and Print Production Fundamentals.pdf",
      "source_location": "Chapter 3: Purpose and Audience - AIDA Model"
    },
    {
      "rule_id": "cta_figure_ground_isolation",
      "category": "cta_optimization",
      "title": "Tách biệt nền và nút CTA theo nguyên lý Figure/Ground Gestalt",
      "description": "Nút bấm kêu gọi hành động (CTA) phải có màu sắc, đường viền hoặc đổ bóng tách biệt rõ khỏi nền để người dùng nhận diện ngay đây là yếu tố có thể tương tác được.",
      "threshold": "Nút CTA tách biệt hoàn toàn khỏi màu nền",
      "severity": "critical",
      "source_book": "The Graphic Design Book- A Comprehensive Guide for Beginners.pdf",
      "source_location": "Section 3: Gestalt Principles - Figure/Ground"
    },
    {
      "rule_id": "branding_logo_scaling_threshold",
      "category": "branding",
      "title": "Ngưỡng thu nhỏ của Logo nhận diện thương hiệu",
      "description": "Logo hoặc biểu tượng thương hiệu trên hình ảnh quảng cáo phải đảm bảo giữ nguyên độ sắc nét và đọc được các nét chữ khi co nhỏ về kích thước 16x16px hoặc 32x32px.",
      "threshold": "Đọc rõ và nhận diện được ở 16x16px / 32x32px",
      "severity": "moderate",
      "source_book": "Graphic Design and Print Production Fundamentals.pdf",
      "source_location": "Chapter 3: Logo and Identity - Scalability"
    },
    {
      "rule_id": "branding_negative_space_breathing_room",
      "category": "branding",
      "title": "Khoảng trống âm tạo không gian thở cho thương hiệu",
      "description": "Xung quanh logo, sản phẩm chủ thể và các thông điệp cốt lõi phải duy trì khoảng trắng tối thiểu bằng chiều cao của ký tự thương hiệu để tăng độ sang trọng.",
      "threshold": "Khoảng trắng tối thiểu bằng chiều cao ký tự thương hiệu",
      "severity": "critical",
      "source_book": "Designing for Clarity.pdf",
      "source_location": "Negative Space - Breathing Room in Visual Communication"
    },
    {
      "rule_id": "branding_visual_consistency_campaign",
      "category": "branding",
      "title": "Đồng bộ nhận diện thị giác trong toàn bộ chiến dịch",
      "description": "Tất cả các hình ảnh quảng cáo trong cùng chiến dịch phải sử dụng chung bảng màu cốt lõi, kiểu font chữ và phong cách hình ảnh để xây dựng niềm tin nơi khách hàng.",
      "threshold": "Đồng bộ 100% bảng màu và font chữ chiến dịch",
      "severity": "critical",
      "source_book": "Graphic Design and Print Production Fundamentals.pdf",
      "source_location": "Chapter 3: Brand Guidelines Consistency"
    }
  ],

  // Lấy toàn bộ danh sách quy tắc
  getAllRules() {
    return this.rules;
  },

  // Lấy danh sách quy tắc theo danh mục
  getRulesByCategory(category) {
    return this.rules.filter(r => r.category === category);
  },

  // Lấy chi tiết quy tắc theo ID
  getRuleById(ruleId) {
    return this.rules.find(r => r.rule_id === ruleId);
  },

  // Render HTML danh sách quy tắc cho Modal
  renderToHtml() {
    return this.rules.map((rule, idx) => {
      const cat = this.CATEGORIES[rule.category] || { label: rule.category, color: "bg-slate-100 text-slate-700" };
      return `
        <div class="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-borderDark hover:border-slate-300 transition-all">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold text-slate-400">#${String(idx + 1).padStart(2, '0')}</span>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.color}">${cat.label}</span>
            </div>
            <span class="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">${rule.threshold}</span>
          </div>
          <p class="font-semibold text-slate-900 dark:text-white text-xs mb-1">${rule.title}</p>
          <p class="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px] mb-2">${rule.description}</p>
          <div class="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/40 dark:border-slate-700/40">
            <i class="fa-regular fa-bookmark text-slate-400"></i>
            <span class="font-medium truncate">${rule.source_book} (${rule.source_location})</span>
          </div>
        </div>
      `;
    }).join('');
  }
};

window.RulesService = RulesService;
