const jwt = require('jsonwebtoken');
const User = require('../models/users');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {

      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.userId).select('-password');

      if (!req.user) {
         return res.status(401).json({ result: false, error: 'Token valide mais utilisateur introuvable.' });
      }

      next(); 
    } catch (error) {
      return res.status(401).json({ result: false, error: 'Non autorisé, token invalide' });
    }
  }

  if (!token) {
    return res.status(401).json({ result: false, error: 'Non autorisé, aucun token fourni' });
  }
};

module.exports = { protect };