/**
 * =============================================================================
 * ADVISION SIDEBAR & USER CONTROLLER — client/js/sidebar.js
 * =============================================================================
 * Thiết kế theo phong cách Claude.ai:
 *   - Nút con mắt cố định ở góc trái để ẩn/hiện Sidebar.
 *   - Quản lý trạng thái User: mặc định là Guest.
 *   - Popover Menu:
 *       ├─ Đổi Theme 3 chế độ: Hệ thống / Sáng / Tối
 *       └─ Đăng nhập bằng Google / Đăng xuất
 *   - Quản lý Lịch sử trò chuyện: Chỉ hiển thị khi ĐÃ đăng nhập.
 *   - Kết nối StorageService (IndexedDB) để tải lại phiên cũ và chat tiếp.
 * =============================================================================
 */

const SidebarController = (() => {

  // State
  let _currentUser = null;
  let _currentThemeMode = localStorage.getItem('adv_theme_mode') || 'system';
  let _sessions = [];
  let _systemThemeListenerAttached = false;

  // DOM Elements cache
  let eyeBtn = null;
  let sidebar = null;
  let historySection = null;
  let sessionList = null;
  let noHistoryMsg = null;
  let userTrigger = null;
  let userAvatar = null;
  let userNameEl = null;
  let userSubtitleEl = null;
  let userPopover = null;
  let themeBtns = {};
  let btnGoogleLogin = null;
  let btnLogout = null;
  let googleAuthModal = null;

  // ---------------------------------------------------------------------------
  // 1. QUẢN LÝ THEME GIAO DIỆN (SYSTEM / LIGHT / DARK - PHONG CÁCH CLAUDE.AI)
  // ---------------------------------------------------------------------------
  function applyTheme(mode) {
    _currentThemeMode = mode;
    try { localStorage.setItem('adv_theme_mode', mode); } catch (e) {}

    const html = document.documentElement;

    if (mode === 'system') {
      const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isSystemDark) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }

      if (!_systemThemeListenerAttached && window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (_currentThemeMode === 'system') {
            if (e.matches) html.classList.add('dark');
            else html.classList.remove('dark');
          }
        });
        _systemThemeListenerAttached = true;
      }
    } else if (mode === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    // Cập nhật giao diện nút chọn theme trong popover
    updateThemeSelectorUi(mode);
  }

  function updateThemeSelectorUi(activeMode) {
    ['system', 'light', 'dark'].forEach(m => {
      const btn = themeBtns[m];
      if (!btn) return;
      if (m === activeMode) {
        btn.classList.add('bg-[#E5E2D9]', 'dark:bg-[#2C2B27]', 'font-semibold', 'text-[#DA7756]');
        btn.classList.remove('text-[#6E6D69]', 'dark:text-[#9A9892]');
      } else {
        btn.classList.remove('bg-[#E5E2D9]', 'dark:bg-[#2C2B27]', 'font-semibold', 'text-[#DA7756]');
        btn.classList.add('text-[#6E6D69]', 'dark:text-[#9A9892]');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 2. SIDEBAR TOGGLE BẰNG NÚT CON MẮT
  // ---------------------------------------------------------------------------
  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('sidebar-collapsed');
    try { localStorage.setItem('adv_sidebar_open', 'true'); } catch (e) {}
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('sidebar-collapsed');
    try { localStorage.setItem('adv_sidebar_open', 'false'); } catch (e) {}
  }

  function toggleSidebar() {
    if (!sidebar) return;
    if (sidebar.classList.contains('sidebar-collapsed')) {
      openSidebar();
    } else {
      closeSidebar();
    }
  }

  // ---------------------------------------------------------------------------
  // 3. USER POPOVER MENU
  // ---------------------------------------------------------------------------
  function toggleUserPopover(e) {
    if (e) e.stopPropagation();
    if (!userPopover) return;
    userPopover.classList.toggle('hidden');
  }

  function closeUserPopover() {
    if (userPopover && !userPopover.classList.contains('hidden')) {
      userPopover.classList.add('hidden');
    }
  }

  // ---------------------------------------------------------------------------
  // 4. QUẢN LÝ TRẠNG THÁI NGƯỜI DÙNG & ĐĂNG NHẬP GOOGLE
  // ---------------------------------------------------------------------------
  function renderUserState() {
    if (_currentUser) {
      // Đã đăng nhập
      if (userNameEl) userNameEl.textContent = _currentUser.name || _currentUser.email || 'Người dùng Google';
      if (userSubtitleEl) userSubtitleEl.textContent = _currentUser.email || 'Google Account';
      if (userAvatar) {
        if (_currentUser.picture) {
          userAvatar.innerHTML = `<img src="${_currentUser.picture}" alt="Avatar" class="w-full h-full rounded-full object-cover">`;
        } else {
          userAvatar.innerHTML = `<span class="text-xs font-bold text-white">${(_currentUser.name || 'U').charAt(0).toUpperCase()}</span>`;
          userAvatar.className = 'w-8 h-8 rounded-full bg-[#DA7756] flex items-center justify-center shrink-0 shadow-sm';
        }
      }

      // Ẩn nút đăng nhập Google, hiện nút Đăng xuất
      if (btnGoogleLogin) btnGoogleLogin.classList.add('hidden');
      if (btnLogout) btnLogout.classList.remove('hidden');

      // Hiện khu vực lịch sử trò chuyện
      if (historySection) historySection.classList.remove('hidden');

      // Tải danh sách lịch sử từ IndexedDB
      loadSessionsFromDb();
    } else {
      // Chưa đăng nhập (Guest)
      if (userNameEl) userNameEl.textContent = 'Guest';
      if (userSubtitleEl) userSubtitleEl.textContent = 'Nhấn để tùy chỉnh & đăng nhập';
      if (userAvatar) {
        userAvatar.className = 'w-8 h-8 rounded-full bg-[#E5E2D9] dark:bg-[#2C2B27] flex items-center justify-center shrink-0 text-[#6E6D69] dark:text-[#9A9892]';
        userAvatar.innerHTML = '<i class="fa-regular fa-user text-xs"></i>';
      }

      // Hiện nút đăng nhập Google, ẩn nút Đăng xuất
      if (btnGoogleLogin) btnGoogleLogin.classList.remove('hidden');
      if (btnLogout) btnLogout.classList.add('hidden');

      // Ẩn hoàn toàn thanh lịch sử trò chuyện
      if (historySection) historySection.classList.add('hidden');
    }
  }

  // Giải mã JWT Token từ Google Identity Services
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.warn("Lỗi parse JWT:", e);
      return {};
    }
  }

  // Khởi tạo Google Identity Services (GIS) chính thức
  function initGoogleIdentity() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
      // Đợi Google SDK tải xong
      setTimeout(initGoogleIdentity, 300);
      return;
    }

    const clientId = (window.AdvConfig && AdvConfig.getGoogleClientId)
      ? AdvConfig.getGoogleClientId()
      : "748430716195-hk1kn197r5cdm18vs0vafsmv24532mrg.apps.googleusercontent.com";

    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response && response.credential) {
            const payload = parseJwt(response.credential);
            completeGoogleSignIn({
              id: payload.sub || ('google-' + Date.now()),
              name: payload.name || payload.given_name || 'Người dùng Google',
              email: payload.email || 'user@gmail.com',
              picture: payload.picture || null
            });
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Render nút đăng nhập Google chính thức vào container nếu có
      const slot = document.getElementById('google-official-btn-slot');
      if (slot) {
        slot.innerHTML = '';
        google.accounts.id.renderButton(slot, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 230
        });

        // Khi nút Google chính thức đã render, ẩn nút dự phòng để giao diện cực gọn
        if (btnGoogleLogin) {
          btnGoogleLogin.classList.add('hidden');
        }
      }

      // Kích hoạt Google One-Tap nếu chưa đăng nhập
      if (!_currentUser) {
        google.accounts.id.prompt();
      }
    } catch (err) {
      console.warn('[Google GIS]', err);
    }
  }

  // Đăng nhập bằng Google
  function handleGoogleLogin() {
    closeUserPopover();

    // Thử kích hoạt Google One Tap / Google Prompt chính thức trước
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      try {
        google.accounts.id.prompt((notification) => {
          // Nếu Google chặn hiển thị do chưa cấu hình Authorized Origins trên Google Cloud
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('[Google GIS] Prompt không hiển thị, mở modal hỗ trợ:', notification.getNotDisplayedReason?.());
            if (googleAuthModal) googleAuthModal.classList.remove('hidden');
          }
        });
        return;
      } catch (e) {
        console.warn('Lỗi gọi google.accounts.id.prompt:', e);
      }
    }

    // Fallback: Mở modal chọn tài khoản nếu SDK chưa sẵn sàng
    if (googleAuthModal) {
      googleAuthModal.classList.remove('hidden');
    }
  }

  // Hoàn tất xác thực Google (nhận payload từ Google OAuth hoặc mô phỏng)
  function completeGoogleSignIn(userProfile) {
    _currentUser = {
      id: userProfile.id || ('google-' + Date.now()),
      name: userProfile.name || 'Người dùng Google',
      email: userProfile.email || 'user@gmail.com',
      picture: userProfile.picture || null,
      provider: 'google',
      signedInAt: Date.now()
    };

    if (window.StorageService) {
      window.StorageService.saveUser(_currentUser);
    }

    // Đồng bộ tên với AdVision để Hoàng An xưng hô đúng tên
    try {
      if (window.AdvConfig) {
        localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_NAME, _currentUser.name);
        if (window.AppController && window.AppController.state) {
          window.AppController.state.userName = _currentUser.name;
        }
      }
    } catch (e) {}

    renderUserState();

    if (googleAuthModal) googleAuthModal.classList.add('hidden');

    // Chào mừng
    if (window.UiController?.showSystemNotice) {
      window.UiController.showSystemNotice(`Đã đăng nhập thành công: ${_currentUser.name}`);
    }
  }

  // Đăng xuất
  function handleLogout() {
    closeUserPopover();
    _currentUser = null;
    _sessions = [];
    if (window.StorageService) {
      window.StorageService.clearCurrentUser();
    }
    renderUserState();
  }

  // ---------------------------------------------------------------------------
  // 5. QUẢN LÝ LỊCH SỬ PHIÊN TRÒ CHUYỆN (SESSIONS & CHAT TIẾP)
  // ---------------------------------------------------------------------------
  async function loadSessionsFromDb() {
    if (!_currentUser || !window.StorageService) return;

    try {
      _sessions = await window.StorageService.getSessions(_currentUser.id);
      renderSessionList();
    } catch (e) {
      console.warn('Lỗi tải session:', e);
    }
  }

  function renderSessionList() {
    if (!sessionList) return;

    // Xóa các item cũ
    const items = sessionList.querySelectorAll('.sidebar-session-item');
    items.forEach(el => el.remove());

    if (_sessions.length === 0) {
      if (noHistoryMsg) noHistoryMsg.classList.remove('hidden');
      return;
    }

    if (noHistoryMsg) noHistoryMsg.classList.add('hidden');

    _sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className = 'sidebar-session-item group flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs text-[#1F1E1D] dark:text-[#EDECE8] hover:bg-[#E5E2D9]/60 dark:hover:bg-[#2C2B27]/60 transition-colors cursor-pointer';
      item.dataset.sessionId = session.id;

      item.innerHTML = `
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <i class="fa-regular fa-message text-[#DA7756] text-[11px] shrink-0"></i>
          <span class="truncate font-medium">${session.title || 'Phiên thẩm định'}</span>
        </div>
        <button class="btn-delete-session opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 text-[#6E6D69] dark:text-[#9A9892] transition-opacity" title="Xóa đoạn chat">
          <i class="fa-regular fa-trash-can text-[10px]"></i>
        </button>
      `;

      // Click vào phiên -> Khôi phục cuộc hội thoại để chat tiếp
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-session')) return;
        selectSession(session);
      });

      // Nút xóa phiên
      const btnDel = item.querySelector('.btn-delete-session');
      btnDel?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.StorageService) {
          await window.StorageService.deleteSession(session.id);
          _sessions = _sessions.filter(s => s.id !== session.id);
          renderSessionList();
        }
      });

      sessionList.appendChild(item);
    });
  }

  // Chọn 1 phiên để chat tiếp
  async function selectSession(session) {
    document.querySelectorAll('.sidebar-session-item').forEach(el => {
      el.classList.remove('bg-[#E5E2D9]', 'dark:bg-[#2C2B27]', 'active');
    });

    const activeEl = sessionList?.querySelector(`[data-session-id="${session.id}"]`);
    if (activeEl) activeEl.classList.add('bg-[#E5E2D9]', 'dark:bg-[#2C2B27]', 'active');

    // Chuyển sang AppController để khôi phục tin nhắn & ảnh vào khung chat
    if (window.AppController && typeof window.AppController.restoreSession === 'function') {
      window.AppController.restoreSession(session);
    }
  }

  // Thêm session mới khi phân tích ảnh xong
  async function addSession(sessionData) {
    if (!window.StorageService) return;

    const currentUserId = _currentUser ? _currentUser.id : 'guest';
    const saved = await window.StorageService.saveSession({
      ...sessionData,
      userId: currentUserId
    });

    if (saved && _currentUser) {
      _sessions.unshift(saved);
      // Giới hạn max sessions
      if (_sessions.length > window.StorageService.MAX_SESSIONS) {
        _sessions = _sessions.slice(0, window.StorageService.MAX_SESSIONS);
      }
      renderSessionList();
    }
  }

  // ---------------------------------------------------------------------------
  // 6. KHỞI TẠO BỘ ĐIỀU KHIỂN
  // ---------------------------------------------------------------------------
  function init() {
    // Cache DOM
    eyeBtn = document.getElementById('btn-eye-logo');
    sidebar = document.getElementById('sidebar');
    historySection = document.getElementById('sidebar-history-section');
    sessionList = document.getElementById('sidebar-session-list');
    noHistoryMsg = document.getElementById('sidebar-no-history');
    userTrigger = document.getElementById('sidebar-user-trigger');
    userAvatar = document.getElementById('user-avatar-slot');
    userNameEl = document.getElementById('sidebar-user-name');
    userSubtitleEl = document.getElementById('sidebar-user-subtitle');
    userPopover = document.getElementById('user-popover-menu');
    btnGoogleLogin = document.getElementById('btn-google-login');
    btnLogout = document.getElementById('btn-logout');
    googleAuthModal = document.getElementById('google-auth-modal');

    themeBtns = {
      system: document.getElementById('theme-btn-system'),
      light: document.getElementById('theme-btn-light'),
      dark: document.getElementById('theme-btn-dark')
    };

    // Áp dụng Theme đã lưu
    applyTheme(_currentThemeMode);

    // Khôi phục User nếu đã lưu
    if (window.StorageService) {
      _currentUser = window.StorageService.getCurrentUser();
    }
    renderUserState();

    // Thiết lập mở sidebar trên màn hình rộng
    if (window.innerWidth < 768) {
      closeSidebar();
    } else {
      openSidebar();
    }

    // Sự kiện Nút Con Mắt cố định
    eyeBtn?.addEventListener('click', toggleSidebar);

    // Sự kiện Nút New Chat
    document.getElementById('btn-new-chat-sidebar')?.addEventListener('click', () => {
      document.getElementById('btn-reset-chat')?.click();
    });

    // Sự kiện User Popover
    userTrigger?.addEventListener('click', toggleUserPopover);
    document.addEventListener('click', (e) => {
      if (!userPopover || userPopover.classList.contains('hidden')) return;
      if (!userPopover.contains(e.target) && !userTrigger?.contains(e.target)) {
        closeUserPopover();
      }
    });

    // Sự kiện nút chọn theme
    themeBtns.system?.addEventListener('click', () => applyTheme('system'));
    themeBtns.light?.addEventListener('click', () => applyTheme('light'));
    themeBtns.dark?.addEventListener('click', () => applyTheme('dark'));

    // Sự kiện Đăng nhập Google
    btnGoogleLogin?.addEventListener('click', handleGoogleLogin);
    btnLogout?.addEventListener('click', handleLogout);

    // Kích hoạt Google Identity Services
    initGoogleIdentity();

    // Xử lý modal đăng nhập Google
    document.getElementById('btn-close-google-modal')?.addEventListener('click', () => {
      googleAuthModal?.classList.add('hidden');
    });

    // Nút chọn tài khoản mô phỏng Google trong modal
    document.querySelectorAll('.mock-google-account-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name || 'Người dùng Google';
        const email = btn.dataset.email || 'user@gmail.com';
        const picture = btn.dataset.picture || null;
        completeGoogleSignIn({ name, email, picture });
      });
    });
  }

  return {
    init,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    addSession,
    completeGoogleSignIn,
    getCurrentUser: () => _currentUser
  };
})();

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => SidebarController.init());
window.SidebarController = SidebarController;
