const express = require('express');
const router = express.Router();
const generatorController = require('../controllers/generator');
const { protect } = require('../middlewares/auth');

// POST /generate
router.post('/generate', protect, generatorController.generateProgram);

// POST /progress : update du programme
// router.post('/progress', protect, generatorController.updateProgram);

module.exports = router;