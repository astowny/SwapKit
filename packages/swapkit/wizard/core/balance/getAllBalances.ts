import { Chain } from "@swapkit/helpers";
import { getSwapKitClient } from "../swap/client";
import { connectKeystoreWrapper } from "../connectKeystore-wrapper";

// Liste des chaînes supportées par THORChain
export const thorchainSupportedChains = [
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

/**
 * Récupère les balances de toutes les chaînes supportées par THORChain
 * @returns Un objet avec les balances par chaîne
 */
/**
 * Récupère les balances d'une chaîne spécifique
 * @param chain La chaîne pour laquelle récupérer les balances
 * @returns Un objet avec les balances de la chaîne
 */
export async function getChainBalance(chain: Chain) {
  try {
    // Initialiser SwapKit
    const swapKit = getSwapKitClient();

    // Vérifier si la phrase mnémonique est configurée
    if (!process.env.MNEMONIC) {
      throw new Error("La phrase mnémonique n'est pas configurée dans le fichier .env (variable MNEMONIC)");
    }

    // Vérifier si la chaîne est supportée
    if (!thorchainSupportedChains.includes(chain)) {
      throw new Error(`La chaîne ${chain} n'est pas supportée par THORChain`);
    }

    // Connecter le wallet avec la phrase mnémonique
    console.log("Connexion du wallet avec la phrase mnémonique...");
    try {
      if (!process.env.MNEMONIC) {
        throw new Error("La variable d'environnement MNEMONIC n'est pas définie");
      }

      console.log(`Phrase mnémonique trouvée (${process.env.MNEMONIC.split(' ').length} mots)`);

      // Connecter le wallet avec une seule chaîne
      console.log(`\n[INFO] Connexion du wallet avec la chaîne ${chain}...`);

      // Utiliser la fonction connectKeystoreWrapper pour éviter l'erreur "n.filter is not a function"
      await connectKeystoreWrapper({
        phrase: process.env.MNEMONIC,
        chains: chain // Pas besoin de tableau, la fonction gère les deux cas
      });
      console.log("✅ Wallet connecté avec succès");
    } catch (connectError) {
      console.error("Erreur lors de la connexion du wallet:", connectError);
      console.error("Détails de l'erreur:", connectError.message);
      throw new Error(`Impossible de connecter le wallet: ${connectError.message}`);
    }

    // Récupérer les balances pour la chaîne
    console.log(`Récupération des balances pour ${chain}...`);
    const balances = await swapKit.getBalance(chain, true);

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
        isSynthetic: asset.isSynthetic
      }));

      console.log(`✅ ${balances.length} balances trouvées pour ${chain}`);

      // Afficher un résumé des balances
      balances.forEach((asset: any) => {
        console.log(`  - ${asset.symbol}: ${asset.getValue("string")}`);
      });

      return {
        status: "success",
        data: formattedBalances,
        timestamp: new Date().toISOString()
      };
    } else {
      console.log(`❌ Aucune balance trouvée pour ${chain}`);

      return {
        status: "success",
        data: [],
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération des balances pour ${chain}:`, error);
    return {
      status: "error",
      errorCode: "BALANCE_RETRIEVAL_ERROR",
      errorMessage: `Erreur lors de la récupération des balances pour ${chain}`,
      errorDetails: {
        message: error.message,
        name: error.name
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Récupère les balances de toutes les chaînes supportées par THORChain
 * @returns Un objet avec les balances par chaîne
 */
export async function getAllChainBalances() {
  try {
    // Initialiser SwapKit
    const swapKit = getSwapKitClient();

    // Vérifier si la phrase mnémonique est configurée
    if (!process.env.MNEMONIC) {
      throw new Error("La phrase mnémonique n'est pas configurée dans le fichier .env (variable MNEMONIC)");
    }

    // Utiliser la liste des chaînes supportées par THORChain

    // Connecter le wallet avec la phrase mnémonique
    console.log("Connexion du wallet avec la phrase mnémonique...");
    try {
      if (!process.env.MNEMONIC) {
        throw new Error("La variable d'environnement MNEMONIC n'est pas définie");
      }

      console.log(`Phrase mnémonique trouvée (${process.env.MNEMONIC.split(' ').length} mots)`);

      // Utiliser la fonction connectKeystoreFixed pour éviter l'erreur "n.filter is not a function"
      console.log("\n[INFO] Connexion du wallet avec toutes les chaînes supportées...");

      // Utiliser un tableau explicite de chaînes au lieu de thorchainSupportedChains
      const chainsToConnect = [
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

      // Utiliser la version wrapper de connectKeystore
      await connectKeystoreWrapper({
        phrase: process.env.MNEMONIC,
        chains: chainsToConnect
      });
      console.log("✅ Wallet connecté avec succès");
    } catch (connectError) {
      console.error("Erreur lors de la connexion du wallet:", connectError);
      console.error("Détails de l'erreur:", connectError.message);
      throw new Error(`Impossible de connecter le wallet: ${connectError.message}`);
    }

    // Objet pour stocker les balances par chaîne
    const balancesByChain: Record<Chain, any[]> = {} as Record<Chain, any[]>;

    // Objet pour stocker les adresses par chaîne
    const addressesByChain: Record<Chain, string> = {} as Record<Chain, string>;

    // Fonction pour récupérer les balances et l'adresse pour une chaîne
    async function getChainBalanceAndAddress(chain: Chain) {
      try {
        console.log(`Récupération des balances pour ${chain}...`);
        let address = '';

        // Récupérer l'adresse pour cette chaîne
        // Traitement normal pour les autres chaînes
        address = swapKit.getAddress(chain) || '';
        if (address) {
          console.log(`✅ Adresse pour ${chain}: ${address}`);
        } else {
          console.log(`❌ Aucune adresse trouvée pour ${chain}`);
        }

        // Récupérer les balances pour la chaîne
        const balances = await swapKit.getBalance(chain, true);
        let formattedBalances: any[] = [];

        if (balances && balances.length > 0) {
          // Formater toutes les balances
          formattedBalances = balances.map((asset: any) => ({
            chain: asset.chain,
            symbol: asset.symbol,
            ticker: asset.ticker,
            balance: asset.getValue("string"),
            balanceFormatted: `${asset.getValue("number")} ${asset.ticker}`,
            address: asset.address,
            decimals: asset.decimal,
            isGasAsset: asset.isGasAsset,
            isSynthetic: asset.isSynthetic
          }));

          // Filtrer pour ne garder que les balances supérieures à zéro
          const nonZeroBalances = formattedBalances.filter(balance => {
            const balanceValue = parseFloat(balance.balance);
            return !isNaN(balanceValue) && balanceValue > 0;
          });

          console.log(`✅ ${balances.length} balances trouvées pour ${chain} (${nonZeroBalances.length} non vides)`);

          // Afficher un résumé des balances non vides
          if (nonZeroBalances.length > 0) {
            console.log(`  Balances non vides pour ${chain}:`);
            nonZeroBalances.forEach((asset: any) => {
              console.log(`  - ${asset.symbol}: ${asset.balance} (${asset.balanceFormatted})`);
            });
          } else {
            console.log(`  Aucune balance non vide pour ${chain}`);
          }
        } else {
          console.log(`❌ Aucune balance trouvée pour ${chain}`);
        }

        return {
          chain,
          address,
          balances: formattedBalances
        };
      } catch (error) {
        console.error(`Erreur lors de la récupération des balances pour ${chain}:`, error);
        return {
          chain,
          address: '',
          balances: []
        };
      }
    }

    // Récupérer les balances pour chaque chaîne en parallèle
    console.log(`Lancement des requêtes en parallèle pour ${thorchainSupportedChains.length} chaînes...`);
    const startTime = Date.now();

    // Exécuter les requêtes en parallèle avec Promise.all
    const results = await Promise.all(
      thorchainSupportedChains.map(chain => getChainBalanceAndAddress(chain))
    );

    const endTime = Date.now();
    console.log(`Toutes les requêtes terminées en ${(endTime - startTime) / 1000} secondes`);

    // Traiter les résultats
    for (const result of results) {
      balancesByChain[result.chain] = result.balances;
      addressesByChain[result.chain] = result.address;
    }

    // Filtrer pour ne garder que les chaînes avec des balances non vides
    const chainesAvecBalances = Object.entries(balancesByChain)
      .filter(([_, balances]) => {
        // Vérifier si le tableau de balances existe et n'est pas vide
        if (!balances || balances.length === 0) return false;

        // Vérifier si au moins une balance a une valeur supérieure à zéro
        return balances.some(balance => {
          // Vérifier si la balance a une valeur numérique supérieure à zéro
          const balanceValue = parseFloat(balance.balance);
          return !isNaN(balanceValue) && balanceValue > 0;
        });
      })
      .reduce((acc, [chain, balances]) => {
        // Filtrer les balances individuelles pour ne garder que celles supérieures à zéro
        const nonEmptyBalances = balances.filter(balance => {
          const balanceValue = parseFloat(balance.balance);
          return !isNaN(balanceValue) && balanceValue > 0;
        });

        // N'ajouter la chaîne que si elle a au moins une balance non vide
        if (nonEmptyBalances.length > 0) {
          acc[chain as Chain] = nonEmptyBalances;
        }

        return acc;
      }, {} as Record<Chain, any[]>);

    // Ajouter des logs pour déboguer
    console.log("\n=== Résumé des balances ===\n");
    console.log(`Nombre total de chaînes: ${Object.keys(balancesByChain).length}`);
    console.log(`Nombre de chaînes avec des balances non vides: ${Object.keys(chainesAvecBalances).length}`);

    // Afficher les chaînes avec des balances non vides
    if (Object.keys(chainesAvecBalances).length > 0) {
      console.log("\nChaînes avec des balances non vides:");
      for (const [chain, balances] of Object.entries(chainesAvecBalances)) {
        console.log(`- ${chain}: ${balances.length} token(s) avec balance > 0`);
        for (const balance of balances) {
          console.log(`  * ${balance.symbol}: ${balance.balance} (${balance.balanceFormatted})`);
        }
      }
    } else {
      console.log("\nAucune chaîne avec des balances non vides trouvée.");
    }

    return {
      status: "success",
      data: {
        allBalances: balancesByChain,
        nonEmptyBalances: chainesAvecBalances,
        addresses: addressesByChain
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des balances:", error);
    return {
      status: "error",
      errorCode: "BALANCE_RETRIEVAL_ERROR",
      errorMessage: "Erreur lors de la récupération des balances",
      errorDetails: {
        message: error.message,
        name: error.name
      },
      timestamp: new Date().toISOString()
    };
  }
}
