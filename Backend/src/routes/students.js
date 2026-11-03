const express = require('express');
const student = require('../controllers/student');
const { authenticate, requireRole, idempotent } = require('../middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', requireRole('admin'), student.getAll);
router.get('/:id', student.getOne);
router.post('/', requireRole('admin'), idempotent, student.create);
router.patch('/:id', requireRole('admin'), student.update);
router.delete('/:id', requireRole('admin'), student.remove);

module.exports = router;
