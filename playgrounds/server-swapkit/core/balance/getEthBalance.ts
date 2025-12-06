import { Chain } from "@swapkit/helpers";
import { connectKeystoreWrapper } from "../connectKeystore-wrapper.js";
import { getSwapKitClient } from "../swap/client.js";

/**
 * Récupère les balances Ethereum uniquement
 * Version simplifiée pour le débogage
 * @returns Un objet avec les balances Ethereum
 */
export async function getEthBalance() {
  try {
    // Initialiser SwapKit
    const swapKit = getSwapKitClient();

    // Vérifier si la phrase mnémonique est configurée
    if (!process.env.MNEMONIC) {
      throw new Error(
        "La phrase mnémonique n'est pas configurée dans le fichier .env (variable MNEMONIC)",
      );
    }

    console.log("Connexion du wallet avec la phrase mnémonique...");
    try {
      console.log(`Phrase mnémonique trouvée (${process.env.MNEMONIC.split(" ").length} mots)`);

      // Connecter le wallet avec Ethereum uniquement
      // Utiliser le wrapper pour éviter l'erreur "n.filter is not a function"
      await connectKeystoreWrapper({
        phrase: process.env.MNEMONIC,
        chains: Chain.Ethereum, // Uniquement Ethereum pour simplifier
      });
      console.log("✅ Wallet connecté avec succès");
    } catch (connectError) {
      console.error("Erreur lors de la connexion du wallet:", connectError);
      console.error("Détails de l'erreur:", connectError.message);
      throw new Error(`Impossible de connecter le wallet: ${connectError.message}`);
    }

    // Récupérer les balances pour Ethereum
    console.log(`Récupération des balances pour ${Chain.Ethereum}...`);
    try {
      const balances = await swapKit.getBalance(Chain.Ethereum, true);

      if (balances && balances.length > 0) {
        const formattedBalances = balances.map((asset: any) => ({
          chain: asset.chain,
          symbol: asset.symbol,
          ticker: asset.ticker,
          balance: asset.getValue("string"),
          balanceFormatted: `${asset.getValue("number")} ${asset.ticker}`,
          address: asset.address,
          decimals: asset.decimal,
          isGasAsset: asset.isGasAsset,
          isSynthetic: asset.isSynthetic,
        }));

        console.log(`✅ ${balances.length} balances trouvées pour ${Chain.Ethereum}`);

        // Afficher un résumé des balances
        balances.forEach((asset: any) => {
          console.log(`  - ${asset.symbol}: ${asset.getValue("string")}`);
        });

        return {
          status: "success",
          data: formattedBalances,
          timestamp: new Date().toISOString(),
        };
      } else {
        console.log(`❌ Aucune balance trouvée pour ${Chain.Ethereum}`);

        return {
          status: "success",
          data: [],
          timestamp: new Date().toISOString(),
        };
      }
    } catch (balanceError) {
      console.error(
        `Erreur lors de la récupération des balances pour ${Chain.Ethereum}:`,
        balanceError,
      );
      throw new Error(`Erreur lors de la récupération des balances: ${balanceError.message}`);
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération des balances pour ${Chain.Ethereum}:`, error);
    return {
      status: "error",
      errorCode: "BALANCE_RETRIEVAL_ERROR",
      errorMessage: `Erreur lors de la récupération des balances pour ${Chain.Ethereum}`,
      errorDetails: {
        message: error.message,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
