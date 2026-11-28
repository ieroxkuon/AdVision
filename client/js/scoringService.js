/**
 * =============================================================================
 * ADVISION AI - SCORING SERVICE (DỊCH VỤ CHẤM ĐIỂM ĐỊNH LƯỢNG)
 * =============================================================================
 * Phân hệ Rubric 6 tiêu chí chấm điểm định lượng (1-10) cho hình ảnh quảng cáo.
 * Nhận phản hồi JSON từ VLM API, validate schema, fallback khi sai định dạng.
 *
 * CẤU TRÚC JSON ĐẦU RA (buộc AI trả về đúng schema này):
 * {
 *   "scores": {
 *     "visual_impact":    { "score": 7.5, "reason": "...", "evidence": "..." },
 *     "message_clarity":  { "score": 8.0, "reason": "...", "evidence": "..." },
 *     "text_hierarchy":   { "score": 6.0, "reason": "...", "evidence": "..." },
 *     "layout_space":     { "score": 7.0, "reason": "...", "evidence": "..." },
 *     "brand_identity":   { "score": 5.5, "reason": "...", "evidence": "..." },
 *     "cta_effectiveness":{ "score": 6.5, "reason": "...", "evidence": "..." }
 *   },
 *   "total": 6.75,
 *   "verdict": "Tiềm năng - Cần chỉnh sửa"
 * }
 * =============================================================================
 */

const ScoringService = {
  // 6 tiêu chí chấm điểm chuẩn theo đồ án
  CRITERIA: {
    visual_impact:     { label: 'Sức hút thị giác (2s)', weight: 20, icon: '👁️' },
    message_clarity:   { label: 'Rõ ràng thông điệp',   weight: 20, icon: '💬' },
    text_hierarchy:    { label: 'Phân cấp chữ',          weight: 15, icon: '🔤' },
    layout_space:      { label: 'Bố cục & Khoảng thở',  weight: 15, icon: '📐' },
    brand_identity:    { label: 'Nhận diện thương hiệu', weight: 15, icon: '🎨' },
    cta_effectiveness: { label: 'Điểm rơi CTA',          weight: 15, icon: '🎯' }
  },

  // Verdict theo điểm tổng
  getVerdict(total) {
    if (total >= 8.5) return { label: 'Xuất sắc — Sẵn sàng chạy', color: '#10b981', emoji: '🏆' };
    if (total >= 7.5) return { label: 'Tốt — Tinh chỉnh nhỏ', color: '#3b82f6', emoji: '✅' };
    if (total >= 6.0) return { label: 'Trung bình — Cần cải thiện', color: '#f59e0b', emoji: '⚠️' };
    if (total >= 4.5) return { label: 'Yếu — Cần thiết kế lại', color: '#ef4444', emoji: '🔴' };
    return { label: 'Rất yếu — Làm lại từ đầu', color: '#7f1d1d', emoji: '💀' };
  },

  /**
   * Parse phản hồi JSON từ VLM. Hỗ trợ cả JSON thuần và JSON nằm trong markdown code block.
   * Trả về object điểm đã validate, hoặc null nếu parse thất bại.
   */
  parseScoreResponse(rawText) {
    if (!rawText) return null;
    try {
      // Thử extract JSON từ ```json ... ``` hoặc ``` ... ```
      let jsonStr = rawText;
      const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // Fallback: tìm object JSON đầu tiên
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      return this._validateAndNormalize(parsed);
    } catch (e) {
      console.warn('[ScoringService] JSON parse thất bại:', e.message, '— trying regex fallback');
      return this._regexFallback(rawText);
    }
  },

  // Validate cấu trúc JSON và tính lại điểm tổng
  _validateAndNormalize(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const scores = obj.scores || obj;
    const result = { scores: {}, total: 0, verdict: '' };
    let totalWeighted = 0;
    let totalWeight = 0;

    for (const [key, meta] of Object.entries(this.CRITERIA)) {
      const entry = scores[key] || {};
      const score = Math.min(10, Math.max(0, parseFloat(entry.score) || 0));
      result.scores[key] = {
        score: Math.round(score * 10) / 10,
        reason: (entry.reason || entry.comment || '').trim().substring(0, 200),
        evidence: (entry.evidence || entry.detail || '').trim().substring(0, 200)
      };
      totalWeighted += score * meta.weight;
      totalWeight += meta.weight;
    }

    result.total = totalWeight > 0
      ? Math.round((totalWeighted / totalWeight) * 10) / 10
      : (obj.total ? parseFloat(obj.total) : 0);

    const v = this.getVerdict(result.total);
    result.verdict = v.label;
    result._verdictMeta = v;
    return result;
  },

  // Fallback bằng regex nếu JSON parse hoàn toàn thất bại
  _regexFallback(rawText) {
    const result = { scores: {}, total: 0, verdict: '', _fallback: true };
    const scorePattern = /(visual_impact|message_clarity|text_hierarchy|layout_space|brand_identity|cta_effectiveness)[^\d]*(\d+(?:\.\d+)?)/gi;
    let match;
    let sum = 0; let count = 0;

    while ((match = scorePattern.exec(rawText)) !== null) {
      const key = match[1].toLowerCase();
      const score = Math.min(10, parseFloat(match[2]));
      if (this.CRITERIA[key]) {
        result.scores[key] = { score, reason: '', evidence: '' };
        sum += score; count++;
      }
    }

    if (count === 0) return null;
    result.total = Math.round((sum / count) * 10) / 10;
    const v = this.getVerdict(result.total);
    result.verdict = v.label;
    result._verdictMeta = v;
    return result;
  },

  /**
   * Render Score Card HTML để inject vào chat.
   * Design: compact card với bar progress cho mỗi tiêu chí.
   */
  renderScoreCard(scoreData, imageFileName = '') {
    if (!scoreData || !scoreData.scores) return '';

    const v = scoreData._verdictMeta || this.getVerdict(scoreData.total);
    const totalPct = (scoreData.total / 10) * 100;

    // Màu ring theo điểm tổng
    const ringColor = v.color;
    const fileLabel = imageFileName ? `<span class="text-[10px] text-[#9A9892] font-normal ml-1 truncate max-w-[120px]">${imageFileName}</span>` : '';

    // Rows từng tiêu chí
    const rows = Object.entries(this.CRITERIA).map(([key, meta]) => {
      const entry = scoreData.scores[key] || { score: 0, reason: '' };
      const pct = (entry.score / 10) * 100;
      const barColor = entry.score >= 7.5 ? '#10b981' : entry.score >= 5.5 ? '#f59e0b' : '#ef4444';
      const tooltip = entry.reason ? `title="${entry.reason.replace(/"/g, '&quot;')}"` : '';
      return `
        <div class="adv-score-row" ${tooltip}>
          <div class="adv-score-label">
            <span class="adv-score-icon">${meta.icon}</span>
            <span>${meta.label}</span>
          </div>
          <div class="adv-score-bar-wrap">
            <div class="adv-score-bar-fill" style="width:${pct}%;background:${barColor}"></div>
          </div>
          <span class="adv-score-num" style="color:${barColor}">${entry.score.toFixed(1)}</span>
        </div>`;
    }).join('');

    return `
<div class="adv-score-card" data-score="${scoreData.total}">
  <div class="adv-score-header">
    <div class="adv-score-circle" style="--ring:${ringColor}">
      <span class="adv-score-total">${scoreData.total.toFixed(1)}</span>
      <span class="adv-score-of">/10</span>
    </div>
    <div class="adv-score-meta">
      <div class="adv-score-verdict" style="color:${ringColor}">${v.emoji} ${v.label}</div>
      <div class="adv-score-file">Rubric 6 tiêu chí ${fileLabel}</div>
      ${scoreData._fallback ? '<div class="adv-score-fallback">⚠️ Trích xuất tự động</div>' : ''}
    </div>
  </div>
  <div class="adv-score-rows">${rows}</div>
  <div class="adv-score-footer">
    <span>AdVision Rubric v1 · Chấm điểm định lượng theo 22 quy chuẩn thiết kế</span>
  </div>
</div>`;
  }
};

window.ScoringService = ScoringService;
