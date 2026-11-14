/**
 * =============================================================================
 * SIDEBAR CONTROLLER — js/sidebar.js
 * =============================================================================
 * Quản lý toàn bộ hành vi của Sidebar:
 *   - Mở / đóng (toggle) sidebar
 *   - Nút "Trò chuyện mới"
 *   - Hiển thị / ẩn khu lịch sử theo trạng thái đăng nhập
 *   - Render danh sách session (khi đã đăng nhập)
 *   - Mở Auth Modal (khi chưa đăng nhập)
 *   - Nút đăng xuất
 *
 * Trạng thái người dùng được lưu tạm trong localStorage.
 * (Sẽ được thay bằng JWT + API call ở Task S3.x)
 * =============================================================================
 */

const SidebarController = (() => {

  // ---------------------------------------------------------------------------
  // STATE (sẽ được nâng cấp thành Auth Service call ở S3.x)
  // ---------------------------------------------------------------------------
  let _currentUser = null; // null = chưa đăng nhập
  let _sessions    = [];   // Danh sách phiên hội thoại

  // ---------------------------------------------------------------------------
  // DOM ELEMENTS
  // ---------------------------------------------------------------------------
  const sidebar          = document.getElementById('sidebar');
  const btnToggle        = document.getElementById('btn-sidebar-toggle');
  const btnClose         = document.getElementById('btn-sidebar-close');
  const btnNewChat       = document.getElementById('btn-new-chat-sidebar');
  const historySection   = document.getElementById('sidebar-history-section');
  const sessionList      = document.getElementById('sidebar-session-list');
  const noHistoryMsg     = document.getElementById('sidebar-no-history');
  const authGuestBlock   = document.getElementById('sidebar-auth-guest');
  const authUserBlock    = document.getElementById('sidebar-auth-user');
  const sidebarUsername  = document.getElementById('sidebar-username');
  const btnOpenAuth      = document.getElementById('btn-open-auth-modal');
  const btnLogout        = document.getElementById('btn-logout');
  const authModal        = document.getElementById('auth-modal');
  const btnCloseAuth     = document.getElementById('btn-close-auth-modal');
  const btnCloseAuth2    = document.getElementById('btn-close-auth-modal-2');

  // ---------------------------------------------------------------------------
  // SIDEBAR OPEN / CLOSE
  // ---------------------------------------------------------------------------
  function openSidebar() {
    sidebar.classList.remove('sidebar-collapsed');
    try { localStorage.setItem('adv_sidebar_open', 'true'); } catch(e) {}
  }

  function closeSidebar() {
    sidebar.classList.add('sidebar-collapsed');
    try { localStorage.setItem('adv_sidebar_open', 'false'); } catch(e) {}
  }

  function toggleSidebar() {
    if (sidebar.classList.contains('sidebar-collapsed')) {
      openSidebar();
    } else {
      closeSidebar();
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER TRẠNG THÁI ĐĂNG NHẬP
  // ---------------------------------------------------------------------------
  function renderAuthState() {
    if (_currentUser) {
      // Đã đăng nhập
      authGuestBlock.classList.add('hidden');
      authUserBlock.classList.remove('hidden');
      authUserBlock.classList.add('flex');
      sidebarUsername.textContent = _currentUser.name || _currentUser.email || 'Người dùng';
      historySection.classList.remove('hidden'); // Hiện khu lịch sử
      renderSessions();
    } else {
      // Chưa đăng nhập
      authGuestBlock.classList.remove('hidden');
      authUserBlock.classList.add('hidden');
      authUserBlock.classList.remove('flex');
      historySection.classList.add('hidden'); // Ẩn khu lịch sử
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER DANH SÁCH SESSION
  // ---------------------------------------------------------------------------
  function renderSessions() {
    // Xóa các item cũ (giữ lại #sidebar-no-history)
    const items = sessionList.querySelectorAll('.sidebar-session-item');
    items.forEach(el => el.remove());

    if (_sessions.length === 0) {
      noHistoryMsg.classList.remove('hidden');
      return;
    }

    noHistoryMsg.classList.add('hidden');

    _sessions.forEach((session, idx) => {
      const item = document.createElement('div');
      item.className = 'sidebar-session-item flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-300';
      item.dataset.sessionId = session.id;
      item.innerHTML = `
        <i class="fa-regular fa-image text-slate-400 shrink-0 text-[11px]"></i>
        <span class="truncate flex-1">${session.title || 'Phiên phân tích ' + (idx + 1)}</span>
        <span class="text-[10px] text-slate-400 shrink-0">${session.date || ''}</span>
      `;
      item.addEventListener('click', () => loadSession(session));
      sessionList.appendChild(item);
    });
  }

  // ---------------------------------------------------------------------------
  // LOAD SESSION (placeholder — sẽ kết nối Session Service ở S4.x)
  // ---------------------------------------------------------------------------
  function loadSession(session) {
    // Highlight item đang chọn
    document.querySelectorAll('.sidebar-session-item').forEach(el => el.classList.remove('active'));
    const target = sessionList.querySelector(`[data-session-id="${session.id}"]`);
    if (target) target.classList.add('active');

    // TODO (Task S4.x): Gọi Session Service để khôi phục hội thoại
    console.log('[Sidebar] Load session:', session.id);
    // Tạm thời thông báo
    if (window.UiController?.showSystemNotice) {
      window.UiController.showSystemNotice('Đang tải lịch sử phiên... (Tính năng hoàn chỉnh ở Task S4.x)');
    }
  }

  // ---------------------------------------------------------------------------
  // THÊM SESSION MỚI VÀO DANH SÁCH (gọi từ app.js sau mỗi phân tích)
  // ---------------------------------------------------------------------------
  function addSession(session) {
    _sessions.unshift(session); // Thêm vào đầu danh sách
    renderSessions();
  }

  // ---------------------------------------------------------------------------
  // AUTH MODAL
  // ---------------------------------------------------------------------------
  function openAuthModal() {
    authModal.classList.remove('hidden');
  }

  function closeAuthModal() {
    authModal.classList.add('hidden');
  }

  // ---------------------------------------------------------------------------
  // ĐĂNG XUẤT (placeholder — sẽ gọi Auth Service ở S3.x)
  // ---------------------------------------------------------------------------
  function logout() {
    _currentUser = null;
    _sessions    = [];
    localStorage.removeItem('adv_user');
    renderAuthState();
  }

  // ---------------------------------------------------------------------------
  // KHỞI TẠO: Phục hồi user từ localStorage (placeholder cho Auth)
  // ---------------------------------------------------------------------------
  function init() {
    // Thử đọc user từ localStorage (sẽ được thay bằng JWT verify ở S3.x)
    try {
      const stored = localStorage.getItem('adv_user');
      if (stored) {
        _currentUser = JSON.parse(stored);
      }
    } catch (e) {
      _currentUser = null;
    }

    renderAuthState();

    // Mặc định: sidebar mở trên desktop, đóng trên mobile
    if (window.innerWidth < 768) {
      closeSidebar();
    } else {
      openSidebar();
    }

    // ---- Event listeners ----
    btnToggle?.addEventListener('click', toggleSidebar);
    btnClose?.addEventListener('click', closeSidebar);

    btnNewChat?.addEventListener('click', () => {
      // Gọi hàm reset chat hiện có của app.js
      document.getElementById('btn-reset-chat')?.click();
    });

    btnOpenAuth?.addEventListener('click', openAuthModal);
    btnCloseAuth?.addEventListener('click', closeAuthModal);
    btnCloseAuth2?.addEventListener('click', closeAuthModal);

    btnLogout?.addEventListener('click', logout);

    // Form đăng nhập
    const authForm = document.getElementById('auth-form');
    authForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputName = document.getElementById('auth-input-name');
      const nameVal = inputName ? inputName.value.trim() : '';
      if (!nameVal) return;

      setUser({ name: nameVal });

      // Đồng bộ tên với AdvConfig để AI Agent Hoàng An biết tên người dùng
      try {
        if (window.AdvConfig && !localStorage.getItem(AdvConfig.STORAGE_KEYS.USER_NAME)) {
          localStorage.setItem(AdvConfig.STORAGE_KEYS.USER_NAME, nameVal);
          if (window.AppController && window.AppController.state) {
            window.AppController.state.userName = nameVal;
          }
        }
      } catch (err) {}

      // Thêm 1 session mẫu ban đầu nếu danh sách rỗng để người dùng thấy ngay giao diện lịch sử
      if (_sessions.length === 0) {
        addSession({
          id: 'demo-' + Date.now(),
          title: 'Chiến dịch Gà rán giòn cay (F&B)',
          date: 'Hôm nay'
        });
      }

      closeAuthModal();
      if (inputName) inputName.value = '';
    });

    // Đóng auth modal khi click backdrop
    authModal?.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------
  return {
    init,
    addSession,
    openSidebar,
    closeSidebar,
    // Cho phép app.js "đăng nhập" tạm thời (sẽ thay bằng Auth Service)
    setUser(user) {
      _currentUser = user;
      if (user) localStorage.setItem('adv_user', JSON.stringify(user));
      renderAuthState();
    },
    getCurrentUser() {
      return _currentUser;
    },
  };

})();

// Tự khởi động khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => SidebarController.init());

// Expose toàn cục để các module khác dùng
window.SidebarController = SidebarController;

