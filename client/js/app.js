/**
 * =============================================================================
 * ADVISION AI - BỘ ĐIỀU PHỐI HỆ THỐNG TRUNG TÂM (MAIN CONTROLLER)
 * =============================================================================
 * Kết nối các mô-đun:
 * - AdvConfig: Cấu hình hệ thống & khóa API
 * - RulesService: 22 quy chuẩn thẩm định thị giác
 * - PersonaPrompt: Nhân cách Cố vấn Hoàng An & Prompt tri thức 16 PDF
 * - ApiService: Cổng giao tiếp Vision AI (Gemini & OpenAI)
 * - UIController: Quản lý hiển thị, streaming chữ, modal & xem trước ảnh
 */

const AppController = {
  // Trạng thái phiên làm việc (Session State)
  state: {
    userName: (() => { try { return localStorage.getItem(AdvConfig.STORAGE_KEYS.USER_NAME) || ""; } catch(e) { return ""; } })(),
    userIndustry: (() => { try { return localStorage.getItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY) || ""; } catch(e) { return ""; } })(),
    userPlatform: (() => { try { return localStorage.getItem('adv_user_platform') || ""; } catch(e) { return ""; } })(),
    nameVariations: (() => {
      try {
        const item = localStorage.getItem(AdvConfig.STORAGE_KEYS.NAME_VARIATIONS);
        return item ? JSON.parse(item) : [];
      } catch (e) {
        return [];
      }
    })(),
    attachedImages: [],
    activeImageData: null,
    conversationHistory: [],
    /**
     * STATE MACHINE - 6 VÒNG HỘI THOẠI (Theo kịch bản Art Director)
     * -------------------------------------------------------------------
     * 'idle'           → Vòng 1: Chào hỏi, chưa biết tên
     * 'onboarding'     → Vòng 1: Đã biết tên, đang hỏi ngành hàng
     * 'briefing'       → Vòng 2: Đã biết ngành, đang hỏi kênh + mục tiêu
     * 'awaiting_image' → Vòng 2 done: Đã có đủ brief, mời gửi ảnh
     * 'image_overview' → Vòng 3: Đã nhận ảnh, hiển thị đánh giá 2 giây đầu
     * 'deep_dive'      → Vòng 4: Phân tích hạt sạn / điểm sáng chi tiết
     * 'actionable'     → Vòng 5: Hướng dẫn fix cụ thể (màu CTA, typography...)
     * 'done'           → Vòng 6: Đã tạo Prompt AI tái thiết kế
     */
    conversationStage: 'idle',
    // Lưu mục tiêu chiến dịch đã được briefing (vd: "sales", "branding", "launch")
    campaignGoal: (() => { try { return localStorage.getItem('adv_campaign_goal') || ""; } catch(e) { return ""; } })(),
    currentSessionId: 'sess-' + Date.now(),
    lastFailedRequest: null    // Lưu lại request để retry khi lỗi API
  },

  // Khởi động toàn bộ hệ thống
  init() {
    try {
      const currentUser = (window.SidebarController && window.SidebarController.getCurrentUser()) 
        || (window.StorageService ? window.StorageService.getCurrentUser() : null);
      const route = window.AppRouter.getCurrentRoute();

      // NẾU LÀ GUEST (CHƯA ĐĂNG NHẬP): Luôn làm mới hoàn toàn khi reload (F5) trang web!
      // Giúp hàng trăm Guest cùng dùng website hoàn toàn độc lập, không vướng rác cũ.
      if (!currentUser) {
        this.state.userName = "";
        this.state.userIndustry = "";
        this.state.userPlatform = "";
        this.state.campaignGoal = "";
        this.state.attachedImages = [];
        this.state.activeImageData = null;
        this.state.conversationHistory = [];
        this.state.conversationStage = 'idle';
        this.state.currentSessionId = 'sess-' + Date.now();
        this.clearAllAttachments();

        try {
          localStorage.removeItem(AdvConfig.STORAGE_KEYS.USER_NAME);
          localStorage.removeItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY);
          localStorage.removeItem(AdvConfig.STORAGE_KEYS.NAME_VARIATIONS);
          localStorage.removeItem('adv_user_platform');
          localStorage.removeItem('adv_campaign_goal');
        } catch(e) {}

      } else {
        this.state.userName = currentUser.name || "";
        if (/^(food|quán ăn|đồ ăn|shop|fb)$/i.test(this.state.userName.trim())) {
          this.state.userName = "";
        }
      }

      UIController.initModals();
      this.bindEvents();
      this.updateSystemStatus();

      if (route.name !== 'chat') {
        if (!currentUser) {
          this.playInitialGreeting();
        } else {
          const callName = (window.PersonaPrompt && PersonaPrompt.getDynamicCallName)
            ? PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName)
            : (this.state.userName || "bạn");

          const welcomeBack = `Chào ${callName}, phiên thẩm định mới đã sẵn sàng! Bạn có thể nhấn 📎 để tải ảnh quảng cáo hoặc nhập câu hỏi cho mình nhé.`;
          UIController.streamLines([welcomeBack]);
        }
      }

      window.AppRouter.emitCurrent();
    } catch (err) {
      console.error("AdVision Init Error:", err);
      this.playInitialGreeting();
    }
  },

  // Đồng bộ trạng thái giao diện và API
  updateSystemStatus() {
    const key = AdvConfig.getEffectiveApiKey();
    if (UIController.elements.inputApiKey) {
      UIController.elements.inputApiKey.value = key;
    }
    UIController.updateApiStatusIndicator(!!key);
    UIController.updateUserBadge(this.state.userName, this.state.userIndustry, this.state.userPlatform);
    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
    UIController.updateInputPlaceholder(
      this.state.userName, this.state.userIndustry, callName,
      this.state.attachedImages.length, this.state.conversationStage
    );
  },

  // Lời chào mở đầu
  async playInitialGreeting() {
    UIController.elements.chatContainer.innerHTML = '';
    UIController.showTypingIndicator();
    await UIController.delay(500);
    UIController.hideTypingIndicator();
    await UIController.streamLines([
      "Chào bạn, mình là Nguyễn Hoàng An - Cố vấn Thẩm định Thị giác Quảng cáo.",
      "Bạn đang chuẩn bị triển khai chiến dịch cho sản phẩm hoặc ngành hàng nào vậy?",
      "Bạn có thể nhắn tin trao đổi hoặc bấm vào biểu tượng kẹp giấy 📎 ở dưới để gửi ảnh cho mình xem ngay nhé!"
    ]);
  },

  // Đăng ký các sự kiện tương tác
  bindEvents() {
    const { chatForm, btnAttachImage, fileInput, btnClearAllAttachments, btnSaveKey, inputApiKey, apiModal } = UIController.elements;

    // Sự kiện đính kèm hình ảnh
    if (btnAttachImage && fileInput) {
      btnAttachImage.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleIncomingFiles(e.target.files);
        }
      });
    }

    if (btnClearAllAttachments) {
      btnClearAllAttachments.addEventListener('click', () => this.clearAllAttachments());
    }

    // Sự kiện lưu API Key cá nhân
    if (btnSaveKey && inputApiKey) {
      btnSaveKey.addEventListener('click', () => {
        const key = inputApiKey.value.trim();
        localStorage.setItem(AdvConfig.STORAGE_KEYS.API_KEY, key);
        if (apiModal) apiModal.classList.add('hidden');
        this.updateSystemStatus();
        alert('Đã lưu API Key thành công! Hệ thống đã sẵn sàng kết nối AI.');
      });
    }

    // Sự kiện submit khung chat
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleChatSubmit();
      });
    }

    // Tiện ích vi mô 1: Dán ảnh trực tiếp từ Clipboard (Ctrl + V) như Claude & ChatGPT
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        this.handleIncomingFiles(imageFiles);
      }
    });

    // Tiện ích vi mô 2: Kéo - Thả hình ảnh trực tiếp vào giao diện (Drag & Drop)
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type && f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          this.handleIncomingFiles(imageFiles);
        }
      }
    });
  },

  // Xử lý nạp các file ảnh tải lên
  handleIncomingFiles(files) {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      alert('Vui lòng chọn các file hình ảnh hợp lệ (.png, .jpg, .jpeg, .webp)');
      return;
    }

    let loaded = 0;
    for (const file of validFiles) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawImgObj = {
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          base64: e.target.result.split(',')[1],
          dataUrl: e.target.result
        };

        // Trích xuất đặc trưng vật lý & tỷ lệ khung hình
        let features = null;
        if (window.ImageFeatureExtractor) {
          try {
            features = await window.ImageFeatureExtractor.extractFeatures(rawImgObj);
          } catch (err) {
            console.warn("Không trích xuất được metadata ảnh:", err);
          }
        }

        rawImgObj.features = features;
        this.state.attachedImages.push(rawImgObj);

        loaded++;
        if (loaded === validFiles.length) {
          UIController.renderAttachmentPreviews(this.state.attachedImages);
          const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
          UIController.updateInputPlaceholder(this.state.userName, this.state.userIndustry, callName, this.state.attachedImages.length);
        }
      };
      reader.readAsDataURL(file);
    }
  },

  // Xóa 1 ảnh trong danh sách đính kèm
  removeAttachmentByIndex(index) {
    this.state.attachedImages.splice(index, 1);
    UIController.renderAttachmentPreviews(this.state.attachedImages);
    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
    UIController.updateInputPlaceholder(this.state.userName, this.state.userIndustry, callName, this.state.attachedImages.length);
  },

  // Xóa toàn bộ ảnh đính kèm
  clearAllAttachments() {
    this.state.attachedImages = [];
    UIController.renderAttachmentPreviews(this.state.attachedImages);
    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
    UIController.updateInputPlaceholder(this.state.userName, this.state.userIndustry, callName, 0);
  },

  // Kích hoạt phản hồi nhanh từ các nút gợi ý (hỗ trợ cả topic key lẫn free text)
  triggerQuickAction(actionKey) {
    if (actionKey === '__retry__') return;
    if (actionKey === '__attach__') {
      const fileInput = UIController.elements.fileInput;
      if (fileInput) fileInput.click();
      return;
    }
    const chatInput = UIController.elements.chatInput;
    if (!chatInput) return;

    // Industry quick actions (Vòng 1 Onboarding)
    const industryMap = {
      'industry_fnb':     'Mình đang chuẩn bị chạy ads cho quán gà rán',
      'industry_fashion': 'Mình đang chuẩn bị chạy ads thời trang',
      'industry_beauty':  'Mình đang chuẩn bị chạy ads mỹ phẩm làm đẹp',
      'industry_tech':    'Mình đang chuẩn bị chạy ads sản phẩm công nghệ'
    };
    if (industryMap[actionKey]) {
      chatInput.value = industryMap[actionKey];
      this.handleChatSubmit();
      return;
    }

    // Briefing quick actions: chọn kênh phân phối & mục tiêu
    const briefingPlatformMap = {
      'briefing_fb_sales':   'Mình chạy Facebook Feed, ảnh vuông, muốn đẩy mạnh ưu đãi combo giảm 30% để khách bấm đặt hàng luôn.',
      'briefing_fb_launch':  'Mình chạy Facebook Feed 1:1, mục tiêu khai trương quán mới',
      'briefing_fb_feed':    'Mình chạy Facebook Feed, ảnh vuông 1:1',
      'briefing_ig_story':   'Mình chạy Instagram Story 9:16',
      'briefing_tiktok':     'Mình chạy TikTok 9:16 dạng video ngắn ưu đãi',
      'briefing_ecommerce':  'Mình chạy trên Shopee/Lazada'
    };
    if (briefingPlatformMap[actionKey]) {
      chatInput.value = briefingPlatformMap[actionKey];
      this.handleChatSubmit();
      return;
    }

    // Chấm điểm định lượng Rubric 6 tiêu chí
    if (actionKey === 'rubric_score') {
      this.handleRubricScore();
      return;
    }

    // So sánh đối đầu A/B giữa các hình ảnh
    if (actionKey === 'compare_ab' || actionKey === 'compare') {
      this.handleCompareAB();
      return;
    }

    // Xuất báo cáo thẩm định dạng PDF
    if (actionKey === 'export_pdf') {
      this.handleExportPdf();
      return;
    }

    // Actionable fix quick actions (Vòng 5)
    const actionableKeys = ['fix_cta_color', 'fix_typography', 'fix_layout', 'platform_specs'];
    if (actionableKeys.includes(actionKey)) {
      this.handleActionableFix(actionKey);
      return;
    }

    // Khi là topic key thì xử lý theo flow hội thoại chuyên sâu
    const topicKeys = [
      'first_impression', 'strengths', 'weaknesses', 'fix_order',
      'layout', 'typography', 'pros_cons', 'suggestions',
      'platform_fb', 'platform_tiktok', 'redesign_prompt', 'compare'
    ];
    if (topicKeys.includes(actionKey)) {
      this.handleFollowUpTopic(actionKey);
      return;
    }

    // Free text: điền vào input và gửi bình thường
    chatInput.value = actionKey;
    this.handleChatSubmit();
  },

  // Hiển thị lỗi API với nút Thử lại trực quan
  showApiError(errorMsg, retryFn) {
    const isHighDemand = /high demand|spikes in demand|503|overloaded|quota|resource exhausted/i.test(errorMsg);
    const lines = isHighDemand ? [
      "Hệ thống máy chủ AI của Google đang có lượng truy cập tăng đột biến (Spikes in demand).",
      "Hiện tượng này thường chỉ kéo dài khoảng vài giây. Bạn chờ một chút rồi bấm nút bên dưới để mình tiếp tục thẩm định nhé!"
    ] : [
      `Mình gặp chút gián đoạn kết nối khi xử lý yêu cầu (${errorMsg}).`,
      `Bạn vui lòng kiểm tra lại kết nối mạng hoặc mã API Key, rồi bấm Thử lại giúp mình nhé.`
    ];
    const actions = [{ text: '🔄 Thử lại ngay', action: '__retry__' }];
    UIController.streamLines(lines, actions).then(() => {
      // Gắn hàm retry vào button
      const retryButtons = document.querySelectorAll('[onclick*="__retry__"]');
      retryButtons.forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          retryFn && retryFn();
        };
      });
    });
  },

  // Xử lý khi người dùng chọn một topic cụ thể từ quick actions
  async handleFollowUpTopic(topic) {
    if (UIController.isAiTyping) return;
    const apiKey = AdvConfig.getEffectiveApiKey();
    if (!apiKey) return;

    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
    // Dùng Vision System Prompt có 16 PDF để soi sâu chi tiết ảnh
    const systemPrompt = PersonaPrompt.getVisionSystemPrompt(
      callName, this.state.userIndustry, this.state.userPlatform, this.state.campaignGoal
    );
    const followUpText = PersonaPrompt.buildFollowUpPrompt(callName, topic);
    if (!followUpText) return;

    // Hiển thị tin nhắn người dùng ngắn gọn
    const topicLabels = {
      first_impression: 'Người xem thấy gì trước tiên?',
      strengths: 'Chỗ nào làm tốt?',
      weaknesses: 'Chỉ cho mình các hạt sạn cần sửa trước đi',
      fix_order: 'Mình nên sửa gì trước?',
      platform_fb: 'Tối ưu cho Facebook & Instagram',
      platform_tiktok: 'Tối ưu cho TikTok',
      redesign_prompt: 'Tạo cho mình cái Prompt vẽ lại ảnh mới luôn đi',
      compare: 'So sánh ảnh nào tốt hơn'
    };
    UIController.appendUserMessage(topicLabels[topic] || topic, []);
    UIController.showTypingIndicator();

    let apiResponse = '';
    try {
      apiResponse = await ApiService.chatNextTurn({
        apiKey, text: followUpText, systemPrompt,
        conversationHistory: this.state.conversationHistory,
        activeImageData: this.state.activeImageData
      });
    } catch (err) {
      UIController.hideTypingIndicator();
      this.showApiError(err.message, () => this.handleFollowUpTopic(topic));
      return;
    }

    UIController.hideTypingIndicator();
    this.state.conversationHistory.push({ role: 'user', text: followUpText });
    this.state.conversationHistory.push({ role: 'model', text: apiResponse });
    this.state.conversationStage = 'deep_dive';

    const lines = apiResponse.split('\n')
      .map(l => UIController.sanitizeStrictRules(l)).filter(l => l.length > 0);
    await UIController.streamLines(lines, this.getNextActionsForTopic(topic));
  },

  // Sinh gợi ý đối thoại tiếp theo tự nhiên (Chuẩn mực Claude.ai/ChatGPT - tối đa 2 gợi ý súc tích)
  getNextActionsForTopic(topic) {
    const map = {
      first_impression: [
        { text: '🔴 Hạt sạn cản trở chuyển đổi', action: 'weaknesses' },
        { text: '✨ Điểm sáng làm tốt', action: 'strengths' }
      ],
      strengths: [
        { text: '🔴 Hạt sạn cản trở chuyển đổi', action: 'weaknesses' },
        { text: '🎨 Chỉnh màu nút CTA', action: 'fix_cta_color' }
      ],
      weaknesses: [
        { text: '🎨 Chỉnh màu nút CTA bật sáng', action: 'fix_cta_color' },
        { text: '✍️ Sắp xếp lại bố cục chữ', action: 'fix_typography' }
      ],
      fix_order: [
        { text: '🎨 Chỉnh màu nút CTA', action: 'fix_cta_color' },
        { text: '🤖 Tạo Prompt AI vẽ lại ảnh', action: 'redesign_prompt' }
      ],
      platform_fb: [
        { text: '🤖 Tạo Prompt tái thiết kế', action: 'redesign_prompt' },
        { text: '🎵 Tối ưu cho TikTok', action: 'platform_tiktok' }
      ],
      platform_tiktok: [
        { text: '🤖 Tạo Prompt tái thiết kế', action: 'redesign_prompt' },
        { text: '📱 Tối ưu cho Facebook', action: 'platform_fb' }
      ],
      redesign_prompt: [
        { text: '🎨 Chỉnh màu nút CTA', action: 'fix_cta_color' },
        { text: '✍️ Chỉnh bố cục chữ', action: 'fix_typography' }
      ],
      compare: [
        { text: '🔴 Hạt sạn cản trở chuyển đổi', action: 'weaknesses' },
        { text: '✨ Điểm sáng làm tốt', action: 'strengths' }
      ]
    };
    return map[topic] || [];
  },

  // Cập nhật quick actions sau fix_order theo context kênh & mục tiêu (Vòng 4 → Vòng 5)
  getActionableActionsForContext() {
    const actions = [
      { text: '🎨 Hướng dẫn chỉnh màu nút CTA', action: 'fix_cta_color' },
      { text: '✍️ Chỉnh bố cục chữ & khoảng cách', action: 'fix_typography' }
    ];
    if (this.state.userPlatform) {
      actions.push({ text: `📐 Thông số chuẩn ${this.state.userPlatform}`, action: 'platform_specs' });
    }
    actions.push({ text: '🤖 Tạo Prompt AI vẽ lại ảnh mới', action: 'redesign_prompt' });
    return actions;
  },

  // Vòng 5: Xử lý hướng dẫn fix cụ thể (CTA màu, typography, layout, thông số kênh)
  async handleActionableFix(actionType) {
    if (UIController.isAiTyping) return;
    const apiKey = AdvConfig.getEffectiveApiKey();
    if (!apiKey) return;

    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
    const systemPrompt = PersonaPrompt.getSystemPrompt(callName, this.state.userIndustry, this.state.userPlatform);
    const fixPrompt = PersonaPrompt.buildActionableFixPrompt(
      callName, actionType, this.state.userPlatform, this.state.campaignGoal
    );
    if (!fixPrompt) return;

    const actionLabels = {
      fix_cta_color:   '🎨 Hướng dẫn chỉnh màu nút CTA',
      fix_typography:  '✍️ Chỉnh bố cục chữ & khoảng cách',
      fix_layout:      '📐 Chỉnh lại bố cục tổng thể',
      platform_specs:  '📋 Thông số kỹ thuật chuẩn kênh'
    };
    UIController.appendUserMessage(actionLabels[actionType] || actionType, []);
    UIController.showTypingIndicator("Đang chuẩn bị hướng dẫn chi tiết...");

    let apiResponse = '';
    try {
      apiResponse = await ApiService.chatNextTurn({
        apiKey, text: fixPrompt, systemPrompt,
        conversationHistory: this.state.conversationHistory,
        activeImageData: this.state.activeImageData
      });
    } catch (err) {
      UIController.hideTypingIndicator();
      this.showApiError(err.message, () => this.handleActionableFix(actionType));
      return;
    }

    UIController.hideTypingIndicator();
    this.state.conversationHistory.push({ role: 'user', text: fixPrompt });
    this.state.conversationHistory.push({ role: 'model', text: apiResponse });
    this.state.conversationStage = 'actionable';

    const lines = apiResponse.split('\n')
      .map(l => UIController.sanitizeStrictRules(l)).filter(l => l.length > 0);

    // Sau Vòng 5 → gợi ý Vòng 6 (Prompt AI)
    const nextActions = [
      { text: '🤖 Tạo Prompt AI vẽ lại ảnh mới', action: 'redesign_prompt' }
    ];
    if (actionType !== 'fix_cta_color') nextActions.unshift({ text: '🎨 Chỉnh màu nút CTA', action: 'fix_cta_color' });
    if (actionType !== 'fix_typography') nextActions.unshift({ text: '✍️ Chỉnh bố cục chữ', action: 'fix_typography' });

    await UIController.streamLines(lines, nextActions);
  },

  // ===========================================================================
  // RUBRIC CHẤM ĐIỂM ĐỊNH LƯỢNG 6 TIÊU CHÍ (COMPOUND AI SYSTEM)
  // ===========================================================================
  async handleRubricScore() {
    if (UIController.isAiTyping) return;
    const apiKey = AdvConfig.getEffectiveApiKey();
    if (!apiKey) {
      if (window.SidebarController) window.SidebarController.openApiKeyModal();
      return;
    }

    const img = this.state.activeImageData;
    if (!img || !img.base64) {
      await UIController.streamLines(["Bạn hãy gửi hình ảnh quảng cáo trước để mình chấm điểm theo Rubric 6 tiêu chí nhé!"]);
      return;
    }

    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
    UIController.appendUserMessage("📊 Chấm điểm định lượng theo Rubric 6 tiêu chí", []);
    UIController.showTypingIndicator("Đang đối chiếu 22 quy chuẩn và chấm điểm 6 tiêu chí...");

    const featureSummary = (window.ImageFeatureExtractor && img.features)
      ? window.ImageFeatureExtractor.formatFeatureSummary(img.features)
      : "";

    const scoringPrompt = PersonaPrompt.buildScoringPrompt(
      featureSummary,
      this.state.userPlatform,
      this.state.userIndustry
    );

    let rawResponse = '';
    try {
      rawResponse = await ApiService.analyzeImage({
        apiKey,
        base64: img.base64,
        mimeType: img.mimeType,
        prompt: scoringPrompt,
        systemPrompt: "Bạn là hệ thống chấm điểm định lượng hình ảnh quảng cáo chuyên nghiệp. Chỉ xuất định dạng JSON thuần theo schema được yêu cầu."
      });
    } catch (err) {
      UIController.hideTypingIndicator();
      this.showApiError(err.message, () => this.handleRubricScore());
      return;
    }

    UIController.hideTypingIndicator();

    // Parse score JSON bằng ScoringService
    let scoreData = null;
    if (window.ScoringService) {
      scoreData = window.ScoringService.parseScoreResponse(rawResponse);
    }

    if (scoreData && window.ScoringService) {
      // Lưu lại điểm vào activeImageData để persist
      img.scoreData = scoreData;
      const cardHtml = window.ScoringService.renderScoreCard(scoreData, img.fileName);
      if (cardHtml && UIController.appendRawHtml) {
        UIController.appendRawHtml(cardHtml);
      }

      const v = scoreData._verdictMeta || window.ScoringService.getVerdict(scoreData.total);
      const lines = [
        `Hoàn tất thẩm định định lượng cho ${callName}! Bức ảnh đạt **${scoreData.total.toFixed(1)}/10 điểm** (${v.label}).`,
        `Bạn có thể xem chi tiết từng tiêu chí ở thẻ điểm phía trên hoặc bấm vào các nút bên dưới để mình hướng dẫn sửa ngay nhé!`
      ];

      // Tự động đồng bộ cập nhật session
      try {
        if (window.SidebarController) {
          window.SidebarController.updateSessionData(this.state.currentSessionId, {
            activeImageData: this.state.activeImageData
          });
        }
      } catch (e) { }

      const nextActions = [
        { text: '🔴 Hạt sạn cản trở chuyển đổi', action: 'weaknesses' },
        { text: '🎨 Hướng dẫn chỉnh màu nút CTA', action: 'fix_cta_color' },
        { text: '✍️ Chỉnh bố cục chữ', action: 'fix_typography' }
      ];

      await UIController.streamLines(lines, nextActions);
    } else {
      // Fallback
      const lines = [
        `Mình đã phân tích điểm định lượng cho ${callName}:`,
        rawResponse
      ];
      await UIController.streamLines(lines, [
        { text: '🔴 Hạt sạn cản trở chuyển đổi', action: 'weaknesses' }
      ]);
    }
  },

  // ===========================================================================
  // SO SÁNH ĐỐI ĐẦU A/B GIỮA CÁC ẢNH (A/B TESTING MODE)
  // ===========================================================================
  async handleCompareAB() {
    if (UIController.isAiTyping) return;
    const apiKey = AdvConfig.getEffectiveApiKey();
    if (!apiKey) {
      if (window.SidebarController) window.SidebarController.openApiKeyModal();
      return;
    }

    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
    UIController.appendUserMessage("⚖️ So sánh đối đầu A/B giữa các hình ảnh", []);
    UIController.showTypingIndicator("Đang phân tích đối chứng A/B thị giác...");

    const promptText = `Hãy so sánh đối đầu A/B giữa các hình ảnh quảng cáo đã được gửi.
Đánh giá chi tiết trên 4 tiêu chí cốt lõi:
1. Sức hút thị giác trong 2 giây đầu (Bức nào giật mắt tốt hơn?)
2. Độ rõ ràng thông điệp và ưu đãi chính (Bức nào truyền tải nhanh hơn?)
3. Điểm rơi và độ tương phản nút CTA (Bức nào kích thích bấm mua hơn?)
4. Phân cấp chữ và khoảng thở bố cục (Bức nào thoáng mắt và chuyên nghiệp hơn?)

KẾT LUẬN:
- Chọn rõ ràng 1 bức ảnh chiến thắng (Winner) và giải thích tại sao nó sẽ mang lại tỷ lệ chuyển đổi (CTR / Conversion Rate) cao hơn.
- Nêu 2 hành động cụ thể để hoàn thiện bức ảnh chiến thắng trước khi bấm chạy chiến dịch.`;

    let apiResponse = '';
    try {
      apiResponse = await ApiService.chatNextTurn({
        apiKey,
        text: promptText,
        systemPrompt: PersonaPrompt.getSystemPrompt(callName, this.state.userIndustry, this.state.userPlatform),
        conversationHistory: this.state.conversationHistory,
        activeImageData: this.state.activeImageData
      });
    } catch (err) {
      UIController.hideTypingIndicator();
      this.showApiError(err.message, () => this.handleCompareAB());
      return;
    }

    UIController.hideTypingIndicator();
    this.state.conversationHistory.push({ role: 'user', text: promptText });
    this.state.conversationHistory.push({ role: 'model', text: apiResponse });

    const lines = apiResponse.split('\n')
      .map(l => UIController.sanitizeStrictRules(l)).filter(l => l.length > 0);

    const nextActions = [
      { text: '🔴 Hạt sạn cản trở chuyển đổi', action: 'weaknesses' },
      { text: '🎨 Chỉnh màu nút CTA', action: 'fix_cta_color' }
    ];

    await UIController.streamLines(lines, nextActions);
  },

  // ===========================================================================
  // TỔNG HỢP VÀ XUẤT BÁO CÁO THẨM ĐỊNH THỊ GIÁC QUA HỘI THOẠI
  // ===========================================================================
  async handleConversationalReport() {
    if (UIController.isAiTyping) return;
    const apiKey = AdvConfig.getEffectiveApiKey();
    if (!apiKey) {
      if (window.SidebarController) window.SidebarController.openApiKeyModal();
      return;
    }

    const img = this.state.activeImageData;
    if (!img) {
      await UIController.streamLines(["Bạn hãy gửi hình ảnh quảng cáo để mình tiến hành thẩm định và tổng hợp báo cáo chi tiết nhé!"]);
      return;
    }

    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
    UIController.showTypingIndicator("Nguyễn Hoàng An đang tổng hợp Báo cáo Thẩm định Thị giác...");

    const promptText = `Người dùng yêu cầu: "Xuất báo cáo thẩm định cho bức ảnh quảng cáo này."
Hãy tổng hợp một Báo cáo Thẩm định Thị giác Chuyên sâu có cấu trúc mạch lạc:
1. TỔNG QUAN CHIẾN DỊCH & THỊ GIÁC:
   - Ngành hàng và kênh phân phối dự kiến.
   - Điểm số đánh giá tổng thể (thang 1-10) và mức độ sẵn sàng chạy ads.
2. PHÂN TÍCH CHỈ SỐ KỸ THUẬT CỐT LÕI:
   - Phối màu & Tỷ lệ 60-30-10 (Nền - Nhận diện - Điểm nhấn CTA).
   - Độ tương phản chữ và nút CTA theo chuẩn WCAG 2.1 (Đạt/Chưa đạt).
   - Mật độ văn bản (Text Density < 20% theo quy chuẩn Meta/TikTok).
3. 3 ĐIỂM NGHẼN CHUYỂN ĐỔI CHÍNH (CẦN KHẮC PHỤC NGAY).
4. KẾ HOẠCH HÀNH ĐỘNG 3 BƯỚC (ACTION PLAN CHO DESIGNER).
5. KẾT LUẬN & KHUYẾN NGHỊ CUỐI CÙNG.

Văn phong sắc sảo, đĩnh đạc của một Giám đốc Nghệ thuật, gãy gọn, không dùng từ ngữ giáo điều phô trương, hoàn toàn tập trung vào giải pháp thực tế.`;

    let apiResponse = '';
    try {
      apiResponse = await ApiService.chatNextTurn({
        apiKey,
        text: promptText,
        systemPrompt: PersonaPrompt.getVisionSystemPrompt(callName, this.state.userIndustry, this.state.userPlatform, this.state.campaignGoal),
        conversationHistory: this.state.conversationHistory,
        activeImageData: this.state.activeImageData
      });
    } catch (err) {
      UIController.hideTypingIndicator();
      this.showApiError(err.message, () => this.handleConversationalReport());
      return;
    }

    UIController.hideTypingIndicator();
    this.state.conversationHistory.push({ role: 'user', text: "Xuất báo cáo thẩm định" });
    this.state.conversationHistory.push({ role: 'model', text: apiResponse });

    const lines = apiResponse.split('\n')
      .map(l => UIController.sanitizeStrictRules(l)).filter(l => l.length > 0);

    // Stream nội dung báo cáo
    await UIController.streamLines(lines);

    // Hiển thị Card hành động in/lưu PDF thanh lịch ngay trong luồng chat
    const reportActionHtml = `
      <div class="my-3 p-3.5 rounded-2xl bg-white/80 dark:bg-[#20201D]/80 border border-claudeBorder dark:border-claudeDarkBorder shadow-sm flex items-center justify-between gap-3 max-w-lg">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-claudeCoral/10 text-claudeCoral flex items-center justify-center shrink-0">
            <i class="fa-solid fa-file-pdf text-sm"></i>
          </div>
          <div class="min-w-0">
            <div class="text-xs font-bold text-claudeText dark:text-claudeDarkText truncate">Báo cáo Thẩm định Thị giác AdVision</div>
            <div class="text-[11px] text-claudeMuted dark:text-claudeDarkMuted">Sẵn sàng xuất file PDF hoặc in lưu trữ</div>
          </div>
        </div>
        <button onclick="window.print()" class="px-3.5 py-1.5 rounded-xl bg-claudeCoral hover:bg-claudeCoralHover text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer">
          <i class="fa-solid fa-print"></i>
          <span>In / Lưu PDF</span>
        </button>
      </div>
    `;
    if (UIController.appendRawHtml) {
      UIController.appendRawHtml(reportActionHtml);
    }
  },

  // ===========================================================================
  // XUẤT BÁO CÁO THẨM ĐỊNH (PDF EXPORT TRỰC TIẾP)
  // ===========================================================================
  handleExportPdf() {
    const toast = document.createElement('div');
    toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 bg-[#181816] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl z-[9999] border border-[#2C2B27] flex items-center gap-2';
    toast.innerHTML = '<i class="fa-solid fa-print text-[#DA7756]"></i> Đang mở hộp thoại In... Chọn "Save as PDF" để xuất báo cáo thẩm định.';
    document.body.appendChild(toast);
    setTimeout(() => {
      window.print();
      setTimeout(() => toast.remove(), 2000);
    }, 400);
  },

  // Xử lý gửi tin nhắn người dùng
  async handleChatSubmit() {
    if (UIController.isAiTyping) return;

    const chatInput = UIController.elements.chatInput;
    const text = chatInput.value.trim();
    if (!text && this.state.attachedImages.length === 0) return;

    const sentImages = [...this.state.attachedImages];
    this.clearAllAttachments();
    chatInput.value = '';

    UIController.appendUserMessage(text, sentImages);

    // Tự động nhận diện ngữ cảnh (tên, ngành hàng, nền tảng) từ tin nhắn của người dùng
    if (text) {
      const detected = PersonaPrompt.detectContextFromText(text);

      // Chỉ nhận diện tên khi có cấu trúc xưng hô rõ ràng (tránh nhầm từ ngữ ngành hàng thành tên)
      if (detected.userName && !this.state.userName) {
        this.state.userName = detected.userName;
        this.state.nameVariations = detected.nameVariations || [detected.userName];
        localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_NAME, this.state.userName);
        localStorage.setItem(AdvConfig.STORAGE_KEYS.NAME_VARIATIONS, JSON.stringify(this.state.nameVariations));
      }

      // Nhận diện ngành hàng
      if (detected.userIndustry && !this.state.userIndustry) {
        this.state.userIndustry = detected.userIndustry;
        localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY, this.state.userIndustry);
      }

      // Nhận diện kênh phân phối
      if (detected.userPlatform) {
        this.state.userPlatform = detected.userPlatform;
        localStorage.setItem('adv_user_platform', this.state.userPlatform);
      }

      this.updateSystemStatus();
    }

    const apiKey = AdvConfig.getEffectiveApiKey();
    if (!apiKey) {
      UIController.showTypingIndicator("Đang kiểm tra kết nối...");
      await UIController.delay(700);
      UIController.hideTypingIndicator();
      await UIController.streamLines([
        "Bạn hãy bấm vào nút **API Key** ở góc trên màn hình để cấu hình kết nối AI trước nhé."
      ]);
      if (UIController.elements.apiModal) UIController.elements.apiModal.classList.remove('hidden');
      return;
    }

    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);

    // Kiểm tra ý định người dùng muốn nhận Báo cáo thẩm định (Conversational Report Request)
    const isReportRequest = /\b(xuất báo cáo|cho mình xin báo cáo|lấy báo cáo|tổng hợp báo cáo|báo cáo thẩm định|tải báo cáo|in báo cáo|file pdf|xuất pdf|báo cáo chi tiết)\b/i.test(text);
    if (isReportRequest && this.state.activeImageData) {
      await this.handleConversationalReport();
      return;
    }

    // Chọn Prompt phân tầng linh hoạt: có ảnh thì dùng Vision Prompt chuyên sâu, chưa có ảnh thì dùng Conversational Prompt tự nhiên
    const systemPrompt = (sentImages.length > 0 || this.state.activeImageData)
      ? PersonaPrompt.getVisionSystemPrompt(callName, this.state.userIndustry, this.state.userPlatform, this.state.campaignGoal)
      : PersonaPrompt.getConversationalSystemPrompt(callName, this.state.userIndustry, this.state.userPlatform, this.state.campaignGoal);

    // BƯỚC 3: NGƯỜI DÙNG GỬI ẢNH -> THẨM ĐỊNH TỪNG ẢNH MỘT
    if (sentImages.length > 0) {
      if (sentImages.length > 1) {
        UIController.showTypingIndicator(`Đang tiếp nhận ${sentImages.length} bức ảnh...`);
        await UIController.delay(600);
        UIController.hideTypingIndicator();
        await UIController.streamLines([
          `Chào ${callName}, mình đã nhận đủ ${sentImages.length} hình ảnh quảng cáo bạn vừa gửi.`,
          `Bây giờ mình sẽ quan sát và bóc tách đánh giá chi tiết cho từng bức ảnh một nhé.`
        ]);
        await UIController.delay(400);
      }

      for (let i = 0; i < sentImages.length; i++) {
        const currentImg = sentImages[i];
        this.state.activeImageData = currentImg;

        // HIỂN THỊ THẺ ĐO ĐẠC THỊ GIÁC CỤC BỘ (LOCAL VISION TELEMETRY CARD)
        // Bằng chứng thực nghiệm của Tầng Cảm nhận độc lập (Perception Layer - Tự xây dựng cục bộ)
        if (window.ImageFeatureExtractor && currentImg.features) {
          const telemetryHtml = window.ImageFeatureExtractor.renderTelemetryBadge(currentImg.features);
          if (telemetryHtml && UIController.appendRawHtml) {
            UIController.appendRawHtml(telemetryHtml);
          }
        }

        const indicatorText = sentImages.length > 1
          ? `Đang xem ảnh ${i + 1}/${sentImages.length}...`
          : `Đang xem ảnh...`;
        UIController.showTypingIndicator(indicatorText);

        const featureSummary = (window.ImageFeatureExtractor && currentImg.features)
          ? window.ImageFeatureExtractor.formatFeatureSummary(currentImg.features)
          : "";

        const userPromptText = PersonaPrompt.buildVisionUserPrompt(
          callName,
          this.state.userIndustry,
          currentImg,
          i,
          sentImages.length,
          text,
          featureSummary,
          this.state.userPlatform,
          this.state.campaignGoal
        );

        let apiResponse = "";
        try {
          apiResponse = await ApiService.analyzeImage({
            apiKey,
            base64: currentImg.base64,
            mimeType: currentImg.mimeType,
            prompt: userPromptText,
            systemPrompt
          });
        } catch (err) {
          console.error("Lỗi Vision API:", err);
          UIController.hideTypingIndicator();
          const retryImg = currentImg;
          const retryText = text;
          this.showApiError(err.message, async () => {
            // Retry: gửi lại chính ảnh đó
            UIController.showTypingIndicator();
            try {
              const retryResp = await ApiService.analyzeImage({
                apiKey, base64: retryImg.base64, mimeType: retryImg.mimeType,
                prompt: userPromptText, systemPrompt
              });
              UIController.hideTypingIndicator();
              const retryLines = retryResp.split('\n')
                .map(l => UIController.sanitizeStrictRules(l)).filter(l => l.length > 0);
              await UIController.streamLines(retryLines, [
                { text: 'Người xem thấy gì trước?', action: 'first_impression' },
                { text: 'Chỗ nào làm tốt?', action: 'strengths' },
                { text: 'Chỗ nào chưa ổn?', action: 'weaknesses' }
              ]);
              this.state.conversationStage = 'image_overview';
            } catch (e2) {
              UIController.hideTypingIndicator();
              await UIController.streamLines([`Vẫn gặp lỗi (${e2.message}). Bạn thử kiểm tra API Key nhé.`]);
            }
          });
          return;
        }

        UIController.hideTypingIndicator();

        this.state.conversationHistory.push({ role: 'user', text: userPromptText });
        this.state.conversationHistory.push({ role: 'model', text: apiResponse });

        const lines = apiResponse.split('\n')
          .map(l => UIController.sanitizeStrictRules(l))
          .filter(l => l.length > 0);

        const isLast = (i === sentImages.length - 1);

        // Gợi ý đối thoại sau overview: Chuẩn kịch bản Art Director tự nhiên (tối đa 2 gợi ý, không spam nút)
        let quickActions = null;
        if (isLast) {
          if (sentImages.length > 1) {
            quickActions = [
              { text: '⚖️ So sánh A/B ảnh nào tốt hơn', action: 'compare_ab' },
              { text: '🔴 Hạt sạn cản trở chuyển đổi', action: 'weaknesses' }
            ];
          } else {
            quickActions = [
              { text: '🔴 Hạt sạn cản trở chuyển đổi', action: 'weaknesses' },
              { text: '✨ Điểm sáng làm tốt', action: 'strengths' }
            ];
          }
        }

        if (sentImages.length > 1) {
          lines.unshift(`📸 BỨC ẢNH ${i + 1}/${sentImages.length}: ${currentImg.fileName}`);
        }

        await UIController.streamLines(lines, quickActions);
        // Cập nhật giai đoạn sau khi hiển thị overview
        if (isLast) {
          this.state.conversationStage = 'image_overview';
          try {
            if (window.SidebarController) {
              const smartTitle = this.generateSmartTitle({
                activeImageData: this.state.activeImageData,
                conversationHistory: this.state.conversationHistory,
                userIndustry: this.state.userIndustry
              });
              window.SidebarController.addSession({
                id: this.state.currentSessionId,
                title: smartTitle,
                activeImageData: this.state.activeImageData,
                conversationHistory: this.state.conversationHistory,
                stage: this.state.conversationStage
              });
            }
          } catch(e) {}
        }

        if (!isLast) {
          await UIController.delay(700);
        }
      }
      return;
    }

    // BƯỚC 4: HỘI THOẠI ĐA LƯỢT (MULTI-TURN CHAT)
    if (text) {
      UIController.showTypingIndicator();

      let apiResponse = "";
      try {
        apiResponse = await ApiService.chatNextTurn({
          apiKey, text, systemPrompt,
          conversationHistory: this.state.conversationHistory,
          activeImageData: this.state.activeImageData
        });
      } catch (err) {
        console.error("Lỗi Chat API:", err);
        UIController.hideTypingIndicator();
        const savedText = text;
        this.showApiError(err.message, async () => {
          UIController.showTypingIndicator();
          try {
            const r = await ApiService.chatNextTurn({
              apiKey, text: savedText, systemPrompt,
              conversationHistory: this.state.conversationHistory,
              activeImageData: this.state.activeImageData
            });
            UIController.hideTypingIndicator();
            const rLines = r.split('\n').map(l => UIController.sanitizeStrictRules(l)).filter(l => l.length > 0);
            await UIController.streamLines(rLines);
          } catch (e2) {
            UIController.hideTypingIndicator();
            await UIController.streamLines([`Vẫn lỗi (${e2.message}). Bạn thử lại sau nhé.`]);
          }
        });
        return;
      }

      UIController.hideTypingIndicator();

      this.state.conversationHistory.push({ role: 'user', text });
      this.state.conversationHistory.push({ role: 'model', text: apiResponse });

      const lines = apiResponse.split('\n')
        .map(l => UIController.sanitizeStrictRules(l))
        .filter(l => l.length > 0);

      let nextActions = null;
      if (!this.state.activeImageData) {
        nextActions = null;
      } else {
        // Sinh quick actions theo nội dung câu hỏi tự nhập của người dùng khi đã có ảnh
        const lower = text.toLowerCase();
        if (lower.includes('nhìn') || lower.includes('mắt') || lower.includes('thấy gì') || lower.includes('trước')) {
          nextActions = [
            { text: 'Chỗ nào làm tốt?', action: 'strengths' },
            { text: 'Chỗ nào chưa ổn?', action: 'weaknesses' }
          ];
        } else if (lower.includes('tốt') || lower.includes('ưu điểm') || lower.includes('mạnh')) {
          nextActions = [
            { text: 'Chỗ nào chưa ổn?', action: 'weaknesses' },
            { text: 'Mình nên sửa gì trước?', action: 'fix_order' }
          ];
        } else if (lower.includes('chưa ổn') || lower.includes('hạn chế') || lower.includes('điểm yếu') || lower.includes('sai')) {
          nextActions = [
            { text: 'Mình nên sửa gì trước?', action: 'fix_order' },
            { text: 'Chỗ nào làm tốt?', action: 'strengths' }
          ];
        } else if (lower.includes('sửa') || lower.includes('đề xuất') || lower.includes('chỉnh')) {
          nextActions = [
            { text: '🎨 Hướng dẫn chỉnh màu nút CTA', action: 'fix_cta_color' },
            { text: '✍️ Chỉnh bố cục chữ', action: 'fix_typography' },
            { text: '🤖 Tạo Prompt AI vẽ lại ảnh', action: 'redesign_prompt' }
          ];
        } else if (this.state.conversationStage === 'image_overview') {
          nextActions = [
            { text: 'Người xem thấy gì trước?', action: 'first_impression' },
            { text: 'Chỗ nào làm tốt?', action: 'strengths' },
            { text: 'Chỗ nào chưa ổn?', action: 'weaknesses' }
          ];
        }
      }

      await UIController.streamLines(lines, nextActions);

      // Cập nhật session vào Database sau mỗi lượt trao đổi
      try {
        if (window.SidebarController) {
          const smartTitle = this.generateSmartTitle({
            activeImageData: this.state.activeImageData,
            conversationHistory: this.state.conversationHistory,
            firstUserText: text,
            userIndustry: this.state.userIndustry
          });
          window.SidebarController.addSession({
            id: this.state.currentSessionId,
            title: smartTitle,
            activeImageData: this.state.activeImageData,
            conversationHistory: this.state.conversationHistory,
            stage: this.state.conversationStage
          });
        }
      } catch (e) {}
    }
  },

  // Quy luật đặt tên thông minh cho đoạn chat (Phong cách ChatGPT / Claude.ai)
  generateSmartTitle(sessionData = {}) {
    const { activeImageData, conversationHistory, firstUserText, userIndustry } = sessionData;

    // Quy luật 1: Nếu có ảnh -> Lấy tên ảnh làm sạch + ngành hàng
    if (activeImageData && activeImageData.fileName) {
      let name = activeImageData.fileName.replace(/\.[a-zA-Z0-9]+$/, '');
      name = name.replace(/^[0-9_\-\s]+/, '');
      name = name.replace(/[\-_]+/g, ' ').trim();
      if (name.length >= 2 && !/^(image|img|screenshot|unnamed|photo|picture)$/i.test(name)) {
        name = name.charAt(0).toUpperCase() + name.slice(1);
        const suffix = userIndustry ? ` [${userIndustry}]` : '';
        const full = name + suffix;
        return full.length > 28 ? full.substring(0, 28) + '...' : full;
      }
    }

    // Quy luật 2: Nếu có câu hỏi text của người dùng -> Trích xuất ý chính súc tích
    const firstText = firstUserText || (conversationHistory && conversationHistory.find(m => m.role === 'user')?.text);
    if (firstText && typeof firstText === 'string') {
      let clean = firstText.trim();
      clean = clean.replace(/^(hãy|bạn|hoàng an|ơi|xem giùm|xem giúp|phân tích|cho mình hỏi|đánh giá|thẩm định|kiểm tra|nhờ bạn|tư vấn)\s+/i, '');
      clean = clean.replace(/^(giúp mình|giúp tôi|hộ mình|với)\s+/i, '');
      clean = clean.replace(/[?.!]+$/, '').trim();
      if (clean.length >= 2) {
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);
        return clean.length > 30 ? clean.substring(0, 30) + '...' : clean;
      }
    }

    // Quy luật 3: Fallback theo ngành hàng hoặc thời gian
    if (userIndustry) {
      return `Chiến dịch ${userIndustry}`;
    }
    const now = new Date();
    return `Đoạn chat ${now.getDate()}/${now.getMonth() + 1} lúc ${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;
  },

  // Bắt đầu một phiên trò chuyện mới (New Chat - phong cách Claude.ai / ChatGPT)
  startNewChat(updateUrl = true) {
    this.state.currentSessionId = 'sess-' + Date.now();
    this.state.conversationHistory = [];
    this.state.activeImageData = null;
    this.state.attachedImages = [];
    this.state.lastFailedRequest = null;
    this.state.userIndustry = '';
    this.state.userPlatform = '';
    this.state.campaignGoal = '';
    this.clearAllAttachments();
    if (UIController.elements.chatInput) UIController.elements.chatInput.value = '';
    localStorage.removeItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY);
    localStorage.removeItem('adv_user_platform');
    localStorage.removeItem('adv_campaign_goal');

    // Bỏ chọn highlight ở sidebar
    document.querySelectorAll('.sidebar-session-item').forEach(el => {
      el.classList.remove('bg-[#E5E2D9]', 'dark:bg-[#2C2B27]', 'active');
    });

    if (updateUrl) {
      window.AppRouter.navigate('/', { skipNewChat: true });
    }

    // Xóa sạch khung chat
    if (UIController.elements.chatContainer) {
      UIController.elements.chatContainer.innerHTML = '';
    }

    const currentUser = window.SidebarController?.getCurrentUser();
    if (currentUser) {
      this.state.userName = currentUser.name || "";
      this.state.conversationStage = this.state.userIndustry ? 'awaiting_image' : 'onboarding';
      const callName = (window.PersonaPrompt && PersonaPrompt.getDynamicCallName) 
        ? PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName)
        : (this.state.userName || "bạn");
      
      const welcomeMsg = `Chào ${callName}, phiên thẩm định mới đã sẵn sàng! Bạn có thể nhấn 📎 để tải ảnh quảng cáo hoặc nhập câu hỏi cho mình nhé.`;
      UIController.streamLines([welcomeMsg]);
      this.updateSystemStatus();
    } else {
      this.state.conversationStage = 'idle';
      this.playInitialGreeting();
    }
  },

  // Khôi phục một phiên trò chuyện cũ từ Database (IndexedDB) để chat tiếp
  async restoreSession(session) {
    if (!session) return;

    this.state.currentSessionId = session.id;
    this.state.activeImageData = session.activeImageData || null;
    this.state.conversationHistory = session.conversationHistory || [];
    this.state.conversationStage = session.stage || 'image_overview';

    // Xóa sạch khung chat
    UIController.elements.chatContainer.innerHTML = '';

    // Khôi phục thẻ đo đạc thị giác cục bộ nếu ảnh có lưu telemetry
    if (this.state.activeImageData?.features && window.ImageFeatureExtractor) {
      const telemetryHtml = window.ImageFeatureExtractor.renderTelemetryBadge(this.state.activeImageData.features);
      if (telemetryHtml && UIController.appendRawHtml) {
        UIController.appendRawHtml(telemetryHtml);
      }
    }

    // Khôi phục thẻ điểm Rubric 6 tiêu chí nếu phiên đã từng chấm điểm
    if (this.state.activeImageData?.scoreData && window.ScoringService) {
      const scoreHtml = window.ScoringService.renderScoreCard(
        this.state.activeImageData.scoreData,
        this.state.activeImageData.fileName
      );
      if (scoreHtml && UIController.appendRawHtml) {
        UIController.appendRawHtml(scoreHtml);
      }
    }

    // Render lại toàn bộ lịch sử trò chuyện
    const history = this.state.conversationHistory;
    for (let i = 0; i < history.length; i++) {
      const turn = history[i];
      if (turn.role === 'user') {
        const attached = (i === 0 && this.state.activeImageData)
          ? [{ dataUrl: `data:${this.state.activeImageData.mimeType};base64,${this.state.activeImageData.base64}`, fileName: this.state.activeImageData.fileName || 'ảnh_quảng_cáo' }]
          : [];
        UIController.appendUserMessage(turn.text, attached);
      } else if (turn.role === 'model') {
        UIController.renderStaticAiMessage(turn.text);
      }
    }

    // Hiển thị thông báo nhẹ
    const noticeHtml = `
      <div class="my-4 text-center">
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#E5E2D9]/70 dark:bg-[#2C2B27]/70 text-[#6E6D69] dark:text-[#9A9892] border border-[#E5E2D9] dark:border-[#2C2B27]">
          <i class="fa-solid fa-clock-rotate-left text-[#DA7756]"></i>
          Đã khôi phục đoạn chat: <strong>${session.title || 'Phiên thẩm định'}</strong>. Bạn có thể tiếp tục nhắn tin trao đổi với Nguyễn Hoàng An!
        </span>
      </div>
    `;
    UIController.elements.chatContainer.insertAdjacentHTML('beforeend', noticeHtml);
    UIController.scrollToBottom();

    // Cập nhật trạng thái và placeholder
    this.updateSystemStatus();
  }
};

window.AppController = AppController;

// Khởi tạo ứng dụng khi DOM sẵn sàng
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    AppController.init();
  });
} else {
  AppController.init();
}
