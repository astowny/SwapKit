import { AssetValue, Chain, ProviderName } from "../../../core/src/index";
import { getSwapKitClient, SwapKitClient } from "./client";
import { executeRealSwap, RealSwapOptions } from "./realSwap";

/**
 * Configuration centralisée pour les swaps
 * Modifiez ces paramètres selon vos besoins
 */
const SWAP_CONFIG = {
  // Paramètres obligatoires
  thorchain: {
    sourceAssetString: "THOR.RUNE",
    destinationAssetString: "BSC.BNB",
    amount: "1", // Montant à swapper
  },
  // Exemple avec Uniswap (ETH -> USDC)
  uniswap: {
    sourceAssetString: "ETH.ETH",
    destinationAssetString: "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    amount: "0.01", // Montant à swapper (0.01 ETH)
    slippage: 0.5 // Slippage de 0.5%
  },
  // Exemple avec Uniswap (USDC -> ETH)
  uniswapReverse: {
    sourceAssetString: "BSC.BNB",
    destinationAssetString: "ETH.ETH",
    amount: "13", // Montant à swapper (1 USDC)
    slippage: 0.5 // Slippage de 0.5%
  },
  // Exemple avec Maya Protocol
  // TODO recuperer le identifier depuis l'api de swapkit /tokens : voir : https://api.swapkit.dev/docs/#/
  maya: {
    sourceAssetString: "MAYA.CACAO",
    destinationAssetString: "MAYA.BTC",
    amount: "6", // Montant à swapper (10 CACAO)
  }
};

// Fonction principale
async function main() {
  try {
    console.log("Initialisation de SwapKit...");

    // Sélectionner la configuration en fonction des arguments de la ligne de commande
    // Par défaut, utiliser ThorChain
    const configType = process.argv[2]?.toLowerCase() || 'maya';
    const configAmount = process.argv[3] || undefined;

    // Vérifier si la configuration demandée existe
    if (!SWAP_CONFIG[configType]) {
      console.error(`\n❌ Configuration '${configType}' non trouvée. Options disponibles: ${Object.keys(SWAP_CONFIG).join(', ')}`);
      return;
    }

    // Récupérer la configuration
    const config = SWAP_CONFIG[configType];
    console.log(`\nℹ️ Utilisation de la configuration: ${configType.toUpperCase()}`);

    // Utiliser le montant spécifié en ligne de commande ou celui de la configuration
    const amount = configAmount || config.amount;
    const { sourceAssetString, destinationAssetString, provider, slippage } = config;

    // Préparer les options de swap
    const swapOptions: RealSwapOptions = {
      amount,
      sourceAssetString,
      destinationAssetString,
      // Utiliser les adresses obtenues des portefeuilles connectés
      // sourceAddress,
      // destinationAddress,
      // Utiliser les chaînes dérivées
      // sourceChain,
      // destinationChain,
      // Utiliser le fournisseur spécifié dans la configuration
    };

    // Ajouter le slippage s'il est spécifié
    if (slippage !== undefined) {
      swapOptions.slippage = slippage;
    }

    // Exécuter le swap réel avec les options
    const result = await executeRealSwap(swapOptions);

    if (result && result.status === "success") {
      console.log("\n✅ Swap exécuté avec succès!");
      console.log(`Transaction hash: ${result.txHash}`);
      console.log(`Explorer URL: ${result.explorerUrl}`);
      console.log(`Montant envoyé: ${result.amount} ${result.sourceAsset}`);
      console.log(`Montant reçu estimé: ${result.expectedOutput} ${result.destinationAsset}`);
    } else if (result && result.status === "error") {
      console.error(`\n❌ Erreur lors de l'exécution du swap: ${result.error}`);
    } else {
      console.error("\n❌ Le swap n'a pas pu être exécuté.");
    }
  } catch (error) {
    console.error("\n❌ Erreur lors de l'exécution:", error);
  }
}

/**
 * Affiche l'aide sur l'utilisation du script
 */
function showHelp() {
  console.log(`
ℹ️ UTILISATION: bun run packages/swapkit/wizard/core/runRealSwap.ts [config] [amount]

Options disponibles:
  - config: Type de configuration à utiliser (${Object.keys(SWAP_CONFIG).join(', ')})
  - amount: Montant à swapper (optionnel, utilise la valeur par défaut de la configuration si non spécifié)

Exemples:
  - bun run packages/swapkit/wizard/core/runRealSwap.ts                  # Utilise la configuration ThorChain par défaut
  - bun run packages/swapkit/wizard/core/runRealSwap.ts thorchain 2     # Swap 2 THOR.RUNE vers BSC.BNB via ThorChain
  - bun run packages/swapkit/wizard/core/runRealSwap.ts uniswap 0.05    # Swap 0.05 ETH vers USDC via Uniswap
  - bun run packages/swapkit/wizard/core/runRealSwap.ts uniswapReverse  # Swap 1 USDC vers ETH via Uniswap
  - bun run packages/swapkit/wizard/core/runRealSwap.ts maya            # Swap 10 MAYA.CACAO vers MAYA.BTC via Maya Protocol
  - bun run packages/swapkit/wizard/core/runRealSwap.ts help            # Affiche cette aide
`);
}

// Vérifier si l'utilisateur demande l'aide
if (process.argv[2] === 'help' || process.argv[2] === '--help' || process.argv[2] === '-h') {
  showHelp();
} else {
  // Exécuter la fonction principale
  main().catch(error => {
    console.error("Erreur inattendue:", error);
  });
}
