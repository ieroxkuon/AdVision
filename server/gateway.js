/**
 * =============================================================================
 * ADVISION API GATEWAY — server/gateway.js (SOA Architecture v2.0)
 * =============================================================================
 * Đóng vai trò là API GATEWAY trung tâm của hệ thống:
 *   - Định tuyến tập trung (Centralized Routing)
 *   - Phân giải static client assets từ thư mục ../client
 *   - Phục vụ file upload từ thư mục ../uploads
 *   - Gắn kết (Mount) các Service độc lập:
 *       ├─ Health Service  : GET  /api/health
 *       ├─ Upload Service  : POST /api/upload
 *       ├─ Analyze Service : POST /api/analyze & POST /api/analyze/chat
 * =============================================================================
 */

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Đường dẫn tới các tầng trong kiến trúc SOA
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const DATA_DIR   = path.join(__dirname, '..', 'data');

// ---------------------------------------------------------------------------
// MIDDLEWARE DÙNG CHUNG
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Phục vụ Client Presentation Tier
app.use(express.static(CLIENT_DIR));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/data', express.static(DATA_DIR));

// ---------------------------------------------------------------------------
// MOUNT CÁC ROUTE SERVICES (SOA Micro-services)
// ---------------------------------------------------------------------------
const healthRoute  = require('./routes/health');   // Health Service
const uploadRoute  = require('./routes/upload');   // Upload Service
const analyzeRoute = require('./routes/analyze');  // AI Analysis Service

app.use('/api/health',  healthRoute);
app.use('/api/upload',  uploadRoute);
app.use('/api/analyze', analyzeRoute);

// ---------------------------------------------------------------------------
// GLOBAL ERROR HANDLER
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[API Gateway Error]', err.message);
  res.status(500).json({ error: 'Lỗi API Gateway nội bộ', detail: err.message });
});

// ---------------------------------------------------------------------------
// KHỞI ĐỘNG SERVER (Local development)
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[🚀] AdVision SOA Gateway đang chạy tại: http://localhost:${PORT}`);
    console.log(`     ├─ Client UI: ${CLIENT_DIR}`);
    console.log(`     ├─ Health   : GET  /api/health`);
    console.log(`     ├─ Upload   : POST /api/upload`);
    console.log(`     ├─ Analyze  : POST /api/analyze`);
    console.log(`     └─ Chat     : POST /api/analyze/chat`);
  });
}

// Export cho môi trường Vercel Serverless Function
module.exports = app;

