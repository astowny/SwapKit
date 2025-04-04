/**
 * Exemple d'utilisation de l'outil de débogage pour les erreurs d'estimation de gaz
 *
 * Pour exécuter ce script:
 * bun run packages/toolboxes/evm/src/debug-example.ts
 */

import { debugSwapQuote } from "./debug-evm-quote";

async function main() {
  console.log("🔍 Démarrage du débogage SwapKit EVM");

  // Exemple 1: Swap ETH -> USDC sur Ethereum
  await debugSwapQuote("ETH.ETH", "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "0.01", 1);

  // Exemple 2: Swap USDC -> ETH sur Ethereum
  // Décommentez pour tester
  /*
  await debugSwapQuote(
    "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "ETH.ETH",
    "10",
    1
  );
  */

  // Exemple 3: Swap cross-chain (peut ne pas être supporté)
  // Décommentez pour tester
  /*
  await debugSwapQuote(
    "ETH.ETH",
    "BSC.BNB",
    "0.1",
    1
  );
  */

  // Exemple 4: Utiliser un RPC URL personnalisé
  // Décommentez et remplacez l'URL RPC
  /*
  await debugSwapQuote(
    "ETH.ETH",
    "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0.01",
    1,
    "https://mainnet.infura.io/v3/VOTRE_CLE_INFURA"
  );
  */

  console.log("\n✅ Débogage terminé");
}

// Exécuter la fonction principale
main().catch((error) => {
  console.error("❌ Erreur lors du débogage:", error);
});
