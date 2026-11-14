/**
 * =============================================================================
 * UPLOAD SERVICE — /api/upload
 * =============================================================================
 * Chịu trách nhiệm DUY NHẤT: nhận file ảnh từ client, lưu vào thư mục
 * uploads/, và trả về URL để các service khác dùng.
 *
 * Nguyên lý SOA áp dụng:
 * - Loose Coupling: Upload Service không biết gì về AI hay Auth.
 * - Single Responsibility: Chỉ xử lý file, không phân tích.
 * - Reusability: Bất kỳ service nào cũng có thể gọi endpoint này.
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const router = express.Router();

// --- Cấu hình lưu trữ ---
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh JPG, PNG, WebP'));
    }
  },
});

// POST /api/upload — Tải lên 1 file ảnh
router.post('/', upload.single('bannerImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Chưa tải lên file ảnh' });
  }

  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  res.json({
    success: true,
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    imageUrl,
  });
});

// Xử lý lỗi multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;

