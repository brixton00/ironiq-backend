const OpenAI = require('openai');
const { z } = require('zod');
const { zodResponseFormat } = require('openai/helpers/zod');
const Program = require('../models/programs');
const WorkoutLog = require('../models/workoutLogs');
const { 
  buildInitialUserPrompt, 
  buildInitialSystemPrompt, 
  buildNextWeekUserPrompt, 
  buildNextWeekSystemPrompt 
} = require('../modules/prompts');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// DÉFINITION DES SCHÉMAS ZOD
const ExerciseSchema = z.object({
  exercise_name: z.string().describe("Le nom spécifique et standardisé de l'exercice."),
  isPriority: z.boolean().describe("Indique si l'exercice est une cible de progression principale ou non."),
  sets: z.number().describe("Nombre de séries de travail, compris entre 2 et 6"),
  reps: z.string().describe("Plage de répétitions cible, ex: '8-12 reps 🎯' ou '5 reps🎯'"),
  intensity_target: z.number().describe("L'intensité cible, ex: '8'"),
  percentage_1rm: z.number().nullable().describe("Pourcentage du 1RM pour les exercices qui sont cibles de progression, ex: '0.75' pour 75% de la charge maximale"),
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

    const DYNAMIC_USER_PROMPT = buildInitialUserPrompt(userData);
    const DYNAMIC_SYSTEM_PROMPT = buildInitialSystemPrompt(userData.goal);

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
        isPriority: ex.isPriority,
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
        
        const DYNAMIC_USER_PROMPT = buildNextWeekUserPrompt(context);
        const isLastWeek = program.goal === 'Force' && targetWeek.weekNumber === program.totalDurationWeeks;
        const DYNAMIC_SYSTEM_PROMPT = buildNextWeekSystemPrompt(program.goal, isLastWeek);

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
            isPriority: ex.isPriority,
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