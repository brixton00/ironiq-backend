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

const WorkoutLog = require('../models/workoutLogs');

// ... (fonctions existantes getMyPrograms, getTemplates)

const logSession = async (req, res) => {
  try {
    const { programId, dayName, exercises } = req.body;

    // Création du log de séance
    const newLog = new WorkoutLog({
      user: req.user._id,
      program: programId,
      dayName: dayName,
      exercises: exercises,
      date: new Date()
    });

    await newLog.save();

    // compte le nombre de logs pour ce programme)
    const logCount = await WorkoutLog.countDocuments({ user: req.user._id, program: programId });
    
    // récupère le programme pour connaître sa fréquence
    const program = await Program.findById(programId);
    
    // si nombre de séances faites >= fréquence hebdo -> SEMAINE TERMINÉE
    const isWeekComplete = logCount >= program.frequency;

    res.json({ result: true, message: 'Séance enregistrée', isWeekComplete });

  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

module.exports = { getMyPrograms, getTemplates, logSession };

