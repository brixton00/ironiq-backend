const mongoose = require('mongoose');

// Sous-document : Exercice
const exerciseSchema = mongoose.Schema({
  name: String,
  sets: Number,
  reps: String,
  rpe: Number,
  rest: Number,
  tempo: String,
  note: String,
});

// Sous-document : Journée d'entraînement
const daySchema = mongoose.Schema({
  dayName: String,
  focus: String,
  exercises: [exerciseSchema], // Tableau d'exercices
});

// Document Principal : Le Programme
const programSchema = mongoose.Schema({
  // 🔗 La liaison avec l'utilisateur (Clé Étrangère)
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  
  programName: String,
  goal: String,
  frequency: Number,
  schedule: [daySchema], // Tableau de jours
  
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true } // Pour savoir quel est le programme en cours
});

const Program = mongoose.model('programs', programSchema);

module.exports = Program;