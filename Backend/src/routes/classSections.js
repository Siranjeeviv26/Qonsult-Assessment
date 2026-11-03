const express = require('express');
const classSection = require('../controllers/classSection');
const { authenticate, requireRole } = require('../middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', classSection.getAll);
router.post('/', requireRole('admin'), classSection.create);
router.put('/:id', requireRole('admin'), classSection.update);

module.exports = router;
