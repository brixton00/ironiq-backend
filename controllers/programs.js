const Program = require('../models/programs');
const Template = require('../models/templates');
const WorkoutLog = require('../models/workoutLogs');

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

// endpoint route POST /log-dession
const logSession = async (req, res) => {
  try {
    // On récupère dayIndex depuis le frontend (ajouté à l'étape 3)
    const { programId, dayName, exercises, dayIndex } = req.body;

    // 1. Sauvegarde du Log (Historique)
    const newLog = new WorkoutLog({
      user: req.user._id,
      program: programId,
      dayName: dayName,
      exercises: exercises,
      date: new Date()
    });
    await newLog.save();

    // 2. Mise à jour sécurisée du Programme
    const program = await Program.findById(programId);

    // 🛡️ ANTI-ICHEAT : On ajoute l'index SEULEMENT s'il n'existe pas déjà
    // $addToSet de MongoDB ferait pareil, mais ici on le fait en JS pour vérifier la longueur ensuite
    if (!program.completedDays.includes(dayIndex)) {
      program.completedDays.push(dayIndex);
    }

    // Vérification : La semaine est finie si le nombre de jours UNIQUES validés >= Fréquence
    let isWeekComplete = false;
    if (program.completedDays.length >= program.frequency) {
      isWeekComplete = true;
      program.isWeekComplete = true; // On persiste l'état final
    }

    await program.save();

    res.json({ result: true, message: 'Séance enregistrée', isWeekComplete });

  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

// endpoint route DELETE /:id
const deleteProgram = async (req, res) => {
  try {
    // Sécurité : On vérifie que le programme appartient bien à l'utilisateur qui fait la requête
    const result = await Program.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.user._id 
    });

    if (!result) {
      return res.status(404).json({ result: false, error: "Programme introuvable ou non autorisé." });
    }

    // Optionnel : Nettoyage des logs associés (WorkoutLog) pour éviter les orphelins
    // await WorkoutLog.deleteMany({ program: req.params.id });

    res.json({ result: true, message: "Programme supprimé avec succès." });
  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

// endpoint route GET /history
const getHistory = async (req, res) => {
  try {
    // On récupère les logs de l'utilisateur, triés du plus récent au plus ancien
    // On limite à 14 jours pour ne pas surcharger le mobile inutilement pour ce calcul
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 14);

    const logs = await WorkoutLog.find({ 
      user: req.user._id,
      date: { $gte: limitDate }
    })
    .sort({ date: -1 });

    res.json({ result: true, logs });
  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

module.exports = { getMyPrograms, getTemplates, logSession, deleteProgram, getHistory };

