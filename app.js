require('dotenv').config(); 
require('./models/connection');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const authRouter = require('./routes/auth');

const app = express();
app.use(helmet());
app.use(cors()); 

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());

app.use('/auth', authRouter);

// Route de test 
app.get('/', (req, res) => {
  res.json({ result: true, message: 'IronIQ Backend is running 🚀' });
});

module.exports = app;