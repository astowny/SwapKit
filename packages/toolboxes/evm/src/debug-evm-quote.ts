/**
 * Utilitaire de débogage pour les erreurs d'estimation de gaz dans SwapKit EVM
 *
 * Ce fichier aide à diagnostiquer les erreurs "toolbox_evm_error_estimating_gas_limit"
 * en fournissant des fonctions de débogage détaillées.
 */

import { ethers } from "ethers";
import { getProvider } from "./provider";

/**
 * Fonction pour déboguer une estimation de gaz échouée
 * @param txObject L'objet de transaction qui a échoué
 * @param chainId L'ID de chaîne EVM
 * @param rpcUrl URL RPC optionnelle à utiliser au lieu de celle par défaut
 */
export async function debugGasEstimation(
  txObject: ethers.providers.TransactionRequest,
  chainId: number,
  rpcUrl?: string,
): Promise<void> {
  console.log("\n🔍 DÉBOGAGE D'ESTIMATION DE GAZ EVM");
  console.log("=====================================\n");

  // 1. Afficher les détails de la transaction
  console.log("📝 DÉTAILS DE LA TRANSACTION:");
  console.log("---------------------------");
  console.log(`To: ${txObject.to}`);
  console.log(`From: ${txObject.from}`);
  console.log(
    `Value: ${txObject.value ? ethers.utils.formatEther(txObject.value) + " ETH" : "0 ETH"}`,
  );
  console.log(
    `Gas Price: ${txObject.gasPrice ? ethers.utils.formatUnits(txObject.gasPrice, "gwei") + " Gwei" : "Non spécifié"}`,
  );
  console.log(`Gas Limit: ${txObject.gasLimit || "Non spécifié"}`);
  console.log(`Nonce: ${txObject.nonce !== undefined ? txObject.nonce : "Non spécifié"}`);

  // Afficher les données de transaction de manière plus lisible
  if (txObject.data) {
    console.log("\n📊 DONNÉES DE TRANSACTION:");
    console.log("------------------------");
    console.log(`Data (hex): ${txObject.data}`);

    // Extraire le sélecteur de fonction (premiers 4 octets)
    const selector = txObject.data.toString().substring(0, 10);
    console.log(`Sélecteur de fonction: ${selector}`);

    // Liste des sélecteurs de fonction courants
    const knownSelectors: Record<string, string> = {
      "0x18cbafe5": "swapExactTokensForTokens (Uniswap V2)",
      "0x38ed1739": "swapExactTokensForTokens (variante)",
      "0x8a0d6b5d": "swapTokensForExactTokens",
      "0x4a25d94a": "swapTokensForExactETH",
      "0x7ff36ab5": "swapExactETHForTokens",
      "0xfb3bdb41": "swapETHForExactTokens",
      "0x5c11d795": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
      "0xb6f9de95": "swapExactETHForTokensSupportingFeeOnTransferTokens",
      "0x791ac947": "swapExactTokensForETHSupportingFeeOnTransferTokens",
      "0x04e45aaf": "exactInputSingle (Uniswap V3)",
      "0xac9650d8": "multicall (Uniswap V3)",
      "0x83800a8e": "swap (1inch)",
      "0xe449022e": "uniswapV3SwapTo (1inch)",
      "0x12aa3caf": "swap (0x Protocol)",
    };

    console.log(`Fonction identifiée: ${knownSelectors[selector] || "Fonction inconnue"}`);
  }

  // 2. Obtenir le provider
  console.log("\n🔌 INFORMATIONS DU PROVIDER:");
  console.log("---------------------------");

  let provider: ethers.providers.Provider;
  try {
    if (rpcUrl) {
      console.log(`Utilisation du RPC URL personnalisé: ${rpcUrl}`);
      provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    } else {
      console.log(`Obtention du provider pour chainId: ${chainId}`);
      provider = await getProvider(chainId);
    }

    // Vérifier la connexion au provider
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Provider connecté - Dernier bloc: ${blockNumber}`);
  } catch (error) {
    console.error(`❌ Erreur lors de la connexion au provider: ${error.message}`);
    console.error("Détails:", error);
    return;
  }

  // 3. Vérifier le solde du compte
  if (txObject.from) {
    try {
      const balance = await provider.getBalance(txObject.from);
      console.log(`Solde du compte: ${ethers.utils.formatEther(balance)} ETH`);

      // Vérifier si le solde est suffisant pour la transaction
      if (txObject.value) {
        const txValue = ethers.BigNumber.from(txObject.value);
        if (balance.lt(txValue)) {
          console.error(`❌ PROBLÈME DÉTECTÉ: Solde insuffisant pour la valeur de la transaction`);
          console.log(`   Solde: ${ethers.utils.formatEther(balance)} ETH`);
          console.log(`   Valeur de la transaction: ${ethers.utils.formatEther(txValue)} ETH`);
        }
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération du solde: ${error.message}`);
    }
  }

  // 4. Tester l'estimation de gaz
  console.log("\n⛽ TEST D'ESTIMATION DE GAZ:");
  console.log("---------------------------");
  try {
    console.log("Tentative d'estimation de gaz...");
    const gasEstimate = await provider.estimateGas(txObject);
    console.log(`✅ Estimation réussie: ${gasEstimate.toString()} unités de gaz`);

    // Calculer le coût en ETH
    if (txObject.gasPrice) {
      const gasCost = gasEstimate.mul(ethers.BigNumber.from(txObject.gasPrice));
      console.log(`Coût estimé: ${ethers.utils.formatEther(gasCost)} ETH`);
    }
  } catch (error) {
    console.error(`❌ Échec de l'estimation de gaz: ${error.message}`);

    // Analyser l'erreur pour des indices
    if (error.message.includes("always failing transaction")) {
      console.log("\n🔍 ANALYSE DE L'ERREUR:");
      console.log("La transaction échoue systématiquement lors de la simulation.");
      console.log("Causes possibles:");
      console.log("1. Paramètres de transaction invalides");
      console.log("2. Le contrat rejette la transaction (revert)");
      console.log("3. Problème de logique dans le contrat pour ces paramètres spécifiques");
    } else if (error.message.includes("insufficient funds")) {
      console.log("\n🔍 ANALYSE DE L'ERREUR:");
      console.log("Fonds insuffisants pour exécuter la transaction.");
    } else if (error.message.includes("execution reverted")) {
      console.log("\n🔍 ANALYSE DE L'ERREUR:");
      console.log("Le contrat a rejeté l'exécution.");

      // Extraire la raison du revert si disponible
      const revertReason = error.message.match(/execution reverted: (.*?)(?:"|$)/);
      if (revertReason && revertReason[1]) {
        console.log(`Raison du revert: ${revertReason[1]}`);
      }
    }

    // Afficher l'erreur complète pour référence
    console.log("\nErreur complète:");
    console.error(error);
  }

  // 5. Vérifier les paramètres courants pour les swaps
  if (txObject.data && txObject.data.toString().length > 10) {
    console.log("\n🧪 VÉRIFICATION DES PARAMÈTRES DE SWAP:");
    console.log("------------------------------------");

    try {
      // Extraire les données après le sélecteur
      const dataWithoutSelector = txObject.data.toString().substring(10);

      // Découper en blocs de 64 caractères (32 octets)
      for (let i = 0; i < dataWithoutSelector.length; i += 64) {
        const paramData = dataWithoutSelector.substring(i, i + 64);
        console.log(`Paramètre ${Math.floor(i / 64) + 1}: ${paramData}`);

        // Essayer d'interpréter comme adresse
        if (paramData.startsWith("000000000000000000000000")) {
          const address = "0x" + paramData.substring(24);
          console.log(`  Possible adresse: ${address}`);

          // Vérifier si c'est une adresse de contrat
          try {
            const code = await provider.getCode(address);
            if (code !== "0x") {
              console.log(
                `  ✅ Adresse de contrat valide (longueur du code: ${code.length / 2 - 1} octets)`,
              );
            } else {
              console.log(`  ℹ️ Adresse EOA (compte externe) ou contrat non déployé`);
            }
          } catch (e) {
            console.log(`  ❌ Erreur lors de la vérification de l'adresse: ${e.message}`);
          }
        }

        // Essayer d'interpréter comme montant
        try {
          const value = ethers.BigNumber.from("0x" + paramData);
          if (!value.isZero()) {
            console.log(`  Valeur numérique: ${value.toString()}`);

            // Essayer différentes unités courantes
            console.log(`  En ETH: ${ethers.utils.formatEther(value)}`);
            console.log(`  En tokens (6 décimales): ${ethers.utils.formatUnits(value, 6)}`);
            console.log(`  En tokens (18 décimales): ${ethers.utils.formatUnits(value, 18)}`);
          }
        } catch (e) {
          // Ignorer les erreurs d'interprétation
        }
      }
    } catch (error) {
      console.log(`Erreur lors de l'analyse des paramètres: ${error.message}`);
    }
  }

  console.log("\n✨ SUGGESTIONS:");
  console.log("-------------");
  console.log("1. Vérifiez que les adresses des tokens sont correctes et supportées");
  console.log(
    "2. Assurez-vous d'avoir suffisamment de fonds pour la transaction et les frais de gaz",
  );
  console.log("3. Essayez d'augmenter le slippage si vous effectuez un swap");
  console.log("4. Vérifiez que la paire de tokens est disponible sur le DEX ciblé");
  console.log("5. Essayez un montant différent (ni trop petit, ni trop grand)");
  console.log("6. Testez avec un autre RPC URL si les problèmes persistent");
}

/**
 * Fonction pour déboguer un quote de swap spécifique
 * @param sourceAsset Asset source (format: "CHAIN.SYMBOL" ou "CHAIN.SYMBOL-ADDRESS")
 * @param destinationAsset Asset destination (format: "CHAIN.SYMBOL" ou "CHAIN.SYMBOL-ADDRESS")
 * @param amount Montant à swapper
 * @param slippage Slippage en pourcentage (par défaut: 1)
 * @param rpcUrl URL RPC optionnelle
 */
export async function debugSwapQuote(
  sourceAsset: string,
  destinationAsset: string,
  amount: string,
  slippage = 1,
  rpcUrl?: string,
): Promise<void> {
  console.log("\n🔄 DÉBOGAGE DE QUOTE DE SWAP");
  console.log("===========================\n");

  console.log(`Source: ${sourceAsset}`);
  console.log(`Destination: ${destinationAsset}`);
  console.log(`Montant: ${amount}`);
  console.log(`Slippage: ${slippage}%`);

  // Extraire les informations de chaîne et de token
  const [sourceChain, sourceToken] = parseAsset(sourceAsset);
  const [destChain, destToken] = parseAsset(destinationAsset);

  console.log(`\nChaîne source: ${sourceChain}`);
  console.log(`Token source: ${sourceToken}`);
  console.log(`Chaîne destination: ${destChain}`);
  console.log(`Token destination: ${destToken}`);

  // Vérifier si les chaînes sont supportées
  if (!isChainSupported(sourceChain)) {
    console.error(`❌ Chaîne source non supportée: ${sourceChain}`);
    return;
  }

  if (!isChainSupported(destChain)) {
    console.error(`❌ Chaîne destination non supportée: ${destChain}`);
    return;
  }

  // Vérifier si c'est un swap cross-chain
  if (sourceChain !== destChain) {
    console.log(`\n⚠️ Swap cross-chain détecté: ${sourceChain} -> ${destChain}`);
    console.log("Vérifiez que SwapKit supporte cette paire de chaînes pour les swaps cross-chain.");
  }

  // Créer un objet de transaction factice pour tester
  // Note: Ceci est une simulation simplifiée, pas une vraie transaction
  const mockTxObject: ethers.providers.TransactionRequest = {
    to: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Adresse du routeur Uniswap V2 (exemple)
    from: "0x0000000000000000000000000000000000000000", // Sera remplacé par l'adresse réelle
    value: "0x0", // Pour les swaps non-ETH
    data: "0x", // Sera généré dans une implémentation réelle
  };

  // Obtenir l'ID de chaîne EVM
  const chainId = getChainId(sourceChain);
  if (!chainId) {
    console.error(`❌ Impossible de déterminer l'ID de chaîne pour: ${sourceChain}`);
    return;
  }

  console.log(
    `\nTest d'estimation de gaz avec une transaction factice sur ${sourceChain} (chainId: ${chainId})...`,
  );
  console.log("Note: Ceci est une simulation simplifiée pour tester la connexion au provider.");

  // Déboguer l'estimation de gaz
  await debugGasEstimation(mockTxObject, chainId, rpcUrl);
}

/**
 * Fonction utilitaire pour analyser une chaîne d'asset
 * @param assetString Chaîne d'asset (format: "CHAIN.SYMBOL" ou "CHAIN.SYMBOL-ADDRESS")
 * @returns [chaîne, token]
 */
function parseAsset(assetString: string): [string, string] {
  const parts = assetString.split(".");
  if (parts.length !== 2) {
    throw new Error(
      `Format d'asset invalide: ${assetString}. Format attendu: "CHAIN.SYMBOL" ou "CHAIN.SYMBOL-ADDRESS"`,
    );
  }

  const chain = parts[0];
  const tokenPart = parts[1];

  // Vérifier si le token a une adresse
  const addressMatch = tokenPart.match(/^([A-Za-z0-9]+)(?:-(.+))?$/);
  if (!addressMatch) {
    throw new Error(`Format de token invalide: ${tokenPart}`);
  }

  const symbol = addressMatch[1];
  const address = addressMatch[2] || "";

  return [chain, address ? `${symbol}-${address}` : symbol];
}

/**
 * Vérifier si une chaîne est supportée
 * @param chain Chaîne à vérifier
 * @returns true si la chaîne est supportée
 */
function isChainSupported(chain: string): boolean {
  const supportedChains = [
    "ETH",
    "BSC",
    "AVAX",
    "MATIC",
    "ARBITRUM",
    "OPTIMISM",
    "BTC",
    "LTC",
    "BCH",
    "DOGE",
    "THOR",
    "MAYA",
    "ATOM",
    "GAIA",
    "KUJIRA",
    "OSMO",
  ];

  return supportedChains.includes(chain.toUpperCase());
}

/**
 * Obtenir l'ID de chaîne EVM pour une chaîne donnée
 * @param chain Chaîne
 * @returns ID de chaîne EVM ou undefined si non supportée
 */
function getChainId(chain: string): number | undefined {
  const chainMap: Record<string, number> = {
    ETH: 1, // Ethereum Mainnet
    BSC: 56, // Binance Smart Chain
    AVAX: 43114, // Avalanche C-Chain
    MATIC: 137, // Polygon
    ARBITRUM: 42161, // Arbitrum
    OPTIMISM: 10, // Optimism
  };

  return chainMap[chain.toUpperCase()];
}

// Exemple d'utilisation:
// debugSwapQuote("ETH.ETH", "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "0.1", 1);
