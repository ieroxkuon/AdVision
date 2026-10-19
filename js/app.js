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
    userName: localStorage.getItem(AdvConfig.STORAGE_KEYS.USER_NAME) || "",
    userIndustry: localStorage.getItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY) || "",
    userPlatform: localStorage.getItem('adv_user_platform') || "", // Facebook, TikTok, Shopee...
    nameVariations: JSON.parse(localStorage.getItem(AdvConfig.STORAGE_KEYS.NAME_VARIATIONS) || "[]"),
    attachedImages: [],
    activeImageData: null,
    conversationHistory: [],
    conversationStage: 'idle', // idle | image_overview | deep_dive | done
    lastFailedRequest: null    // Lưu lại request để retry khi lỗi API
  },

  // Khởi động toàn bộ hệ thống
  init() {
    // Tự động làm sạch các chuỗi cũ bị lỗi nếu có
    if (this.state.userPlatform && (this.state.userPlatform.length > 30 || /không|gì|sao|thế nào/i.test(this.state.userPlatform))) {
      this.state.userPlatform = "";
      localStorage.removeItem('adv_user_platform');
    }
    if (this.state.userIndustry && (this.state.userIndustry.length > 40 || /nha bạn|nhé|không/i.test(this.state.userIndustry))) {
      if (this.state.userIndustry.toLowerCase().includes('thực phẩm')) {
        this.state.userIndustry = "F&B / Thực phẩm";
      } else {
        this.state.userIndustry = "";
      }
      localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY, this.state.userIndustry);
    }

    UIController.initModals();
    this.bindEvents();
    this.updateSystemStatus();

    if (!this.state.userName) {
      this.playInitialGreeting();
    } else {
      const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
      UIController.streamLines([
        `Chào ${callName}, rất vui được gặp lại bạn!`,
        `Bạn có hình ảnh quảng cáo nào cần mình thẩm định hôm nay không?`
      ], [
        { text: '📎 Gửi ảnh ngay', action: '__attach__' },
        { text: 'F&B Thực phẩm', action: 'Mình đang làm sản phẩm ngành thực phẩm' },
        { text: 'Thời trang & Làm đẹp', action: 'Mình làm ngành thời trang mỹ phẩm' }
      ]);
    }
  },

  // Đồng bộ trạng thái giao diện và API
  updateSystemStatus() {
    const key = AdvConfig.getEffectiveApiKey();
    if (UIController.elements.inputApiKey) {
      UIController.elements.inputApiKey.value = key;
    }
    UIController.updateApiStatusIndicator(!!key);
    UIController.updateUserBadge(this.state.userName, this.state.userIndustry);
    const callName = PersonaPrompt.getDynamicCallName(this.state.nameVariations, this.state.userName);
    UIController.updateInputPlaceholder(this.state.userName, this.state.userIndustry, callName, this.state.attachedImages.length);
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
    ], [
      { text: '📎 Gửi ảnh ngay', action: '__attach__' },
      { text: 'F&B Thực phẩm', action: 'Mình đang làm sản phẩm ngành thực phẩm' },
      { text: 'Thời trang & Làm đẹp', action: 'Mình làm ngành thời trang mỹ phẩm' }
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
          this.state.nameVariations = [];
          this.state.activeImageData = null;
          this.state.conversationHistory = [];
          this.state.conversationStage = 'idle';
          this.state.lastFailedRequest = null;
          localStorage.removeItem(AdvConfig.STORAGE_KEYS.USER_NAME);
          localStorage.removeItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY);
          localStorage.removeItem(AdvConfig.STORAGE_KEYS.NAME_VARIATIONS);
          localStorage.removeItem('adv_user_platform');
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
    const systemPrompt = PersonaPrompt.getSystemPrompt(callName);
    const followUpText = PersonaPrompt.buildFollowUpPrompt(callName, topic);
    if (!followUpText) return;

    // Hiển thị tin nhắn người dùng ngắn gọn
    const topicLabels = {
      first_impression: 'Người xem thấy gì trước tiên?',
      strengths: 'Chỗ nào làm tốt?',
      weaknesses: 'Chỗ nào chưa ổn?',
      fix_order: 'Mình nên sửa gì trước?',
      platform_fb: 'Tối ưu cho Facebook & Instagram',
      platform_tiktok: 'Tối ưu cho TikTok',
      redesign_prompt: 'Tạo Prompt tái thiết kế',
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

  // Sinh quick actions tiếp theo dựa trên topic vừa trả lời - theo đoạn hội thoại mẫu
  getNextActionsForTopic(topic) {
    // Flow: overview → first_impression → strengths → weaknesses → fix_order → platform → redesign
    const map = {
      first_impression: [
        { text: '⚠️ Chỗ nào chưa ổn?', action: 'weaknesses' },
        { text: '✨ Chỗ nào làm tốt?', action: 'strengths' }
      ],
      strengths: [
        { text: '⚠️ Chỗ nào chưa ổn?', action: 'weaknesses' },
        { text: '🎯 Mình nên sửa gì trước?', action: 'fix_order' }
      ],
      weaknesses: [
        { text: '🎯 Mình nên sửa gì trước?', action: 'fix_order' },
        { text: '💡 Đề xuất cách sửa cụ thể', action: 'suggestions' },
        { text: '✨ Chỗ nào làm tốt?', action: 'strengths' }
      ],
      fix_order: [
        { text: 'Tạo Prompt tái thiết kế', action: 'redesign_prompt' },
        { text: 'Tối ưu cho Facebook', action: 'platform_fb' },
        { text: 'Tối ưu cho TikTok', action: 'platform_tiktok' }
      ],
      platform_fb: [
        { text: 'Tạo Prompt tái thiết kế', action: 'redesign_prompt' },
        { text: 'Tối ưu cho TikTok', action: 'platform_tiktok' }
      ],
      platform_tiktok: [
        { text: 'Tạo Prompt tái thiết kế', action: 'redesign_prompt' },
        { text: 'Tối ưu cho Facebook', action: 'platform_fb' }
      ],
      redesign_prompt: [
        { text: 'Tối ưu cho Facebook', action: 'platform_fb' },
        { text: 'Tối ưu cho TikTok', action: 'platform_tiktok' }
      ],
      compare: [
        { text: 'Người xem thấy gì trước?', action: 'first_impression' },
        { text: 'Chỗ nào chưa ổn?', action: 'weaknesses' },
        { text: 'Mình nên sửa gì trước?', action: 'fix_order' }
      ],
      // Aliases cho các topic cũ
      layout: [
        { text: 'Chỗ nào chưa ổn?', action: 'weaknesses' },
        { text: 'Mình nên sửa gì trước?', action: 'fix_order' }
      ],
      typography: [
        { text: 'Chỗ nào làm tốt?', action: 'strengths' },
        { text: 'Mình nên sửa gì trước?', action: 'fix_order' }
      ],
      pros_cons: [
        { text: 'Mình nên sửa gì trước?', action: 'fix_order' },
        { text: 'Tạo Prompt tái thiết kế', action: 'redesign_prompt' }
      ],
      suggestions: [
        { text: 'Tạo Prompt tái thiết kế', action: 'redesign_prompt' },
        { text: 'Tối ưu cho Facebook', action: 'platform_fb' }
      ]
    };
    return map[topic] || [];
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

      if (detected.userIndustry) {
        this.state.userIndustry = detected.userIndustry;
        localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY, this.state.userIndustry);
      }
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
    const systemPrompt = PersonaPrompt.getSystemPrompt(callName, this.state.userIndustry, this.state.userPlatform);

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
          featureSummary
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
        // Quick actions sau overview: đúng theo flow hội thoại mẫu
        const quickActions = isLast ? (
          sentImages.length > 1 ? [
            { text: 'So sánh ảnh nào tốt hơn', action: 'compare' },
            { text: 'Người xem thấy gì trước?', action: 'first_impression' },
            { text: 'Chỗ nào làm tốt?', action: 'strengths' },
            { text: 'Chỗ nào chưa ổn?', action: 'weaknesses' }
          ] : [
            { text: 'Người xem thấy gì trước?', action: 'first_impression' },
            { text: 'Chỗ nào làm tốt?', action: 'strengths' },
            { text: 'Chỗ nào chưa ổn?', action: 'weaknesses' }
          ]
        ) : null;

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
        // Khi người dùng chat trao đổi trước khi gửi ảnh
        nextActions = [
          { text: '📎 Gửi ảnh thẩm định', action: '__attach__' },
          { text: 'Chạy Facebook & Instagram', action: 'Mình định chạy Facebook và Instagram' },
          { text: 'Chạy TikTok Video dọc', action: 'Mình định chạy TikTok Video dọc' }
        ];
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
            { text: 'Tạo Prompt tái thiết kế', action: 'redesign_prompt' },
            { text: 'Tối ưu cho Facebook', action: 'platform_fb' },
            { text: 'Tối ưu cho TikTok', action: 'platform_tiktok' }
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
window.addEventListener('DOMContentLoaded', () => {
  AppController.init();
});
