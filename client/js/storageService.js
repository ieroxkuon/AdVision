/**
 * =============================================================================
 * ADVISION STORAGE SERVICE — client/js/storageService.js (SOA Data Client)
 * =============================================================================
 * Chịu trách nhiệm lưu trữ và quản lý dữ liệu người dùng & lịch sử trò chuyện:
 *   - Sử dụng IndexedDB để lưu trữ dung lượng lớn (chứa cả hình ảnh base64).
 *   - QUY TẮC GIỚI HẠN AN TOÀN (Token & Quota Optimization):
 *       ├─ MAX_SESSIONS: Tối đa 10 phiên chat gần nhất (tự dọn dẹp phiên cũ)
 *       ├─ MAX_TURNS_PER_SESSION: Tối đa 12 lượt hội thoại gần nhất mỗi phiên
 *   - Hỗ trợ khôi phục đầy đủ tin nhắn và hình ảnh để người dùng tiếp tục chat.
 * =============================================================================
 */

const StorageService = (() => {
  const DB_NAME = 'AdVision_ClientDB';
  const DB_VERSION = 1;
  const STORE_SESSIONS = 'sessions';
  const STORE_USERS = 'users';

  // Giới hạn tiết kiệm token free
  const MAX_SESSIONS = 10;
  const MAX_TURNS_PER_SESSION = 12;

  let _dbPromise = null;

  // Khởi tạo và kết nối IndexedDB
  function getDb() {
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const sessionStore = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          sessionStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_USERS)) {
          db.createObjectStore(STORE_USERS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return _dbPromise;
  }

  // ---------------------------------------------------------------------------
  // QUẢN LÝ PHIÊN TRÒ CHUYỆN (SESSIONS)
  // ---------------------------------------------------------------------------

  /**
   * Lưu hoặc cập nhật phiên trò chuyện (Chỉ lưu với người dùng đã đăng nhập)
   * @param {Object} session { id, title, userId, activeImageData, conversationHistory, stage, updatedAt }
   */
  async function saveSession(session) {
    try {
      if (!session || !session.userId || session.userId === 'guest') {
        // Không lưu phiên của khách (Guest)
        return null;
      }

      const db = await getDb();

      // Giới hạn số lượng tin nhắn trong phiên để tránh tràn context token
      const history = session.conversationHistory || [];
      const trimmedHistory = history.length > MAX_TURNS_PER_SESSION
        ? history.slice(history.length - MAX_TURNS_PER_SESSION)
        : history;

      const record = {
        id: session.id || ('sess-' + Date.now()),
        title: session.title || 'Thẩm định hình ảnh quảng cáo',
        userId: session.userId,
        activeImageData: session.activeImageData || null,
        conversationHistory: trimmedHistory,
        stage: session.stage || 'image_overview',
        updatedAt: Date.now(),
        dateString: new Date().toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      };

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        const store = tx.objectStore(STORE_SESSIONS);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Tự động dọn dẹp các phiên cũ nếu vượt quá MAX_SESSIONS (10 phiên)
      await cleanupOldSessions(record.userId);

      return record;
    } catch (err) {
      console.warn('[StorageService] Không thể lưu IndexedDB:', err);
      return null;
    }
  }

  /**
   * Lấy danh sách phiên của người dùng (sắp xếp mới nhất lên đầu)
   * @param {string} userId ID của người dùng
   * @param {number} limit Giới hạn số lượng (mặc định 10 phiên, 0 là lấy hết)
   */
  async function getSessions(userId, limit = MAX_SESSIONS) {
    try {
      if (!userId || userId === 'guest') return [];

      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SESSIONS, 'readonly');
        const store = tx.objectStore(STORE_SESSIONS);
        const request = store.getAll();

        request.onsuccess = () => {
          let list = request.result || [];
          if (userId && userId !== 'all') {
            list = list.filter(item => item.userId === userId);
          }
          // Sắp xếp mới nhất lên trước
          list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          if (limit && limit > 0) {
            resolve(list.slice(0, limit));
          } else {
            resolve(list);
          }
        };

        request.onerror = () => resolve([]);
      });
    } catch (err) {
      return [];
    }
  }

  /**
   * Lấy chi tiết 1 phiên để tiếp tục trò chuyện
   */
  async function getSessionById(id) {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SESSIONS, 'readonly');
        const store = tx.objectStore(STORE_SESSIONS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      return null;
    }
  }

  /**
   * Xóa 1 phiên trò chuyện
   */
  async function deleteSession(id) {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        tx.objectStore(STORE_SESSIONS).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (err) {
      return false;
    }
  }

  /**
   * Dọn dẹp phiên cũ khi vượt quá giới hạn (Chỉ giữ đúng 10 phiên mới nhất)
   */
  async function cleanupOldSessions(userId) {
    try {
      const allSessions = await getSessions(userId, 0); // Lấy toàn bộ không giới hạn
      if (allSessions.length > MAX_SESSIONS) {
        const toDelete = allSessions.slice(MAX_SESSIONS);
        const db = await getDb();
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        const store = tx.objectStore(STORE_SESSIONS);
        toDelete.forEach(s => store.delete(s.id));
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // QUẢN LÝ DỮ LIỆU NGƯỜI DÙNG (USER PROFILE)
  // ---------------------------------------------------------------------------

  async function saveUser(user) {
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_USERS, 'readwrite');
      tx.objectStore(STORE_USERS).put(user);
      localStorage.setItem('adv_current_user', JSON.stringify(user));
    } catch (e) {
      localStorage.setItem('adv_current_user', JSON.stringify(user));
    }
  }

  function getCurrentUser() {
    try {
      const str = localStorage.getItem('adv_current_user');
      return str ? JSON.parse(str) : null;
    } catch (e) {
      return null;
    }
  }

  function clearCurrentUser() {
    localStorage.removeItem('adv_current_user');
  }

  return {
    MAX_SESSIONS,
    MAX_TURNS_PER_SESSION,
    saveSession,
    getSessions,
    getSessionById,
    deleteSession,
    saveUser,
    getCurrentUser,
    clearCurrentUser
  };
})();

window.StorageService = StorageService;

