const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const programsController = require('../controllers/programs');

// Route sécurisée : Mes programmes
router.get('/my-programs', protect, programsController.getMyPrograms);

// Route sécurisée : Les templates (On protège aussi pour éviter le scraping public)
router.get('/templates', protect, programsController.getTemplates);

module.exports = router;