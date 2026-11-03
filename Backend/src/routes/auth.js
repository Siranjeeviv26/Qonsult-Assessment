const express = require('express');
const auth = require('../controllers/auth');

const router = express.Router();

router.post('/login', auth.limiter, auth.login);

module.exports = router;
