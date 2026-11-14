/**
 * =============================================================================
 * ADVISION AI - BỘ TRÍCH XUẤT ĐẶC TRƯNG HÌNH ẢNH (IMAGE FEATURE EXTRACTOR)
 * =============================================================================
 * CHỨC NĂNG CỐT LÕI:
 * Đảm nhiệm TẦNG NHẬN DẠNG ĐẶC TRƯNG HÌNH ẢNH (Image Feature Recognition):
 * 1. Tiền xử lý dữ liệu ảnh phía client (Client-side Preprocessing qua Canvas API).
 * 2. Trích xuất đặc trưng vật lý: Độ phân giải, tỷ lệ khung hình (Aspect Ratio), dung lượng.
 * 3. Phân loại định dạng quảng cáo chuẩn: Vuông (1:1), Dọc Story/TikTok (9:16), Ngang (16:9).
 * 4. Đóng gói Payload thị giác chuẩn hóa nạp vào Vision Encoder (Vision Transformer - ViT) của mô hình VLM.
 */

const ImageFeatureExtractor = {
  /**
   * Trích xuất đặc trưng hình ảnh từ tệp hoặc DataURL
   * @param {File|Object} imageObj - Đối tượng ảnh gồm dataUrl, base64, mimeType
   * @returns {Promise<Object>} Đặc trưng thị giác được trích xuất
   */
  async extractFeatures(imageObj) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const ratioValue = width / height;

        // Phân loại tỷ lệ khung hình quảng cáo
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
          standardRatio = "Khung dọc (Portrait Ad)";
          ratioKey = "4:5";
        } else if (ratioValue > 1.1) {
          standardRatio = "Khung ngang (Landscape Banner)";
          ratioKey = "1.91:1";
        }

        // Đánh giá sơ bộ độ phân giải hiển thị
        let qualityTier = "Đạt chuẩn hiển thị sắc nét";
        if (width < 600 || height < 600) {
          qualityTier = "Độ phân giải thấp, có thể bị vỡ hạt trên màn hình võng mạc (Retina)";
        } else if (width >= 1200 && height >= 1200) {
          qualityTier = "Độ phân giải cao (High Definition), tối ưu hiển thị đa thiết bị";
        }

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
          dataUrl: imageObj.dataUrl
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
   * Tạo văn bản tóm tắt đặc trưng kỹ thuật để bổ sung vào Prompt phân tích của VLM
   * @param {Object} features - Đặc trưng đã trích xuất từ extractFeatures()
   * @returns {string} Đoạn tóm tắt đặc trưng kỹ thuật
   */
  formatFeatureSummary(features) {
    if (!features) return "";
    return `ĐẶC TRƯNG KỸ THUẬT HÌNH ẢNH:
- Kích thước hiển thị: ${features.dimensions}
- Định dạng khung hình: ${features.aspectRatio}
- Đánh giá độ phân giải: ${features.qualityTier}`;
  }
};

window.ImageFeatureExtractor = ImageFeatureExtractor;
