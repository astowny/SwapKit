// Importer les polyfills en premier
import "./polyfills";

import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";

import App from "./App";
import FallbackApp from "./FallbackApp";

// Variable pour suivre si une erreur SES s'est produite
let sesErrorOccurred = false;

// Les polyfills sont maintenant importés depuis le fichier polyfills.ts

// Gestionnaire d'erreurs global pour intercepter les erreurs SES
window.addEventListener('error', (event) => {
  if (event.error && event.error.toString().includes('SES_UNCAUGHT_EXCEPTION')) {
    console.error('Erreur SES interceptée:', event.error);
    // Marquer qu'une erreur SES s'est produite
    sesErrorOccurred = true;
    // Empêcher l'erreur de bloquer le rendu
    event.preventDefault();

    // Rendre l'application de secours
    setTimeout(() => {
      try {
        const rootElement = document.getElementById('root');
        if (rootElement) {
          // Utiliser ReactDOM pour rendre l'application de secours
          ReactDOM.createRoot(rootElement).render(
            <React.StrictMode>
              <FallbackApp />
            </React.StrictMode>
          );
          console.log('Application de secours rendue avec succès');
        }
      } catch (renderError) {
        console.error('Erreur lors du rendu de l\'application de secours:', renderError);
        // Fallback ultime en cas d'échec du rendu React
        const rootElement = document.getElementById('root');
        if (rootElement) {
          rootElement.innerHTML = `
            <div style="padding: 20px; font-family: sans-serif;">
              <h2 style="color: #d32f2f;">Problème avec une extension de navigateur</h2>
              <p>Une erreur a été détectée avec une extension de navigateur (probablement un portefeuille crypto).</p>
              <p>Pour résoudre ce problème, essayez de :</p>
              <ol>
                <li>Désactiver temporairement vos extensions de portefeuille crypto (MetaMask, etc.)</li>
                <li>Utiliser le mode navigation privée</li>
                <li>Essayer un autre navigateur</li>
              </ol>
              <button onclick="window.location.reload()" style="padding: 8px 16px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Recharger la page
              </button>
            </div>
          `;
        }
      }
    }, 500);
  }
});

// Ajout de logs de débogage
console.log("Début du chargement de l'application");

// Vérifier si l'élément root existe
const rootElement = document.getElementById("root");
console.log("Elément root trouvé:", rootElement);

if (!rootElement) {
  console.error("ERREUR: L'élément root n'a pas été trouvé dans le DOM!");
} else {
  try {
    // Vérifier si une erreur SES s'est produite
    if (sesErrorOccurred) {
      console.log("Une erreur SES a été détectée, utilisation de l'application de secours...");
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <FallbackApp />
        </React.StrictMode>
      );
    } else {
      console.log("Création du root React...");
      const root = ReactDOM.createRoot(rootElement);

      console.log("Rendu de l'application principale...");
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
      console.log("Rendu terminé!");
    }
  } catch (error) {
    console.error("ERREUR lors du rendu de l'application:", error);

    // En cas d'erreur, essayer de rendre l'application de secours
    try {
      console.log("Tentative de rendu de l'application de secours après erreur...");
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <FallbackApp />
        </React.StrictMode>
      );
    } catch (fallbackError) {
      console.error("ERREUR lors du rendu de l'application de secours:", fallbackError);
    }
  }
}

console.log("Fin du script main.tsx");
