/**
 * =============================================================================
 * ADVISION AI - BỘ ĐIỀU KHIỂN GIAO DIỆN & TƯƠNG TÁC (UI CONTROLLER)
 * =============================================================================
 * Quản lý toàn bộ hiển thị DOM, hiệu ứng gõ phím kiểu streaming, xem trước ảnh,
 * và các cửa sổ Modal (Quy chuẩn thiết kế, Cài đặt API Key).
 */

const UIController = {
  // Ánh xạ các phần tử giao diện
  elements: {
    chatContainer: document.getElementById('chat-container'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    btnAttachImage: document.getElementById('btn-attach-image'),
    fileInput: document.getElementById('file-input'),

    attachedImagePreview: document.getElementById('attached-image-preview'),
    attachedCountText: document.getElementById('attached-count-text'),
    attachedThumbsList: document.getElementById('attached-thumbs-list'),
    btnClearAllAttachments: document.getElementById('btn-clear-all-attachments'),

    btnApiKeyModal: document.getElementById('btn-api-key-modal'),
    apiModal: document.getElementById('api-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnSaveKey: document.getElementById('btn-save-key'),
    inputApiKey: document.getElementById('input-api-key'),
    apiStatusDot: document.getElementById('api-status-dot'),

    btnDocsModal: document.getElementById('btn-docs-modal'),
    docsModal: document.getElementById('docs-modal'),
    btnCloseDocsModal: document.getElementById('btn-close-docs-modal'),
    btnDoneDocsModal: document.getElementById('btn-done-docs-modal'),
    docsRulesList: document.getElementById('docs-rules-list'),

    btnResetChat: document.getElementById('btn-reset-chat'),
    userInfoBadge: document.getElementById('user-info-badge'),
    badgeUserName: document.getElementById('badge-user-name'),
    badgeIndustryContainer: document.getElementById('badge-industry-container'),
    badgeIndustryName: document.getElementById('badge-industry-name'),
  },

  // Trạng thái hiển thị AI đang phản hồi
  isAiTyping: false,

  // HTML avatar dùng chung cho AI agent trong chat
  AI_AVATAR_HTML: `<img src="images/advisor_hoang_an.jpg" alt="Hoàng An" class="w-8 h-8 rounded-full object-cover shrink-0 shadow-md ring-2 ring-violet-200/60 dark:ring-violet-900/60">`,

  // Tiện ích tạm dừng bất đồng bộ
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Cuộn khung chat xuống đáy mượt mà
  scrollToBottom() {
    if (this.elements.chatContainer) {
      this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
    }
  },

  // Cập nhật chấm trạng thái kết nối API
  updateApiStatusIndicator(hasKey) {
    const dot = this.elements.apiStatusDot;
    if (!dot) return;
    if (hasKey) {
      dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20";
      dot.title = "API Key đã kết nối";
    } else {
      dot.className = "w-1.5 h-1.5 rounded-full bg-amber-400";
      dot.title = "Chưa cài đặt API Key";
    }
  },

  // Cập nhật huy hiệu thông tin người dùng ở thanh công cụ
  updateUserBadge(userName, userIndustry) {
    const { userInfoBadge, badgeUserName, badgeIndustryContainer, badgeIndustryName } = this.elements;
    if (!userInfoBadge) return;

    if (userName) {
      badgeUserName.textContent = userName;
      userInfoBadge.classList.remove('hidden');
      userInfoBadge.classList.add('flex');

      if (userIndustry) {
        badgeIndustryName.textContent = userIndustry;
        badgeIndustryContainer.classList.remove('hidden');
      } else {
        badgeIndustryContainer.classList.add('hidden');
      }
    } else {
      userInfoBadge.classList.add('hidden');
      userInfoBadge.classList.remove('flex');
    }
  },

  // Cập nhật gợi ý placeholder trong ô nhập liệu
  updateInputPlaceholder(userName, userIndustry, callName, attachedCount = 0) {
    const input = this.elements.chatInput;
    if (!input) return;

    if (attachedCount > 0) {
      input.placeholder = attachedCount === 1
        ? "Nhập thêm lời nhắn cho ảnh (hoặc bấm gửi ngay)..."
        : `Nhập ghi chú cho ${attachedCount} ảnh này (hoặc bấm gửi ngay)...`;
      return;
    }

    if (!userName) {
      input.placeholder = "Nhập tên hoặc cách xưng hô bạn muốn để tiện trao đổi...";
    } else if (!userIndustry) {
      input.placeholder = `Sản phẩm ${callName} đang làm thuộc ngành nào (ví dụ: F&B đồ ăn, thời trang, mỹ phẩm...)?`;
    } else {
      input.placeholder = "Nhắn tin trao đổi hoặc bấm 📎 để gửi ảnh quảng cáo...";
    }
  },

  // Hiển thị danh sách thumbnail ảnh đã chọn
  renderAttachmentPreviews(attachedImages) {
    const { attachedImagePreview, attachedCountText, attachedThumbsList, fileInput } = this.elements;
    if (!attachedImagePreview || !attachedThumbsList) return;

    if (attachedImages.length === 0) {
      attachedImagePreview.classList.add('hidden');
      attachedImagePreview.classList.remove('flex');
      attachedThumbsList.innerHTML = '';
      if (fileInput) fileInput.value = '';
      return;
    }

    attachedImagePreview.classList.remove('hidden');
    attachedImagePreview.classList.add('flex');
    if (attachedCountText) {
      attachedCountText.textContent = `Ảnh đã chọn (${attachedImages.length})`;
    }

    attachedThumbsList.innerHTML = attachedImages.map((img, idx) => `
      <div class="relative group shrink-0">
        <img src="${img.dataUrl}" alt="${img.fileName}" class="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" title="${img.fileName}">
        <button type="button" onclick="window.AppController.removeAttachmentByIndex(${idx})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center text-[10px] shadow hover:bg-rose-600 dark:hover:bg-rose-500 transition-colors" title="Gỡ ảnh này">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <span class="block text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[56px] text-center mt-0.5">${img.fileName}</span>
      </div>
    `).join('');
  },

  // Thêm tin nhắn của người dùng vào hộp thoại
  appendUserMessage(text, images) {
    let imgHtml = '';
    if (images && images.length > 0) {
      imgHtml = `<div class="flex flex-wrap gap-2 mb-2.5">${images.map(img =>
        `<img src="${img.dataUrl}" alt="${img.fileName}" class="max-h-48 rounded-xl border border-slate-200 dark:border-borderDark object-cover shadow-sm" title="${img.fileName}">`
      ).join('')}</div>`;
    }
    const textHtml = text ? `<p class="leading-relaxed">${text}</p>` : '';

    const html = `
      <div class="flex gap-3 justify-end items-start group">
        <div class="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 px-4 py-3 rounded-2xl rounded-tr-sm text-[15px] font-normal max-w-lg leading-relaxed shadow-sm">
          ${imgHtml}
          ${textHtml}
        </div>
        <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 border border-slate-300 dark:border-slate-700">
          <i class="fa-regular fa-user"></i>
        </div>
      </div>
    `;
    this.elements.chatContainer.insertAdjacentHTML('beforeend', html);
    this.scrollToBottom();
  },

  // Hiển thị chỉ báo đang suy nghĩ / soạn tin
  showTypingIndicator(message = "Đang soạn câu trả lời...") {
    this.isAiTyping = true;
    const html = `
      <div id="typing-indicator" class="flex gap-3 items-center">
        ${this.AI_AVATAR_HTML}
        <div class="inline-flex items-center gap-2.5 bg-white dark:bg-cardDark border border-slate-200/80 dark:border-borderDark px-4 py-2.5 rounded-2xl rounded-tl-sm text-xs text-slate-500 dark:text-slate-400 shadow-sm">
          <div class="flex items-center gap-1">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
          <span>${message}</span>
        </div>
      </div>
    `;
    this.elements.chatContainer.insertAdjacentHTML('beforeend', html);
    this.scrollToBottom();
  },

  // Ẩn chỉ báo soạn tin
  hideTypingIndicator() {
    this.isAiTyping = false;
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  },

  // Phân loại dòng văn bản để định dạng trực quan
  classifyLine(line) {
    if (/^\[GỢI Ý PROMPT.*?\]\s*$/i.test(line)) return 'redesign-prompt-header';
    if (/^\[.+\]\s*$/.test(line)) return 'block-header';
    if (/^📸\s/.test(line)) return 'image-label';
    if (/^(Đánh giá( tổng quan)?:?\s*\d+(\.\d+)?\/10|\b\d+(\.\d+)?\/10\s*điểm)/i.test(line)) return 'score-badge';
    if (/^(Điểm nghẽn|Hạt sạn|Lỗi|Điểm chưa ổn|Vấn đề)(\s+thứ|\s+\d+|:)/i.test(line) || /^-\s*(Điểm nghẽn|Hạt sạn|Lỗi|Điểm chưa ổn)/i.test(line)) return 'flaw-card';
    if (/^(Điểm sáng|Ưu điểm|Điểm mạnh|Điểm làm tốt)(\s+thứ|\s+\d+|:)/i.test(line) || /^-\s*(Điểm sáng|Ưu điểm|Điểm mạnh)/i.test(line)) return 'strength-card';
    if (/^(Đề xuất|Khuyến nghị|Bước\s+\d+|Giải pháp)(\s+thứ|\s+\d+|:)/i.test(line) || /^-\s*(Đề xuất|Bước\s+\d+)/i.test(line)) return 'recommendation-card';
    if (/^(Theo bạn|Bạn muốn|Bạn nghĩ sao|Bạn định|Bạn có muốn)/i.test(line) && line.includes('?')) return 'question-card';
    if (/^(Đầu tiên|Thứ nhất|Thứ hai|Thứ ba|Tiếp đến|Kế tiếp|Cuối cùng)(,|\s+là|\s+về)/i.test(line)) return 'conversational-point';
    if (/^[^-\[].+:\s*$/.test(line)) return 'section-title';
    if (/^-\s+.+:\s*$/.test(line)) return 'section-title';
    if (/^-\s+.+:/.test(line)) return 'bullet-with-content';
    if (/^-\s+/.test(line)) return 'bullet';
    return 'paragraph';
  },

  // Chuyển đổi inline Markdown (**in đậm**, *nghiêng*, `code`) thành HTML an toàn và trực quan
  formatInlineMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
      .replace(/\*([^\*]+?)\*/g, '<em class="italic text-slate-700 dark:text-slate-300">$1</em>')
      .replace(/`([^`]+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">$1</code>');
  },

  // Tiện ích hiển thị chữ từng từ mượt mà (tương đương tốc độ ChatGPT)
  async streamTextToElement(targetEl, text, wordDelay = 16) {
    const tokens = text.split(/(\s+)/);
    for (const token of tokens) {
      targetEl.textContent += token;
      this.scrollToBottom();
      if (token.trim().length > 0) {
        await this.delay(wordDelay);
      }
    }
    // Render inline markdown khi đã stream xong toàn bộ từ của dòng
    targetEl.innerHTML = this.formatInlineMarkdown(text);
  },

  // Tiện ích sao chép văn bản vào Clipboard mượt mà
  async copyToClipboard(button, text) {
    try {
      await navigator.clipboard.writeText(text);
      const originalHtml = button.innerHTML;
      button.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i> <span class="text-emerald-400">Đã sao chép!</span>`;
      button.classList.add('bg-emerald-950/40', 'border-emerald-700/60');
      setTimeout(() => {
        button.innerHTML = originalHtml;
        button.classList.remove('bg-emerald-950/40', 'border-emerald-700/60');
      }, 2200);
    } catch (err) {
      console.error("Không thể copy:", err);
      alert("Đã sao chép: " + text.substring(0, 50) + "...");
    }
  },

  // Hiệu ứng hiển thị chữ từng từ mượt mà & định dạng thẻ trực quan
  async streamLines(linesArray, actionButtons = null) {
    this.isAiTyping = true;
    const messageWrapperId = 'agent-msg-' + Date.now();
    const html = `
      <div class="flex gap-3.5 items-start">
        <div class="mt-1 shrink-0">${this.AI_AVATAR_HTML}</div>
        <div class="space-y-3 text-[15px] leading-relaxed flex-1 prose-refined">
          <div id="${messageWrapperId}" class="bg-white dark:bg-cardDark border border-slate-200/80 dark:border-borderDark p-4 sm:p-5 rounded-2xl rounded-tl-sm shadow-sm space-y-3 text-slate-800 dark:text-slate-200">
          </div>
        </div>
      </div>
    `;
    this.elements.chatContainer.insertAdjacentHTML('beforeend', html);
    const container = document.getElementById(messageWrapperId);

    let isInsidePromptBlock = false;

    for (let i = 0; i < linesArray.length; i++) {
      const line = linesArray[i].trim();
      if (!line) continue;

      const type = this.classifyLine(line);
      const el = document.createElement('div');
      el.className = 'fade-in-text';

      // 1. Khối Prompt Tái thiết kế
      if (type === 'redesign-prompt-header') {
        isInsidePromptBlock = true;
        el.className = 'mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white border border-slate-700 shadow-md space-y-2.5';
        el.innerHTML = `
          <div class="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
              </span>
              <span class="text-xs font-bold tracking-wide text-slate-200">Prompt Tái Thiết Kế (DALL-E 3 / Midjourney / ChatGPT)</span>
            </div>
            <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Gen AI Ready</span>
          </div>
        `;
        container.appendChild(el);
        this.scrollToBottom();
        await this.delay(60);
        continue;
      }

      if (isInsidePromptBlock) {
        if (type === 'block-header') {
          isInsidePromptBlock = false;
        } else {
          const promptBox = document.createElement('div');
          promptBox.className = 'p-3 bg-black/40 rounded-xl border border-slate-700/60 font-mono text-xs text-emerald-300 leading-relaxed space-y-2 select-all break-words';
          
          const cleanPromptText = line.replace(/^(Prompt.*?:\s*)/i, '').replace(/^[\\"\']+|[\\"\']+$/g, '');
          promptBox.textContent = cleanPromptText;

          const copyBtn = document.createElement('button');
          copyBtn.type = 'button';
          copyBtn.className = 'mt-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/80 transition-all flex items-center gap-1.5 shadow-sm';
          copyBtn.innerHTML = `<i class="fa-regular fa-copy text-xs"></i> <span>Sao chép Prompt cho ChatGPT</span>`;
          copyBtn.addEventListener('click', () => this.copyToClipboard(copyBtn, cleanPromptText));

          const wrapper = container.lastElementChild;
          if (wrapper && wrapper.classList.contains('bg-gradient-to-br')) {
            wrapper.appendChild(promptBox);
            wrapper.appendChild(copyBtn);
          } else {
            container.appendChild(promptBox);
            container.appendChild(copyBtn);
          }

          this.scrollToBottom();
          await this.delay(60);
          continue;
        }
      }

      // 2. Thẻ Đánh giá & Điểm số tổng quan (Score Badge)
      if (type === 'score-badge') {
        el.className = 'my-1.5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 text-sm font-semibold shadow-xs';
        el.innerHTML = `<i class="fa-solid fa-award text-amber-500"></i><span>${line}</span>`;
        container.appendChild(el);
        this.scrollToBottom();
        await this.delay(100);
        continue;
      }

      // 3. Thẻ Hạt sạn / Điểm chưa ổn (Flaw Card)
      if (type === 'flaw-card') {
        el.className = 'mt-2 p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/25 border-l-4 border-rose-500 border-t border-r border-b border-rose-200/60 dark:border-rose-900/40 text-slate-800 dark:text-slate-200 space-y-1 shadow-xs';
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const title = line.substring(0, colonIdx).replace(/^-\s*/, '');
          const desc = line.substring(colonIdx + 1).trim();
          el.innerHTML = `
            <div class="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400 text-sm">
              <i class="fa-solid fa-triangle-exclamation text-xs"></i>
              <span>${title}</span>
            </div>
            <div class="text-[14px] leading-relaxed text-slate-700 dark:text-slate-300"></div>
          `;
          container.appendChild(el);
          const descTarget = el.lastElementChild;
          await this.streamTextToElement(descTarget, desc, 16);
          continue;
        }
      }

      // 4. Thẻ Điểm sáng / Ưu điểm (Strength Card)
      if (type === 'strength-card') {
        el.className = 'mt-2 p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border-l-4 border-emerald-500 border-t border-r border-b border-emerald-200/60 dark:border-emerald-900/40 text-slate-800 dark:text-slate-200 space-y-1 shadow-xs';
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const title = line.substring(0, colonIdx).replace(/^-\s*/, '');
          const desc = line.substring(colonIdx + 1).trim();
          el.innerHTML = `
            <div class="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 text-sm">
              <i class="fa-solid fa-circle-check text-xs"></i>
              <span>${title}</span>
            </div>
            <div class="text-[14px] leading-relaxed text-slate-700 dark:text-slate-300"></div>
          `;
          container.appendChild(el);
          const descTarget = el.lastElementChild;
          await this.streamTextToElement(descTarget, desc, 16);
          continue;
        }
      }

      // 5. Thẻ Đề xuất / Thứ tự sửa (Recommendation Card)
      if (type === 'recommendation-card') {
        el.className = 'mt-2 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/25 border-l-4 border-indigo-500 border-t border-r border-b border-indigo-200/60 dark:border-indigo-900/40 text-slate-800 dark:text-slate-200 space-y-1 shadow-xs';
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const title = line.substring(0, colonIdx).replace(/^-\s*/, '');
          const desc = line.substring(colonIdx + 1).trim();
          el.innerHTML = `
            <div class="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-400 text-sm">
              <i class="fa-solid fa-lightbulb text-xs"></i>
              <span>${title}</span>
            </div>
            <div class="text-[14px] leading-relaxed text-slate-700 dark:text-slate-300"></div>
          `;
          container.appendChild(el);
          const descTarget = el.lastElementChild;
          await this.streamTextToElement(descTarget, desc, 16);
          continue;
        }
      }

      // 6. Hộp Câu hỏi tương tác ở cuối (Question Card)
      if (type === 'question-card') {
        el.className = 'mt-3 p-3.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/25 border border-violet-200 dark:border-violet-900/50 text-slate-800 dark:text-slate-200 text-[14px] font-medium leading-relaxed flex items-start gap-2.5 shadow-xs';
        el.innerHTML = `<span class="mt-0.5 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 flex items-center justify-center text-[10px] shrink-0 font-bold"><i class="fa-solid fa-comments"></i></span><div></div>`;
        container.appendChild(el);
        const textTarget = el.lastElementChild;
        await this.streamTextToElement(textTarget, line, 18);
        continue;
      }

      // 7. Header khối
      if (type === 'block-header') {
        el.className += ' text-[13px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 pt-3 pb-1 border-b border-slate-200/60 dark:border-slate-700/40 mb-1';
        el.textContent = line.replace(/^\[|\]$/g, '');
        container.appendChild(el);
        this.scrollToBottom();
        await this.delay(60);
        continue;
      }

      // 8. Nhãn ảnh
      if (type === 'image-label') {
        el.className += ' text-sm font-bold text-indigo-600 dark:text-indigo-400 pt-2 pb-1';
        el.textContent = line;
        container.appendChild(el);
        this.scrollToBottom();
        await this.delay(60);
        continue;
      }

      // 9. Tiêu đề mục
      if (type === 'section-title') {
        el.className += ' font-semibold text-slate-900 dark:text-white text-[15px] pt-1.5';
        container.appendChild(el);
        await this.streamTextToElement(el, line.replace(/^-\s+/, ''), 16);
        continue;
      }

      // 10. Điểm nối hội thoại tự nhiên (Đầu tiên, Tiếp đến, Cuối cùng...)
      if (type === 'conversational-point') {
        el.className += ' font-semibold text-slate-900 dark:text-white leading-relaxed text-[15px] mt-2.5 pt-1.5 border-t border-slate-100 dark:border-borderDark/40 flex items-start gap-2';
        el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0"></span><span class="flex-1"></span>`;
        container.appendChild(el);
        const target = el.lastElementChild;
        await this.streamTextToElement(target, line, 16);
        continue;
      }

      // 11. Dòng gạch đầu dòng (bullet hoặc bullet có nội dung)
      if (type === 'bullet' || type === 'bullet-with-content') {
        el.className += ' font-normal text-slate-700 dark:text-slate-300 leading-relaxed pl-3 text-[14px] flex items-start gap-2';
        el.innerHTML = `<span class="text-indigo-500 font-bold shrink-0 mt-0.5">•</span><span class="flex-1"></span>`;
        container.appendChild(el);
        const target = el.lastElementChild;
        await this.streamTextToElement(target, line.replace(/^-\s+/, ''), 16);
        continue;
      }

      // 11. Đoạn văn bản thông thường (Stream từng từ chuẩn tốc độ ChatGPT)
      el.className += ' font-normal text-slate-800 dark:text-slate-200 leading-relaxed text-[15px]';
      container.appendChild(el);
      await this.streamTextToElement(el, line, 16);
    }

    if (actionButtons && actionButtons.length > 0) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'flex flex-wrap gap-2 pt-2.5 border-t border-slate-100 dark:border-borderDark mt-3 fade-in-text';
      actionsDiv.innerHTML = actionButtons.map(btn => `
        <button type="button" onclick="window.AppController.triggerQuickAction('${btn.action || btn.text}')" class="text-xs font-medium px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all shadow-sm flex items-center gap-1.5">
          <span>${btn.text}</span>
          <i class="fa-solid fa-chevron-right text-[9px] opacity-40"></i>
        </button>
      `).join('');
      container.appendChild(actionsDiv);
      this.scrollToBottom();
    }

    this.isAiTyping = false;
  },

  // Làm sạch văn bản AI trả về theo đúng chuẩn không ký tự markdown thô
  sanitizeStrictRules(str) {
    if (!str) return "";
    return str
      .replace(/^\*{3,}$/gm, '')
      .replace(/\*{3,}/g, '')
      .replace(/^-{3,}$/gm, '')
      .replace(/^={3,}$/gm, '')
      .replace(/-{5,}/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/banner\b/gi, 'hình ảnh quảng cáo')
      .replace(/banners\b/gi, 'các hình ảnh quảng cáo')
      .replace(/\bEm chào\b/gi, 'Chào')
      .replace(/\bem\b/gi, 'mình')
      .replace(/->|-->|=>|==>|⇒|→|⇄|⇆|⇾|➔|➜|⇢|⇨/g, ' : ')
      .replace(/^>\s*/gm, '')
      .replace(/>/g, '')
      .trim();
  },

  // Khởi tạo các sự kiện Modal
  initModals() {
    const {
      btnDocsModal, docsModal, btnCloseDocsModal, btnDoneDocsModal, docsRulesList,
      btnApiKeyModal, apiModal, btnCloseModal
    } = this.elements;

    if (docsRulesList && window.RulesService) {
      docsRulesList.innerHTML = window.RulesService.renderToHtml();
    }

    if (btnDocsModal) btnDocsModal.addEventListener('click', () => docsModal.classList.remove('hidden'));
    if (btnCloseDocsModal) btnCloseDocsModal.addEventListener('click', () => docsModal.classList.add('hidden'));
    if (btnDoneDocsModal) btnDoneDocsModal.addEventListener('click', () => docsModal.classList.add('hidden'));

    if (btnApiKeyModal) btnApiKeyModal.addEventListener('click', () => apiModal.classList.remove('hidden'));
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => apiModal.classList.add('hidden'));
  }
};

window.UIController = UIController;
