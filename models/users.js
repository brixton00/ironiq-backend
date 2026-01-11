const mongoose = require('mongoose');

const userSchema = mongoose.Schema({

  //AUTHENTIFICATION
  username: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true, 
    lowercase: true 
  },

  //SECURITE
  password: { type: String, required: true }, 
  isVerified: { type: Boolean, default: false }, 
  verificationCode: { type: String }, 
  
  //META
  createdAt: { type: Date, default: Date.now },

});

const User = mongoose.model('users', userSchema);

module.exports = User;