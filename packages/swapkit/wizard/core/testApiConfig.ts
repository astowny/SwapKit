import { getSwapKitClient } from "./client";
import { cleanSwapKitForLogging } from "./swap/walletLogger";

/**
 * Script de test pour vérifier la configuration de l'API SwapKit
 *
 * Ce script permet de vérifier si l'API SwapKit est correctement configurée
 * et si la clé API est valide.
 *
 * Exécution : bun run core/testApiConfig.ts
 */

async function testApiConfiguration() {
  // Appliquer le patch pour nettoyer les logs
  applyLogPatch();

  console.log("Test de la configuration de l'API SwapKit...");

  // Obtenir le client SwapKit
  console.log("Initialisation de SwapKit...");
  const swapKit = getSwapKitClient();

  if (!swapKit) {
    console.error("❌ Impossible d'initialiser SwapKit");
    return;
  }

  console.log("✅ SwapKit initialisé avec succès");

  console.log("\nInformation sur le client SwapKit :");
  // Utiliser notre utilitaire de nettoyage pour éviter d'afficher trop de détails
  const cleanedSwapKit = cleanSwapKitForLogging(swapKit);
  console.log("- Propriétés disponibles :", Object.keys(cleanedSwapKit));

  // Vérifier si l'API est disponible
  if (!swapKit.api) {
    console.error("\n❌ L'API SwapKit n'est pas disponible");
    console.error("Cela peut être dû à une clé API manquante ou invalide");
    console.error("Vérifiez que vous avez défini la variable d'environnement SWAPKIT_API_KEY");
    console.error("ou que vous avez remplacé 'VOTRE_CLE_API_ICI' dans le fichier client.ts");
    return;
  }

  console.log("\nInformation sur l'API SwapKit :");
  console.log("- Type de swapKit.api :", typeof swapKit.api);
  // Afficher seulement les propriétés de l'API, pas les objets complets
  if (swapKit.api) {
    console.log("- Propriétés de swapKit.api :", Object.keys(swapKit.api));
  } else {
    console.log("- Propriétés de swapKit.api : Non disponible");
  }

  // Vérifier si la méthode getSwapQuote est disponible
  if (!swapKit.api.getSwapQuote) {
    console.error("\n❌ La méthode getSwapQuote n'est pas disponible");
    console.error("Cela peut être dû à une configuration incorrecte de l'API");
    return;
  }

  console.log("\n✅ La méthode getSwapQuote est disponible");

  // Tester la méthode getSwapQuote avec des paramètres simples
  try {
    console.log("\nTest de la méthode getSwapQuote...");

    const quoteRequest = {
      sellAsset: "THOR.RUNE",
      buyAsset: "BSC.BNB",
      sellAmount: "1",
      sourceAddress: "thor1yhvxs53dhrtunmh7sc9z6fmxa3wwlmcde6l3rm", // Adresse fictive
      destinationAddress: "0x4cE8bEe6A8afC3debF669adC3b1727103cdBB649", // Adresse fictive
      slippage: 3,
      includeTx: true,
    };

    console.log("Requête de devis :", quoteRequest);

    // Appeler la méthode getSwapQuote
    const quoteResponse = await swapKit.api.getSwapQuote(quoteRequest);

    console.log("\n✅ Réponse reçue de l'API :");
    console.log(JSON.stringify(quoteResponse, null, 2));

    console.log("\n✅ L'API SwapKit est correctement configurée et fonctionne !");
  } catch (error) {
    console.error("\n❌ Erreur lors du test de la méthode getSwapQuote :");
    console.error(error);

    console.log("\nDétails de l'erreur :");
    if (error.response) {
      console.log("- Status :", error.response.status);
      console.log("- Message :", error.response.statusText);
      console.log("- Données :", error.response.data);
    } else if (error.request) {
      console.log("- Requête envoyée mais pas de réponse");
    } else {
      console.log("- Message :", error.message);
    }

    console.log("\nSuggestions :");
    console.log("1. Vérifiez que votre clé API est valide");
    console.log("2. Vérifiez que vous avez accès à l'API SwapKit");
    console.log("3. Vérifiez que l'URL de l'API est correcte");
    console.log("4. Vérifiez que votre connexion Internet fonctionne");
  }
}

// Exécuter le test
testApiConfiguration().catch(error => {
  console.error("Erreur inattendue :", error);
});
