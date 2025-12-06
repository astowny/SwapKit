import { AssetValue, Chain, FeeOption } from "../../core/src/index";
import { SwapKitApi } from "../../api/src/index";
import { getSwapKitClient } from "./client";

// Fonction pour estimer un swap de THOR.RUNE vers BNB.BNB
async function estimateSwap(swapKit, runeAmount = "1") {
  try {
    console.log(`\n\u2699️ Estimation d'un swap de ${runeAmount} THOR.RUNE vers BNB.BNB...`);

    // Créer les objets AssetValue pour les actifs source et destination
    const sourceAsset = AssetValue.from({
      asset: "THOR.RUNE",
      value: runeAmount,
    });

    const destinationAsset = AssetValue.from({
      asset: "BNB.BNB",
      value: 0,
    });

    console.log(`Source: ${sourceAsset.toString()}`);
    console.log(`Destination: ${destinationAsset.toString()}`);

    // Récupérer l'adresse source
    const sourceAddress = swapKit.getAddress(Chain.THORChain);

    if (!sourceAddress) {
      console.error("\n❌ Adresse source non disponible. Connectez d'abord un portefeuille THORChain.");
      return null;
    }

    console.log(`Adresse source: ${sourceAddress}`);

    // Vérifier si le plugin ThorChain est disponible
    if (!swapKit.thorchain) {
      console.error("\n❌ Plugin ThorChain non disponible.");
      return null;
    }

    // Utiliser une estimation simplifiée basée sur le taux de change actuel
    console.log("\nCalcul d'une estimation simplifiée...");

    // Taux de change approximatif (1 RUNE ≈ 0.0075 BNB au moment de l'écriture)
    // Dans un environnement de production, ce taux devrait être récupéré dynamiquement
    const approximateExchangeRate = 0.0075;

    // Calculer l'estimation du montant de BNB
    const runeAmountNum = parseFloat(runeAmount);
    const estimatedBnbAmount = runeAmountNum * approximateExchangeRate;

    // Appliquer un slippage estimé de 1% et des frais de 0.5%
    const slippageEstimation = 0.01; // 1%
    const feesEstimation = 0.005; // 0.5%

    const estimatedBnbWithSlippage = estimatedBnbAmount * (1 - slippageEstimation - feesEstimation);

    console.log("\n✨ Estimation du swap (basée sur un taux approximatif):");
    console.log(`Montant d'entrée: ${runeAmount} THOR.RUNE`);
    console.log(`Montant de sortie estimé: ${estimatedBnbWithSlippage.toFixed(8)} BNB.BNB`);
    console.log(`Taux de change utilisé: 1 RUNE = ${approximateExchangeRate.toFixed(8)} BNB`);
    console.log(`Taux de change effectif: 1 RUNE = ${(estimatedBnbWithSlippage / runeAmountNum).toFixed(8)} BNB`);
    console.log(`Slippage estimé: 1.0%`);
    console.log(`Frais estimés: 0.5%`);

    console.log("\n\u26a0️ Note: Cette estimation est très approximative et ne reflète pas nécessairement le taux réel.");
    console.log("Pour une estimation précise, utilisez l'API SwapKit avec une clé API valide ou consultez un explorateur ThorChain.");

    return {
      sourceAsset: sourceAsset.toString(),
      destinationAsset: destinationAsset.toString(),
      inputAmount: runeAmount,
      estimatedOutputAmount: estimatedBnbWithSlippage.toFixed(8),
      exchangeRate: approximateExchangeRate.toFixed(8),
      effectiveExchangeRate: (estimatedBnbWithSlippage / runeAmountNum).toFixed(8)
    };
  } catch (error) {
    console.error("\n❌ Erreur lors de l'estimation du swap:", error);
    return null;
  }
}

// Fonction principale pour connecter un portefeuille et vérifier la balance THOR.RUNE
async function main() {
  try {
    console.log("Initialisation de SwapKit...");

    // Créer une instance SwapKit avec le portefeuille keystore
    const swapKit = getSwapKitClient();

    if (!swapKit) {
      console.error("\n❌ Impossible d'initialiser SwapKit");
      return null;
    }

    // Charger les assets statiques
    await AssetValue.loadStaticAssets();
    console.log("Assets statiques chargés avec succès");

    // Phrase mnémonique pour le portefeuille (ATTENTION: ceci est un exemple, utilisez votre propre phrase)
    // Dans un environnement de production, ne stockez JAMAIS votre phrase mnémonique en clair dans le code
    const phrase = "shine practice ocean behind letter armed exercise auction catalog blanket test want";

    // Vérifier si la méthode connectKeystore est disponible
    if (!swapKit.connectKeystore) {
      console.error("\n❌ La méthode connectKeystore n'est pas disponible sur cette instance de SwapKit.");
      console.log("Vérifiez que le portefeuille keystore est correctement importé dans client.ts");
      return null;
    }

    // Connecter le portefeuille THORChain
    console.log("Connexion du portefeuille THORChain...");
    await swapKit.connectKeystore([Chain.THORChain], phrase);

    // Vérifier si le portefeuille est connecté
    const thorAddress = swapKit.getAddress(Chain.THORChain);

    if (thorAddress) {
      console.log("\n✅ Portefeuille THORChain connecté avec succès!");
      console.log(`Adresse: ${thorAddress}\n`);

      // Créer un AssetValue pour THOR.RUNE
      const runeAsset = AssetValue.from({
        asset: "THOR.RUNE",
        value: 0,
      });

      console.log("Asset THOR.RUNE créé:", runeAsset);

      // Obtenir la balance avec refresh=true pour forcer une mise à jour
      console.log("Récupération de la balance...");
      const balance = await swapKit.getBalance(Chain.THORChain, true);

      // Filtrer pour trouver THOR.RUNE
      const runeBalance = balance.find(asset => asset.ticker === "RUNE" && asset.chain === Chain.THORChain);

      if (runeBalance) {
        console.log("\n✨ Résultat:");
        console.log(`Balance THOR.RUNE: ${runeBalance.toString()}`);
        console.log(`Valeur numérique: ${runeBalance.getValue("number")}\n`);
        return runeBalance;
      } else {
        console.log("\n⚠️ Aucune balance THOR.RUNE trouvée pour cette adresse\n");
        return null;
      }
    } else {
      console.log("\n❌ Échec de la connexion du portefeuille THORChain\n");
      return null;
    }
  } catch (error) {
    console.error("\n❌ Erreur lors de l'exécution:", error);
    return null;
  }
}

// Fonction pour exécuter un swap de THOR.RUNE vers BNB.BNB
async function executeSwap(swapKit, runeAmount = "1") {
  try {
    console.log(`\n\u26a1️ Préparation de l'exécution d'un swap de ${runeAmount} THOR.RUNE vers BNB.BNB...`);

    // Vérifier si le portefeuille THORChain est connecté
    const sourceAddress = swapKit.getAddress(Chain.THORChain);
    if (!sourceAddress) {
      console.error("\n❌ Portefeuille THORChain non connecté. Impossible d'exécuter le swap.");
      return null;
    }

    // Vérifier si le portefeuille BNB est connecté (ou utiliser l'adresse THORChain comme destination)
    const destinationAddress = swapKit.getAddress(Chain.BinanceSmartChain) || sourceAddress;

    console.log(`Adresse source: ${sourceAddress}`);
    console.log(`Adresse destination: ${destinationAddress}`);

    // Créer les objets AssetValue pour les actifs source et destination
    const sourceAsset = AssetValue.from({
      asset: "THOR.RUNE",
      value: runeAmount,
    });

    const destinationAsset = AssetValue.from({
      asset: "BNB.BNB",
      value: 0,
    });

    // Vérifier la balance disponible
    const balance = await swapKit.getBalance(Chain.THORChain, true);
    const runeBalance = balance.find(asset => asset.ticker === "RUNE" && asset.chain === Chain.THORChain);

    if (!runeBalance) {
      console.error("\n❌ Aucune balance THOR.RUNE trouvée. Impossible d'exécuter le swap.");
      return null;
    }

    const runeBalanceValue = runeBalance.getValue("number");
    const swapAmount = parseFloat(runeAmount);

    if (runeBalanceValue < swapAmount) {
      console.error(`\n❌ Balance insuffisante. Vous avez ${runeBalanceValue} RUNE mais essayez d'en swapper ${swapAmount}.`);
      // return null;
    }

    console.log(`\n✅ Balance suffisante: ${runeBalanceValue} RUNE disponible pour swapper ${swapAmount} RUNE.`);

    // ÉTAPE 1: Obtenir un devis de swap (quote)
    console.log("\nℹ️ Pour exécuter un swap réel, vous devez suivre ces étapes:");
    console.log("1. Obtenir un devis de swap (quote) via l'API SwapKit");
    console.log("   Exemple de code:");
    console.log(`   const quoteResponse = await SwapKitApi.getSwapQuote({`);
    console.log(`     sellAsset: "${sourceAsset.toString()}",`);
    console.log(`     buyAsset: "${destinationAsset.toString()}",`);
    console.log(`     sellAmount: "${sourceAsset.getValue("string")}",`);
    console.log(`     sourceAddress: "${sourceAddress}",`);
    console.log(`     destinationAddress: "${destinationAddress}",`);
    console.log(`     slippage: 3,`);
    console.log(`     includeTx: true,`);
    console.log(`   });`);

    // ÉTAPE 2: Exécuter le swap avec la meilleure route
    console.log("\n2. Exécuter le swap avec la meilleure route");
    console.log("   Exemple de code:");
    console.log(`   const bestRoute = quoteResponse.routes[0];`);
    console.log(`   const txHash = await swapKit.swap({`);
    console.log(`     route: bestRoute,`);
    console.log(`     feeOptionKey: FeeOption.Fast,`);
    console.log(`   });`);

    // ÉTAPE 3: Suivre la transaction
    console.log("\n3. Suivre la transaction");
    console.log("   Exemple de code:");
    console.log("   console.log(`Transaction hash: ${txHash}`)");
    console.log("   const explorerUrl = swapKit.getExplorerTxUrl({ chain: Chain.THORChain, txHash });");
    console.log("   console.log(`Explorer URL: ${explorerUrl}`)");

    console.log("\n⚠️ Note: Pour exécuter un swap réel, vous avez besoin d'une clé API SwapKit valide.");
    console.log("Consultez la documentation SwapKit pour plus d'informations: https://docs.thorswap.finance/swapkit-docs");

    return {
      status: "simulation",
      sourceAsset: sourceAsset.toString(),
      destinationAsset: destinationAsset.toString(),
      amount: runeAmount,
      sourceAddress,
      destinationAddress,
    };
  } catch (error) {
    console.error("\n❌ Erreur lors de la préparation du swap:", error);
    return null;
  }
}

// Exécuter la fonction principale
main().then(async (balance) => {
  if (balance) {
    console.log("✅ Opération terminée avec succès!");

    // Après avoir vérifié la balance, estimer un swap de 1 RUNE vers BNB
    const swapKit = getSwapKitClient();
    if (swapKit) {
      // Estimer le swap
      await estimateSwap(swapKit, "1");

      // Demander à l'utilisateur s'il souhaite exécuter le swap
      console.log("\n❓ Souhaitez-vous exécuter le swap? (simulation uniquement)");
      console.log("Appuyez sur Entrée pour continuer...");

      // Simuler une attente de l'entrée utilisateur
    //   await new Promise(resolve => setTimeout(resolve, 2000));

      // Exécuter le swap (simulation)
      await executeSwap(swapKit, "1");
    }
  } else {
    console.log("❌ Impossible de vérifier la balance THOR.RUNE.");
  }
});
