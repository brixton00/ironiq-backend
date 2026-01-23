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

// endpoint route POST /log-session
const logSession = async (req, res) => {
  try {
    // 1. Réception des données (Note : le front envoie 'dayName')
    const { programId, dayName, exercises, dayIndex, weekNumber } = req.body;

    // Validation basique
    if (!weekNumber && weekNumber !== 0) { // check strict pour accepter 0
      return res.status(400).json({ result: false, error: "WeekNumber manquant" });
    }

    // 2. Sauvegarde du Log (Historique)
    // ⚠️ CORRECTIF ICI : On mappe 'dayName' (reçu) vers 'sessionName' (attendu par le modèle)
    const newLog = new WorkoutLog({
      user: req.user._id,
      program: programId,
      sessionName: dayName, // <--- C'était ici le bug !
      exercises: exercises,
      weekNumber: weekNumber,
      date: new Date()
    });
    await newLog.save();

    // 3. Mise à jour du Programme
    const program = await Program.findById(programId);
    if (!program) return res.status(404).json({ result: false, error: "Programme introuvable" });

    // RECHERCHE DE LA SEMAINE ACTIVE
    const activeWeek = program.mesocycle.weeks.find(w => w.weekNumber === weekNumber);

    if (!activeWeek) {
      return res.status(404).json({ result: false, error: "Semaine introuvable dans le programme" });
    }

    // 🛡️ ANTI-ICHEAT & VALIDATION
    if (!activeWeek.completedSessions.includes(dayIndex)) {
      activeWeek.completedSessions.push(dayIndex);
    }

    // Vérification : La semaine est finie si le nombre de jours UNIQUES validés >= Fréquence
    let isWeekComplete = false;
    if (activeWeek.completedSessions.length >= program.frequency) {
      isWeekComplete = true;
      activeWeek.isWeekComplete = true; // On persiste l'état final sur la SEMAINE
    }

    // Important : on marque l'objet modifié pour que Mongoose détecte le changement
    program.markModified('mesocycle'); 
    await program.save();

    res.json({ result: true, message: 'Séance enregistrée', isWeekComplete });

  } catch (error) {
    console.error("Erreur logSession:", error);
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

