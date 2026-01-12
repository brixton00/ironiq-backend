const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { z } = require('zod');
const { zodResponseFormat } = require('openai/helpers/zod');

const User = require('../models/users');     
const Program = require('../models/programs'); 

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WorkoutExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().describe("Compris entre 2 et 5"),
  reps: z.string().describe("Plage de répétitions adaptée à l'exercice, ex: '8-12'"),
  rpe: z.number().describe("Rating of Perceived Exertion: Effort perçu sur 10, minimum 7, maximum 10"),
  rest: z.number().describe("Temps de repos en secondes"),
  tempo: z.string().optional().describe("Cadence d'éxécution, seulement si nécessaire, ex: 3-0-1-0"),
  note: z.string().describe("Conseil technique et/ou optimisation pour la performance ou l'hypertrophie")
});

const WorkoutDaySchema = z.object({
  dayName: z.string(),
  focus: z.string().describe("Exemple 1: Force - Push & Triceps. Exemple 2: Hypertrophie - Legs & Quadriceps"),
  exercises: z.array(WorkoutExerciseSchema)
});
 
const ProgramSchema = z.object({
  programName: z.string().describe("Doit faire référence à l'objectif et/ou au focus musculaire"),
  goal: z.string(),
  frequency: z.number(),
  schedule: z.array(WorkoutDaySchema)
});

/* POST /generate : création du programme*/
router.post('/generate', async (req, res) => {
  try {
    const { userData, userId } = req.body;
    
    console.log("⏳ Génération en cours pour l'utilisateur :", userId || "Anonyme");
    console.log("🔍 INSPECTION OPENAI :", {
       type: typeof openai,
       hasBeta: !!openai.beta,
       keys: Object.keys(openai)
    });

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        { 
          role: "system", 
          content: "Tu es un expert en hypertrophie et programmation en culture physique. Génère un programme basé strictement sur les principes de Brad Schoenfeld." 
        },
        { 
          role: "user", 
          content: JSON.stringify(userData) 
        },
      ],
      response_format: zodResponseFormat(ProgramSchema, "workout_program"),
    });

    const generatedData = completion.choices[0].message.parsed; 
    
    const newProgram = new Program({
      user: userId ? userId : null, 
      programName: generatedData.programName,
      goal: generatedData.goal,
      frequency: generatedData.frequency,
      schedule: generatedData.schedule,
      isActive: true,
      createdAt: new Date(),
    });

    const savedProgram = await newProgram.save();
    console.log(`✅ Programme sauvegardé avec succès (ID: ${savedProgram._id})`);

    res.json({ result: true, program: savedProgram });

  } catch (error) {
    console.error("Erreur Génération:", error);
    res.status(500).json({ result: false, error: "Échec de la génération structurée." });
  }
});

/* POST /progress : update du programme*/

module.exports = router;