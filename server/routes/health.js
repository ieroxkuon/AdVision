/**
 * =============================================================================
 * HEALTH SERVICE — /api/health
 * =============================================================================
 * Kiểm tra trạng thái hoạt động của server.
 * Đây là service nhỏ nhất trong kiến trúc SOA — minh họa nguyên lý
 * "Single Responsibility": mỗi route chỉ làm đúng một việc.
 */

const express = require('express');
const router = express.Router();

// GET /api/health — Ping để kiểm tra server còn sống không
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AdVision API',
    version: '2.0.0-soa',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

