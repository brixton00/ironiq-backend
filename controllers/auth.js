const User = require('../models/users');
const { checkBody } = require('../modules/checkBody');
const bcrypt = require('bcryptjs');
const uid2 = require('uid2'); 
const validator = require('validator');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail } = require('../modules/mailer');

// fonction utilitaire pour générer un code à 6 chiffres
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

/* endpoint route POST /signup : création du compte (statut non vérifié) */
const signup = async (req, res) => {

  if (!checkBody(req.body, ['username', 'password', 'passwordBis', 'email'])) {
    return res.json({ result: false, error: 'Champs manquants ou vides' });
  }

  const usernameRegex = /^[a-zA-Z0-9]+$/;

  if (!usernameRegex.test(req.body.username)) {
    return res.json({
      result: false,
      error: "Le nom d'utilisateur ne peut contenir que des lettres et des chiffres sans espaces."
    });
  }

  if (!validator.isEmail(req.body.email)) {
    return res.json({ result: false, error: 'Email invalide' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  if (!passwordRegex.test(req.body.password)) {
    return res.json({
      result: false,
      error: 'Mot de passe trop faible : min. 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial.'
    });
  }

  if (req.body.password !== req.body.passwordBis) {
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
      return res.json({ result: false, error: "Compte créé mais échec de l'envoi d'email. Veuillez réessayer plus tard ou contactez le support.", email: newUser.email });
    }

    res.json({
      result: true,
      message: 'Inscription réussie. Vérifiez vos emails pour le code.',
      email: newUser.email
    });

  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

/* endpoint route POST /verify : validation du code et délivrance du JWT */
const verify = async (req, res) => {
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
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    await user.save();

    res.json({ result: true, token: token, username: user.username });

  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

const signin = async (req, res) => {
  if (!checkBody(req.body, ['identifier', 'password'])) {
    return res.json({ result: false, error: 'Champs manquants ou vides' });
  }

  try {
    const user = await User.findOne({
      $or: [
        { email: req.body.identifier.toLowerCase() },
        { username: req.body.identifier }
      ]
    });

    if (!user || !bcrypt.compareSync(req.body.password, user.password)) {
      return res.json({ result: false, error: 'Identifiants incorrects' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ result: true, token, username: user.username });

  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

module.exports = { signup, verify, signin };