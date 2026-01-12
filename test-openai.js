// Fichier : test-openai.js
require('dotenv').config(); // Charge ton .env
const OpenAI = require('openai');
const { z } = require('zod');
const { zodResponseFormat } = require('openai/helpers/zod');

// 1. Vérification de la clé
console.log("🔑 Clé API détectée :", process.env.OPENAI_API_KEY ? "OUI (commence par " + process.env.OPENAI_API_KEY.substring(0, 5) + "...)" : "NON ❌");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 2. Définition d'un schéma simple pour le test
const TestSchema = z.object({
  message: z.string(),
  mood: z.enum(["heureux", "triste", "colère"])
});

async function runTest() {
  console.log("⏳ Envoi de la requête à OpenAI...");
  
  try {
    // 3. Appel avec la méthode BETA (Standard actuel pour Node.js)
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: "Réponds simplement." },
        { role: "user", content: "Dis-moi bonjour." },
      ],
      response_format: zodResponseFormat(TestSchema, "test_response"),
    });

    // 4. Résultat
    const result = completion.choices[0].message.parsed;
    console.log("✅ SUCCÈS ! Réponse reçue :", result);

  } catch (error) {
    console.log("\n❌ ÉCHEC. Voici l'erreur exacte :");
    console.error(error);
  }
}

runTest();