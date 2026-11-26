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
  let _activeRoute = null;

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
  let logoutConfirmModal = null;
  let btnCancelLogout = null;
  let btnConfirmLogout = null;

  // ---------------------------------------------------------------------------
  // 1. QUẢN LÝ THEME GIAO DIỆN (SYSTEM / LIGHT / DARK - PHONG CÁCH CLAUDE.AI)
  // ---------------------------------------------------------------------------
  function applyTheme(mode) {
    _currentThemeMode = mode;
    try { localStorage.setItem('adv_theme_mode', mode); } catch (e) { }

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
    try { localStorage.setItem('adv_sidebar_open', 'true'); } catch (e) { }
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('sidebar-collapsed');
    try { localStorage.setItem('adv_sidebar_open', 'false'); } catch (e) { }
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
    if (userPopover.classList.contains('hidden')) {
      window.AppRouter.navigate('/account');
    } else {
      closeUserPopover();
    }
  }

  function hideUserPopover() {
    if (userPopover && !userPopover.classList.contains('hidden')) {
      userPopover.classList.add('hidden');
    }
  }

  function closeUserPopover() {
    hideUserPopover();
    if (window.AppRouter.getCurrentRoute().name === 'account') {
      window.AppRouter.navigate('/', { replace: true, skipNewChat: true });
    }
  }

  function openLogoutConfirm() {
    closeUserPopover();
    logoutConfirmModal?.classList.remove('hidden');
    btnCancelLogout?.focus();
  }

  function closeLogoutConfirm() {
    if (logoutConfirmModal) logoutConfirmModal.classList.add('hidden');
    btnLogout?.focus();
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

      // Hiện duy nhất 1 nút Đăng nhập bằng Google chuẩn Claude, ẩn nút Đăng xuất
      if (btnGoogleLogin) btnGoogleLogin.classList.remove('hidden');
      if (btnLogout) btnLogout.classList.add('hidden');

      // Ẩn hoàn toàn thanh lịch sử trò chuyện khi chưa đăng nhập
      if (historySection) historySection.classList.add('hidden');
    }
  }

  let _tokenClient = null;

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

  // Lấy thông tin người dùng từ Google UserInfo API qua Access Token
  async function fetchGoogleUserInfo(accessToken) {
    try {
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const userInfo = await resp.json();
      if (userInfo && (userInfo.email || userInfo.sub)) {
        await completeGoogleSignIn({
          id: userInfo.sub || ('google-' + Date.now()),
          name: userInfo.name || userInfo.given_name || 'Người dùng Google',
          email: userInfo.email || 'user@gmail.com',
          picture: userInfo.picture || null,
          provider: 'google'
        });
      }
    } catch (err) {
      console.error('[Google OAuth] Lỗi fetch userinfo:', err);
    }
  }

  // Khởi tạo Google Identity Services (GIS) & OAuth 2.0 Token Client
  let _gisInitAttempts = 0;
  function initGoogleIdentity() {
    if (typeof google === 'undefined' || !google.accounts) {
      _gisInitAttempts++;
      if (_gisInitAttempts < 25) setTimeout(initGoogleIdentity, 400); // thử tối đa 10 giây
      return;
    }

    const clientId = (window.AdvConfig && AdvConfig.getGoogleClientId)
      ? AdvConfig.getGoogleClientId()
      : "748430716195-hk1kn197r5cdm18vs0vafsmv24532mrg.apps.googleusercontent.com";

    if (google.accounts.oauth2) {
      try {
        _tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              await fetchGoogleUserInfo(tokenResponse.access_token);
            } else if (tokenResponse && tokenResponse.error) {
              console.error('[Google OAuth] Token error:', tokenResponse.error);
              _showLoginError('Đăng nhập thất bại: ' + tokenResponse.error);
            }
          },
          error_callback: (err) => {
            console.error('[Google OAuth] GIS error:', err);
            if (err && err.type === 'popup_blocked_by_browser') {
              _fallbackToRedirect();
            } else if (err && (err.type === 'popup_failed_to_open' || err.type === 'unknown')) {
              _fallbackToRedirect();
            } else {
              _showLoginError('Popup bị chặn. Đang chuyển hướng…');
              setTimeout(_fallbackToRedirect, 800);
            }
          }
        });
      } catch (err) {
        console.warn('[Google OAuth Token Client]', err);
      }
    }
  }

  // Hiển thị toast lỗi đăng nhập
  function _showLoginError(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg z-[9999] transition-opacity duration-300';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 4000);
  }

  // Fallback: chuyển hướng thẳng sang Google OAuth (không dùng popup)
  function _fallbackToRedirect() {
    const clientId = (window.AdvConfig && AdvConfig.getGoogleClientId)
      ? AdvConfig.getGoogleClientId()
      : "748430716195-hk1kn197r5cdm18vs0vafsmv24532mrg.apps.googleusercontent.com";
    const redirectUri = window.location.origin + '/';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid profile email',
      prompt: 'select_account'
    });
    window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  }

  // Kiểm tra token từ URL hash (khi Google OAuth chuyển hướng về)
  function checkGoogleRedirectToken() {
    try {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          // Xóa hash trên URL để giữ thanh địa chỉ sạch đẹp
          history.replaceState(null, null, window.location.pathname + window.location.search);
          fetchGoogleUserInfo(token);
        }
      }
    } catch (e) { }
  }

  // Đăng nhập bằng Google (hỗ trợ cả Desktop và Mobile)
  function handleGoogleLogin() {
    closeUserPopover();

    // 1. Dùng GIS Token Client nếu đã khởi tạo thành công
    if (_tokenClient) {
      try {
        _tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (e) {
        console.warn('[Google OAuth] requestAccessToken thất bại, fallback redirect:', e);
        _fallbackToRedirect();
        return;
      }
    }

    // 2. GIS chưa khởi tạo xong → thử lại một lần inline
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      try {
        const clientId = (window.AdvConfig && AdvConfig.getGoogleClientId)
          ? AdvConfig.getGoogleClientId()
          : "748430716195-hk1kn197r5cdm18vs0vafsmv24532mrg.apps.googleusercontent.com";
        _tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              await fetchGoogleUserInfo(tokenResponse.access_token);
            } else if (tokenResponse && tokenResponse.error) {
              _showLoginError('Đăng nhập thất bại: ' + tokenResponse.error);
            }
          },
          error_callback: () => _fallbackToRedirect()
        });
        _tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('[Google OAuth] Inline init thất bại, fallback redirect:', err);
      }
    }

    // 3. Dự phòng cuối: redirect thẳng
    _fallbackToRedirect();
  }

  // Hoàn tất xác thực Google (nhận payload từ Google OAuth hoặc mô phỏng)
  async function completeGoogleSignIn(userProfile) {
    _currentUser = {
      id: userProfile.id || ('google-' + Date.now()),
      name: userProfile.name || 'Người dùng Google',
      email: userProfile.email || 'user@gmail.com',
      picture: userProfile.picture || null,
      provider: 'google',
      signedInAt: Date.now()
    };

    if (window.StorageService) {
      await window.StorageService.saveUser(_currentUser);
    }

    // Đồng bộ tên với AdVision để Hoàng An xưng hô đúng tên
    try {
      if (window.AdvConfig) {
        localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_NAME, _currentUser.name);
        if (window.AppController && window.AppController.state) {
          window.AppController.state.userName = _currentUser.name;
        }
      }
    } catch (e) { }

    window.location.replace(new URL('/', window.location.origin).toString());
  }

  // Đăng xuất
  function handleLogout() {
    closeLogoutConfirm();
    closeUserPopover();
    _currentUser = null;
    _sessions = [];
    if (window.StorageService) {
      window.StorageService.clearCurrentUser();
    }
    localStorage.removeItem(AdvConfig.STORAGE_KEYS.USER_NAME);
    localStorage.removeItem(AdvConfig.STORAGE_KEYS.USER_INDUSTRY);
    localStorage.removeItem(AdvConfig.STORAGE_KEYS.NAME_VARIATIONS);
    localStorage.removeItem('adv_user_platform');
    localStorage.removeItem('adv_campaign_goal');

    if (window.AppController?.state) {
      window.AppController.state.userName = '';
      window.AppController.state.userIndustry = '';
      window.AppController.state.userPlatform = '';
      window.AppController.state.nameVariations = [];
      window.AppController.state.campaignGoal = '';
    }

    renderUserState();
    window.location.replace(new URL('/', window.location.origin).toString());
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

      const sessionTitle = session.title || 'Phiên thẩm định';
      item.innerHTML = `
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <i class="fa-regular fa-message text-[#DA7756] text-[11px] shrink-0"></i>
          <span class="truncate font-medium" title="${sessionTitle}">${sessionTitle}</span>
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

  // Chọn 1 phiên để chat tiếp.
  async function selectSession(session, updateUrl = true) {
    if (!session) return;

    document.querySelectorAll('.sidebar-session-item').forEach(el => {
      el.classList.remove('bg-[#E5E2D9]', 'dark:bg-[#2C2B27]', 'active', 'ring-1', 'ring-[#DA7756]/30');
    });

    const activeEl = sessionList?.querySelector(`[data-session-id="${session.id}"]`);
    if (activeEl) activeEl.classList.add('bg-[#E5E2D9]', 'dark:bg-[#2C2B27]', 'active', 'ring-1', 'ring-[#DA7756]/30');

    if (updateUrl) {
      window.AppRouter.navigate(`/c/${encodeURIComponent(session.id)}`);
      return;
    }

    // Chuyển sang AppController để khôi phục tin nhắn & ảnh vào khung chat
    if (window.AppController && typeof window.AppController.restoreSession === 'function') {
      window.AppController.restoreSession(session);
    }
  }

  async function handleRouteChange(event) {
    const { route, state = {} } = event.detail;
    const previousRoute = _activeRoute;
    _activeRoute = route;

    if (route.name === 'notFound') {
      window.AppRouter.navigate('/', { replace: true, skipNewChat: true });
      return;
    }

    if (route.name === 'account') {
      userPopover?.classList.remove('hidden');
    } else {
      hideUserPopover();
    }

    if (route.name === 'chat') {
      if (!_currentUser || !window.StorageService || !route.sessionId) {
        window.AppRouter.navigate('/', { replace: true, skipNewChat: true });
        window.AppController?.startNewChat(false);
        return;
      }

      const session = await window.StorageService.getSessionById(route.sessionId);
      const currentRoute = window.AppRouter.getCurrentRoute();
      if (currentRoute.name !== 'chat' || currentRoute.sessionId !== route.sessionId) return;

      if (!session || session.userId !== _currentUser.id) {
        window.AppRouter.navigate('/', { replace: true, skipNewChat: true });
        window.AppController?.startNewChat(false);
        return;
      }

      if (route.legacy) {
        window.AppRouter.navigate(`/c/${encodeURIComponent(session.id)}`, { replace: true, skipNewChat: true });
        return;
      }
      selectSession(session, false);
      return;
    }

    if (previousRoute?.name === 'chat' && route.name === 'home' && _currentUser && !state.skipNewChat) {
      window.AppController?.startNewChat(false);
    }
  }

  // Thêm hoặc cập nhật session (CHỈ LƯU VỚI NGƯỜI ĐÃ ĐĂNG NHẬP)
  async function addSession(sessionData) {
    if (!window.StorageService || !_currentUser) return; // Chỉ người đăng nhập mới lưu lịch sử

    const saved = await window.StorageService.saveSession({
      ...sessionData,
      userId: _currentUser.id
    });

    if (saved) {
      const existingIdx = _sessions.findIndex(s => s.id === saved.id);
      if (existingIdx >= 0) {
        _sessions[existingIdx] = saved;
      } else {
        _sessions.unshift(saved);
      }
      // Giới hạn tối đa 10 bản chat
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
    logoutConfirmModal = document.getElementById('logout-confirm-modal');
    btnCancelLogout = document.getElementById('btn-cancel-logout');
    btnConfirmLogout = document.getElementById('btn-confirm-logout');

    themeBtns = {
      system: document.getElementById('theme-btn-system'),
      light: document.getElementById('theme-btn-light'),
      dark: document.getElementById('theme-btn-dark')
    };

    // Kiểm tra token nếu chuyển hướng về từ Google OAuth
    checkGoogleRedirectToken();

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

    // Sự kiện Nút New Chat (Tương tự Claude & ChatGPT)
    document.getElementById('btn-new-chat-sidebar')?.addEventListener('click', () => {
      if (!window.confirm('Bạn có muốn bắt đầu lại cuộc trò chuyện và nhập lại thông tin từ đầu không?')) return;
      window.AppController?.startNewChat();
    });

    window.addEventListener('app:routechange', (event) => {
      void handleRouteChange(event);
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

    // Sự kiện Cài đặt API Key từ menu người dùng
    document.getElementById('btn-api-key-modal')?.addEventListener('click', closeUserPopover);

    // Sự kiện Đăng nhập Google
    btnGoogleLogin?.addEventListener('click', handleGoogleLogin);
    btnLogout?.addEventListener('click', openLogoutConfirm);
    btnCancelLogout?.addEventListener('click', closeLogoutConfirm);
    btnConfirmLogout?.addEventListener('click', handleLogout);
    logoutConfirmModal?.addEventListener('click', (e) => {
      if (e.target === logoutConfirmModal) closeLogoutConfirm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && logoutConfirmModal && !logoutConfirmModal.classList.contains('hidden')) {
        closeLogoutConfirm();
      }
    });

    // Kích hoạt Google Identity Services (Google OAuth 2.0 Token Client)
    initGoogleIdentity();
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
