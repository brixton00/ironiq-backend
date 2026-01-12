const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const programsController = require('../controllers/programs');

// GET /my-programs
router.get('/my-programs', protect, programsController.getMyPrograms);

// GET /templates
router.get('/templates', protect, programsController.getTemplates);

module.exports = router;