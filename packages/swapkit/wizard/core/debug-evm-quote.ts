/**
 * Utilitaire de débogage pour les erreurs de quote dans SwapKit
 *
 * Ce fichier aide à diagnostiquer les erreurs lors de l'obtention de quotes,
 * notamment les erreurs "toolbox_evm_error_estimating_gas_limit".
 */

import { Chain } from "@swapkit/core";
import { getSwapKitClient } from "./client";

/**
 * Interface pour les options de débogage
 */
interface DebugQuoteOptions {
  sourceAssetString: string;
  destinationAssetString: string;
  amount: string;
  slippage?: number;
  sourceAddress?: string;
  destinationAddress?: string;
  // Note: Ne pas utiliser preferredProvider ou providers car cela peut causer des problèmes
  verbose?: boolean;
}

/**
 * Fonction principale pour déboguer un quote de swap
 * @param options Options de débogage
 */
export async function debugSwapQuote(options: DebugQuoteOptions): Promise<void> {
  const {
    sourceAssetString,
    destinationAssetString,
    amount,
    slippage = 1,
    sourceAddress,
    destinationAddress,
    // preferredProvider supprimé
    verbose = true
  } = options;

  console.log('\n🔍 DÉBOGAGE DE QUOTE SWAPKIT');
  console.log('===========================\n');

  console.log('📋 PARAMÈTRES:');
  console.log(`Source: ${sourceAssetString}`);
  console.log(`Destination: ${destinationAssetString}`);
  console.log(`Montant: ${amount}`);
  console.log(`Slippage: ${slippage}%`);
  if (sourceAddress) console.log(`Adresse source: ${sourceAddress}`);
  if (destinationAddress) console.log(`Adresse destination: ${destinationAddress}`);
  // Ne pas utiliser preferredProvider ou providers

  // Extraire les chaînes à partir des assets
  const extractChainFromAsset = (assetString: string): Chain => {
    const chainString = assetString.split('.')[0];
    if (chainString.toUpperCase() === 'BNB') {
      return Chain.BinanceSmartChain;
    }
    return chainString as unknown as Chain;
  };

  const sourceChain = extractChainFromAsset(sourceAssetString);
  const destinationChain = extractChainFromAsset(destinationAssetString);

  console.log(`\n🔗 CHAÎNES DÉTECTÉES:`);
  console.log(`Chaîne source: ${sourceChain}`);
  console.log(`Chaîne destination: ${destinationChain}`);

  // Vérifier si c'est un swap cross-chain
  if (sourceChain !== destinationChain) {
    console.log(`\n⚠️ Swap cross-chain détecté: ${sourceChain} -> ${destinationChain}`);
  }

  // Initialiser SwapKit
  console.log('\n🔌 INITIALISATION DE SWAPKIT:');
  let swapKit: any;
  try {
    console.log(`Initialisation de SwapKit...`);
    swapKit = getSwapKitClient([sourceChain, destinationChain]);

    if (!swapKit) {
      console.error('❌ Échec de l\'initialisation de SwapKit');
      return;
    }

    console.log('✅ SwapKit initialisé avec succès');

    // Connecter dynamiquement les chaînes nécessaires
    console.log(`Connexion des chaînes: ${sourceChain}, ${destinationChain}...`);

    // Utiliser une phrase mnémonique de test pour le développement
    const phrase = process.env.MNEMONIC || "test test test test test test test test test test test junk";

    try {
      await swapKit.connectKeystore([sourceChain, destinationChain], phrase);
      console.log(`✅ Portefeuilles connectés avec succès!`);
    } catch (error) {
      console.warn(`⚠️ Impossible de connecter les portefeuilles: ${error.message}`);
      console.log('Continuons sans portefeuilles connectés...');
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de SwapKit:', error);
    return;
  }

  // Vérifier les adresses des portefeuilles
  console.log('\n👛 VÉRIFICATION DES PORTEFEUILLES:');
  const actualSourceAddress = sourceAddress || swapKit.getAddress(sourceChain);
  const actualDestAddress = destinationAddress || swapKit.getAddress(destinationChain);

  console.log(`Adresse source: ${actualSourceAddress || 'Non disponible'}`);
  console.log(`Adresse destination: ${actualDestAddress || 'Non disponible'}`);

  if (!actualSourceAddress) {
    console.warn('⚠️ Adresse source non disponible. Connectez un portefeuille pour la chaîne source.');
  }

  // Vérifier les balances
  if (actualSourceAddress) {
    console.log('\n💰 VÉRIFICATION DES BALANCES:');
    try {
      // Utiliser la méthode correcte pour obtenir les balances
      // SwapKit expose getBalance pour un seul asset, pas getBalances pour tous
      console.log('Tentative de récupération des balances...');

      // Extraire les informations sur l'asset source
      const sourceAssetTicker = sourceAssetString.split('.')[1].split('-')[0];
      const sourceAssetAddress = sourceAssetString.includes('-') ?
        sourceAssetString.split('-')[1] :
        undefined;

      // Obtenir la balance de l'asset source
      let sourceBalance;
      try {
        if (sourceAssetAddress) {
          // Pour les tokens ERC20
          sourceBalance = await swapKit.getBalance(sourceChain, sourceAssetAddress, actualSourceAddress);
          console.log(`Balance de ${sourceAssetTicker}: ${sourceBalance?.formattedAmount || 'Non disponible'}`);
        } else {
          // Pour les assets natifs (ETH, BNB, etc.)
          sourceBalance = await swapKit.getBalance(sourceChain, sourceAssetTicker, actualSourceAddress);
          console.log(`Balance de ${sourceAssetTicker}: ${sourceBalance?.formattedAmount || 'Non disponible'}`);
        }

        // Vérifier si le solde est suffisant
        if (sourceBalance && parseFloat(sourceBalance.formattedAmount) < parseFloat(amount)) {
          console.error(`❌ PROBLÈME DÉTECTÉ: Solde insuffisant pour le swap`);
          console.log(`   Solde: ${sourceBalance.formattedAmount} ${sourceAssetTicker}`);
          console.log(`   Montant à swapper: ${amount} ${sourceAssetTicker}`);
        } else if (sourceBalance) {
          console.log('✅ Solde suffisant pour le swap');
        }
      } catch (balanceError) {
        console.error(`❌ Erreur lors de la récupération de la balance de ${sourceAssetTicker}:`, balanceError);

        // Essayer d'obtenir la balance native comme fallback
        try {
          const nativeBalance = await swapKit.getBalance(sourceChain);
          console.log(`Balance native de ${sourceChain}: ${nativeBalance?.formattedAmount || 'Non disponible'}`);
        } catch (nativeError) {
          console.error('❌ Impossible de récupérer la balance native:', nativeError);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des balances:', error);
      console.log('Conseil: Vérifiez que le portefeuille est correctement connecté pour la chaîne source.');
    }
  }

  // Obtenir un quote
  console.log('\n📊 OBTENTION DU QUOTE:');
  try {
    console.log('Envoi de la requête de quote...');

    // Construire la requête
    const quoteRequest = {
      sourceAsset: sourceAssetString,
      destinationAsset: destinationAssetString,
      sourceAmount: amount,
      slippage,
      sourceAddress: actualSourceAddress,
      destinationAddress: actualDestAddress,
      // Ne pas utiliser providers ou preferredProvider
    };

    // Toujours afficher la requête pour le débogage
    console.log('\n📣 REQUÊTE API ENVOYÉE:');
    console.log(JSON.stringify(quoteRequest, null, 2));

    // Afficher les détails des assets pour vérifier leur format
    console.log('\n🔍 DÉTAILS DES ASSETS:');
    console.log(`Source: ${quoteRequest.sourceAsset}`);
    console.log(`  - Chaîne: ${quoteRequest.sourceAsset.split('.')[0]}`);
    console.log(`  - Token: ${quoteRequest.sourceAsset.split('.')[1]}`);
    console.log(`Destination: ${quoteRequest.destinationAsset}`);
    console.log(`  - Chaîne: ${quoteRequest.destinationAsset.split('.')[0]}`);
    console.log(`  - Token: ${quoteRequest.destinationAsset.split('.')[1]}`);

    // Vérifier la validité des assets
    console.log('\n⚙️ VÉRIFICATION DES ASSETS:');

    // Vérifier le format des assets
    const isValidAssetFormat = (asset: string): boolean => {
      // Format attendu: CHAIN.SYMBOL ou CHAIN.SYMBOL-ADDRESS
      return /^[A-Za-z0-9]+\.[A-Za-z0-9]+(\-[A-Za-z0-9]+)?$/.test(asset);
    };

    const sourceAssetValid = isValidAssetFormat(quoteRequest.sourceAsset);
    const destAssetValid = isValidAssetFormat(quoteRequest.destinationAsset);

    console.log(`Format de l'asset source: ${sourceAssetValid ? '✅ Valide' : '❌ Invalide'}`);
    console.log(`Format de l'asset destination: ${destAssetValid ? '✅ Valide' : '❌ Invalide'}`);

    // Vérifier les chaînes supportées
    const supportedChains = ['ETH', 'BSC', 'AVAX', 'MATIC', 'ARBITRUM', 'OPTIMISM', 'BTC', 'LTC', 'BCH', 'DOGE', 'THOR', 'MAYA', 'ATOM', 'GAIA', 'KUJIRA', 'OSMO'];

    const sourceChainSupported = supportedChains.includes(quoteRequest.sourceAsset.split('.')[0]);
    const destChainSupported = supportedChains.includes(quoteRequest.destinationAsset.split('.')[0]);

    console.log(`Chaîne source supportée: ${sourceChainSupported ? '✅ Oui' : '❌ Non'}`);
    console.log(`Chaîne destination supportée: ${destChainSupported ? '✅ Oui' : '❌ Non'}`);

    // Vérifier le montant
    console.log(`Montant: ${quoteRequest.sourceAmount} (${isNaN(parseFloat(quoteRequest.sourceAmount)) ? '❌ Invalide' : '✅ Valide'})`);

    // Avertir si des problèmes sont détectés
    if (!sourceAssetValid || !destAssetValid || !sourceChainSupported || !destChainSupported || isNaN(parseFloat(quoteRequest.sourceAmount))) {
      console.warn('\n⚠️ AVERTISSEMENT: Des problèmes ont été détectés dans les paramètres de la requête.');
    }

    // Vérifier les adresses
    console.log('\n🔑 ADRESSES:');
    console.log(`Source: ${quoteRequest.sourceAddress || 'Non spécifiée'}`);
    console.log(`Destination: ${quoteRequest.destinationAddress || 'Non spécifiée'}`);

    // Vérifier les adresses de tokens ERC20
    console.log('\n💰 ADRESSES DE TOKENS:');

    // Fonction pour extraire l'adresse d'un token ERC20
    const extractTokenAddress = (assetString: string): string | null => {
      const parts = assetString.split('-');
      return parts.length > 1 ? parts[1] : null;
    };

    // Fonction pour vérifier si une adresse ERC20 est valide
    const isValidEthAddress = (address: string | null): boolean => {
      if (!address) return false;
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    };

    // Vérifier l'adresse du token source
    const sourceTokenAddress = extractTokenAddress(quoteRequest.sourceAsset.split('.')[1]);
    if (sourceTokenAddress) {
      const isValidSource = isValidEthAddress(sourceTokenAddress);
      console.log(`Adresse du token source: ${sourceTokenAddress}`);
      console.log(`Format valide: ${isValidSource ? '✅ Oui' : '❌ Non'}`);
    } else {
      console.log('Token source: Asset natif (pas d\'adresse de contrat)');
    }

    // Vérifier l'adresse du token destination
    const destTokenAddress = extractTokenAddress(quoteRequest.destinationAsset.split('.')[1]);
    if (destTokenAddress) {
      const isValidDest = isValidEthAddress(destTokenAddress);
      console.log(`Adresse du token destination: ${destTokenAddress}`);
      console.log(`Format valide: ${isValidDest ? '✅ Oui' : '❌ Non'}`);

      // Avertir si l'adresse du token n'est pas valide
      if (!isValidDest) {
        console.warn('⚠️ AVERTISSEMENT: L\'adresse du token destination n\'est pas au format ERC20 valide.');
      }
    } else {
      console.log('Token destination: Asset natif (pas d\'adresse de contrat)');
    }

    // Obtenir le quote
    console.log('\n⏳ ENVOI DE LA REQUÊTE...');
    const startTime = Date.now();
    let quoteResponse;
    try {
      quoteResponse = await swapKit.api.getSwapQuote(quoteRequest);
      const endTime = Date.now();
      console.log(`\n✅ Quote obtenu en ${endTime - startTime}ms`);
    } catch (error) {
      const endTime = Date.now();
      console.error(`\n❌ Échec de la requête après ${endTime - startTime}ms`);
      console.error(`Erreur: ${error.message || error}`);

      // Afficher les détails de l'erreur
      console.log('\n🔍 DÉTAILS DE L\'ERREUR:');
      if (error.code) console.log(`Code: ${error.code}`);
      if (error.cause) console.log(`Cause: ${error.cause}`);
      if (error.data) console.log(`Données: ${JSON.stringify(error.data, null, 2)}`);
      if (error.stack) {
        console.log('\nStack trace:');
        console.log(error.stack);
      }

      // Suggestions spécifiques en fonction du type d'erreur
      console.log('\n💡 SUGGESTIONS:');
      if (error.message?.includes('validation_error')) {
        console.log('- Vérifiez le format des assets (doit être "CHAIN.SYMBOL" ou "CHAIN.SYMBOL-ADDRESS")');
        console.log('- Assurez-vous que les adresses des tokens sont correctes');
        console.log('- Vérifiez que le montant est valide et dans le bon format');
      } else if (error.message?.includes('api_v2_server_error')) {
        console.log('- Problème avec le serveur API de SwapKit');
        console.log('- Vérifiez que les assets sont supportés par SwapKit');
        console.log('- Essayez avec un montant différent');
      }

      // Terminer la fonction ici en cas d'erreur
      return;
    }

    // Analyser la réponse
    if (quoteResponse.routes && quoteResponse.routes.length > 0) {
      console.log(`\n🛣️ ${quoteResponse.routes.length} routes trouvées`);

      // Trier les routes par montant attendu
      const sortedRoutes = [...quoteResponse.routes].sort(
        (a, b) => parseFloat(b.expectedBuyAmount) - parseFloat(a.expectedBuyAmount)
      );

      // Afficher la meilleure route
      const bestRoute = sortedRoutes[0];
      console.log('\n🥇 MEILLEURE ROUTE:');
      console.log(`Fournisseur: ${bestRoute.providers.join(', ')}`);
      console.log(`Montant d'entrée: ${bestRoute.sellAmount} ${bestRoute.sellAsset}`);
      console.log(`Montant de sortie estimé: ${bestRoute.expectedBuyAmount} ${bestRoute.buyAsset}`);

      // Vérifier les avertissements
      if (bestRoute.warnings && bestRoute.warnings.length > 0) {
        console.log('\n⚠️ AVERTISSEMENTS:');
        bestRoute.warnings.forEach(warning => {
          console.log(`- ${warning.code}: ${warning.display}`);
          console.log(`  ${warning.tooltip}`);

          // Vérifier l'impact de prix
          if (warning.code === 'highPriceImpact' && bestRoute.meta && typeof bestRoute.meta.priceImpact === 'number') {
            const priceImpact = bestRoute.meta.priceImpact;
            console.log(`  Impact de prix: ${priceImpact}%`);

            if (priceImpact <= -50) {
              console.error(`\n❌ PROBLÈME CRITIQUE: Impact de prix extrêmement élevé (${priceImpact}%)`);
              console.error('  Ce swap serait automatiquement annulé en production.');
            }
          }
        });
      }

      // Vérifier les frais
      console.log('\n💸 FRAIS:');
      if (bestRoute.fees && bestRoute.fees.length > 0) {
        bestRoute.fees.forEach(fee => {
          console.log(`- Type: ${fee.type}, Montant: ${fee.amount} ${fee.asset}, Chaîne: ${fee.chain}`);
        });
      } else {
        console.log('Aucun frais spécifique détecté');
      }

      // Vérifier les informations de transaction
      if (bestRoute.tx) {
        console.log('\n📝 INFORMATIONS DE TRANSACTION:');
        console.log(`To: ${bestRoute.tx.to}`);
        console.log(`From: ${bestRoute.tx.from}`);
        console.log(`Gas: ${parseInt(bestRoute.tx.gas || '0', 16)} unités`);
        console.log(`Gas Price: ${parseInt(bestRoute.tx.gasPrice || '0', 16) / 1e9} Gwei`);

        // Calculer le coût en gas
        if (bestRoute.tx.gas && bestRoute.tx.gasPrice) {
          const gasLimit = parseInt(bestRoute.tx.gas, 16);
          const gasPrice = parseInt(bestRoute.tx.gasPrice, 16);
          const gasCostWei = BigInt(gasLimit) * BigInt(gasPrice);
          const gasCostEth = Number(gasCostWei) / 1e18;
          console.log(`Coût estimé en gas: ${gasCostEth.toFixed(8)} ETH`);
        }

        // Afficher les données de transaction si verbose
        if (verbose) {
          console.log('\nDonnées de transaction:');
          console.log(bestRoute.tx.data);

          // Extraire le sélecteur de fonction (premiers 4 octets)
          if (bestRoute.tx.data) {
            const selector = bestRoute.tx.data.substring(0, 10);
            console.log(`\nSélecteur de fonction: ${selector}`);

            // Liste des sélecteurs de fonction courants
            const knownSelectors: Record<string, string> = {
              '0x18cbafe5': 'swapExactTokensForTokens (Uniswap V2)',
              '0x38ed1739': 'swapExactTokensForTokens (variante)',
              '0x8a0d6b5d': 'swapTokensForExactTokens',
              '0x4a25d94a': 'swapTokensForExactETH',
              '0x7ff36ab5': 'swapExactETHForTokens',
              '0xfb3bdb41': 'swapETHForExactTokens',
              '0x5c11d795': 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
              '0xb6f9de95': 'swapExactETHForTokensSupportingFeeOnTransferTokens',
              '0x791ac947': 'swapExactTokensForETHSupportingFeeOnTransferTokens',
              '0x04e45aaf': 'exactInputSingle (Uniswap V3)',
              '0xac9650d8': 'multicall (Uniswap V3)',
              '0x83800a8e': 'swap (1inch)',
              '0xe449022e': 'uniswapV3SwapTo (1inch)',
              '0x12aa3caf': 'swap (0x Protocol)',
            };

            console.log(`Fonction identifiée: ${knownSelectors[selector] || 'Fonction inconnue'}`);
          }
        }
      }

      // Afficher les métadonnées
      if (bestRoute.meta && verbose) {
        console.log('\n📋 MÉTADONNÉES:');
        console.log(`Impact de prix: ${bestRoute.meta.priceImpact}%`);
        console.log(`Adresse d'approbation: ${bestRoute.meta.approvalAddress || 'N/A'}`);
        console.log(`Tags: ${bestRoute.meta.tags?.join(', ') || 'Aucun'}`);

        // Afficher les informations sur les assets
        if (bestRoute.meta.assets && bestRoute.meta.assets.length > 0) {
          console.log('\nInformations sur les assets:');
          bestRoute.meta.assets.forEach(asset => {
            console.log(`- ${asset.asset}: $${asset.price}`);
          });
        }
      }
    } else {
      console.error('❌ Aucune route trouvée');

      // Vérifier les erreurs des fournisseurs
      if (quoteResponse.providerErrors && quoteResponse.providerErrors.length > 0) {
        console.log('\n❌ ERREURS DES FOURNISSEURS:');
        quoteResponse.providerErrors.forEach(error => {
          console.log(`- ${error.provider}: ${error.errorCode}`);
        });
      }
    }

    // Afficher la réponse complète si verbose
    if (verbose) {
      console.log('\n📄 RÉPONSE COMPLÈTE:');
      console.log(JSON.stringify(quoteResponse, null, 2));
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'obtention du quote:', error);

    // Analyser l'erreur
    if (error.message) {
      console.log('\n🔍 ANALYSE DE L\'ERREUR:');

      if (error.message.includes('toolbox_evm_error_estimating_gas_limit')) {
        console.log('Erreur d\'estimation de gas dans la toolbox EVM');
        console.log('Causes possibles:');
        console.log('1. Paramètres de transaction invalides');
        console.log('2. Le contrat rejette la transaction (revert)');
        console.log('3. Fonds insuffisants pour la transaction');
        console.log('4. Problème de connexion au provider RPC');
        console.log('5. Paire de tokens non supportée par le fournisseur');
      } else if (error.message.includes('no_route_found')) {
        console.log('Aucune route trouvée pour ce swap');
        console.log('Causes possibles:');
        console.log('1. Paire de tokens non supportée');
        console.log('2. Liquidité insuffisante');
        console.log('3. Montant trop petit ou trop grand');
      } else if (error.message.includes('insufficient_funds')) {
        console.log('Fonds insuffisants pour exécuter la transaction');
      }
    }

    // Afficher l'erreur complète si verbose
    if (verbose && error.stack) {
      console.log('\nStack trace:');
      console.log(error.stack);
    }
  }

  console.log('\n✨ SUGGESTIONS:');
  console.log('1. Vérifiez que les adresses des tokens sont correctes et supportées');
  console.log('2. Assurez-vous d\'avoir suffisamment de fonds pour la transaction et les frais de gas');
  console.log('3. Essayez d\'augmenter le slippage si vous effectuez un swap');
  console.log('4. Vérifiez que la paire de tokens est disponible sur le DEX ciblé');
  console.log('5. Essayez un montant différent (ni trop petit, ni trop grand)');
  console.log('6. Testez avec un autre fournisseur si les problèmes persistent');
}

/**
 * Fonction pour déboguer un swap USDC -> ETH
 * @param amount Montant de USDC à swapper
 * @param slippage Slippage en pourcentage (par défaut: 1)
 */
export async function debugUsdcToEthSwap(amount: string = "1", slippage: number = 1): Promise<void> {
  return debugSwapQuote({
    sourceAssetString: "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    destinationAssetString: "ETH.ETH",
    amount,
    slippage,
    // Ne pas utiliser preferredProvider
  });
}

/**
 * Fonction pour déboguer un swap ETH -> USDC
 * @param amount Montant d'ETH à swapper
 * @param slippage Slippage en pourcentage (par défaut: 1)
 */
export async function debugEthToUsdcSwap(amount: string = "0.01", slippage: number = 1): Promise<void> {
  return debugSwapQuote({
    sourceAssetString: "ETH.ETH",
    destinationAssetString: "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    amount,
    slippage,
    // Ne pas utiliser preferredProvider
  });
}

/**
 * Fonction pour déboguer un swap THOR.RUNE -> BNB.BNB
 * @param amount Montant de RUNE à swapper
 * @param slippage Slippage en pourcentage (par défaut: 3)
 */
export async function debugRuneToBnbSwap(amount: string = "1", slippage: number = 3): Promise<void> {
  return debugSwapQuote({
    sourceAssetString: "THOR.RUNE",
    destinationAssetString: "BNB.BNB",
    amount,
    slippage,
    // Ne pas utiliser preferredProvider
  });
}

// Exemple d'utilisation:
// Pour exécuter: bun run packages/swapkit/wizard/core/debug-evm-quote.ts
if (require.main === module) {
  // Déterminer quelle fonction exécuter en fonction des arguments
  const args = process.argv.slice(2);
  const swapType = args[0] || 'usdc-to-eth';
  const amount = args[1];
  const slippage = args[2] ? parseFloat(args[2]) : undefined;

  console.log(`Exécution du débogage pour: ${swapType}`);

  switch (swapType.toLowerCase()) {
    case 'usdc-to-eth':
      debugUsdcToEthSwap(amount, slippage).catch(console.error);
      break;
    case 'eth-to-usdc':
      debugEthToUsdcSwap(amount, slippage).catch(console.error);
      break;
    case 'rune-to-bnb':
      debugRuneToBnbSwap(amount, slippage).catch(console.error);
      break;
    default:
      console.error(`Type de swap inconnu: ${swapType}`);
      console.log('Types disponibles: eth-to-usdc, usdc-to-eth, rune-to-bnb');
  }
}
