const nodemailer = require('nodemailer');

// 👇 LOG DE CONTRÔLE : On vérifie ce qui est chargé
console.log("🔧 CONFIG MAILER CHARGÉE :");
console.log(`   - User: ${process.env.EMAIL_USER}`);
console.log(`   - Pass: ${process.env.EMAIL_PASS ? '******** (Présent)' : '❌ ABSENT'}`);
console.log(`   - Port: 465 (Test SSL + IPv4)`);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,        // On retente le 465 (SSL) qui est souvent plus stable avec IPv4 forcé
  secure: true,     // Vrai pour 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4,        // ⚠️ INDISPENSABLE : Force l'IPv4
  logger: true,     // 🔍 ACTIVE LES LOGS DÉTAILLÉS NODEMAILER
  debug: true,      // 🔍 AFFICHE TOUT LE TRAFIC SMTP
});

const sendVerificationEmail = async (userEmail, code) => {
  const mailOptions = {
    from: `"IronIQ Security" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: 'Votre code de vérification IronIQ',
    html: `<h1>Code: ${code}</h1>`,
  };

  console.log(`📨 Tentative d'envoi à ${userEmail}...`);

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé avec succès ! ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ ECHEC CRITIQUE ENVOI EMAIL :');
    console.error(error);
    return false;
  }
};

module.exports = { sendVerificationEmail };