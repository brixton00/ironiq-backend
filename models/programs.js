const mongoose = require('mongoose');

// Niveau 4 : exercice
const exerciseSchema = mongoose.Schema({
  name: { type: String, required: true },
  sets: { type: Number, required: true },
  reps: { type: String, required: true },
  load: { type: Number, default: 0 }, 
  intensityTarget: { type: Number, required: true },
  percentage1RM: { type: Number, required: false, default: null },
  setType: { type: String, default: null },
  rest: { type: Number, default: 180 },
  notes: { type: String },
  substitutionReason: { type: String, default: null },
});

// Niveau 3 : séance
const sessionSchema = mongoose.Schema({
  sessionName: { type: String, required: true },
  focus: { type: String, required: true },
  exercises: [exerciseSchema], 
});

// Niveau 2 : semaine 
const microcycleSchema = mongoose.Schema({
  weekNumber: { type: Number, required: true },
  overview: { type: String },
  sessions: { type: [sessionSchema], default: [] }, 
  completedSessions: { type: [Number], default: [] }, 
  isWeekComplete: { type: Boolean, default: false },
  isGenerated: { type: Boolean, default: false } 
});

// Niveau 1 : programme
const programSchema = mongoose.Schema({

  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },

  programName: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  totalDurationWeeks: { type: Number, required: true }, 
  aiReasoning: { type: String },

  gender: { type: String, required: true },
  age: { type: Number, required: true },
  goal: { type: String, required: true }, 
  frequency: { type: Number, required: true }, 
  level: { type: String, required: true }, 
  split: { type: String, default: null },
  kcal: { type: String, required: true }, 
  timeAvailable: { type: String, required: true },
  anatomicalFocus: { type: [String], default: [] },
  equipment: { type: String, required: true }, 
  exercisesToInclude: { type: [String], default: [] },
  exercisesToExclude: { type: [String], default: [] },
  injuries: { type: [String], default: [] }, 
  inquiries: { type: [String], default: [] },
   
  mesocycle: {
    focus: { type: String, required: true }, // ???
    weeks: [microcycleSchema]
  },
});

const Program = mongoose.model('programs', programSchema);

module.exports = Program;