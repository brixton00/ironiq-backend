// routes/users.js
var express = require('express');
var router = express.Router();

const User = require('../models/users');
const { checkBody } = require('../modules/checkBody'); 
const bcrypt = require('bcrypt');
const uid2 = require('uid2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { sendVerificationEmail } = require('../modules/mailer');

// Fonction utilitaire pour générer un code à 6 chiffres
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

/* POST /signup : Création du compte (Statut non vérifié) */
router.post('/signup', async (req, res) => {

    if (!checkBody(req.body, ['username', 'password', 'passwordBis', 'email'])) {
    return res.json({ result: false, error: 'Champs manquants ou vides' });
  }

  if (!validator.isEmail(req.body.email)) {
    return res.json({ result: false, error: 'Email invalide' });
  }

  if (req.body.password.length < 8){
    return res.json({ result: false, error: 'Mot de passe trop court' });
  }

  if (req.body.password.length !== req.body.passwordBis){
    return res.json({ result: false, error: 'Les mots de passe ne correspondent pas' });
  }

  try {
    const userExists = await User.findOne({ email: req.body.email });
    if (userExists) {
      return res.json({ result: false, error: 'Email déjà utilisé' });
    }

    const hash = bcrypt.hashSync(req.body.password, 10);
    const verificationCode = generateCode();

    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: hash,
      verificationCode: verificationCode,
      isVerified: false, 
    });

    await newUser.save();

    const emailSent = await sendVerificationEmail(newUser.email, verificationCode);

    if (!emailSent) {
      await User.deleteOne({ _id: newUser._id });
      return res.json({ result: false, message: "Compte créé mais échec de l'envoi d'email. Veuillez réessayer plus tard ou contactez le support.", email: newUser.email });
    }

    res.json({ 
      result: true, 
      message: 'Inscription réussie. Vérifiez vos emails pour le code.',
      email: newUser.email
    });

  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
});

/* POST /verify : Validation du code et délivrance du JWT */
router.post('/verify', async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    if (user.verificationCode !== code) {
      return res.json({ result: false, error: 'Code incorrect' });
    }

    user.isVerified = true;
    user.verificationCode = null; 
    
    const token = jwt.sign(
      { userId: user._id, username: user.username }, 
      process.env.JWT_SECRET || 'SECRET_TEMPORAIRE', 
      { expiresIn: '30d' }
    );
    
    user.token = token;
    await user.save();

    res.json({ result: true, token: token, username: user.username });

  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
});

module.exports = router;