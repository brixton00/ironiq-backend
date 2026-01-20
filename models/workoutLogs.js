const mongoose = require('mongoose');

const setLogSchema = mongoose.Schema({
  setIndex: Number, 
  weight: { type: Number, required: true }, 
  reps: { type: Number, required: true },
  intensityReached: { type: Number, required: true },
  validated: { type: Boolean, default: false }
});

const exerciseLogSchema = mongoose.Schema({
  exerciseName: { type: String, required: true },
  setType: { type: String, default: null },
  sets: [setLogSchema]
});

const workoutLogSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'programs', required: true, index: true },
  sessionName: { type: String, required: true },
  weekNumber: { type: Number, required: true, index: true },
  date: { type: Date, default: Date.now },
  exercises: [exerciseLogSchema]
});

workoutLogSchema.index({ program: 1, weekNumber: 1 });

const WorkoutLog = mongoose.model('workoutLogs', workoutLogSchema);

module.exports = WorkoutLog;