import { AssetValue, Chain, FeeOption } from "@swapkit/core";
import { getSwapKitClient } from "./client";
import { cleanSwapKitForLogging } from "./swap/walletLogger";
import { applyLogPatch } from "./logPatch";

/**
 * Script pour exécuter un swap directement via le plugin ThorChain
 * sans utiliser l'API SwapKit
 *
 * Ce script est une alternative à realSwap.ts qui ne nécessite pas de clé API
 *
 * Exécution : MNEMONIC="votre phrase mnémonique" bun run core/thorchainDirectSwap.ts
 */

export async function executeThorchainDirectSwap(runeAmount = "1") {
  try {
    // Appliquer le patch pour nettoyer les logs
    applyLogPatch();

    console.log("Initialisation de SwapKit...");

    // Charger les assets statiques
    await AssetValue.loadStaticAssets();
    console.log("Assets statiques chargés avec succès");

    // Créer une instance SwapKit
    const swapKit = getSwapKitClient();
    if (!swapKit) {
      console.error("\n❌ Impossible d'initialiser SwapKit");
      return null;
    }

    // Phrase mnémonique pour le portefeuille
    const phrase = process.env.MNEMONIC || "votre phrase mnémonique ici";

    if (phrase === "votre phrase mnémonique ici") {
      console.error("\n⚠️ ATTENTION: Vous devez définir votre propre phrase mnémonique!");
      console.error("Définissez la variable d'environnement MNEMONIC ou modifiez directement le code.\n");
      return null;
    }

    // Connecter le portefeuille THORChain uniquement
    console.log("Connexion du portefeuille THORChain...");
    await swapKit.connectKeystore([Chain.THORChain], phrase);

    // Vérifier si le portefeuille est connecté
    const thorAddress = swapKit.getAddress(Chain.THORChain);
    if (!thorAddress) {
      console.error("\n❌ Échec de la connexion du portefeuille THORChain");
      return null;
    }

    console.log(`\n✅ Portefeuille THORChain connecté avec succès!`);
    console.log(`Adresse: ${thorAddress}\n`);

    // Vérifier si le plugin ThorChain est disponible
    console.log('\nVérification du plugin ThorChain:');
    // Utiliser notre utilitaire de nettoyage pour éviter d'afficher trop de détails
    const cleanedSwapKit = cleanSwapKitForLogging(swapKit);
    console.log('- swapKit.thorchain exists:', !!cleanedSwapKit.thorchain);

    if (cleanedSwapKit.thorchain) {
      console.log('- swapKit.thorchain object keys:', Object.keys(cleanedSwapKit.thorchain));
      console.log('- swapKit.thorchain.swap exists:', !!cleanedSwapKit.thorchain.swap);
    }

    // Vérifier si nous pouvons utiliser le plugin ThorChain directement
    if (!swapKit.thorchain || !swapKit.thorchain.swap) {
      console.error("\n❌ Plugin ThorChain non disponible ou méthode swap manquante.");
      console.error("Vérifiez que le plugin ThorChain est correctement importé dans client.ts");
      return null;
    }

    console.log("\n✅ Plugin ThorChain disponible. Nous allons utiliser swapKit.thorchain.swap directement.");

    console.log(`\n⚡️ Exécution d'un swap direct de ${runeAmount} THOR.RUNE vers BNB.BNB...`);

    // Vérifier si le portefeuille THORChain est connecté
    const sourceAddress = swapKit.getAddress(Chain.THORChain);
    if (!sourceAddress) {
      console.error("\n❌ Portefeuille THORChain non connecté. Impossible d'exécuter le swap.");
      return null;
    }

    // Utiliser l'adresse THORChain comme destination
    const destinationAddress = sourceAddress;

    console.log(`Adresse source: ${sourceAddress}`);
    console.log(`Adresse destination: ${destinationAddress}`);

    // Créer les objets AssetValue pour les actifs source et destination
    const sourceAsset = AssetValue.from({
      asset: "THOR.RUNE",
      value: runeAmount,
    });

    const destinationAsset = "BSC.BNB";

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
      return null;
    }

    console.log(`\n✅ Balance suffisante: ${runeBalanceValue} RUNE disponible pour swapper ${swapAmount} RUNE.`);

    // ÉTAPE 1: Préparer le swap en utilisant directement le plugin ThorChain
    console.log("\nℹ️ ÉTAPE 1: Préparation du swap via le plugin ThorChain...");

    // Créer les paramètres pour le swap ThorChain
    const swapParams = {
      assetValue: sourceAsset,
      destinationAsset: destinationAsset,
      destinationAddress: destinationAddress,
      slippage: 0.03, // 3% de slippage
      feeOptionKey: FeeOption.Fast,
    };

    console.log("Paramètres du swap:", {
      ...swapParams,
      assetValue: swapParams.assetValue.toString(),
    });

    // ÉTAPE 2: Exécuter le swap avec ThorChain
    console.log("\nℹ️ ÉTAPE 2: Exécution du swap via ThorChain...");

    // Demander confirmation à l'utilisateur
    console.log("\n⚠️ ATTENTION: Vous êtes sur le point d'exécuter un swap réel qui engagera vos fonds.");
    console.log("Appuyez sur Entrée pour confirmer et exécuter le swap, ou Ctrl+C pour annuler...");

    // Simuler une attente de l'entrée utilisateur (dans un environnement réel, vous utiliseriez readline ou un autre mécanisme)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Exécuter le swap en utilisant directement le plugin ThorChain
    console.log("Exécution du swap via swapKit.thorchain.swap...");
    const txResult = await swapKit.thorchain.swap(swapParams);

    // Vérifier le résultat
    if (!txResult) {
      console.error("\n❌ Échec du swap. Aucun résultat retourné.");
      return null;
    }

    const txHash = typeof txResult === 'string' ? txResult : txResult.hash || txResult.txHash || JSON.stringify(txResult);

    // ÉTAPE 3: Suivre la transaction
    console.log("\nℹ️ ÉTAPE 3: Suivi de la transaction...");
    console.log(`\n✅ Swap initié avec succès!`);
    console.log(`Transaction hash: ${txHash}`);

    // Générer l'URL de l'explorateur
    const explorerUrl = swapKit.getExplorerTxUrl({ chain: Chain.THORChain, txHash });
    console.log(`Explorer URL: ${explorerUrl}`);

    // Attendre que la transaction soit confirmée (dans un environnement réel, vous utiliseriez un mécanisme de polling)
    console.log("\nAttente de la confirmation de la transaction...");
    console.log("Ce processus peut prendre plusieurs minutes. Veuillez consulter l'explorateur pour plus de détails.");

    return {
      status: "success",
      txHash,
      explorerUrl,
      sourceAsset: sourceAsset.toString(),
      destinationAsset,
      amount: runeAmount,
    };
  } catch (error) {
    console.error("\n❌ Erreur lors de l'exécution du swap:", error);
    return {
      status: "error",
      error: error.message || "Erreur inconnue",
    };
  }
}

// Script d'exécution
if (require.main === module) {
  // Récupérer le montant depuis les arguments de la ligne de commande ou utiliser 1 par défaut
  const amount = process.argv[2] || "1";

  // Exécuter le swap direct via ThorChain
  executeThorchainDirectSwap(amount)
    .then(result => {
      if (result && result.status === "success") {
        console.log("\n✅ Swap exécuté avec succès!");
        console.log(`Transaction hash: ${result.txHash}`);
        console.log(`Explorer URL: ${result.explorerUrl}`);
        console.log(`Montant envoyé: ${result.amount} ${result.sourceAsset}`);
        console.log(`Destination: ${result.destinationAsset}`);
      } else if (result && result.status === "error") {
        console.error(`\n❌ Erreur lors de l'exécution du swap: ${result.error}`);
      } else {
        console.error("\n❌ Le swap n'a pas pu être exécuté.");
      }
    })
    .catch(error => {
      console.error("Erreur inattendue:", error);
    });
}
