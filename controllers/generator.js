const OpenAI = require('openai');
const { z } = require('zod');
const { zodResponseFormat } = require('openai/helpers/zod');
const Program = require('../models/programs');
const WorkoutLog = require('../models/workoutLogs');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// DÉFINITION DES SCHÉMAS ZOD
const ExerciseSchema = z.object({
  exercise_name: z.string().describe("Le nom spécifique et standardisé de l'exercice."),
  sets: z.number().describe("Nombre de séries de travail, compris entre 2 et 6"),
  reps: z.string().describe("Plage de répétitions cible, ex: '🎯 8-12 reps' ou '🎯 5 reps'"),
  intensity_target: z.number().describe("L'intensité cible, ex: '8'"),
  percentage_1rm: z.number().nullable().describe("Pourcentage du 1RM pour les exercices pertinents, ex: '0.75' pour 75% de la charge maximale"),
  set_type: z.string().nullable().describe("'Top Set(s)' ou 'Back-off Set(s)', uniquement si pertinence de programmation"),
  load: z.number().nullable().describe("Charge calculée en kg, d'après % du 1RM et/ou RPE si possible, sinon 'null'"),
  rest: z.number().describe("Intervalle de repos en secondes"),
  notes: z.string().describe("Indices (cues) pour la forme, le focus biomécanique ou l'optimisation de l'éxécution de l'exercice"),
  substitution_reason: z.string().nullable().describe("Si un exercice standard a été substitué pour cause de blessure/équipement, rappelez lequel et expliquez pourquoi ici. Sinon null."),
});

const SessionSchema = z.object({
  session_name: z.string().describe("ex: 'Session #1'"),
  session_focus: z.string().describe("Focus primaire, ex: 'Force Haut du Corps' ou 'Hypertrophie Jambes'"),
  exercises_list: z.array(ExerciseSchema).describe("Liste ordonnée des exercices pour la session"),
});

// GÉNÉRATION INITIALE
const InitialPlanSchema = z.object({
  reasoning: z.string(),
  program_name: z.string().describe("Un nom créatif et scientifique pour le programme"),
  mesocycle_overview: z.string("Description générale des objectifs et/ou de la structure du mesocycle"),
  total_duration_weeks: z.number().int().min(4).max(12),
  // détails UNIQUEMENT pour la semaine 1
  first_week_detailed: z.object({
    week_number: z.number().int(),
    overview: z.string().describe("Bref aperçu des objectifs de la semaine"),
    sessions_list: z.array(SessionSchema).describe("Liste des séances pour cette semaine")
  }),
  // Architecture des semaines suivantes
  future_weeks_plan: z.array(z.object({
    week_number: z.number().int(),
    overview: z.string().describe("Bref aperçu des objectifs de la semaine")
  }))
});

// GÉNÉRATION SEMAINE N
const NextWeekSchema = z.object({
  overview: z.string(),
  sessions_list: z.array(SessionSchema)
});

// LOGIQUE MÉTIER

/* endpoint route POST /generate : création du template mesocycle*/
const generateProgram = async (req, res) => {
  try {
    const userId = req.user._id; 
    const { userData } = req.body;

    const DYNAMIC_USER_PROMPT = `
    Génère moi un plan d'entrainement en résistance d'après les données de mon profil utilisateur.
    Profil Utilisateur :
    - Age : ${userData.age}
    - Sexe : ${userData.gender}
    - Objectif : ${userData.goal}
    - Contexte calorique : ${userData.kcal}
    - Fréquence d'entrainement souhaitée : ${userData.frequency}
    - Niveau de pratique : ${userData.level}
    - Split souhaité : ${userData.split || "Libre"}
    - Blessure(s)/Douleur(s) : ${userData.injuries ? userData.injuries.join(', ') : "Aucune"}
    - Équipement disponible : ${userData.equipment}
    - Temps disponible par séance : ${userData.timeAvailable}
    - Spécialisation(s) : ${userData.anatomicalFocus ? userData.anatomicalFocus.join(', ') : "Aucune(s)"}
    - Exercices à exclure : ${userData.exercisesToExclude ? userData.exercisesToExclude.join(', ') : "Aucun"}
    - Exercices à inclure : ${userData.exercisesToInclude ? userData.exercisesToInclude.join(', ') : "Aucun"}
    - Requetes particulières : ${userData.inquiries ? userData.inquiries.join(', ') : "Aucune"}
    `;

    
    let DYNAMIC_SYSTEM_PROMPT = `
    RÔLE/
    Vous êtes un Coach de Force et Conditionnement d'élite et un Physiologiste de l'Hypertrophie musculaire. Votre programmation est strictement basée sur les méta-analyses actuelles (Schoenfeld, Helms, Israetel etc.). Vous rejetez les mythes populaires au profit de la biomécanique appliquée.
    OBJECTIF/
    Générer un programme d'entraînement en résistance scientifique et détaillé pour l'utilisateur, basé sur son profil spécifique et les informations fournies. La sortie doit être un objet JSON structuré respectant strictement le schéma fourni.
    PRINCIPES SCIENTIFIQUES & HEURISTIQUES/
    1. Sélection d'Exercices :
    ◦ Incluez le concept de SFR (Stimulus to Fatigue Ratio) pour la sélection d'exercices et suivant le niveau de l'athlète, en vue d'une augmentation future potentielle du volume d'entraînement sur les groupes musculaires qui font l'objet d'une spécialisation.
    ◦ Les exercices ciblant les groupes musculaires faisant l'objet d'un focus/spécialisation doivent être effectués en premier dans la séance (ou juste après les "exercices de force").
    ◦ Optimisez l'ordre des séances et des exercices en fonction des objectifs et focus pour éviter les effets d'interférences qui réduiraient la performance.
    ◦ Evitez au maximum d'inclure plus de 6-7 exercices par séance.
    2. Gestion du Volume d'Entraînement :
    ◦ Basez vous sur les concepts de MEV (Minimum Effective Volume), MAV (Maximum Adaptative Volume) et MRV (Maximum Recoverable Volume) pour déterminer le volume d'entraînement par groupe musculaire.
    ◦ Assignez un volume cohérent pour un début de mésocycle, à chaque exercice et d'après les données utilisateur, notamment objectif (force ou hypertrophie) et niveau de pratique.
    ◦ Assignez un volume correspondant à la valeur moyenne de la fourchette MAV si le groupe musculaire est cité en focus musculaire.
    ◦ Évitez les variations inutiles d'exercices, sauf si celles-ci ont un bénéfice direct (permettent de travailler un faisceau spécifique non couvert, régulation intensité, transfert immédiat sur les performances du mouvement principal etc.).
    3. Fréquence & Split (Helms) :
    ◦ Priorisez une fréquence de 2x/semaine par groupe musculaire - au minimum.
    ◦ Essayez de répartir le nombre de séries de travail sur un même groupe musculaire sur les différentes séances possibles.
    ◦ Jamais plus de 10 séries de travail par groupe musculaire et par séance.
    ◦ Respectez au maximum la règle des 48h de repos minimum entre deux sollicitations du même groupe musculaire, ajustez cette règle d'après le volume et la fréquence d'entrainement.
    4. Intensité & Autorégulation (Zourdos) :
    ◦ Utilisez le RPE (Rate of Perceived Exertion).
    ◦ Mouvements Composés : RPE 7-8-9 (1-3 RIR) pour gérer la fatigue systémique.
    ◦ Mouvements d'Isolation : RPE 9-10 (0-1 RIR) pour maximiser le stress métabolique.
    5. Biomécanique & Gestion des Blessures :
    ◦ Adhérez strictement aux contraintes de blessures de l'utilisateur.
    ◦ Douleur Lombaire : Substituez la charge axiale (Squats/Deadlifts) par des variantes supportées (Leg Press, Chest-Supported Rows, Trap Bar).
    ◦ Douleur au Genou : Réduisez les angles de flexion du genou sous charge ; priorisez les mouvements dominants hanches ou extensions terminales.
    ◦ Douleur Épaule : Évitez la rotation interne sous charge ; priorisez le pressing prise neutre.
    INSTRUCTIONS DE GÉNÉRATION
    1. Étape 1 : Analyse (Chain of Thought) :
    ◦ Dans le champ reasoning, vous DEVEZ d'abord analyser les entrées utilisateur. Sélectionnez les exercices adaptés, calculez leurs besoins en volume, sélectionnez le split approprié si non imposé, et justifiez explicitement les substitutions d'exercices basées sur les blessures ou l'équipement.
    2. Étape 2 : Construction du Programme :
    ◦ Peuplez l'objet program.
    ◦ Assurez-vous que chaque session a un focus spécifique.
    ◦ En l'absence de focus anatomique particulier, assurez-vous que l'ordre des exercices suit la logique : Neural/Composé -> Mécanique/Supporté -> Métabolique/Isolation.
    FORMATAGE STRICT
    • La sortie DOIT être un JSON valide correspondant au schéma défini.
    • Ne produisez aucun texte markdown en dehors du JSON.
    • Tous les champs sont requis.
    `;

    if (userData.goal === 'Force') {
      DYNAMIC_SYSTEM_PROMPT += `
      NOTES ADDITIONNELLES
      ◦ Si l'objectif est le développement de la force sur un exercice, fournir également le % cible par rapport à la charge maximale. 
      ◦ Incluez la possibilité de prescrire des Top Sets sur les exercices suivants: Squat et variations, Bench press, Weighted Dip, Weighted Pull-up, «Comp» Deadlift, Barbell Overhead Press et variations directes. Le Top Set sera compté comme un exercice à part avant les Back-Off Sets de la même séance.
      ◦ Pour la Force, priorisez l'intensité (>85% 1RM) sur le volume, à minima sur la séance principale (si séances axées force vs volume).
      ◦ Si l'objectif est le développement de la force sur un exercice, priorisez une fréquence de 2x/semaine au minimum sur cet exercice ou une variation directe, ou plus (selon le niveau de l'utilisateur) afin de travailler le pattern moteur.
      `;
    } 
    else if (userData.goal === 'Hypertrophie') {
      DYNAMIC_SYSTEM_PROMPT += `
      NOTES ADDITIONNELLES
      ◦ Chaque groupe musculaire doit être travaillé au minimum au MEV, même si le volume est indirect.
      ◦ Assignz au minimum un exercice de travail direct par groupe musculaire et par semaine.
      `;
    }

    //console.log("Génération en cours pour l'utilisateur authentifié :", userId);

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        { 
          role: "system", 
          content: DYNAMIC_SYSTEM_PROMPT
          },
        { 
          role: "user", 
          content: DYNAMIC_USER_PROMPT 
        },
      ],
      response_format: zodResponseFormat(InitialPlanSchema, "initial_plan"),
    });

    const message = completion.choices[0].message;

    if (message.refusal) {
      console.warn("Refus du modèle:", message.refusal);
      return res.status(400).json({ 
        result: false, 
        error: "Génération refusée: contenu inapproprié." 
      });
    }

    const generatedData = message.parsed;

    const weeks = [];

    // transformation des clefs snake_case (zod) en camelCase (mongoose)
    const mappedSessionsWeek1 = generatedData.first_week_detailed.sessions_list.map(session => ({
      sessionName: session.session_name,   
      focus: session.session_focus,    
      exercises: session.exercises_list.map(ex => ({ 
        name: ex.exercise_name,
        sets: ex.sets,
        reps: ex.reps,
        load: ex.load || null,
        intensityTarget: ex.intensity_target,
        percentage1RM: ex.percentage_1rm || null,
        setType: ex.set_type || null,
        rest: ex.rest,
        notes: ex.notes,
        substitutionReason: ex.substitution_reason || null
      }))
    }));

    // Semaine 1
    weeks.push({
      weekNumber: 1,
      overview: generatedData.first_week_detailed.overview,
      sessions: mappedSessionsWeek1,
      isGenerated: true
    });

    // Semaines futures
    generatedData.future_weeks_plan.forEach(week => {
      weeks.push({
        weekNumber: week.week_number,
        overview: week.overview,
        sessions: [],
        isGenerated: false
      });
    });

    const newProgram = new Program({

      user: userId,

      gender: userData.gender,
      age: userData.age,
      goal: userData.goal, 
      frequency: userData.frequency,
      level: userData.level,
      split: userData.split,
      anatomicalFocus: userData.anatomicalFocus,
      kcal: userData.kcal,
      equipment: userData.equipment,
      timeAvailable: userData.timeAvailable,
      exercisesToInclude: userData.exercisesToInclude,
      exercisesToExclude: userData.exercisesToExclude,
      injuries: userData.injuries,
      inquiries: userData.inquiries,

      programName: generatedData.program_name,
      totalDurationWeeks: generatedData.total_duration_weeks,
      aiReasoning: generatedData.reasoning,
      mesocycle: {
        overview: generatedData.mesocycle_overview,
        weeks: weeks
      },

      isActive: true,
      createdAt: new Date()
    });

    const savedProgram = await newProgram.save();
    console.log(`Programme sauvegardé en BDD (ID: ${savedProgram._id} - ${savedProgram.programName})`);

    res.json({ result: true, program: savedProgram });

  } catch (error) {
    console.error("Erreur Génération:", error);
    res.status(500).json({ result: false, error: "Échec de la génération structurée." });
  }
};

/* endpoint route POST /progress : update du programme*/
const generateNextWeek = async (req, res) => {
  try {
    const userId = req.user._id; 
    const { programId, userFeedback } = req.body;

    // récupération du programme cible + vérification
    const program = await Program.findOne({ _id: programId, user: userId });
    if (!program) return res.status(404).json({ result: false, error: "Programme introuvable." });

    // identification de la semaine cible + vérification complétude
    const targetWeekIndex = program.mesocycle.weeks.findIndex(w => !w.isGenerated);
    if (targetWeekIndex === -1) {
      return res.json({ result: false, error: "Toutes les semaines sont déjà générées !" });
    }

    const targetWeek = program.mesocycle.weeks[targetWeekIndex];
    const weekNumber = targetWeek.weekNumber;
    console.log(`Génération de la Semaine #${weekNumber} pour ${programId}...`);

    const lastWeekNumber = targetWeek.weekNumber - 1;
    const lastWeekLogs = await WorkoutLog.find({ 
      program: programId, 
      weekNumber: lastWeekNumber 
      });

      // récupération de la structure prévue de la semaine précédente (écoulée)
      const lastWeekStructure = program.mesocycle.weeks.find(w => w.weekNumber === lastWeekNumber);

      // récupération du nombre de séances prévues de la semaine écoulée
      const totalPlannedSessions = lastWeekStructure ? lastWeekStructure.sessions.length : 0;
      let weeklyComplianceScore = 0; 

      // rapport "plan vs réalité"
      const performanceAnalysis = lastWeekStructure ? lastWeekStructure.sessions.map((plannedSession, index) => {

        // recherche du log correspondant d'après le nom de séance
        const matchingLog = lastWeekLogs.find(log => log.sessionName === plannedSession.sessionName);

        // cas log absent aka séance non réalisée
        if (!matchingLog) {
          return `SÉANCE #${index + 1} - '${plannedSession.sessionName}' : NON RÉALISÉE.`;
        }

        // cas séance réalisée
        let sessionReport = `SÉANCE #${index + 1} - '${plannedSession.sessionName}' : RÉALISÉE.`;
        let exerciseDetails = [];

        plannedSession.exercises.forEach((plannedEx, i) => {
          //recherche d'un exercice spécifique dans le log
          const actualEx = matchingLog.exercises.find(e => e.exerciseName === plannedEx.name && e.setType === plannedEx.setType);

          if (!actualEx) {
           exerciseDetails.push(`   - ${plannedEx.name} - ${plannedEx.setType} : NON RÉALISÉ.`);
           return;
          }

          // données de volume validées uniquement
          const validSets = actualEx.sets.filter(s => s.validated);
          const volumeDone = validSets.length;
          const volumePlanned = plannedEx.sets;

          // calcul du rpe moyen par exercice d'après l'ensemble des séries réalisées
          const avgActualRpe = validSets.length > 0 
          ? (validSets.reduce((acc, set) => acc + (set.intensityReached || 0), 0) / validSets.length)
          : 0;

          // garde 1 chiffre après la virgule (UI)
          const formattedActualRpe = Number(avgActualRpe.toFixed(1));

          // récupération rpe prévu
          const targetRpe = plannedEx.intensityTarget || 0;

          // calcul de la charge moyenne par exercice d'après l'ensemble des séries réalisées
          const avgActualWeight = validSets.length > 0 
          ? (validSets.reduce((acc, set) => acc + (set.weight || 0), 0) / validSets.length)
          : 0;
          const formattedActualWeight = Number(avgActualWeight.toFixed(1));

          let exStatusParts = [];

          // ANALYSE DES DELTAS

          // volume (nombre de séries)
          if (volumeDone < volumePlanned) exStatusParts.push(`Volume incomplet (${volumeDone}/${volumePlanned} sets)`);

          // charge
          if (plannedEx.load && formattedActualWeight) {
             const diff = formattedActualWeight - plannedEx.load;
             if (diff > 0) exStatusParts.push(`Charge moyenne +${diff}kg`);
             else if (diff < 0) exStatusParts.push(`Charge moyenne -${Math.abs(diff)}kg`);
          }
          
          // intensité
          if (targetRpe > 0 && formattedActualRpe > 0) {
            const deltaRpe = formattedActualRpe - targetRpe;
            if (deltaRpe >= 1) exStatusParts.push(`RPE OVERSHOOT (${avgRpeActual.toFixed(1)} vs ${targetRpe})`);
            else if (deltaRpe <= -1) exStatusParts.push(`RPE UNDERSHOOT (${avgRpeActual.toFixed(1)} vs ${targetRpe})`);
          }

          // compilation du rapport l'exercice spécifique
          if (exStatusParts.length > 0) {
            exerciseDetails.push(`   - ${plannedEx.name}: ${exStatusParts.join(', ')}`);
          }
        });

      // rapport de séance
      if (exerciseDetails.length > 0) {
        sessionReport += `\n${exerciseDetails.join('\n')}`;
      } 
      else {
        sessionReport += ` (Parfaite conformité)`;
      }

      return sessionReport;

    }) : ["Données de la structure de la semaine précédente introuvables."];

      const context = {
        user_profile:{
          age: program.age,
          gender: program.gender,
          level: program.level,
          injuries: program.injuries || "Aucune",
          goal: program.goal,
          kcal: program.kcal,
          time_available: program.timeAvailable,
        },
        program_context: {
          mesocycle_overview: program.mesocycle.overview,
          current_week_number: targetWeek.week_number,
          week_goal: targetWeek.overview,
          total_duration: program.totalDurationWeeks,
          frequency: program.frequency,
          split: program.split,
          anatomical_focus: program.anatomicalFocus,
          equipment: program.equipment,
          exercises_to_include: program.exercisesToInclude,
          exercises_to_exclude: program.exercisesToExclude,
          inquiries: program.inquiries,
        },
        last_week_feedback: {
          completed_sessions: lastWeekLogs.length,
          missed_sessions: totalPlannedSessions - weeklyComplianceScore,
          sessions_detailed_report: performanceAnalysis,
          //intensity_issues: hasIntensityIssues,
          user_qualitative_feedback: userFeedback || "L'utilisateur n'a rien signalé (Récupération et énergie supposées normales).",
        },
      };
        
        const DYNAMIC_USER_PROMPT = `
        Voici les données consolidées pour la semaine d'entrainement suivante à générer (Format JSON) :
        ${JSON.stringify(context, null, 2)}

        INSTRUCTIONS DE PROGRESSION :
        1. Analyse le 'last_week_feedback' pour appliquer ou non la surcharge progressive.
        3. Génère la Semaine #${targetWeek.weekNumber} en respectant strictement le 'program_context' (split, focus, frequency etc.).
        `;

        let DYNAMIC_SYSTEM_PROMPT = `
    RÔLE/
    Vous êtes un Coach de Force et Conditionnement d'élite et un Physiologiste de l'Hypertrophie musculaire. Votre programmation est strictement basée sur les méta-analyses actuelles (Schoenfeld, Helms, Israetel etc.). Vous rejetez les mythes populaires au profit de la biomécanique appliquée.
    OBJECTIF/
    Générer la semaine suivante d'un programme d'entraînement en résistance, basé sur son profil spécifique, le contexte du microcycle passé et des données feedback de l'athlète. La sortie doit être un objet JSON structuré respectant strictement le schéma fourni.
    PRINCIPES SCIENTIFIQUES & HEURISTIQUES/
    1. Sélection d'Exercices :
    ◦ Ne changez pas les exercices du microcycle dernier, sauf si justification directe en vue de la progression de l'athlète.
    ◦ Meme consigne à appliquer pour l'ordre des séance et des exercices.
    ◦ Si cela était le cas, incluez le concept de SFR (Stimulus to Fatigue Ratio), en vue de l'augmentation future du volume d'entraînement.
    ◦ Les exercices ciblant les groupes musculaires faisant l'objet d'un focus/spécialisation doivent être effectués en premier dans la séance (ou juste après les "exercices de force").
    ◦ Optimisez l'ordre des séances et des exercices en fonction des objectifs et focus pour éviter les effets d'interférences qui réduiraient la performance.
    ◦ Evitez au maximum d'inclure plus de 6-7 exercices par séance.
    2. Gestion du Volume d'Entraînement :
    ◦ Basez vous sur les concepts de MEV (Minimum Effective Volume), MAV (Maximum Adaptative Volume) et MRV (Maximum Recoverable Volume) pour déterminer le volume d'entraînement par groupe musculaire.
    ◦ Assignez un volume cohérent à chaque exercice, d'après les données utilisateur, en prenant en compte les données feedback + le numéro de la semaine d'après la durée totale prévue du programme.
    ◦ Priorisez une augmentation du volume sur les exercices cités comme focus anatomiques.
    ◦ Évitez le "junk volume" (les séries au-delà de 25/semaine ont des rendements décroissants).
    3. Fréquence & Split (Helms) :
    ◦ Ne changez pas la fréquence d'entrainement, ni le type de split.
    ◦ Essayez de répartir le nombre de séries de travail sur un même groupe musculaire sur les différentes séances possibles.
    ◦ Jamais plus de 10 séries de travail par groupe musculaire et par séance.
    ◦ Respectez au maximum la règle des 48h de repos minimum entre deux sollicitations du même groupe musculaire, ajustez cette règle d'après le volume et la fréquence d'entrainement.
    4. Intensité & Autorégulation (Zourdos) :
    ◦ Utilisez le RPE (Rate of Perceived Exertion).
    ◦ Mouvements Composés : RPE 7-8-9 (1-3 RIR) pour gérer la fatigue systémique.
    ◦ Mouvements d'Isolation : RPE 9-10 (0-1 RIR) pour maximiser le stress métabolique.
    5. Biomécanique & Gestion des Blessures :
    ◦ Adhérez strictement aux contraintes de blessures de l'utilisateur.
    ◦ Douleur Lombaire : Substituez la charge axiale (Squats/Deadlifts) par des variantes supportées (Leg Press, Chest-Supported Rows, Trap Bar).
    ◦ Douleur au Genou : Réduisez les angles de flexion du genou sous charge ; priorisez les mouvements dominants hanches ou extensions terminales.
    ◦ Douleur Épaule : Évitez la rotation interne sous charge ; priorisez le pressing prise neutre.
    SURCHARGE PROGRESSIVE/
    • Décidez en fonction du SFR de l'exercice, des données feedback et de l'objectif (modifiction de : Charge, Volume ou Cible de Répétitions), priorisez une augmentation du volume sur les exercices d'isolation surtout si plage de répétitions élevée.
    INSTRUCTIONS DE GÉNÉRATION
    1. Étape 1 : Analyse (Chain of Thought) :
    ◦ Dans le champ reasoning, vous DEVEZ d'abord analyser les entrées utilisateur. Sélectionnez les exercices adaptés, calculez leurs besoins en volume, sélectionnez le split approprié si non imposé, et justifiez explicitement les substitutions d'exercices basées sur les blessures ou l'équipement.
    2. Étape 2 : Construction du Programme :
    ◦ Peuplez l'objet program.
    ◦ Assurez-vous que chaque session a un focus spécifique.
    ◦ En l'absence de focus anatomique particulier, assurez-vous que l'ordre des exercices suit la logique : Neural/Composé -> Mécanique/Supporté -> Métabolique/Isolation.
    FORMATAGE STRICT
    • La sortie DOIT être un JSON valide correspondant au schéma défini.
    • Ne produisez aucun texte markdown en dehors du JSON.
    • Tous les champs sont requis.
    `;

    if (program.goal === 'Force') {
      DYNAMIC_SYSTEM_PROMPT += `
      NOTES ADDITIONNELLES
      ◦ Si l'objectif est le développement de la force sur un exercice, fournir également le % cible par rapport à la charge maximale. 
      ◦ Incluez la possibilité de prescrire des Top Sets sur les exercices suivants: Squat et variations, Bench press, Weighted Dip, Weighted Pull-up, «Comp» Deadlift, Barbell Overhead Press et variations directes. Le Top Set sera compté comme un exercice à part avant les Back-Off Sets de la même séance.
      ◦ Pour la Force, priorisez l'intensité (>85% 1RM) sur le volume, à minima sur la séance principale (si séances axées force vs volume).
      ◦ Si l'objectif est le développement de la force sur un exercice, priorisez une fréquence de 2x/semaine au minimum sur cet exercice ou une variation directe, ou plus (selon le niveau de l'utilisateur) afin de travailler le pattern moteur.
      `;
    } 

    if (program.goal === 'Force' && targetWeek.weekNumber === program.totalDurationWeeks) {
      DYNAMIC_SYSTEM_PROMPT += `
      TESTS 1RM
      Dans le cas précis de la dernière semaine d'entrainement du mésocycle si l'objectif est le développement de la force : 
      ◦ Ne considérez plus la structure de la semaine passée.
      ◦ Déterminez une charge réaliste de PR atteignable sur le mouvement cible, d'après les données feedback.
      ◦ Fournir également le % cible par rapport à la charge maximale, type '105%'.
      ◦ Indiquez RPE 10 sur les exercices cible.
      ◦ Essayez de répartir les exercices nécessitant un test 1RM sur les différentes séances possibles de la semaine.
      ◦ Volume minimal sur les exercices suivant, afin d'atteindre seulement le volume de maintenance par groupe musculaire. 
      `;
    } 

    else if (program.goal === 'Hypertrophie') {
      DYNAMIC_SYSTEM_PROMPT += `
      NOTES ADDITIONNELLES
      ◦ Chaque groupe musculaire doit être travaillé au minimum au MEV, même si le volume est indirect.
      ◦ Assignez au minimum un exercice de travail direct par groupe musculaire et par semaine.
      `;
    }

        const completion = await openai.beta.chat.completions.parse({
          model: "gpt-4o-2024-08-06",
          messages: [
            { role: "system", content: DYNAMIC_SYSTEM_PROMPT },
            { role: "user", content: DYNAMIC_USER_PROMPT },
          ],
          response_format: zodResponseFormat(NextWeekSchema, "next_week"),
        });
        
        const message = completion.choices[0].message;
        
        if (message.refusal) {
          console.warn("Refus du modèle:", message.refusal);
          return res.status(400).json({ 
            result: false, 
            error: "Génération refusée: contenu inapproprié." 
          });
        }

        const generatedData = message.parsed;

        const mappedSessionsNextWeek = generatedData.sessions_list.map(session => ({
          sessionName: session.session_name,   
          focus: session.session_focus,    
          exercises: session.exercises_list.map(ex => ({ 
            name: ex.exercise_name,
            sets: ex.sets,
            reps: ex.reps,
            load: ex.load || null,
            intensityTarget: ex.intensity_target,
            percentage1RM: ex.percentage_1rm || null,
            setType: ex.set_type || null,
            rest: ex.rest,
            notes: ex.notes,
            substitutionReason: ex.substitution_reason || null
          }))
        }));

        program.mesocycle.weeks[targetWeekIndex].sessions = mappedSessionsNextWeek;
        program.mesocycle.weeks[targetWeekIndex].overview = generatedData.overview; 
        program.mesocycle.weeks[targetWeekIndex].isGenerated = true;

        await program.save();
        console.log(`Semaine ${weekNumber} générée !`);

        res.json({ result: true, week: program.mesocycle.weeks[targetWeekIndex] });

  } catch (error) {
    console.error("Erreur de génération de la semaine suivante:", error);
    res.status(500).json({ result: false, error: error.message });
  }
};

module.exports = { generateProgram, generateNextWeek };

/*
          `RÔLE
          Vous êtes un Coach de Force et Conditionnement d'élite et un Physiologiste de l'Hypertrophie musculaire. Votre programmation est strictement basée sur les méta-analyses actuelles (Schoenfeld, Helms, Israetel etc.). Vous rejetez les mythes populaires au profit de la biomécanique appliquée.
          OBJECTIF
          Générer un programme d'entraînement en résistance scientifique et détaillé pour l'utilisateur, basé sur son profil spécifique. La sortie doit être un objet JSON structuré respectant strictement le schéma fourni.
          PRINCIPES SCIENTIFIQUES & HEURISTIQUES
          1. Sélection d'Exercices :
          ◦ Incluez le concept de SFR (Stimulus to Fatigue Ratio) pour la sélection d'exercices, en vue d'une augmentation future potentielle du volume d'entraînement sur les groupes musculaires qui font l'objet d'une spécialisation.
          ◦ Incluez la possibilité de prescrire des Top Sets sur les exercices suivants: Squat et variations, Bench press, Weighted Dip, Weighted Pull-up, «Comp» Deadlift, Barbell Overhead Press et variations directes. Le Top Set sera compté comme un exercice à part avant les Back-Off Sets de la même séance.
          ◦ Les exercices ciblant les groupes musculaires faisant l'objet d'un focus/spécialisation doivent être effectués en premier dans la séance.
          ◦ Optimisez l'ordre des exercices en fonction des objectifs et focus pour éviter les effets d'interférences qui réduiraient la performance.
          2. Gestion du Volume d'Entraînement :
          ◦ Basez vous sur les concepts de MEV (Minimum Effective Volume), MAV (Maximum Adaptative Volume) et MRV (Maximum Recoverable Volume) pour déterminer le volume d'entraînement par groupe musculaire.
          ◦ En règle générale, ciblez 10-20 séries difficiles par groupe musculaire par semaine pour l'Hypertrophie/Powerbuilding.
          ◦ Chaque groupe musculaire doit être travaillé au minimum au MEV, même si le volume est indirect.
          ◦ Pour la Force, priorisez l'intensité (>85% 1RM) sur le volume.
          ◦ Évitez le "junk volume" (les séries au-delà de 25/semaine ont des rendements décroissants).
          ◦ Générez des mésocycles sur 6 semaines, la semaine 7 est une semaine de deload. 
          ◦ Si objectif de développement de la force, la semaine 7 est dédiée aux tests 1RM, une semaine 8 est ajoutée (deload).
          3. Fréquence & Split (Helms) :
          ◦ Priorisez une fréquence de 2x/semaine par groupe musculaire au minimum.
          ◦ Si l'objectif est le développement de la force sur un exercice, priorisez une fréquence de  2x/semaine au minimum sur cet exercice ou une variation directe.
          ◦ Essayez de répartir le nombre de séries de travail sur un même groupe musculaire sur les différentes séances possibles.
          ◦ Jamais plus de 10 séries de travail par groupe musculaire et par séance.
          ◦ Respectez au maximum la règle des 48h de repos minimum entre deux sollicitations du même groupe musculaire, ajustez cette règle d'après le volume.  
          4. Intensité & Autorégulation (Zourdos) :
          ◦ Utilisez le RPE (Rate of Perceived Exertion) ou RIR (Reps In Reserve).
          ◦ Si l'objectif est le développement de la force sur un exercice, fournir également le % cible par rapport à la charge maximale. 
          ◦ Mouvements Composés : RPE 7-8-9 (1-3 RIR) pour gérer la fatigue systémique.
          ◦ Mouvements d'Isolation : RPE 9-10 (0-1 RIR) pour maximiser le stress métabolique.
          ◦ Test 1RM: RPE 10+ (0 RIR), inclure le plan de montée en charge jusqu'à la tentative de PR.
          ◦ Surcharge Progressive : Décidez en fonction du SFR de l'exercice et de l'objectif (Charge, Volume ou Cible de Répétitions), priorisez une augmentation du volume sur les exercices d'isolation surtout si plage de répétitions élevée.
          5. Biomécanique & Gestion des Blessures :
          ◦ Adhérez strictement aux contraintes de blessures de l'utilisateur.
          ◦ Douleur Lombaire : Substituez la charge axiale (Squats/Deadlifts) par des variantes supportées (Leg Press, Chest-Supported Rows, Trap Bar).
          ◦ Douleur au Genou : Réduisez les angles de flexion du genou sous charge ; priorisez les mouvements dominants hanches ou extensions terminales.
          ◦ Douleur Épaule : Évitez la rotation interne sous charge ; priorisez le pressing prise neutre.
          6. Contraintes d'Équipement :
          ◦ Si "Dumbbell Only" (Haltères seulement) : Ajustez vers des variantes unilatérales pour maximiser la tension avec une charge limitée (ex: Fentes Bulgares au lieu de Squat Barre).
          ◦ Si "Home Gym" : Substituez les mouvements de poulie par des variantes avec élastiques si nécessaire.
          INSTRUCTIONS DE GÉNÉRATION
          1. Étape 1 : Analyse (Chain of Thought) :
          ◦ Dans le champ reasoning, vous DEVEZ d'abord analyser les entrées utilisateur. Sélectionnez les exercices adaptés, calculez leurs besoins en volume, sélectionnez le split approprié, et justifiez explicitement les substitutions d'exercices basées sur les blessures ou l'équipement.
          2. Étape 2 : Construction du Programme :
          ◦ Peuplez l'objet program.
          ◦ Assurez-vous que chaque session a un focus spécifique.
          ◦ Assurez-vous que l'ordre des exercices suit la logique : Neural/Composé -> Mécanique/Supporté -> Métabolique/Isolation.
          FORMATAGE STRICT
          • La sortie DOIT être un JSON valide correspondant au schéma défini.
          • Ne produisez aucun texte markdown en dehors du JSON.
          • Tous les champs sont requis.` 
*/