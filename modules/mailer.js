const nodemailer = require('nodemailer');

console.log("🔧 CONFIG MAILER : Passage au Port 587 (STARTTLS) + IPv4");

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,        // 👈 SEULE OPTION POSSIBLE (465 est bloqué)
  secure: false,    // 👈 OBLIGATOIRE pour le port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Aide à la compatibilité
  },
  family: 4,        // ⚠️ ON GARDE ÇA (C'est vital pour Railway)
  logger: true,     // On garde les logs pour vérifier
  debug: true,
});

const sendVerificationEmail = async (userEmail, code) => {
  const mailOptions = {
    from: `"IronIQ Security" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: 'Votre code de vérification IronIQ',
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h1>Code IronIQ : ${code}</h1>
        <p>Ce code expire dans 15 minutes.</p>
      </div>
    `,
  };

  console.log(`📨 Tentative via Port 587 vers ${userEmail}...`);

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé ! ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ ERREUR 587 :', error);
    return false;
  }
};

module.exports = { sendVerificationEmail };