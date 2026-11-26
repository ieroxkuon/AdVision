/**
 * =============================================================================
 * ADVISION AI - BỘ ĐO ĐẠC & TRÍCH XUẤT ĐẶC TRƯNG THỊ GIÁC CỤC BỘ
 * (LOCAL COMPUTER VISION MEASUREMENT & PERCEPTION ENGINE)
 * =============================================================================
 * THÀNH PHẦN THI CÔNG ĐỘC LẬP THEO ĐỒ ÁN TỐT NGHIỆP:
 * "Nghiên cứu và xây dựng AI Agent hỗ trợ phân tích, đánh giá và tối ưu hình ảnh quảng cáo"
 * 
 * ĐẢM NHIỆM TẦNG CẢM NHẬN THỊ GIÁC (PERCEPTION LAYER) CỦA AI AGENT:
 * 1. Tiền xử lý điểm ảnh phía Client qua HTML5 Canvas API (Offscreen Rasterization).
 * 2. Thuật toán trích xuất bảng màu chủ đạo (K-Means / Color Quantization) & kiểm tra tỷ lệ 60-30-10.
 * 3. Thuật toán tính độ chói Luminance & đo độ tương phản chuẩn quốc tế WCAG 2.1.
 * 4. Thuật toán phân tích biên cạnh tần số cao (Edge Gradient Density) ước lượng tỷ lệ chữ (Meta 20% Text Rule).
 * 5. Cung cấp bộ chỉ số đo đạc thực nghiệm (Grounding Truth) cho AI Agent để triệt tiêu ảo giác (Hallucination).
 * =============================================================================
 */

const ImageFeatureExtractor = {
  /**
   * Chuyển đổi giá trị RGB 0-255 sang dạng tuyến tính theo chuẩn sRGB của W3C
   */
  _toLinear(val) {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  },

  /**
   * Tính độ chói tương đối (Relative Luminance) theo chuẩn WCAG 2.1
   */
  _getLuminance(r, g, b) {
    const rLin = this._toLinear(r);
    const gLin = this._toLinear(g);
    const bLin = this._toLinear(b);
    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  },

  /**
   * Tính Tỷ lệ tương phản thị giác giữa 2 màu RGB (Contrast Ratio: 1:1 đến 21:1)
   */
  _getContrastRatio(rgb1, rgb2) {
    const lum1 = this._getLuminance(rgb1[0], rgb1[1], rgb1[2]);
    const lum2 = this._getLuminance(rgb2[0], rgb2[1], rgb2[2]);
    const brighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (brighter + 0.05) / (darker + 0.05);
  },

  /**
   * Chuyển RGB sang mã HEX
   */
  _rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("").toUpperCase();
  },

  /**
   * Trích xuất toàn diện đặc trưng vật lý và số liệu đo đạc thị giác từ hình ảnh
   * @param {Object} imageObj - Đối tượng ảnh chứa dataUrl, base64, mimeType
   * @returns {Promise<Object>} Bộ chỉ số đo đạc thị giác hoàn chỉnh
   */
  async extractFeatures(imageObj) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const ratioValue = width / height;

        // 1. Phân loại tỷ lệ khung hình quảng cáo tiêu chuẩn
        let standardRatio = "Tùy biến (Custom)";
        let ratioKey = "1:1";
        if (Math.abs(ratioValue - 1.0) <= 0.08) {
          standardRatio = "Khung vuông 1:1 (Feed Facebook, Instagram, Shopee)";
          ratioKey = "1:1";
        } else if (Math.abs(ratioValue - 9 / 16) <= 0.08) {
          standardRatio = "Khung dọc 9:16 (TikTok, Story, Reels)";
          ratioKey = "9:16";
        } else if (Math.abs(ratioValue - 16 / 9) <= 0.08) {
          standardRatio = "Khung ngang 16:9 (Youtube Thumbnail, Banner Web)";
          ratioKey = "16:9";
        } else if (ratioValue < 0.9) {
          standardRatio = "Khung dọc 4:5 (Portrait Feed Ad)";
          ratioKey = "4:5";
        } else if (ratioValue > 1.1) {
          standardRatio = "Khung ngang 1.91:1 (Landscape Feed Banner)";
          ratioKey = "1.91:1";
        }

        // 2. Phân cấp độ phân giải hiển thị
        let qualityTier = "Độ phân giải tiêu chuẩn (Standard Quality)";
        if (width < 600 || height < 600) {
          qualityTier = "Độ phân giải thấp (<600px), dễ bị vỡ hạt trên màn hình võng mạc (Retina)";
        } else if (width >= 1080 && height >= 1080) {
          qualityTier = "Độ phân giải cao (High Definition), sắc nét tối đa trên mọi thiết bị";
        }

        // 3. XỬ LÝ MA TRẬN ĐIỂM ẢNH BẰNG HTML5 CANVAS ĐỂ ĐO ĐẠC THỊ GIÁC CỤC BỘ
        const sampleSize = 160; // Thu nhỏ ảnh mẫu xuống 160x160 để tính toán siêu tốc < 30ms
        const canvas = document.createElement("canvas");
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imgData.data;
        const totalPixels = sampleSize * sampleSize;

        // 3.1. Gom cụm màu sắc (Color Quantization) để tìm bảng màu chủ đạo
        const colorBuckets = {};
        let totalR = 0, totalG = 0, totalB = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalR += r;
          totalG += g;
          totalB += b;

          // Lượng tử hóa RGB thành các khối 32 đơn vị
          const qR = Math.round(r / 32) * 32;
          const qG = Math.round(g / 32) * 32;
          const qB = Math.round(b / 32) * 32;
          const key = `${qR},${qG},${qB}`;

          colorBuckets[key] = (colorBuckets[key] || 0) + 1;
        }

        // Sắp xếp các cụm màu theo tần suất xuất hiện
        const sortedBuckets = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1]);

        // Trích xuất Primary (Nền/Chính), Secondary (Cấu trúc), Accent (Điểm nhấn)
        const top1Rgb = sortedBuckets[0] ? sortedBuckets[0][0].split(",").map(Number) : [255, 255, 255];
        const top1Percent = sortedBuckets[0] ? Math.round((sortedBuckets[0][1] / totalPixels) * 100) : 60;

        // Tìm màu phụ (cách biệt độ chói với màu 1 ít nhất 0.15)
        let top2Rgb = [100, 100, 100];
        let top2Percent = 25;
        for (let i = 1; i < sortedBuckets.length; i++) {
          const rgb = sortedBuckets[i][0].split(",").map(Number);
          if (Math.abs(this._getLuminance(rgb[0], rgb[1], rgb[2]) - this._getLuminance(top1Rgb[0], top1Rgb[1], top1Rgb[2])) > 0.12) {
            top2Rgb = rgb;
            top2Percent = Math.round((sortedBuckets[i][1] / totalPixels) * 100);
            break;
          }
        }

        // Tìm màu điểm nhấn (Accent Color - màu có độ tương phản cao nhất với màu nền)
        let accentRgb = [230, 80, 50];
        let maxContrast = 0;
        let accentPercent = 10;
        for (let i = 1; i < Math.min(sortedBuckets.length, 12); i++) {
          const rgb = sortedBuckets[i][0].split(",").map(Number);
          const cr = this._getContrastRatio(top1Rgb, rgb);
          if (cr > maxContrast) {
            maxContrast = cr;
            accentRgb = rgb;
            accentPercent = Math.max(5, Math.round((sortedBuckets[i][1] / totalPixels) * 100));
          }
        }

        // Chuẩn hóa tỷ lệ để tổng ~ 100%
        const normSum = top1Percent + top2Percent + accentPercent;
        const p1 = Math.round((top1Percent / normSum) * 100);
        const p2 = Math.round((top2Percent / normSum) * 100);
        const p3 = Math.max(5, 100 - p1 - p2);

        // Đánh giá quy tắc 60-30-10
        let rule60_30_10Status = "Cân đối hài hòa theo quy tắc 60-30-10";
        if (p1 > 75) {
          rule60_30_10Status = "Màu chủ đạo chiếm tỷ lệ áp đảo (>75%), thiết kế có nguy cơ đơn điệu";
        } else if (p3 < 5) {
          rule60_30_10Status = "Thiếu màu điểm nhấn tương phản nổi bật (<5%) để kích hoạt nút kêu gọi CTA";
        }

        // 3.2. Tính toán độ tương phản theo chuẩn WCAG 2.1
        const wcagRatioNum = this._getContrastRatio(top1Rgb, accentRgb);
        const wcagRatio = wcagRatioNum.toFixed(1) + ":1";

        let wcagBadge = "Đạt chuẩn WCAG 2.1 AA (Tương phản cao, rất dễ đọc)";
        let wcagPass = true;
        if (wcagRatioNum < 3.0) {
          wcagBadge = "Cảnh báo vi phạm WCAG (<3.0:1) - Độ tương phản yếu, chữ/nút dễ bị chìm";
          wcagPass = false;
        } else if (wcagRatioNum < 4.5) {
          wcagBadge = "Đạt chuẩn WCAG Large Text (3.0:1 - 4.5:1) - Phù hợp cho tiêu đề lớn hoặc nút bấm nổi";
          wcagPass = true;
        }

        // 3.3. Thuật toán ước lượng mật độ chi tiết & tỷ lệ diện tích chữ (Meta 20% Text Rule)
        // Chia ảnh thành lưới 10x10 ô. Ô nào có độ lệch gradient ngang cao thì đánh dấu là vùng chi tiết/văn bản
        const gridSize = 10;
        const cellPixels = sampleSize / gridSize;
        let textLikeCells = 0;

        for (let gy = 0; gy < gridSize; gy++) {
          for (let gx = 0; gx < gridSize; gx++) {
            let edgeCount = 0;
            const startX = gx * cellPixels;
            const startY = gy * cellPixels;

            for (let y = startY; y < startY + cellPixels - 1; y += 2) {
              for (let x = startX; x < startX + cellPixels - 1; x += 2) {
                const idx = (y * sampleSize + x) * 4;
                const idxNext = (y * sampleSize + (x + 1)) * 4;
                const lumA = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
                const lumB = data[idxNext] * 0.299 + data[idxNext + 1] * 0.587 + data[idxNext + 2] * 0.114;
                if (Math.abs(lumA - lumB) > 40) {
                  edgeCount++;
                }
              }
            }
            // Nếu mật độ biên cạnh cao, ô lưới này chứa văn bản hoặc chi tiết đồ họa dày
            if (edgeCount > 18) {
              textLikeCells++;
            }
          }
        }

        const estimatedTextPercent = Math.min(45, Math.max(5, Math.round((textLikeCells / 100) * 100)));
        let textRuleVerdict = `Mật độ chi tiết/văn bản ước tính ~${estimatedTextPercent}% (Nằm trong vùng an toàn <20%)`;
        let textRulePass = true;
        if (estimatedTextPercent > 20) {
          textRuleVerdict = `Cảnh báo: Mật độ chi tiết/văn bản ước tính ~${estimatedTextPercent}% (>20%, có thể ảnh hưởng tỷ lệ phân phối quảng cáo Meta/Google)`;
          textRulePass = false;
        }

        // 3.4. Nhiệt độ màu & Độ sáng trung bình
        const avgR = totalR / totalPixels;
        const avgG = totalG / totalPixels;
        const avgB = totalB / totalPixels;
        const avgBrightness = Math.round(0.299 * avgR + 0.587 * avgG + 0.114 * avgB);
        const warmthDiff = avgR - avgB;
        let colorWarmth = "Tông màu cân bằng (Neutral Tone)";
        if (warmthDiff > 18) colorWarmth = "Tông màu ấm (Warm Tone - gợi cảm giác nhiệt huyết, kích thích vị giác)";
        else if (warmthDiff < -18) colorWarmth = "Tông màu lạnh (Cool Tone - gợi sự tin cậy, công nghệ, thanh bình)";

        const features = {
          fileName: imageObj.fileName || "unknown",
          mimeType: imageObj.mimeType || "image/jpeg",
          width,
          height,
          dimensions: `${width} x ${height} px`,
          aspectRatio: standardRatio,
          ratioKey,
          qualityTier,
          fileSizeKb: imageObj.size ? Math.round(imageObj.size / 1024) : null,
          base64: imageObj.base64,
          dataUrl: imageObj.dataUrl,
          // BỘ SỐ LIỆU ĐO ĐẠC THỊ GIÁC CỤC BỘ (LOCAL VISION TELEMETRY)
          telemetry: {
            palette: {
              primary: { hex: this._rgbToHex(top1Rgb[0], top1Rgb[1], top1Rgb[2]), percent: p1, role: "Nền chủ đạo (60%)" },
              secondary: { hex: this._rgbToHex(top2Rgb[0], top2Rgb[1], top2Rgb[2]), percent: p2, role: "Cấu trúc/Sản phẩm (30%)" },
              accent: { hex: this._rgbToHex(accentRgb[0], accentRgb[1], accentRgb[2]), percent: p3, role: "Điểm nhấn/CTA (10%)" },
              evaluation: rule60_30_10Status
            },
            wcag: {
              contrastRatio: wcagRatio,
              verdict: wcagBadge,
              passed: wcagPass
            },
            textDensity: {
              estimatedPercent: estimatedTextPercent,
              verdict: textRuleVerdict,
              passed: textRulePass
            },
            environment: {
              brightness: `${avgBrightness}/255`,
              warmth: colorWarmth
            }
          }
        };

        resolve(features);
      };

      img.onerror = (err) => {
        reject(new Error("Không thể trích xuất đặc trưng hình ảnh: " + err.message));
      };

      img.src = imageObj.dataUrl;
    });
  },

  /**
   * Tạo văn bản số liệu thực nghiệm bổ sung trực tiếp vào Prompt của VLM
   * Cung cấp bằng chứng vật lý khách quan giúp AI Agent phân tích chuẩn xác, triệt tiêu ảo giác
   */
  formatFeatureSummary(features) {
    if (!features || !features.telemetry) return "";
    const t = features.telemetry;
    const p = t.palette;

    return `KẾT QUẢ ĐO ĐẠC THỊ GIÁC TỪ CÔNG CỤ CỤC BỘ (LOCAL VISION ENGINE):
- Kích thước & Khung hình: ${features.dimensions} | ${features.aspectRatio}
- Phân tích Bảng màu thực nghiệm:
  * Màu nền chủ đạo: ${p.primary.hex} (chiếm ~${p.primary.percent}%)
  * Màu cấu trúc/sản phẩm: ${p.secondary.hex} (chiếm ~${p.secondary.percent}%)
  * Màu điểm nhấn (Accent/CTA): ${p.accent.hex} (chiếm ~${p.accent.percent}%)
  * Đánh giá quy tắc 60-30-10: ${p.evaluation}
- Đo độ tương phản thị giác chuẩn WCAG 2.1:
  * Tỷ lệ tương phản điểm nhấn so với nền: ${t.wcag.contrastRatio}
  * Đánh giá khả năng đọc (Legibility): ${t.wcag.verdict}
- Ước lượng mật độ chữ & chi tiết (Meta Ads 20% Rule):
  * ${t.textDensity.verdict}
- Ánh sáng & Nhiệt độ màu:
  * Độ sáng trung bình: ${t.environment.brightness} | ${t.environment.warmth}

HƯỚNG DẪN DÀNH CHO CỐ VẤN HOÀNG AN:
Hãy sử dụng trực tiếp các số liệu đo đạc khách quan ở trên (độ tương phản ${t.wcag.contrastRatio}, bảng màu ${p.primary.hex} - ${p.accent.hex}, mật độ chữ ~${t.textDensity.estimatedPercent}%) để làm bằng chứng khoa học cụ thể khi nhận xét và chỉ ra giải pháp tối ưu cho người dùng.`;
  },

  /**
   * Kết xuất chuỗi HTML Thẻ đo đạc thị giác (Visual Telemetry Card) tối giản, tinh gọn (Mini & Clean)
   */
  renderTelemetryBadge(features) {
    if (!features || !features.telemetry) return "";
    const t = features.telemetry;
    const p = t.palette;

    const wcagColorClass = t.wcag.passed
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

    const textDensityColorClass = t.textDensity.passed
      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";

    return `
    <div class="visual-telemetry-card my-2 px-3 py-2 rounded-xl bg-white/70 dark:bg-[#20201D]/70 border border-claudeBorder dark:border-claudeDarkBorder shadow-xs backdrop-blur-xs text-[11px] space-y-1.5">
      <div class="flex items-center justify-between text-claudeMuted dark:text-claudeDarkMuted">
        <span class="flex items-center gap-1.5 font-semibold text-claudeText dark:text-claudeDarkText text-[10px] uppercase tracking-wider">
          <i class="fa-solid fa-microchip text-claudeCoral"></i>
          Đo lường thị giác cục bộ
        </span>
        <span class="font-mono text-[10px] opacity-80">${features.dimensions || ''} (${features.ratioKey || 'Tự do'})</span>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <!-- 3 Chip màu 60-30-10 tinh gọn -->
        <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-claudeSidebar dark:bg-claudeDarkSidebar border border-claudeBorder/50 dark:border-claudeDarkBorder/50" title="Bảng màu chính 60-30-10">
          <span class="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style="background-color: ${p.primary.hex}"></span>
          <span class="font-mono text-[10px] font-semibold">${p.primary.hex}</span>
          <span class="text-[9px] text-claudeMuted">60%</span>
        </div>

        <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-claudeSidebar dark:bg-claudeDarkSidebar border border-claudeBorder/50 dark:border-claudeDarkBorder/50" title="Màu cấu trúc 30%">
          <span class="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style="background-color: ${p.secondary.hex}"></span>
          <span class="font-mono text-[10px] font-semibold">${p.secondary.hex}</span>
          <span class="text-[9px] text-claudeMuted">30%</span>
        </div>

        <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-claudeSidebar dark:bg-claudeDarkSidebar border border-claudeBorder/50 dark:border-claudeDarkBorder/50" title="Màu nhấn CTA 10%">
          <span class="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style="background-color: ${p.accent.hex}"></span>
          <span class="font-mono text-[10px] font-semibold">${p.accent.hex}</span>
          <span class="text-[9px] text-claudeMuted">10%</span>
        </div>

        <!-- Badge Tương phản WCAG & Mật độ chữ -->
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${wcagColorClass} text-[10px] font-medium" title="Chuẩn tương phản WCAG 2.1">
          <i class="fa-solid fa-eye-low text-[9px]"></i>
          WCAG: <strong>${t.wcag.contrastRatio}</strong>
        </span>

        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${textDensityColorClass} text-[10px] font-medium" title="Mật độ diện tích chữ (chuẩn Meta <20%)">
          <i class="fa-solid fa-font text-[9px]"></i>
          Chữ: <strong>~${t.textDensity.estimatedPercent}%</strong>
        </span>
      </div>
    </div>
    `.trim();
  }
};

window.ImageFeatureExtractor = ImageFeatureExtractor;
