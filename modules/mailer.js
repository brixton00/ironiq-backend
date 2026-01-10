const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,        // Port TLS
  secure: false,    // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false 
  },
  family: 4, // 👈 AJOUTE CECI (Force l'IPv4 pour éviter les Timeouts Railway)
});

const sendVerificationEmail = async (userEmail, code) => {
  const mailOptions = {
    from: `"IronIQ Security" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: 'Votre code de vérification IronIQ',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h1>Bienvenue sur IronIQ ! 🦾</h1>
        <p>Merci de vous être inscrit. Voici votre code :</p>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${code}
        </div>
        <p>Valable 15 minutes.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé: ' + info.response);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return false;
  }
};

module.exports = { sendVerificationEmail };