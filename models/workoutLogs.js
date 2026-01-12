const mongoose = require('mongoose');

const setLogSchema = mongoose.Schema({
  setIndex: Number, 
  weight: Number,
  reps: Number,
  validated: Boolean
});

const exerciseLogSchema = mongoose.Schema({
  exerciseName: String,
  sets: [setLogSchema]
});

const workoutLogSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'programs' },
  dayName: String, 
  date: { type: Date, default: Date.now },
  exercises: [exerciseLogSchema]
});

const WorkoutLog = mongoose.model('workoutLogs', workoutLogSchema);

module.exports = WorkoutLog;