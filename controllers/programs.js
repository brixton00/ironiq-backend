const Program = require('../models/programs');
const Template = require('../models/templates');

// endpoint route GET /my-programs
const getMyPrograms = async (req, res) => {
  try {
    const programs = await Program.find({ user: req.user._id })
      .sort({ createdAt: -1 }); 

    res.json({ result: true, programs });
  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

// endpoint route GET /templates
const getTemplates = async (req, res) => {
  try {
    const templates = await Template.find();
    res.json({ result: true, templates });
  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

module.exports = { getMyPrograms, getTemplates };