import { Chain } from "@swapkit/core";
import { getSwapKitClient } from "./swap/client";

async function testCovalentAPI() {
  try {
    console.log("Initialisation de SwapKit...");
    const swapKit = getSwapKitClient();
    
    console.log("Récupération des balances sur Binance Smart Chain...");
    // Utilise Covalent pour récupérer les balances sur BSC
    const balances = await swapKit.getBalance(Chain.BinanceSmartChain, true);
    
    console.log("Balances récupérées avec succès :");
    console.log(JSON.stringify(balances, null, 2));
    
    console.log("\nSi vous voyez des balances ci-dessus, votre clé API Covalent fonctionne correctement !");
  } catch (error) {
    console.error("Erreur lors du test de l'API Covalent :", error);
    console.log("\nVérifiez que votre clé API Covalent est correcte et active.");
  }
}

// Exécuter le test
testCovalentAPI().catch(console.error);
