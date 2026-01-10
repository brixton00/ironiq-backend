// MODULE MAILER VIA API HTTP (BREVO)
// Documentation : https://developers.brevo.com/reference/sendtransacemail

const sendVerificationEmail = async (userEmail, code) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_USER;

  if (!apiKey) {
    console.error("❌ ERREUR : La variable BREVO_API_KEY est manquante.");
    return false;
  }

  const url = 'https://api.brevo.com/v3/smtp/email';
  
  const body = {
    sender: { name: "IronIQ Security: Mail Verification", email: senderEmail },
    to: [{ email: userEmail }],
    subject: "Votre code de vérification IronIQ",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h1>Bienvenue sur IronIQ ! 🦾</h1>
        <p>Pour valider votre compte, voici votre code :</p>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${code}
        </div>
        <p>Ce code est valable 15 minutes.</p>
      </div>
    ` 
  };

  console.log(`📨 Envoi via API HTTP vers ${userEmail}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Email envoyé via API ! Message ID:', data.messageId);
      return true;
    } else {
      console.error('❌ Erreur API Brevo :', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur Réseau (Fetch) :', error);
    return false;
  }
};

module.exports = { sendVerificationEmail };

/*const nodemailer = require('nodemailer');

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

module.exports = { sendVerificationEmail };*/