const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth');

// POST /signup 
router.post('/signup', authController.signup);

// POST /verify 
router.post('/verify', authController.verify);

// POST /signin 
router.post('/signin', authController.signin);

module.exports = router;