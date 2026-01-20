const express = require('express');
const router = express.Router();
const generatorController = require('../controllers/generator');
const { protect } = require('../middlewares/auth');

// POST /generate
router.post('/generate', protect, generatorController.generateProgram);

// POST /generate-next-week
router.post('/generate-next-week', protect, generatorController.generateNextWeek);

module.exports = router;