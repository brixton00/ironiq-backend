require('dotenv').config();
require('./models/connection');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const authRouter = require('./routes/auth');
const generatorRouter = require('./routes/generator');
const programsRouter = require('./routes/programs');
const usersRouter = require('./routes/users');

const app = express();

// config proxy 
app.set('trust proxy', 1);

// sécurité Headers & CORS
app.use(helmet());
app.use(cors());

// rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// parsing des données
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// PATCH EXPRESS 5 (fix spécifique pour éviter crash sur req.query)
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    writable: true,
    configurable: true,
    value: req.query
  });
  next();
});

// nettoyage NoSQL
app.use(mongoSanitize());

// routes
app.use('/auth', authRouter);
app.use('/gpt', generatorRouter);
app.use('/programs', programsRouter);
app.use('/users', usersRouter);

// route de test
app.get('/', (req, res) => {
  res.json({ result: true, message: 'IronIQ Backend is running 🚀' });
});

module.exports = app;