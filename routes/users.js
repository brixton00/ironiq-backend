const express = require('express');
const router = express.Router();
const userController = require('../controllers/users');
const { protect } = require('../middleware/auth');

router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, userController.updateProfile);

module.exports = router;