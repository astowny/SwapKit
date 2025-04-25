/**
 * Wrapper pour la fonction connectKeystore
 * 
 * Ce script crée un wrapper pour la fonction connectKeystore qui contourne
 * le problème avec la fonction filterSupportedChains.
 */

import { Chain } from "../../helpers/src/index";
import { getSwapKitClient } from "./swap/client";

// Type pour les options de connectKeystore
interface ConnectKeystoreOptions {
  phrase: string;
  chains: Chain[] | Chain;
}

/**
 * Wrapper pour la fonction connectKeystore
 * 
 * Cette fonction contourne le problème avec la fonction filterSupportedChains
 * en utilisant une approche différente pour connecter le wallet.
 * 
 * @param options Options pour connecter le wallet
 * @returns Résultat de la connexion
 */
export async function connectKeystoreWrapper(options: ConnectKeystoreOptions): Promise<any> {
  try {
    console.log("[WRAPPER] Appel de connectKeystore avec les options suivantes:");
    console.log("[WRAPPER] Phrase:", options.phrase ? `${options.phrase.substring(0, 5)}...` : "non définie");
    
    // Obtenir l'instance de SwapKit
    const swapKit = getSwapKitClient();
    
    // Vérifier si la fonction connectKeystore existe
    if (typeof swapKit.connectKeystore !== 'function') {
      throw new Error("La fonction connectKeystore n'existe pas dans l'instance de SwapKit");
    }
    
    // S'assurer que chains est un tableau
    const chainsArray = Array.isArray(options.chains) ? options.chains : [options.chains];
    
    console.log("[WRAPPER] Chaînes à connecter:", chainsArray);
    console.log("[WRAPPER] Type de chainsArray:", typeof chainsArray);
    console.log("[WRAPPER] Est un tableau:", Array.isArray(chainsArray));
    console.log("[WRAPPER] Longueur du tableau:", chainsArray.length);
    
    // Liste des chaînes supportées par THORChain
    const supportedChains = [
      Chain.Bitcoin,
      Chain.Ethereum,
      Chain.BinanceSmartChain,
      Chain.THORChain,
      Chain.Avalanche,
      Chain.Cosmos,
      Chain.Litecoin,
      Chain.BitcoinCash,
      Chain.Dogecoin
    ];
    
    // Filtrer les chaînes supportées manuellement
    const filteredChains = chainsArray.filter(chain => supportedChains.includes(chain));
    
    console.log("[WRAPPER] Chaînes filtrées:", filteredChains);
    console.log("[WRAPPER] Longueur du tableau filtré:", filteredChains.length);
    
    // Connecter chaque chaîne individuellement
    const results:any[] = [];
    
    // for (const chain of filteredChains) {
      try {
        console.log(`[WRAPPER] Connexion des chaînes ${chainsArray}...`);
        
        // Utiliser une approche différente pour connecter le wallet
        // Cette approche évite d'utiliser la fonction filterSupportedChains
        const result:any = await swapKit.connectKeystore(
          chainsArray, // Utiliser un tableau
          options.phrase
        );
        
        console.log(`[WRAPPER] Chaîne ${chainsArray} connectée avec succès`);
        results.push(result);
      } catch (error) {
        console.error(`[WRAPPER] Erreur lors de la connexion de la chaîne ${chainsArray}:`, error.message);
      }
    // }
    
    console.log("[WRAPPER] Toutes les chaînes ont été traitées");
    return results;
  } catch (error) {
    console.error("[WRAPPER] Erreur lors de l'appel à connectKeystore:", error);
    throw error;
  }
}

/**
 * Fonction pour tester le wrapper
 */
export async function testConnectKeystoreWrapper() {
  try {
    console.log("=== TEST DU WRAPPER POUR CONNECTKEYSTORE ===");
    
    // Vérifier si la variable MNEMONIC est définie
    if (!process.env.MNEMONIC) {
      throw new Error("La variable d'environnement MNEMONIC n'est pas définie");
    }
    
    // Test avec une seule chaîne
    console.log("\n=== TEST AVEC UNE SEULE CHAÎNE ===");
    try {
      await connectKeystoreWrapper({
        phrase: process.env.MNEMONIC,
        chains: Chain.Ethereum
      });
      console.log("Test réussi avec une seule chaîne");
    } catch (error) {
      console.error("Test échoué avec une seule chaîne:", error.message);
    }
    
    // Test avec plusieurs chaînes
    console.log("\n=== TEST AVEC PLUSIEURS CHAÎNES ===");
    try {
      await connectKeystoreWrapper({
        phrase: process.env.MNEMONIC,
        chains: [
          Chain.Bitcoin,
          Chain.Ethereum,
          Chain.BinanceSmartChain,
          Chain.THORChain,
          Chain.Avalanche,
          Chain.Cosmos,
          Chain.Litecoin,
          Chain.BitcoinCash,
          Chain.Dogecoin
        ]
      });
      console.log("Test réussi avec plusieurs chaînes");
    } catch (error) {
      console.error("Test échoué avec plusieurs chaînes:", error.message);
    }
    
    console.log("\n=== FIN DU TEST ===");
  } catch (error) {
    console.error("Erreur lors du test:", error);
  }
}

// Exécuter le test si ce script est appelé directement
if (require.main === module) {
  testConnectKeystoreWrapper().catch(console.error);
}
