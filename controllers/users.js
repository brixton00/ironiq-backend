const User = require('../models/users');
const cloudinary = require('cloudinary').v2;
const fs = require('fs'); // Pas utilisé ici car on envoie du base64 direct, mais utile à savoir

// Configuration de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Récupérer le profil (Inchangé)
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -verificationCode');
    res.json({ result: true, user });
  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
};

// Mettre à jour le profil (AVEC CLOUDINARY)
const updateProfile = async (req, res) => {
  try {
    const { bio, avatar } = req.body;
    const user = await User.findById(req.user._id);
    
    // 1. Mise à jour de la Bio
    if (bio !== undefined) {
      user.bio = bio;
    }

    // 2. Gestion de l'Avatar (Upload Cloudinary)
    if (avatar) {
      // On vérifie si c'est bien une nouvelle image (format base64)
      if (avatar.startsWith('data:image')) {
        console.log("📤 Upload vers Cloudinary en cours...");
        
        // Upload vers Cloudinary
        const uploadResult = await cloudinary.uploader.upload(avatar, {
          folder: 'ironiq_avatars', // Dossier dans Cloudinary
          resource_type: 'image',
        });

        // On sauvegarde l'URL sécurisée (https) fournie par Cloudinary
        user.avatar = uploadResult.secure_url;
        console.log("✅ Image hébergée :", user.avatar);
      }
    }

    await user.save();
    
    res.json({ 
      result: true, 
      message: 'Profil mis à jour', 
      user: { 
        username: user.username, 
        bio: user.bio, 
        avatar: user.avatar 
      } 
    });

  } catch (error) {
    console.error("Erreur Update Profile:", error);
    res.status(500).json({ result: false, error: error.message });
  }
};

module.exports = { getProfile, updateProfile };