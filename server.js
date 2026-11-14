/**
 * =============================================================================
 * ADVISION API GATEWAY — server.js (SOA Architecture v2.0)
 * =============================================================================
 * File này chỉ đóng vai trò API GATEWAY:
 *   - Khởi động Express server
 *   - Đăng ký middleware dùng chung (JSON parser, static files)
 *   - Mount các Route Service vào đúng đường dẫn
 *
 * Mỗi Service nằm trong routes/ và chịu trách nhiệm một việc duy nhất.
 * Nguyên lý SOA: Loose Coupling, Single Responsibility, Reusability.
 * =============================================================================
 */

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// MIDDLEWARE DÙNG CHUNG
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------------------------------------------------------------------
// MOUNT CÁC ROUTE SERVICE (SOA — mỗi route = 1 service độc lập)
// ---------------------------------------------------------------------------
const healthRoute  = require('./routes/health');   // Health-check Service
const uploadRoute  = require('./routes/upload');   // Upload Service
const analyzeRoute = require('./routes/analyze');  // AI Analysis Service
// Các service sẽ được thêm sau:
// const authRoute    = require('./routes/auth');   // Auth Service (S3.x)
// const sessionRoute = require('./routes/sessions'); // Session Service (S4.x)

app.use('/api/health',  healthRoute);
app.use('/api/upload',  uploadRoute);
app.use('/api/analyze', analyzeRoute);
// app.use('/api/auth',    authRoute);
// app.use('/api/sessions', sessionRoute);

// ---------------------------------------------------------------------------
// GLOBAL ERROR HANDLER
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[Gateway Error]', err.message);
  res.status(500).json({ error: 'Lỗi server nội bộ', detail: err.message });
});

// ---------------------------------------------------------------------------
// KHỞI ĐỘNG SERVER (khi chạy local)
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[🚀] AdVision SOA Gateway đang chạy tại: http://localhost:${PORT}`);
    console.log(`     ├─ Health  : GET  /api/health`);
    console.log(`     ├─ Upload  : POST /api/upload`);
    console.log(`     ├─ Analyze : POST /api/analyze`);
    console.log(`     └─ Chat    : POST /api/analyze/chat`);
  });
}

// Export cho môi trường Vercel Serverless
module.exports = app;
