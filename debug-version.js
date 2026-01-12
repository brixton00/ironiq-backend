/* debug-version.js */
const fs = require('fs');
const path = require('path');

console.log("--- 🕵️ DIAGNOSTIC SHERLOCK HOLMES ---");

// 1. Vérifier ce que demande ton package.json
try {
  const myPackage = require('./package.json');
  console.log(`📄 Ton package.json demande : "openai": "${myPackage.dependencies.openai}"`);
} catch (e) {
  console.log("❌ Impossible de lire ton package.json à la racine.");
}

// 2. Vérifier ce qui est RÉELLEMENT installé dans node_modules
try {
  // On va chercher le package.json INTERNE de la librairie installée
  const libPackagePath = require.resolve('openai/package.json');
  const libPackage = require(libPackagePath);
  console.log(`📦 Version réelle installée dans node_modules : ${libPackage.version}`);
  console.log(`📍 Chemin du fichier chargé : ${libPackagePath}`);
} catch (e) {
  console.log("❌ Impossible de trouver 'openai' dans node_modules. Erreur :", e.message);
}

// 3. Inspecter l'objet en mémoire
try {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: "sk-fake-key-just-for-test" });
  
  console.log("\n--- 🧠 INSPECTION MÉMOIRE ---");
  console.log("Clés disponibles sur l'objet 'openai' :", Object.keys(openai));
  
  if (openai.beta) {
    console.log("✅ 'beta' existe.");
    if (openai.beta.chat) {
        console.log("✅ 'beta.chat' existe.");
        if (openai.beta.chat.completions) {
            console.log("✅ 'beta.chat.completions' existe. TOUT EST OK.");
        } else {
            console.log("❌ 'beta.chat.completions' MANQUE.");
        }
    } else {
        console.log("❌ 'beta.chat' MANQUE.");
    }
  } else {
    console.log("❌ 'beta' n'existe pas sur cet objet.");
    console.log("   -> Tu utilises probablement une version v3 ou v4 très ancienne.");
  }
} catch (e) {
  console.log("❌ Erreur lors de l'instanciation :", e.message);
}