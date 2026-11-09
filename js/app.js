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
    lastFailedRequest: null    // Lưu lại request để retry khi lỗi API
  },

  // Khởi động toàn bộ hệ thống
  init() {
    try {
      // Tự động làm sạch các chuỗi cũ bị lỗi nếu có
      if (this.state.userPlatform && (this.state.userPlatform.length > 30 || /không|gì|sao|thế nào/i.test(this.state.userPlatform))) {
        this.state.userPlatform = "";
        try { localStorage.removeItem('adv_user_platform'); } catch(e) {}
      }
      if (this.state.userIndustry && (this.state.userIndustry.length > 40 || /nha bạn|nhé|không/i.test(this.state.userIndustry))) {
        if (this.state.userIndustry.toLowerCase().includes('thực phẩm')) {
          this.state.userIndustry = "F&B / Thực phẩm";
        } else {
          this.state.userIndustry = "";
        }
        try { localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY, this.state.userIndustry); } catch(e) {}
      }

      UIController.initModals();
      this.bindEvents();
      this.updateSystemStatus();

      if (!this.state.userName) {
        this.playInitialGreeting();
      } else {
        const callName = (window.PersonaPrompt && PersonaPrompt.getDynamicCallName) 
          ? PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName)
          : (this.state.userName || "bạn");

        // Khôi phục stage phù hợp dựa trên dữ liệu localStorage
        if (this.state.userIndustry && this.state.userPlatform) {
          this.state.conversationStage = 'awaiting_image';
        } else if (this.state.userIndustry) {
          this.state.conversationStage = 'briefing';
        } else {
          this.state.conversationStage = 'onboarding';
        }

        const welcomeBack = this.state.userPlatform
          ? `Chào ${callName}, rất vui được gặp lại! Mình thấy bạn đang chạy chiến dịch trên **${this.state.userPlatform}**. Bạn đã chuẩn bị ảnh quảng cáo chưa nhỉ — bấm 📎 để gửi mình xem nhé!`
          : `Chào ${callName}, rất vui được gặp lại bạn! Bạn có hình ảnh quảng cáo nào cần mình thẩm định hôm nay không?`;
        UIController.streamLines([welcomeBack]);
        this.updateSystemStatus();
      }
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
    const { chatForm, btnAttachImage, fileInput, btnClearAllAttachments, btnSaveKey, inputApiKey, apiModal, btnResetChat } = UIController.elements;

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

    // Sự kiện đặt lại cuộc trò chuyện từ đầu
    if (btnResetChat) {
      btnResetChat.addEventListener('click', () => {
        if (confirm('Bạn có muốn bắt đầu lại cuộc trò chuyện không?')) {
          this.state.userName = "";
          this.state.userIndustry = "";
          this.state.userPlatform = "";
          this.state.campaignGoal = "";
          this.state.nameVariations = [];
          this.state.activeImageData = null;
          this.state.conversationHistory = [];
          this.state.conversationStage = 'idle';
          this.state.lastFailedRequest = null;
          localStorage.removeItem(AdvConfig.STORAGE_KEYS.USER_NAME);
          localStorage.removeItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY);
          localStorage.removeItem(AdvConfig.STORAGE_KEYS.NAME_VARIATIONS);
          localStorage.removeItem('adv_user_platform');
          localStorage.removeItem('adv_campaign_goal');
          this.clearAllAttachments();
          this.updateSystemStatus();
          this.playInitialGreeting();
        }
      });
    }

    // Sự kiện submit khung chat
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleChatSubmit();
      });
    }
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

  // Sinh quick actions tiếp theo dựa trên topic vừa trả lời - chuẩn 6 Vòng Art Director
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
        { text: '✍️ Chỉnh bố cục chữ & khoảng cách', action: 'fix_typography' },
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
        { text: 'Người xem thấy gì trước?', action: 'first_impression' },
        { text: 'Chỗ nào chưa ổn?', action: 'weaknesses' },
        { text: 'Mình nên sửa gì trước?', action: 'fix_order' }
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
      const wasNameKnown = !!this.state.userName;

      // Nhận diện tên
      if (detected.userName && !this.state.userName) {
        this.state.userName = detected.userName;
        this.state.nameVariations = detected.nameVariations || [detected.userName];
        localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_NAME, this.state.userName);
        localStorage.setItem(AdvConfig.STORAGE_KEYS.NAME_VARIATIONS, JSON.stringify(this.state.nameVariations));
      } else if (!this.state.userName && sentImages.length === 0 && text.split(/\s+/).length <= 2 && !text.includes('?')) {
        const parsed = PersonaPrompt.extractSmartName(text);
        if (parsed.mainName && parsed.mainName !== "bạn") {
          this.state.userName = parsed.mainName;
          this.state.nameVariations = parsed.variations;
          localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_NAME, this.state.userName);
          localStorage.setItem(AdvConfig.STORAGE_KEYS.NAME_VARIATIONS, JSON.stringify(this.state.nameVariations));
        }
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

    // =========================================================================
    // VÒNG 1: ONBOARDING NHANH (ZERO-LATENCY TỨC THÌ)
    // =========================================================================
    if (
      this.state.conversationStage === 'idle' || this.state.conversationStage === 'onboarding'
    ) {
      const hasName = !!this.state.userName;
      const hasIndustry = !!this.state.userIndustry;
      const hasPlatform = !!this.state.userPlatform;
      const hasCampaignGoal = !!this.state.campaignGoal;

      // 1A. Người dùng chỉ mới nhập Tên -> Phản hồi tức thì trong 0.05s chào Tên và hỏi ngành
      if (hasName && !hasIndustry && !hasPlatform && !hasCampaignGoal && sentImages.length === 0) {
        this.state.conversationStage = 'onboarding';
        const instantGreeting = [
          `Chào ${callName}! Rất vui được đồng hành cùng bạn.`,
          `Hôm nay ${callName} cần mình đồng hành tối ưu hình ảnh cho sản phẩm hoặc chiến dịch nào vậy?`
        ];
        await UIController.streamLines(instantGreeting, [
          { text: '🍗 Quán ăn / F&B gà rán', action: 'industry_fnb' },
          { text: '👗 Thời trang / Phụ kiện', action: 'industry_fashion' },
          { text: '💄 Mỹ phẩm / Làm đẹp', action: 'industry_beauty' },
          { text: '📱 Công nghệ / Điện tử', action: 'industry_tech' }
        ]);
        this.updateSystemStatus();
        return;
      }

      // 1B. Đã có cả Tên + Ngành hàng -> Chuyển ngay sang Vòng 2 Briefing
      if (hasName && hasIndustry && !hasPlatform && !hasCampaignGoal && sentImages.length === 0) {
        this.state.conversationStage = 'briefing';
        const briefingLines = PersonaPrompt.buildOnboardingToBriefing(callName, this.state.userIndustry);
        await UIController.streamLines(briefingLines, [
          { text: '📱 Facebook Feed 1:1 - Ưu đãi giảm 30%', action: 'briefing_fb_sales' },
          { text: '📱 Facebook Feed 1:1 - Khai trương quán', action: 'briefing_fb_launch' },
          { text: '🎵 TikTok / Reels 9:16', action: 'briefing_tiktok' },
          { text: '🛒 Sàn Shopee / Lazada', action: 'briefing_ecommerce' }
        ]);
        this.updateSystemStatus();
        return;
      }
    }

    // =========================================================================
    // VÒNG 2 → CHỜ ẢNH: Người dùng trả lời về kênh + mục tiêu → xác nhận brief
    // =========================================================================
    if (this.state.conversationStage === 'briefing' && sentImages.length === 0 && text) {
      const briefing = PersonaPrompt.parseBriefingAnswer(text);

      // Cập nhật kênh nếu tìm thấy
      if (briefing.platform) {
        this.state.userPlatform = briefing.platformLabel;
        localStorage.setItem('adv_user_platform', this.state.userPlatform);
      }
      // Cập nhật mục tiêu nếu tìm thấy
      if (briefing.goal) {
        this.state.campaignGoal = briefing.goal;
        localStorage.setItem('adv_campaign_goal', this.state.campaignGoal);
      }

      // Nếu đã đủ cả kênh lẫn mục tiêu → xác nhận brief và mời gửi ảnh
      const finalPlatform = briefing.platform || '';
      const finalGoal = briefing.goal || '';
      const finalPlatformLabel = briefing.platformLabel || this.state.userPlatform || 'kênh đã chọn';
      const finalGoalLabel = briefing.goalLabel || this.state.campaignGoal || 'mục tiêu đã chọn';

      if (finalPlatform || finalGoal) {
        this.state.conversationStage = 'awaiting_image';
        const confirmLines = PersonaPrompt.buildBriefingConfirm(
          callName, finalPlatformLabel, finalGoalLabel, finalPlatform, finalGoal
        );
        await UIController.streamLines(confirmLines, [
          { text: '📎 Gửi ảnh để thẩm định ngay', action: '__attach__' }
        ]);
        this.updateSystemStatus();
        return;
      }
      // Nếu không parse được kênh/mục tiêu → để AI trả lời tự nhiên (fall through)
    }

    // Chọn Prompt phân tầng: có ảnh thì dùng Vision Prompt (kèm 16 PDF), chưa ảnh thì dùng Mini Prompt siêu nhẹ
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

        // Quick actions sau overview: Chuẩn kịch bản Art Director Vòng 3
        let quickActions = null;
        if (isLast) {
          if (sentImages.length > 1) {
            quickActions = [
              { text: '⚖️ So sánh ảnh nào tốt hơn', action: 'compare' },
              { text: '🔴 Hạt sạn cản trở chuyển đổi', action: 'weaknesses' },
              { text: '✨ Điểm sáng làm tốt', action: 'strengths' }
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
        if (isLast) this.state.conversationStage = 'image_overview';

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
    }
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
