import { ProviderName } from "@swapkit/helpers";
import { getSwapKitClient } from "./swap/client.js";

/**
 * Script pour récupérer la liste des tokens disponibles dans SwapKit
 *
 * Ce script utilise l'API SwapKit pour récupérer la liste des tokens
 * disponibles pour différents fournisseurs (providers).
 *
 * Exécution : bun run core/getTokenList.ts [provider]
 * Exemple : bun run core/getTokenList.ts thorchain
 */

// Liste des fournisseurs disponibles
const availableProviders = [
  ProviderName.ThorSwap,
  ProviderName.THORChain,
  ProviderName.MayaProtocol,
  ProviderName.Chainflip,
  ProviderName.Kado,
  ProviderName.Pangolin,
  ProviderName.TraderJoe,
  ProviderName.Uniswap,
  ProviderName.OneInch,
  ProviderName.Pancake,
  ProviderName.Sushi,
  ProviderName.Curve,
  ProviderName.Balancer,
  ProviderName.Velodrome,
  ProviderName.Aerodrome,
  ProviderName.Camelot,
  ProviderName.Wombat,
  ProviderName.Rango,
  ProviderName.Squid,
  ProviderName.Hop,
  ProviderName.Socket,
  ProviderName.Lifi,
  ProviderName.Satellite,
  ProviderName.Osmosis,
  ProviderName.Kujira,
  ProviderName.Radix,
  ProviderName.Solana,
];

/**
 * Récupère la liste des tokens pour un fournisseur spécifique
 * @param provider Nom du fournisseur
 * @returns Liste des tokens
 */
async function getTokensForProvider(provider: ProviderName) {
  console.log(`Récupération des tokens pour le fournisseur: ${provider}...`);

  // Obtenir le client SwapKit
  const swapKit = getSwapKitClient();
  if (!swapKit) {
    console.error("❌ Impossible d'initialiser SwapKit");
    return null;
  }

  // Vérifier si l'API est disponible
  if (!swapKit.api) {
    console.error("❌ L'API SwapKit n'est pas disponible");
    console.error("Vérifiez que votre clé API est correctement configurée");
    return null;
  }

  // Vérifier si la méthode getTokenList est disponible
  if (!swapKit.api.getTokenList) {
    console.error("❌ La méthode getTokenList n'est pas disponible");
    console.error("Vérifiez que votre clé API est valide et que l'API est correctement configurée");
    return null;
  }

  try {
    // Récupérer la liste des tokens
    const tokenList = await swapKit.api.getTokenList(provider);

    if (!tokenList || !tokenList.tokens || tokenList.tokens.length === 0) {
      console.error(`❌ Aucun token trouvé pour le fournisseur: ${provider}`);
      return null;
    }

    console.log(`✅ ${tokenList.tokens.length} tokens trouvés pour le fournisseur: ${provider}`);

    return tokenList;
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des tokens pour le fournisseur: ${provider}`);
    console.error(error);
    return null;
  }
}

/**
 * Récupère la liste des fournisseurs disponibles
 * @returns Liste des fournisseurs
 */
async function getAvailableProviders() {
  console.log("Récupération des fournisseurs disponibles...");

  // Obtenir le client SwapKit
  const swapKit = getSwapKitClient();
  if (!swapKit) {
    console.error("❌ Impossible d'initialiser SwapKit");
    return null;
  }

  // Vérifier si l'API est disponible
  if (!swapKit.api) {
    console.error("❌ L'API SwapKit n'est pas disponible");
    console.error("Vérifiez que votre clé API est correctement configurée");
    return null;
  }

  // Vérifier si la méthode getTokenListProviders est disponible
  if (!swapKit.api.getTokenListProviders) {
    console.error("❌ La méthode getTokenListProviders n'est pas disponible");
    console.error("Vérifiez que votre clé API est valide et que l'API est correctement configurée");
    return null;
  }

  try {
    // Récupérer la liste des fournisseurs
    const providers = await swapKit.api.getTokenListProviders();

    if (!providers && !providers.providers && providers.providers.length === 0) {
      console.error("❌ Aucun fournisseur trouvé");
      return null;
    }

    console.log(`✅ ${providers.length} fournisseurs trouvés`);
    console.log("Fournisseurs disponibles:", providers);

    return providers;
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des fournisseurs");
    console.error(error);
    return null;
  }
}

/**
 * Récupère les paires de trading disponibles pour un ensemble de fournisseurs
 * @param providers Liste des fournisseurs
 * @returns Paires de trading
 */
async function getTradingPairs(providers: ProviderName[]) {
  console.log(
    `Récupération des paires de trading pour les fournisseurs: ${providers.join(", ")}...`,
  );

  // Obtenir le client SwapKit
  const swapKit = getSwapKitClient();
  if (!swapKit) {
    console.error("❌ Impossible d'initialiser SwapKit");
    return null;
  }

  // Vérifier si l'API est disponible
  if (!swapKit.api) {
    console.error("❌ L'API SwapKit n'est pas disponible");
    console.error("Vérifiez que votre clé API est correctement configurée");
    return null;
  }

  // Vérifier si la méthode getTokenTradingPairs est disponible
  if (!swapKit.api.getTokenTradingPairs) {
    console.error("❌ La méthode getTokenTradingPairs n'est pas disponible");
    console.error("Vérifiez que votre clé API est valide et que l'API est correctement configurée");
    return null;
  }

  try {
    // Récupérer les paires de trading
    const tradingPairs = await swapKit.api.getTokenTradingPairs(providers);

    if (!tradingPairs || !tradingPairs.pairs || tradingPairs.pairs.length === 0) {
      console.error(
        `❌ Aucune paire de trading trouvée pour les fournisseurs: ${providers.join(", ")}`,
      );
      return null;
    }

    console.log(`✅ ${tradingPairs.pairs.length} paires de trading trouvées`);

    return tradingPairs;
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des paires de trading`);
    console.error(error);
    return null;
  }
}

/**
 * Fonction principale
 */
async function main() {
  // Récupérer le fournisseur depuis les arguments de la ligne de commande
  const provider = process.argv[2] as ProviderName;

  // Si aucun fournisseur n'est spécifié, afficher la liste des fournisseurs disponibles
  if (!provider) {
    console.log(
      "Aucun fournisseur spécifié. Récupération de la liste des fournisseurs disponibles...",
    );
    await getAvailableProviders();

    console.log("\nUtilisation: bun run core/getTokenList.ts [provider]");
    console.log("Exemple: bun run core/getTokenList.ts thorchain");
    console.log("\nFournisseurs disponibles:");
    availableProviders.forEach((p) => console.log(`- ${p}`));

    return;
  }

  // Vérifier si le fournisseur est valide
  if (!availableProviders.includes(provider)) {
    console.error(`❌ Fournisseur invalide: ${provider}`);
    console.log("Fournisseurs disponibles:");
    availableProviders.forEach((p) => console.log(`- ${p}`));
    return;
  }

  // Récupérer la liste des tokens pour le fournisseur spécifié
  const tokenList = await getTokensForProvider(provider);

  if (tokenList && tokenList.tokens) {
    // Afficher les 10 premiers tokens
    console.log("\nExemple de tokens (10 premiers):");
    tokenList.tokens.slice(0, 10).forEach((token) => {
      console.log(`- ${token.symbol} (${token.name}): ${token.address}`);
    });

    // Demander si l'utilisateur souhaite voir tous les tokens
    console.log(`\nVoulez-vous voir tous les ${tokenList.tokens.length} tokens? (y/n)`);
    process.stdin.once("data", async (data) => {
      const input = data.toString().trim().toLowerCase();

      if (input === "y" || input === "yes") {
        console.log("\nListe complète des tokens:");
        tokenList.tokens.forEach((token) => {
          console.log(`- ${token.symbol} (${token.name}): ${token.address}`);
        });
      }

      // Demander si l'utilisateur souhaite voir les paires de trading
      console.log("\nVoulez-vous voir les paires de trading pour ce fournisseur? (y/n)");
      process.stdin.once("data", async (data) => {
        const input = data.toString().trim().toLowerCase();

        if (input === "y" || input === "yes") {
          const tradingPairs = await getTradingPairs([provider]);

          if (tradingPairs && tradingPairs.pairs) {
            // Afficher les 10 premières paires
            console.log("\nExemple de paires de trading (10 premières):");
            tradingPairs.pairs.slice(0, 10).forEach((pair) => {
              console.log(`- ${pair.baseAsset} <-> ${pair.quoteAsset}`);
            });

            // Demander si l'utilisateur souhaite voir toutes les paires
            console.log(`\nVoulez-vous voir toutes les ${tradingPairs.pairs.length} paires? (y/n)`);
            process.stdin.once("data", (data) => {
              const input = data.toString().trim().toLowerCase();

              if (input === "y" || input === "yes") {
                console.log("\nListe complète des paires de trading:");
                tradingPairs.pairs.forEach((pair) => {
                  console.log(`- ${pair.baseAsset} <-> ${pair.quoteAsset}`);
                });
              }

              process.exit(0);
            });
          } else {
            process.exit(0);
          }
        } else {
          process.exit(0);
        }
      });
    });
  } else {
    process.exit(1);
  }
}

// Exécuter la fonction principale
main().catch((error) => {
  console.error("Erreur inattendue:", error);
  process.exit(1);
});
