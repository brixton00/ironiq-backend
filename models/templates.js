const mongoose = require('mongoose');

const exerciseSchema = mongoose.Schema({
  name: String,
  sets: Number,
  reps: String,
  rpe: Number,
  rest: Number,
  note: String,
});

const daySchema = mongoose.Schema({
  dayName: String,
  focus: String,
  exercises: [exerciseSchema],
});

const templateSchema = mongoose.Schema({
  programName: String,
  goal: String, 
  frequency: Number,
  level: String, 
  durationWeeks: Number, 
  schedule: [daySchema],
  image: String, 
  createdAt: { type: Date, default: Date.now },
});

const Template = mongoose.model('templates', templateSchema);

module.exports = Template;