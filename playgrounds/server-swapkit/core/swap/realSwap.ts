import {
  AssetValue,
  Chain,
  ChainToChainId,
  FeeOption,
  getExplorerTxUrl,
  type ProviderName,
  SKConfig,
} from "@swapkit/helpers";
import { applyLogPatch } from "../logPatch.js";
import { getSwapKitClient } from "./client.js";
import { clearNetworkLogs, printNetworkSummary } from "./networkUtils.js";
import { TokenProvider, validateAsset } from "./tokenValidator.js";
import { cleanSwapKitForLogging } from "./walletLogger.js";


// Configuration globale des logs
const globalLogConfig = {
  enableDebug: true,
  verboseInfo: true, // Contrôle le niveau de détail des logs d'information
};

// Configuration globale pour le calcul des montants
const globalAmountConfig = {
  // Si true: amount = montant du token cible (ancien comportement)
  // Si false: amount = montant USDT à dépenser (nouveau comportement par défaut)
  amountIsTargetToken: false,
};

// Fonctions utilitaires pour changer le mode de calcul
function setAmountModeToTargetToken() {
  globalAmountConfig.amountIsTargetToken = true;
  console.log("🔄 Mode changé: amount = montant du token cible");
}

function setAmountModeToUsdtAmount() {
  globalAmountConfig.amountIsTargetToken = false;
  console.log("💰 Mode changé: amount = montant USDT à dépenser");
}

function getCurrentAmountMode() {
  return globalAmountConfig.amountIsTargetToken ? "target-token" : "usdt-amount";
}


// Utilitaire de logging simple
const logger = {
  // Fonction pour les logs essentiels (toujours affichés)
  info: (message: string, ...args: any[]) => {
    // Si le message commence par un espace ou un caractère spécial, il est considéré comme détaillé
    const isDetailedLog =
      message.startsWith(" ") ||
      message.startsWith("\n") ||
      message.startsWith("-") ||
      message.startsWith("  ");

    // N'afficher les logs détaillés que si verboseInfo est activé
    if (!isDetailedLog || globalLogConfig.verboseInfo) {
      console.log(message, ...args);
    }
  },
  // Fonction pour les logs de débogage (affichés uniquement si enableDebug est true)
  debug: (message: string, ...args: any[]) => {
    if (globalLogConfig.enableDebug) {
      console.debug(`${message}`, ...args);
    }
  },
  // Fonction pour les logs d'erreur (toujours affichés)
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  // Fonction pour les logs d'avertissement (toujours affichés)
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
};

// Fonction utilitaire pour activer le débogage
export function enableSwapDebug(verbose = true) {
  globalLogConfig.enableDebug = true;
  globalLogConfig.verboseInfo = verbose;
  console.log("🔍 Mode débogage SwapKit activé");
}

// Fonction utilitaire pour désactiver le débogage
export function disableSwapDebug() {
  globalLogConfig.enableDebug = false;
  globalLogConfig.verboseInfo = false;
  console.log("🔇 Mode débogage SwapKit désactivé");
}

// Wrapper pour déboguer les plugins en profondeur
function wrapPluginWithDebug(pluginName: string, plugin: any) {
  if (!plugin || typeof plugin !== 'object') return plugin;

  const wrappedPlugin = { ...plugin };

  // Wrapper pour la méthode swap du plugin
  if (typeof plugin.swap === 'function') {
    const originalSwap = plugin.swap;
    wrappedPlugin.swap = async function debugSwap(params: any) {
      if (globalLogConfig.enableDebug) {
        logger.info(`\n🔍 [${pluginName}] Début du swap au niveau plugin`);
        logger.info(`[${pluginName}] Paramètres reçus:`, JSON.stringify(params, null, 2));

        // Vérifier les propriétés du plugin
        logger.info(`[${pluginName}] Propriétés du plugin:`, Object.keys(plugin));
        if (plugin.supportedSwapkitProviders) {
          logger.info(`[${pluginName}] Providers supportés:`, plugin.supportedSwapkitProviders);
        }
      }

      try {
        const startTime = Date.now();
        const result = await originalSwap.call(this, params);
        const duration = Date.now() - startTime;

        if (globalLogConfig.enableDebug) {
          logger.info(`\n✅ [${pluginName}] Swap réussi en ${duration}ms`);
          logger.info(`[${pluginName}] Résultat:`, typeof result === 'string' ? result : JSON.stringify(result, null, 2));
        }

        return result;
      } catch (error) {
        if (globalLogConfig.enableDebug) {
          logger.error(`\n❌ [${pluginName}] Erreur dans le plugin:`);
          logger.error(`[${pluginName}] Type d'erreur:`, error.constructor.name);
          logger.error(`[${pluginName}] Message:`, error.message);

          if (error.stack) {
            logger.error(`[${pluginName}] Stack trace:`, error.stack);
          }

          // Informations spécifiques SwapKit
          if (error.errorKey) {
            logger.error(`[${pluginName}] Code SwapKit:`, error.errorKey);
          }
          if (error.info) {
            logger.error(`[${pluginName}] Détails SwapKit:`, JSON.stringify(error.info, null, 2));
          }
        }
        throw error;
      }
    };
  }

  // Wrapper pour d'autres méthodes importantes
  ['approveAssetValue', 'isAssetValueApproved'].forEach(methodName => {
    if (typeof plugin[methodName] === 'function') {
      const originalMethod = plugin[methodName];
      wrappedPlugin[methodName] = async function debugMethod(...args: any[]) {
        if (globalLogConfig.enableDebug) {
          logger.info(`\n🔍 [${pluginName}] Appel de ${methodName}`);
          logger.info(`[${pluginName}] Arguments:`, JSON.stringify(args, null, 2));
        }

        try {
          const result = await originalMethod.apply(this, args);
          if (globalLogConfig.enableDebug) {
            logger.info(`✅ [${pluginName}] ${methodName} réussi:`, result);
          }
          return result;
        } catch (error) {
          if (globalLogConfig.enableDebug) {
            logger.error(`❌ [${pluginName}] Erreur dans ${methodName}:`, error.message);
          }
          throw error;
        }
      };
    }
  });

  return wrappedPlugin;
}

// Fonction pour déboguer en profondeur le client SwapKit
function debugSwapKitClient(swapKit: any) {
  if (!globalLogConfig.enableDebug) return swapKit;

  // Wrapper pour la méthode swap principale
  if (swapKit.swap && typeof swapKit.swap === 'function') {
    const originalSwap = swapKit.swap;
    swapKit.swap = async function debugClientSwap(params: any) {
      logger.info(`\n🎯 [SwapKit Client] Début du swap au niveau client`);
      logger.info(`[SwapKit Client] Paramètres:`, JSON.stringify(params, null, 2));

      // Analyser la route pour déterminer le plugin
      if (params.route) {
        const { providers, sellAsset, buyAsset, sellAmount } = params.route;
        logger.info(`[SwapKit Client] Route analysée:`);
        logger.info(`  - Providers: ${providers}`);
        logger.info(`  - Sell Asset: ${sellAsset}`);
        logger.info(`  - Buy Asset: ${buyAsset}`);
        logger.info(`  - Sell Amount: ${sellAmount}`);

        // Déterminer quel plugin sera utilisé
        const pluginName = params.pluginName || providers[0];
        logger.info(`  - Plugin sélectionné: ${pluginName}`);

        // Vérifier si le plugin existe
        if (swapKit.plugins && swapKit.plugins[pluginName]) {
          logger.info(`  - Plugin trouvé: ✅`);
          logger.info(`  - Méthodes du plugin:`, Object.keys(swapKit.plugins[pluginName]));
        } else {
          logger.warn(`  - Plugin non trouvé: ❌`);
          logger.info(`  - Plugins disponibles:`, swapKit.plugins ? Object.keys(swapKit.plugins) : 'Aucun');
        }
      }

      try {
        const result = await originalSwap.call(this, params);
        logger.info(`\n✅ [SwapKit Client] Swap client réussi: ${result}`);
        return result;
      } catch (error) {
        logger.error(`\n❌ [SwapKit Client] Erreur au niveau client:`);
        logger.error(`[SwapKit Client] ${error.constructor.name}: ${error.message}`);

        // Analyser l'erreur pour donner plus de contexte
        if (error.message.includes('plugin')) {
          logger.error(`[SwapKit Client] 🔍 Problème de plugin détecté`);
          logger.error(`[SwapKit Client] Plugins disponibles:`, swapKit.plugins ? Object.keys(swapKit.plugins) : 'Aucun');
        }

        if (error.message.includes('wallet')) {
          logger.error(`[SwapKit Client] 🔍 Problème de wallet détecté`);
          const wallets = swapKit.getAllWallets ? swapKit.getAllWallets() : {};
          logger.error(`[SwapKit Client] Wallets connectés:`, Object.keys(wallets));
        }

        throw error;
      }
    };
  }

  return swapKit;
}

// Fonction pour déboguer les wallets en profondeur
function debugWalletOperations(swapKit: any, chain: string) {
  if (!globalLogConfig.enableDebug) return;

  try {
    const wallet = swapKit.getWallet(chain);
    if (wallet) {
      logger.info(`\n🔍 [Wallet Debug] Wallet ${chain}:`);
      logger.info(`  - Address: ${wallet.address}`);
      logger.info(`  - Wallet Type: ${wallet.walletType}`);
      logger.info(`  - Balance: ${wallet.balance ? wallet.balance.length + ' assets' : 'Non chargé'}`);
      logger.info(`  - Méthodes disponibles: ${Object.keys(wallet).filter(k => typeof wallet[k] === 'function')}`);

      // Vérifier les méthodes critiques
      const criticalMethods = ['sendTransaction', 'signTransaction', 'transfer', 'getBalance'];
      criticalMethods.forEach(method => {
        const hasMethod = typeof wallet[method] === 'function';
        logger.info(`  - ${method}: ${hasMethod ? '✅' : '❌'}`);
      });
    } else {
      logger.warn(`\n⚠️ [Wallet Debug] Aucun wallet trouvé pour ${chain}`);
    }
  } catch (error) {
    logger.error(`\n❌ [Wallet Debug] Erreur lors du debug du wallet ${chain}:`, error.message);
  }
}

// Fonction pour déboguer spécifiquement selon le type de plugin
function debugPluginSpecifics(pluginName: string, swapParams: any) {
  if (!globalLogConfig.enableDebug) return;

  logger.info(`\n🔬 [Plugin Specifics] Debug spécialisé pour ${pluginName}:`);

  switch (pluginName.toLowerCase()) {
    case 'thorchain':
    case 'mayachain':
      logger.info(`[${pluginName}] Type: Cross-chain DEX`);
      if (swapParams.route) {
        logger.info(`[${pluginName}] Memo: ${swapParams.route.memo || 'Non défini'}`);
        logger.info(`[${pluginName}] Inbound address: ${swapParams.route.inboundAddress || 'Non défini'}`);
        logger.info(`[${pluginName}] Expected output: ${swapParams.route.expectedOutput || 'Non défini'}`);
      }
      break;

    case 'evm':
      logger.info(`[${pluginName}] Type: EVM Transaction`);
      if (swapParams.route && swapParams.route.tx) {
        const tx = swapParams.route.tx;
        logger.info(`[${pluginName}] Transaction details:`);
        logger.info(`  - To: ${tx.to}`);
        logger.info(`  - From: ${tx.from}`);
        logger.info(`  - Value: ${tx.value}`);
        logger.info(`  - Gas: ${tx.gas || 'Auto'}`);
        logger.info(`  - Data length: ${tx.data ? tx.data.length : 0} chars`);
      }
      break;

    case 'chainflip':
      logger.info(`[${pluginName}] Type: Chainflip Protocol`);
      if (swapParams.route) {
        logger.info(`[${pluginName}] Deposit address: ${swapParams.route.depositAddress || 'Non défini'}`);
        logger.info(`[${pluginName}] Channel ID: ${swapParams.route.channelId || 'Non défini'}`);
        if (swapParams.route.meta && swapParams.route.meta.chainflip) {
          logger.info(`[${pluginName}] Chainflip meta:`, JSON.stringify(swapParams.route.meta.chainflip, null, 2));
        }
      }
      break;

    case 'radix':
      logger.info(`[${pluginName}] Type: Radix DLT`);
      if (swapParams.route && swapParams.route.tx) {
        logger.info(`[${pluginName}] Manifest: ${typeof swapParams.route.tx === 'string' ? 'Présent' : 'Manquant'}`);
      }
      break;

    case 'solana':
      logger.info(`[${pluginName}] Type: Solana Transaction`);
      if (swapParams.route && swapParams.route.tx) {
        logger.info(`[${pluginName}] Transaction (base64): ${typeof swapParams.route.tx === 'string' ? 'Présent' : 'Manquant'}`);
      }
      break;

    case 'near':
      logger.info(`[${pluginName}] Type: NEAR Protocol`);
      if (swapParams.route) {
        logger.info(`[${pluginName}] Inbound Address: ${swapParams.route.inboundAddress || 'Non défini'}`);
        if (swapParams.route.meta && swapParams.route.meta.near) {
          logger.info(`[${pluginName}] NEAR meta:`, JSON.stringify(swapParams.route.meta.near, null, 2));
        }
      }
      break;

    default:
      logger.info(`[${pluginName}] Type: Plugin générique`);
      if (swapParams.route) {
        logger.info(`[${pluginName}] Route keys: ${Object.keys(swapParams.route)}`);
      }
  }

  // Debug des assets pour tous les plugins
  if (swapParams.route) {
    logger.info(`[${pluginName}] Assets:`);
    logger.info(`  - Sell Asset: ${swapParams.route.sellAsset}`);
    logger.info(`  - Buy Asset: ${swapParams.route.buyAsset}`);
    logger.info(`  - Sell Amount: ${swapParams.route.sellAmount}`);
    logger.info(`  - Expected Output: ${swapParams.route.expectedOutput || 'Non défini'}`);
  }
}



// Fonction pour analyser les erreurs spécifiques aux plugins
function analyzePluginError(pluginName: string, error: any, swapParams: any) {
  if (!globalLogConfig.enableDebug) return;

  logger.error(`\n🔍 [Error Analysis] Analyse d'erreur pour ${pluginName}:`);

  switch (pluginName.toLowerCase()) {
    case 'evm':
      if (error.message.includes('insufficient funds')) {
        logger.error(`[${pluginName}] 💰 Problème: Fonds insuffisants`);
        logger.error(`[${pluginName}] 💡 Solution: Vérifiez le solde du wallet`);
      } else if (error.message.includes('gas')) {
        logger.error(`[${pluginName}] ⛽ Problème: Erreur de gas`);
        logger.error(`[${pluginName}] 💡 Solution: Augmentez la limite de gas ou le prix du gas`);
      } else if (error.message.includes('nonce')) {
        logger.error(`[${pluginName}] 🔢 Problème: Nonce incorrect`);
        logger.error(`[${pluginName}] 💡 Solution: Réinitialisez le wallet ou attendez`);
      } else if (error.message.includes('revert')) {
        logger.error(`[${pluginName}] 🔄 Problème: Transaction revertée`);
        logger.error(`[${pluginName}] 💡 Solution: Vérifiez les paramètres de la transaction`);
      } else if (error.message.includes('0xf4059071')) {
        logger.error(`[${pluginName}] 🔄 Problème: Erreur 1inch spécifique (0xf4059071)`);
        logger.error(`[${pluginName}] 💡 Causes possibles:`);
        logger.error(`[${pluginName}]   - Slippage trop faible (prix a changé)`);
        logger.error(`[${pluginName}]   - Liquidité insuffisante pour ce montant`);
        logger.error(`[${pluginName}]   - Token non supporté ou pool inexistant`);
        logger.error(`[${pluginName}]   - Allowance insuffisante`);
        logger.error(`[${pluginName}] 💡 Solutions:`);
        logger.error(`[${pluginName}]   - Augmentez le slippage (ex: 5-10%)`);
        logger.error(`[${pluginName}]   - Réduisez le montant du swap`);
        logger.error(`[${pluginName}]   - Vérifiez l'approbation du token`);
        logger.error(`[${pluginName}]   - Essayez plus tard`);
      } else if (error.message.includes('toolbox_evm_error_estimating_gas_limit')) {
        logger.error(`[${pluginName}] ⛽ Problème: Impossible d'estimer le gas`);
        logger.error(`[${pluginName}] 💡 Solution: La transaction échouerait, vérifiez les paramètres`);
      }
      break;

    case 'thorchain':
    case 'mayachain':
      if (error.message.includes('memo')) {
        logger.error(`[${pluginName}] 📝 Problème: Memo invalide`);
        logger.error(`[${pluginName}] 💡 Solution: Vérifiez le format du memo`);
      } else if (error.message.includes('inbound')) {
        logger.error(`[${pluginName}] 📥 Problème: Adresse inbound invalide`);
        logger.error(`[${pluginName}] 💡 Solution: Vérifiez l'adresse inbound de la route`);
      } else if (error.message.includes('pool')) {
        logger.error(`[${pluginName}] 🏊 Problème: Pool non disponible`);
        logger.error(`[${pluginName}] 💡 Solution: Vérifiez que les assets sont supportés`);
      }
      break;

    case 'chainflip':
      if (error.message.includes('broker')) {
        logger.error(`[${pluginName}] 🏢 Problème: Broker URL invalide`);
        logger.error(`[${pluginName}] 💡 Solution: Vérifiez la configuration du broker`);
      } else if (error.message.includes('deposit')) {
        logger.error(`[${pluginName}] 💳 Problème: Adresse de dépôt invalide`);
        logger.error(`[${pluginName}] 💡 Solution: Régénérez l'adresse de dépôt`);
      }
      break;

    case 'radix':
      if (error.message.includes('manifest')) {
        logger.error(`[${pluginName}] 📋 Problème: Manifest invalide`);
        logger.error(`[${pluginName}] 💡 Solution: Vérifiez le format du manifest`);
      }
      break;
  }

  // Analyse générale des erreurs SwapKit
  if (error.errorKey) {
    switch (error.errorKey) {
      case 'core_swap_invalid_params':
        logger.error(`[${pluginName}] ❌ Paramètres de swap invalides`);
        logger.error(`[${pluginName}] 💡 Vérifiez: route, assets, montants`);
        break;
      case 'core_wallet_connection_not_found':
        logger.error(`[${pluginName}] 🔌 Wallet non connecté`);
        logger.error(`[${pluginName}] 💡 Connectez le wallet pour la chaîne appropriée`);
        break;
      case 'core_plugin_not_found':
        logger.error(`[${pluginName}] 🔌 Plugin non trouvé`);
        logger.error(`[${pluginName}] 💡 Vérifiez que le plugin est installé et configuré`);
        break;
    }
  }

  // Suggestions basées sur les paramètres
  if (swapParams && swapParams.route) {
    logger.error(`[${pluginName}] 🔍 Paramètres à vérifier:`);
    logger.error(`  - Sell Asset: ${swapParams.route.sellAsset}`);
    logger.error(`  - Buy Asset: ${swapParams.route.buyAsset}`);
    logger.error(`  - Amount: ${swapParams.route.sellAmount}`);
    logger.error(`  - Provider: ${swapParams.route.providers?.[0]}`);
  }
}

// Fonction pour exécuter un swap réel avec des options personnalisables
// Exemple d'utilisation :
// executeRealSwap(); // Utilise les valeurs par défaut (1 THOR.RUNE vers BSC.BNB)
// executeRealSwap({ amount: "2" }); // Swap 2 THOR.RUNE vers BSC.BNB
// executeRealSwap({
//   sourceAssetString: "THOR.RUNE",
//   destinationAssetString: "ETH.ETH",
//   amount: "0.5",
//   slippage: 1,
//   waitForConfirmation: false
// }); // Swap 0.5 THOR.RUNE vers ETH.ETH avec 1% de slippage sans demander confirmation
//
// Exemples avec différents fournisseurs :
//
// 1. Swap via ThorChain (comportement par défaut)
// executeRealSwap();
//
// 2. Swap via Maya Protocol
// executeRealSwap({
//   preferredProvider: ProviderName.MAYACHAIN,
//   sourceAssetString: "MAYA.CACAO", // Asset natif de Maya
//   destinationAssetString: "MAYA.BTC", // BTC sur Maya
//   amount: "10", // Swap 10 CACAO
// });
//
// 3. Swap via Uniswap
// executeRealSwap({
//   preferredProvider: ProviderName.UNISWAP,
//   sourceAssetString: "ETH.ETH",
//   destinationAssetString: "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
//   sourceChain: Chain.Ethereum,
//   destinationChain: Chain.Ethereum,
//   amount: "0.1", // Swap 0.1 ETH
// });
//
// 4. Essayer plusieurs fournisseurs et choisir le meilleur
// executeRealSwap({
//   providers: [
//     ProviderName.THORCHAIN,
//     ProviderName.MAYACHAIN,
//     ProviderName.UNISWAP,
//     ProviderName.ONEINCH
//   ],
//   sourceAssetString: "ETH.ETH",
//   destinationAssetString: "ETH.USDT-0xdac17f958d2ee523a2206206994597c13d831ec7",
//   amount: "0.05", // Swap 0.05 ETH
//   slippage: 0.5, // Slippage de 0.5%
// });
//
// 5. Utiliser une adresse de destination personnalisée
// executeRealSwap({
//   sourceAssetString: "THOR.RUNE",
//   destinationAssetString: "ETH.ETH",
//   amount: "1",
//   destinationAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Adresse ETH personnalisée
// });
//
// 6. Utiliser une adresse source personnalisée
// executeRealSwap({
//   sourceAssetString: "THOR.RUNE",
//   destinationAssetString: "BTC.BTC",
//   amount: "10",
//   sourceAddress: "thor1rk865semrc6exdwha4lfj6tnj4k2cw9nhlvh9y", // Adresse THOR personnalisée
// });
//
// 7. Utiliser à la fois une adresse source et une adresse de destination personnalisées
// executeRealSwap({
//   sourceAssetString: "THOR.RUNE",
//   destinationAssetString: "ETH.ETH",
//   amount: "5",
//   sourceAddress: "thor1rk865semrc6exdwha4lfj6tnj4k2cw9nhlvh9y", // Adresse THOR personnalisée
//   destinationAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Adresse ETH personnalisée
// });
/**
 * Options pour exécuter un swap réel
 */
export interface RealSwapOptions {
  /** Montant à swapper (par défaut: "1") */
  amount?: string;
  /** Asset source (par défaut: "THOR.RUNE") */
  sourceAssetString?: string;
  /** Asset de destination (par défaut: "BSC.BNB") */
  destinationAssetString?: string;
  /** Adresse source personnalisée (par défaut: adresse du portefeuille de la chaîne source) */
  sourceAddress?: string;
  /** Adresse de destination personnalisée (par défaut: adresse du portefeuille de la chaîne de destination ou adresse de secours) */
  destinationAddress?: string;
  /** Slippage en pourcentage (par défaut: 3) */
  slippage?: number;
  /** Chaîne source (par défaut: Chain.THORChain) */
  sourceChain?: Chain;
  /** Chaîne de destination (par défaut: Chain.BinanceSmartChain) */
  destinationChain?: Chain;
  /** Option de frais (par défaut: FeeOption.Fast) */
  feeOption?: FeeOption;
  /** Attendre la confirmation de l'utilisateur (par défaut: true) */
  waitForConfirmation?: boolean;
  /** Délai d'attente pour la confirmation en ms (par défaut: 5000) */
  confirmationTimeout?: number;
  /** Phrase mnémonique pour le portefeuille (par défaut: process.env.MNEMONIC) */
  mnemonic?: string;
  /** Fournisseur(s) à utiliser pour le swap (par défaut: [ProviderName.THORChain]) */
  providers?: ProviderName[];
  /** Fournisseur spécifique à utiliser (prioritaire sur providers) */
  preferredProvider?: ProviderName;
  /** Nom du plugin à utiliser pour le swap (par défaut: déterminé automatiquement) */
  pluginName?: string;
  /** Forcer l'exécution même si les assets ne sont pas reconnus (par défaut: false) */
  forceExecution?: boolean;
  /** Activer les logs de débogage (par défaut: false) */
  enableDebug?: boolean;
  /** Activer les logs détaillés (par défaut: false) */
  verboseInfo?: boolean;
}

/**
 * Exécute un swap réel avec les options spécifiées
 * @param options Options pour le swap
 * @returns Résultat du swap ou null en cas d'échec
 */
export async function executeRealSwap(options: RealSwapOptions = {}) {
  // Configurer les logs en fonction des options
  globalLogConfig.enableDebug = options.enableDebug || false;
  globalLogConfig.verboseInfo = options.verboseInfo || false;

  logger.debug("Début de executeRealSwap");
  logger.debug("AssetValue avant loadStaticAssets:", AssetValue);

  // Réinitialiser les logs réseau pour cette exécution
  clearNetworkLogs();
  logger.info("Logs réseau réinitialisés pour cette exécution");

  // Appliquer le patch pour nettoyer les logs
  applyLogPatch();

  // Charger explicitement les assets statiques
  logger.debug("Chargement des assets statiques...");
  try {
    await AssetValue.loadStaticAssets();
    logger.debug("Assets statiques chargés avec succès");
    logger.debug("AssetValue après loadStaticAssets:", AssetValue);
  } catch (error) {
    logger.error("Erreur lors du chargement des assets statiques:", error);
  }

  // Extraire les options avec des valeurs par défaut
  const {
    amount = "1",
    sourceAssetString = "THOR.RUNE",
    destinationAssetString = "MAYA.CACAO",
    sourceAddress: customSourceAddress,
    destinationAddress: customDestinationAddress,
    slippage = 3,
    // Les chaînes seront extraites des assets par défaut, mais peuvent être surchargées
    sourceChain,
    destinationChain,
    feeOption = FeeOption.Fast,
    waitForConfirmation = true,
    confirmationTimeout = 5000,
    // Nouvelles options pour les fournisseurs
    providers = undefined,
    preferredProvider,
    pluginName,
    // Option pour forcer l'exécution même si les assets ne sont pas reconnus
    forceExecution = false,
  } = options;

  // Debug des paramètres d'entrée
  logger.info("🚀 [executeRealSwap] Début de l'exécution avec paramètres:");
  logger.info(`  - sourceAssetString: ${sourceAssetString}`);
  logger.info(`  - destinationAssetString: ${destinationAssetString}`);
  logger.info(`  - amount: ${amount} (type: ${typeof amount})`);
  logger.info(`  - customDestinationAddress: ${customDestinationAddress || 'undefined'}`);
  logger.info(`  - waitForConfirmation: ${waitForConfirmation}`);

  try {
    // Appliquer le patch de logging si nécessaire
    applyLogPatch();

    // Nettoyer les logs réseau précédents
    clearNetworkLogs();

    // Extraire les chaînes à partir des assets si elles ne sont pas spécifiées
    const extractChainFromAsset = (assetString: string): Chain => {
      // Extraire le préfixe de l'asset (par exemple, "THOR" de "THOR.RUNE")
      const chainString = assetString.split(".")[0];

      // Cas spéciaux qui nécessitent une conversion
      if (chainString.toUpperCase() === "BNB") {
        return Chain.BinanceSmartChain; // BNB est sur BSC
      }

      // Pour la plupart des cas, le préfixe correspond déjà au nom de la chaîne
      // Utiliser le préfixe directement comme nom de chaîne
      return chainString as unknown as Chain;
    };

    // Déterminer les chaînes source et destination
    const derivedSourceChain = extractChainFromAsset(sourceAssetString);
    const derivedDestinationChain = extractChainFromAsset(destinationAssetString);

    // Utiliser les chaînes spécifiées ou les chaînes dérivées
    // Utiliser une assertion non-null (!) pour garantir que TypeScript sait que ces valeurs ne sont jamais undefined
    const effectiveSourceChain = (sourceChain || derivedSourceChain)!;
    const effectiveDestinationChain = (destinationChain || derivedDestinationChain)!;

    logger.info(`Chaîne source: ${effectiveSourceChain}`);
    logger.info(`Chaîne destination: ${effectiveDestinationChain}`);

    // Déterminer le fournisseur approprié en fonction des chaînes
    const determineProvider = () => {
      // Si les deux chaînes sont THORChain ou Maya, utiliser le fournisseur correspondant
      if (
        effectiveSourceChain === Chain.THORChain &&
        effectiveDestinationChain === Chain.THORChain
      ) {
        return TokenProvider.THORCHAIN;
      }
      if (effectiveSourceChain === Chain.Maya && effectiveDestinationChain === Chain.Maya) {
        return TokenProvider.MAYA;
      }

      // Si l'une des chaînes est Ethereum, essayer Uniswap
      if (effectiveSourceChain === Chain.Ethereum || effectiveDestinationChain === Chain.Ethereum) {
        return TokenProvider.UNISWAP_V3;
      }

      // Si l'une des chaînes est BSC, essayer PancakeSwap
      if (
        effectiveSourceChain === Chain.BinanceSmartChain ||
        effectiveDestinationChain === Chain.BinanceSmartChain
      ) {
        return TokenProvider.PANCAKESWAP;
      }

      // Par défaut, utiliser tous les fournisseurs
      return TokenProvider.ALL;
    };

    const suggestedProvider = determineProvider();
    logger.info(`Fournisseur suggéré pour la validation des tokens: ${suggestedProvider || "ALL"}`);

    // Vérifier que les assets existent dans l'API SwapKit tokens
    logger.info("\nVérification des assets dans l'API SwapKit tokens...");

    // Vérifier l'asset source
    const sourceAssetValidation = await validateAsset(sourceAssetString, suggestedProvider);
    logger.info(
      `Asset source (${sourceAssetString}): ${sourceAssetValidation.isValid ? "✅ Valide" : "❌ Non valide"}`,
    );
    if (!sourceAssetValidation.isValid) {
      logger.warn(`⚠️ Avertissement: ${sourceAssetValidation.message}`);
    } else if (sourceAssetValidation.token) {
      logger.info(`  Nom: ${sourceAssetValidation.token.name}`);
      logger.info(`  Décimales: ${sourceAssetValidation.token.decimals}`);
      logger.info(`  Fournisseur: ${sourceAssetValidation.provider || "ALL"}`);
      if (sourceAssetValidation.token.logoURI) {
        logger.info(`  Logo: ${sourceAssetValidation.token.logoURI}`);
      }
      if (sourceAssetValidation.token.coingeckoId) {
        logger.info(`  CoinGecko ID: ${sourceAssetValidation.token.coingeckoId}`);
      }
    }

    // Vérifier l'asset destination
    const destinationAssetValidation = await validateAsset(
      destinationAssetString,
      suggestedProvider,
    );
    logger.info(
      `Asset destination (${destinationAssetString}): ${destinationAssetValidation.isValid ? "✅ Valide" : "❌ Non valide"}`,
    );
    if (!destinationAssetValidation.isValid) {
      logger.warn(`⚠️ Avertissement: ${destinationAssetValidation.message}`);
    } else if (destinationAssetValidation.token) {
      logger.info(`  Nom: ${destinationAssetValidation.token.name}`);
      logger.info(`  Décimales: ${destinationAssetValidation.token.decimals}`);
      logger.info(`  Fournisseur: ${destinationAssetValidation.provider || "ALL"}`);
      if (destinationAssetValidation.token.logoURI) {
        logger.info(`  Logo: ${destinationAssetValidation.token.logoURI}`);
      }
      if (destinationAssetValidation.token.coingeckoId) {
        logger.info(`  CoinGecko ID: ${destinationAssetValidation.token.coingeckoId}`);
      }
    }

    // Si l'un des assets n'est pas valide, demander confirmation à l'utilisateur
    if (!sourceAssetValidation.isValid || !destinationAssetValidation.isValid) {
      if (forceExecution) {
        logger.warn("\n⚠️ Exécution forcée malgré des assets non reconnus.");
      } else {
        logger.warn("\n⚠️ Un ou plusieurs assets ne sont pas reconnus dans l'API SwapKit tokens.");
        logger.warn("Cela peut indiquer que vous utilisez un asset non supporté ou mal formaté.");
        logger.warn(
          "Pour forcer l'exécution malgré cet avertissement, utilisez l'option 'forceExecution: true'.",
        );
        return {
          status: "error",
          error:
            "Assets non reconnus dans l'API SwapKit tokens. Utilisez forceExecution: true pour ignorer cette vérification.",
        };
      }
    }

    // Connecter dynamiquement les chaînes nécessaires
    let swapKit = await getSwapKitClient([effectiveSourceChain, effectiveDestinationChain]);

    // Appliquer le débogage en profondeur si activé
    if (globalLogConfig.enableDebug) {
      logger.info("\n🔧 Application du débogage en profondeur...");
      swapKit = debugSwapKitClient(swapKit);

      // Wrapper les plugins individuellement pour un débogage plus fin
      if (swapKit.plugins) {
        Object.keys(swapKit.plugins).forEach(pluginName => {
          swapKit.plugins[pluginName] = wrapPluginWithDebug(pluginName, swapKit.plugins[pluginName]);
        });
        logger.info("🔧 Plugins wrappés pour le débogage:", Object.keys(swapKit.plugins));
      }

      // Déboguer les wallets des chaînes impliquées
      debugWalletOperations(swapKit, effectiveSourceChain);
      debugWalletOperations(swapKit, effectiveDestinationChain);

      // Debug des plugins directement sur swapKit
      logger.info("🔧 Debug des plugins après wrapping:");
      const pluginNames = ['evm', 'thorchain', 'mayachain', 'chainflip', 'radix', 'near', 'solana'];
      pluginNames.forEach(name => {
        if (swapKit[name]) {
          logger.info(`  - Plugin ${name}: ✅`);
          logger.info(`    - Méthodes: ${Object.keys(swapKit[name])}`);
          logger.info(`    - Providers supportés: ${swapKit[name].supportedSwapkitProviders || 'Non défini'}`);
        } else {
          logger.info(`  - Plugin ${name}: ❌`);
        }
      });
    }

    logger.info(`Chaîne source: ${effectiveSourceChain}`);
    logger.info(`Chaîne destination: ${effectiveDestinationChain}`);
    if (!swapKit) {
      logger.error("\n❌ Impossible d'initialiser SwapKit");
      return null;
    }

    // Vérifier que le client SwapKit est correctement configuré
    if (globalLogConfig.verboseInfo) {
      // Utiliser notre utilitaire pour nettoyer les logs
      const cleanedSwapKit = cleanSwapKitForLogging(swapKit);

      logger.info("\nDébogage SwapKit:");
      logger.info("- swapKit object keys:", Object.keys(cleanedSwapKit));
      logger.info("- swapKit.api exists:", !!cleanedSwapKit.api);

      if (cleanedSwapKit.api) {
        logger.info("- swapKit.api object keys:", Object.keys(cleanedSwapKit.api));
        logger.info("- swapKit.api.getSwapQuote exists:", !!cleanedSwapKit.api.getSwapQuote);
      }

      // Vérifier si la propriété thorchain existe
      logger.info("- swapKit.thorchain exists:", !!cleanedSwapKit.thorchain);
      if (cleanedSwapKit.thorchain) {
        logger.info("- swapKit.thorchain object keys:", Object.keys(cleanedSwapKit.thorchain));
      }

      // Vérifier les méthodes essentielles
      logger.info("- swapKit.swap exists:", typeof cleanedSwapKit.swap);
      logger.info("- swapKit.getBalance exists:", typeof cleanedSwapKit.getBalance);
      logger.info("- swapKit.connectKeystore exists:", typeof cleanedSwapKit.connectKeystore);
      logger.info("- swapKit.getAddress exists:", typeof cleanedSwapKit.getAddress);

      // Vérifier les plugins disponibles
      if (swapKit.plugins) {
        logger.info("- Plugins disponibles:", Object.keys(swapKit.plugins));
      } else {
        logger.warn("- Aucun plugin disponible!");
      }
    }

    // Vérifications critiques même sans verbose
    if (!swapKit.swap) {
      logger.error("❌ ERREUR CRITIQUE: swapKit.swap n'est pas disponible!");
      logger.error("Méthodes disponibles:", Object.keys(swapKit));
      throw new Error("SwapKit n'est pas correctement initialisé - méthode swap manquante");
    }

    // Connecter toutes les chaînes disponibles directement
    const chainsToConnect = new Set<Chain>([
      Chain.Arbitrum,
      Chain.Avalanche,
      Chain.Base,
      Chain.BinanceSmartChain, // erreur wallet_missing_api_key
      Chain.Bitcoin,
      Chain.BitcoinCash,
      Chain.Cosmos,
      Chain.Dash,
      Chain.Dogecoin,
      Chain.Ethereum,
      // Chain.Fiat,
      Chain.Kujira,
      Chain.Litecoin,
      Chain.Maya,
      Chain.Optimism,
      // Chain.Polkadot,
      // Chain.Chainflip, // erreur
      Chain.Polygon,
      // Chain.Radix,
      Chain.THORChain,
      Chain.Solana,
    ]);

    // Ajouter également les chaînes source et destination pour s'assurer qu'elles sont incluses
    chainsToConnect.add(effectiveSourceChain);
    chainsToConnect.add(effectiveDestinationChain);

    // Convertir le Set en tableau
    const chainsArray = Array.from(chainsToConnect);

    // Connecter toutes les chaînes disponibles
    logger.info(`\nConnexion de toutes les chaînes disponibles: ${chainsArray.join(", ")}...`);

    // Utiliser la phrase mnémonique fournie dans les options ou celle par défaut
    const phrase =
      options.mnemonic ||
      process.env.MNEMONIC ||
      "test test test test test test test test test test test junk";

    try {
      await swapKit.connectKeystore(chainsArray, phrase);
      logger.info(`\n✅ Portefeuilles connectés avec succès!`);

      // Afficher les adresses connectées pour chaque chaîne (seulement si verboseInfo est activé)
      if (globalLogConfig.verboseInfo) {
        logger.info("\n🔑 Adresses connectées:");
        for (const chain of chainsArray) {
          const address = swapKit.getAddress(chain);
          if (address) {
            logger.info(`${chain}: ${address}`);
          } else {
            logger.warn(`⚠️ Impossible d'obtenir l'adresse pour ${chain}`);
          }
        }
      } else {
        // Afficher seulement les adresses source et destination
        const sourceAddress = swapKit.getAddress(effectiveSourceChain);
        const destAddress = swapKit.getAddress(effectiveDestinationChain);

        if (sourceAddress) {
          logger.info(`Adresse ${effectiveSourceChain}: ${sourceAddress}`);
        }

        if (destAddress && effectiveDestinationChain !== effectiveSourceChain) {
          logger.info(`Adresse ${effectiveDestinationChain}: ${destAddress}`);
        }
      }
    } catch (error) {
      logger.error(`\n❌ Échec de la connexion des portefeuilles:`, error);
      // return null;
    }

    // Vérifier si nous pouvons utiliser le plugin ThorChain directement
    if (!swapKit.thorchain || !swapKit.thorchain.swap) {
      logger.error("\n❌ Plugin ThorChain non disponible ou méthode swap manquante.");
      logger.error("Vérifiez que le plugin ThorChain est correctement importé dans client.ts");
      return null;
    }

    logger.info(
      "\n✅ Plugin ThorChain disponible. Nous allons utiliser swapKit.thorchain.swap directement.",
    );

    // logger.info(`\n⚡️ Exécution d'un swap réel de ${amount} ${sourceAssetString} vers ${destinationAssetString}...`);

    // Déterminer l'adresse source
    // 1. Utiliser l'adresse source personnalisée si fournie
    // 2. Sinon, utiliser l'adresse du portefeuille de la chaîne source si connecté
    const sourceAddress = customSourceAddress || swapKit.getAddress(effectiveSourceChain);

    // Vérifier si une adresse source est disponible
    if (!sourceAddress) {
      logger.error(
        `\n❌ Aucune adresse source disponible. Veuillez fournir une adresse source personnalisée ou connecter un portefeuille ${effectiveSourceChain}.`,
      );
      return null;
    }

    // Déterminer l'adresse de destination
    // 1. Utiliser l'adresse personnalisée si fournie
    // 2. Sinon, utiliser l'adresse du portefeuille de la chaîne de destination si connecté
    // 3. Sinon, utiliser une adresse de secours (adresse THORChain)
    const destinationAddress =
      customDestinationAddress ||
      swapKit.getAddress(effectiveDestinationChain) ||
      "0x4cE8bEe6A8afC3debF669adC3b1727103cdBB649"; // Adresse de secours

    logger.info(`Adresse source: ${sourceAddress}`);
    logger.info(`Adresse destination: ${destinationAddress}`);

    // Créer les objets AssetValue pour les actifs source et destination
    logger.debug(`\nCréation de sourceAsset pour ${sourceAssetString} avec amount=${amount}`);
    let sourceAsset;
    let destinationAsset;

    try {
      // Charger explicitement les assets statiques avant de créer les AssetValue
      logger.debug(`Chargement des assets statiques avant création des AssetValue...`);
      await AssetValue.loadStaticAssets();
      logger.debug(`Assets statiques chargés avec succès`);

      // Déterminer le montant USDT à utiliser selon la configuration
      let calculatedUsdtAmount = amount; // Par défaut, utiliser le montant tel quel

      if (globalAmountConfig.amountIsTargetToken) {
        // MODE ANCIEN: amount = montant du token cible
        logger.debug(`🔄 [Amount Config] Mode: amount = montant du token cible (${amount})`);
        logger.debug(`🔍 [Price Debug] Calcul du montant USDT nécessaire pour obtenir ${amount} du token cible`);

        try {
          logger.debug(`🔍 [Price Debug] Récupération des prix pour calculer le montant USDT...`);

          const priceRequest = {
            tokens: [
              { identifier: destinationAssetString }, // Token cible (ex: BSC.1INCH)
            ],
            metadata: false
          };

          logger.debug(`🔍 [Price Debug] Requête de prix:`, priceRequest);
          const priceResponse = await swapKit.api.getPrice(priceRequest);

          if (priceResponse && priceResponse.length > 0 && priceResponse[0].price_usd > 0) {
            const targetTokenPriceUsd = priceResponse[0].price_usd;
            const targetAmount = Number.parseFloat(amount);

            // Calculer la valeur USD du montant cible
            const targetValueUsd = targetAmount * targetTokenPriceUsd;

            // Comme le token source est toujours USDT (≈ 1 USD), le montant USDT nécessaire ≈ valeur USD
            calculatedUsdtAmount = targetValueUsd.toString();

            logger.debug(`🔍 [Price Debug] Calcul réussi:`);
            logger.debug(`  - Prix du token cible: $${targetTokenPriceUsd}`);
            logger.debug(`  - Montant cible désiré: ${targetAmount}`);
            logger.debug(`  - Valeur USD totale: $${targetValueUsd}`);
            logger.debug(`  - Montant USDT nécessaire: ${calculatedUsdtAmount}`);
          } else {
            logger.warn(`⚠️ [Price Debug] Prix non disponible pour ${destinationAssetString}, utilisation du montant par défaut`);
          }

        } catch (priceError) {
          logger.warn(`⚠️ [Price Debug] Erreur lors de la récupération du prix:`, priceError.message);
          logger.warn(`⚠️ [Price Debug] Utilisation du montant par défaut: ${amount}`);
        }

        logger.debug(`Création de sourceAsset avec le montant USDT calculé: ${calculatedUsdtAmount}`);
        logger.debug(`🔍 [AssetValue Debug] Paramètres pour AssetValue.from:`);
        logger.debug(`  - asset: ${sourceAssetString}`);
        logger.debug(`  - value: ${calculatedUsdtAmount} (calculé depuis ${amount} du token cible)`);

      } else {
        // MODE NOUVEAU: amount = montant USDT à dépenser
        logger.debug(`💰 [Amount Config] Mode: amount = montant USDT à dépenser (${amount})`);
        logger.debug(`🔍 [AssetValue Debug] Paramètres pour AssetValue.from:`);
        logger.debug(`  - asset: ${sourceAssetString}`);
        logger.debug(`  - value: ${amount} (montant USDT direct)`);
      }

      try {
        sourceAsset = await AssetValue.from({
          asset: sourceAssetString,
          value: calculatedUsdtAmount,
          asyncTokenLookup: true,
        });

        // Vérifier que sourceAsset a été créé correctement
        if (!sourceAsset) {
          throw new Error("AssetValue.from() a retourné null/undefined");
        }

        logger.debug(`🔍 [AssetValue Debug] sourceAsset créé avec succès:`);
        logger.debug(`  - Type: ${typeof sourceAsset}`);
        logger.debug(`  - Constructor: ${sourceAsset.constructor?.name}`);
        logger.debug(`  - toString(): ${sourceAsset.toString()}`);

        // Vérifications sécurisées
        try {
          logger.debug(`  - getValue("number"): ${sourceAsset.getValue("number")}`);
          logger.debug(`  - getValue("string"): ${sourceAsset.getValue("string")}`);
          logger.debug(`  - Asset ticker: ${sourceAsset.ticker}`);
          logger.debug(`  - Asset chain: ${sourceAsset.chain}`);
          logger.debug(`  - Asset decimals: ${sourceAsset.decimal}`);

          if (sourceAsset.baseAmount) {
            logger.debug(`  - Raw value (bigint): ${sourceAsset.baseAmount.toString()}`);
          } else {
            logger.warn(`  - ⚠️ baseAmount est undefined!`);
          }
        } catch (debugError) {
          logger.warn(`⚠️ [AssetValue Debug] Erreur lors du debug des propriétés:`, debugError.message);
        }

      } catch (assetError) {
        logger.error(`❌ [AssetValue Debug] ERREUR lors de la création de sourceAsset:`);
        logger.error(`  - Message: ${assetError.message}`);
        logger.error(`  - Stack: ${assetError.stack}`);
        logger.error(`  - Paramètres utilisés:`);
        logger.error(`    - asset: ${sourceAssetString}`);
        logger.error(`    - value: ${amount}`);
        logger.error(`    - asyncTokenLookup: true`);

        throw new Error(`Impossible de créer sourceAsset: ${assetError.message}`);
      }

      // Utiliser une fonction personnalisée pour sérialiser l'objet sans les BigInt
      const customStringify = (obj) => {
        try {
          return JSON.stringify(obj, (key, value) =>
            typeof value === "bigint" ? value.toString() + "n" : value,
          );
        } catch (error) {
          return `[Non sérialisable: ${error.message}]`;
        }
      };

      logger.debug(`- toJSON (personnalisé): ${customStringify(sourceAsset)}`);
      logger.debug(`- Prototype: ${Object.getPrototypeOf(sourceAsset)?.constructor?.name}`);
      logger.debug(`- hasOwnProperty('decimal'): ${sourceAsset.hasOwnProperty("decimal")}`);
      logger.debug(`- Object.keys(): ${Object.keys(sourceAsset)}`);
      logger.debug(`- Object.getOwnPropertyNames(): ${Object.getOwnPropertyNames(sourceAsset)}`);

      // Extraire manuellement les propriétés importantes
      logger.debug(`- Propriétés importantes:`);
      logger.debug(`- decimal: ${sourceAsset.decimal}`);
      logger.debug(`- chain: ${sourceAsset.chain}`);
      logger.debug(`- symbol: ${sourceAsset.symbol}`);
      logger.debug(`- ticker: ${sourceAsset.ticker}`);
      logger.debug(`- address: ${sourceAsset.address || "N/A"}`);
      logger.debug(`- value (string): ${sourceAsset.getValue("string")}`);
      logger.debug(`- value (number): ${sourceAsset.getValue("number")}`);

      // Ne pas essayer de sérialiser les descripteurs de propriétés car ils peuvent contenir des BigInt
      logger.debug(
        `- Descripteurs de propriétés disponibles: ${Object.getOwnPropertyNames(sourceAsset).join(", ")}`,
      );

      // Vérifier spécifiquement la propriété decimal
      const decimalDescriptor = Object.getOwnPropertyDescriptor(sourceAsset, "decimal");
      logger.debug(`- Descripteur de decimal: ${decimalDescriptor ? "Existe" : "N'existe pas"}`);
      if (decimalDescriptor) {
        logger.debug(`- decimal est configurable: ${decimalDescriptor.configurable}`);
        logger.debug(`- decimal est énumérable: ${decimalDescriptor.enumerable}`);
        logger.debug(`- decimal a un getter: ${!!decimalDescriptor.get}`);
        logger.debug(`- decimal a un setter: ${!!decimalDescriptor.set}`);
        logger.debug(`- decimal a une valeur: ${decimalDescriptor.value !== undefined}`);
      }
      logger.debug(`- Chain: ${sourceAsset.chain}`);
      logger.debug(`- Symbol: ${sourceAsset.symbol}`);
      logger.debug(`- Decimals: ${sourceAsset.decimal}`);
      logger.debug(`- Value: ${sourceAsset.getValue("string")}`);

      logger.debug(`\nCréation de destinationAsset pour ${destinationAssetString}`);
      try {
        destinationAsset = await AssetValue.from({
          asset: destinationAssetString,
          value: 0,
          asyncTokenLookup: true,
        });

        // Vérifier que destinationAsset a été créé correctement
        if (!destinationAsset) {
          throw new Error("AssetValue.from() a retourné null/undefined pour destinationAsset");
        }

        logger.debug(`🔍 [AssetValue Debug] destinationAsset créé avec succès:`);
        logger.debug(`  - Type: ${typeof destinationAsset}`);
        logger.debug(`  - toString(): ${destinationAsset.toString()}`);

      } catch (destAssetError) {
        logger.error(`❌ [AssetValue Debug] ERREUR lors de la création de destinationAsset:`);
        logger.error(`  - Message: ${destAssetError.message}`);
        logger.error(`  - Stack: ${destAssetError.stack}`);
        logger.error(`  - Paramètres utilisés:`);
        logger.error(`    - asset: ${destinationAssetString}`);
        logger.error(`    - value: 0`);
        logger.error(`    - asyncTokenLookup: true`);

        throw new Error(`Impossible de créer destinationAsset: ${destAssetError.message}`);
      }

      logger.debug(`destinationAsset créé avec succès:`);
      logger.debug(`- Type: ${typeof destinationAsset}`);
      logger.debug(`- Constructor: ${destinationAsset.constructor?.name}`);
      logger.debug(`- toString(): ${destinationAsset.toString()}`);

      // Utiliser la même fonction personnalisée pour sérialiser l'objet
      logger.debug(`- toJSON (personnalisé): ${customStringify(destinationAsset)}`);

      // Extraire manuellement les propriétés importantes
      logger.debug(`- Propriétés importantes:`);
      logger.debug(`- decimal: ${destinationAsset.decimal}`);
      logger.debug(`- chain: ${destinationAsset.chain}`);
      logger.debug(`- symbol: ${destinationAsset.symbol}`);
      logger.debug(`- ticker: ${destinationAsset.ticker}`);
      logger.debug(`- address: ${destinationAsset.address || "N/A"}`);

      // Vérifier spécifiquement la propriété decimal
      const destDecimalDescriptor = Object.getOwnPropertyDescriptor(destinationAsset, "decimal");
      logger.debug(
        `- Descripteur de decimal: ${destDecimalDescriptor ? "Existe" : "N'existe pas"}`,
      );
      if (destDecimalDescriptor) {
        logger.debug(`- decimal est configurable: ${destDecimalDescriptor.configurable}`);
        logger.debug(`- decimal est énumérable: ${destDecimalDescriptor.enumerable}`);
        logger.debug(`- decimal a un getter: ${!!destDecimalDescriptor.get}`);
        logger.debug(`- decimal a une valeur: ${destDecimalDescriptor.value !== undefined}`);
      }
    } catch (error) {
      logger.error(`[DEBUG] ERREUR lors de la création des AssetValue:`, error);
      throw error;
    }

    // Vérifier la balance disponible
    logger.info("Verif de la balance");
    let balance = [
      {
        ticker: "RUNE",
        chain: "THORChain",
        value: 1000000000000000000000,
        symbol: "RUNE",
        address: "RUNE",
        getValue(str) {
          return 10000;
        },
      },
    ];
    // Récupérer toutes les balances du wallet pour la chaîne source
    // Cette méthode utilise swapKit.getBalance pour obtenir toutes les balances de la chaîne source
    // puis recherche l'asset spécifique en vérifiant le ticker, la chaîne et l'adresse du contrat (pour les tokens ERC20)
    try {
      balance = await swapKit.getBalance(effectiveSourceChain, true);
    } catch (error) {
      console.error(
        `Erreur lors de la récupération du balance pour ${effectiveSourceChain}:`,
        JSON.stringify(error),
      );
      throw error;
    }

    logger.info("🔍 [Balance Debug] Balance récupéré:", balance);
    logger.info("🔍 [Balance Debug] Nombre d'assets dans balance:", balance.length);
    logger.info("🔍 [Balance Debug] Assets disponibles:", balance.map(b => `${b.chain}.${b.ticker}(${b.getValue("string")})`));

    // Extraire le ticker et l'adresse du contrat de l'asset source (par exemple, "RUNE" de "THOR.RUNE" ou "USDC-0x..." de "ETH.USDC-0x...")
    const sourceAssetParts = sourceAssetString.split(".");
    const sourceTickerWithAddress =
      sourceAssetParts.length > 1 ? sourceAssetParts[1] : sourceAssetParts[0];
    const sourceTickerParts = sourceTickerWithAddress.split("-");
    const sourceTicker = sourceTickerParts[0];
    const sourceTokenAddress = sourceTickerParts.length > 1 ? sourceTickerParts[1] : null;

    logger.info("🔍 [Balance Debug] Parsing de l'asset source:");
    logger.info(`  - sourceAssetString: ${sourceAssetString}`);
    logger.info(`  - sourceAssetParts: ${JSON.stringify(sourceAssetParts)}`);
    logger.info(`  - sourceTicker: ${sourceTicker}`);
    logger.info(`  - sourceTokenAddress: ${sourceTokenAddress}`);
    logger.info(`  - effectiveSourceChain: ${effectiveSourceChain}`);

    // Chercher l'asset dans les balances
    logger.info("🔍 [Balance Debug] Recherche de l'asset dans les balances...");

    const sourceBalance = balance.find((asset, index) => {
      logger.info(`🔍 [Balance Debug] Vérification asset ${index + 1}/${balance.length}:`);
      logger.info(`  - Asset: ${asset.chain}.${asset.ticker} (${asset.symbol})`);
      logger.info(`  - Address: ${asset.address || 'N/A'}`);
      logger.info(`  - Value: ${asset.getValue("string")}`);

      // Vérifier si le ticker correspond
      const tickerMatch =
        asset.ticker === sourceTicker || asset.symbol.toLowerCase() === sourceTicker.toLowerCase();
      logger.info(`  - Ticker match (${asset.ticker} === ${sourceTicker} || ${asset.symbol.toLowerCase()} === ${sourceTicker.toLowerCase()}): ${tickerMatch}`);

      // Vérifier si la chaîne correspond
      const chainMatch = asset.chain === effectiveSourceChain;
      logger.info(`  - Chain match (${asset.chain} === ${effectiveSourceChain}): ${chainMatch}`);

      // Vérifier si l'adresse correspond (pour les tokens ERC20)
      const addressMatch = sourceTokenAddress
        ? asset.address && asset.address.toLowerCase() === sourceTokenAddress.toLowerCase()
        : true;
      logger.info(`  - Address match: ${addressMatch} (required: ${sourceTokenAddress || 'N/A'})`);

      const finalMatch = tickerMatch && chainMatch && addressMatch;
      logger.info(`  - Final match: ${finalMatch}`);

      if (finalMatch) {
        logger.info(`🎯 [Balance Debug] Asset trouvé! ${asset.chain}.${asset.ticker}`);
      }

      return finalMatch;
    });

    logger.info("🔍 [Balance Debug] Résultat de la recherche:");
    logger.info(`  - sourceBalance trouvé: ${!!sourceBalance}`);
    if (sourceBalance) {
      logger.info(`  - Asset: ${sourceBalance.chain}.${sourceBalance.ticker}`);
      logger.info(`  - Value: ${sourceBalance.getValue("string")}`);
    }

    if (!sourceBalance) {
      logger.error(
        `\n❌ Aucune balance ${sourceAssetString} trouvée. Impossible d'exécuter le swap.`,
      );

      // Construire une réponse d'erreur détaillée pour l'absence de balance
      return {
        status: "error",
        errorCode: "NO_BALANCE_FOUND",
        errorMessage: `Aucune balance ${sourceAssetString} trouvée pour l'adresse ${sourceAddress}`,
        errorDetails: {
          address: sourceAddress,
          asset: sourceAssetString,
          chain: effectiveSourceChain,
          balancesDisponibles: balance.map((b) => ({
            chain: b.chain,
            symbol: b.symbol,
            ticker: b.ticker,
            value: b.getValue("string"),
            address: b.address,
          })),
          requiredAction:
            "Veuillez approvisionner ce compte avec des tokens avant d'effectuer un swap",
        },
        timestamp: new Date().toISOString(),
      };
    }

    logger.info("🔍 [Balance Debug] Vérification basique du wallet...");

    const sourceBalanceValue = sourceBalance.getValue("number");
    const targetAmount = Number.parseFloat(amount); // Montant désiré de token cible

    logger.info("🔍 [Balance Debug] Informations de base:");
    logger.info(`  - sourceBalanceValue (balance actuelle): ${sourceBalanceValue} ${sourceTicker}`);
    logger.info(`  - targetAmount (désiré): ${targetAmount} (token cible)`);
    logger.info(`  - NOTE: La vérification précise du montant USDT nécessaire sera faite avec la quote réelle`);

    // Vérification basique : au moins avoir quelque chose dans le wallet
    if (sourceBalanceValue <= 0) {
      logger.error("🔍 [Balance Debug] ❌ CONDITION: Aucun token source dans le wallet!");
      logger.error(`\n❌ Aucun ${sourceTicker} disponible dans votre wallet.`);
      return {
        status: "error",
        errorCode: "NO_BALANCE",
        errorMessage: `Aucun ${sourceTicker} disponible dans votre wallet.`,
        errorDetails: {
          sourceBalanceValue,
          targetAmount,
          sourceTicker,
        },
        timestamp: new Date().toISOString(),
      };
    }

    logger.info("🔍 [Balance Debug] ✅ CONDITION: Wallet contient des tokens source!");
    logger.info(`\n✅ Wallet contient ${sourceBalanceValue} ${sourceTicker}. Vérification précise après la quote...`);
    logger.info("🔍 [Balance Debug] Continuons vers la vérification des frais de gas...");

    // Vérifier la balance de tokens natifs pour les frais de gas
    // Cette vérification est particulièrement importante pour les chaînes EVM (Ethereum, BSC, etc.)
    logger.info("🔍 [Gas Debug] Vérification des frais de gas...");
    logger.info(`🔍 [Gas Debug] effectiveSourceChain: ${effectiveSourceChain}`);

    const isEVMChain = effectiveSourceChain.includes("ETH") ||
      effectiveSourceChain === Chain.BinanceSmartChain ||
      effectiveSourceChain === Chain.Avalanche ||
      effectiveSourceChain === Chain.Polygon;

    logger.info(`🔍 [Gas Debug] Est-ce une chaîne EVM? ${isEVMChain}`);

    if (isEVMChain) {
      // Déterminer le token natif en fonction de la chaîne
      let nativeToken = "";
      switch (effectiveSourceChain) {
        case Chain.Ethereum:
          nativeToken = "ETH";
          break;
        case Chain.BinanceSmartChain:
          nativeToken = "BNB";
          break;
        case Chain.Avalanche:
          nativeToken = "AVAX";
          break;
        case Chain.Polygon:
          nativeToken = "MATIC";
          break;
        default:
          nativeToken = effectiveSourceChain;
      }

      // Trouver la balance du token natif
      const nativeBalance = balance.find(
        (asset) => asset.ticker === nativeToken && asset.chain === effectiveSourceChain,
      );

      if (nativeBalance) {
        const nativeBalanceValue = nativeBalance.getValue("number");
        logger.info(
          `\n💰 Balance de tokens natifs pour les frais: ${nativeBalanceValue} ${nativeToken}`,
        );

        // Estimation très basique des frais de gas minimum nécessaires
        // Ces valeurs sont approximatives et peuvent varier
        const minGasRequired = {
          [Chain.Ethereum]: 0.005, // ~5-10$ en ETH
          [Chain.BinanceSmartChain]: 0.005, // ~1-2$ en BNB
          [Chain.Avalanche]: 0.05, // ~1-2$ en AVAX
          [Chain.Polygon]: 1, // ~1-2$ en MATIC
        };

        const requiredGas = minGasRequired[effectiveSourceChain] || 0.01;

        if (nativeBalanceValue < requiredGas) {
          logger.warn(
            `\n⚠️ Attention: Votre balance de ${nativeToken} (${nativeBalanceValue}) pourrait être insuffisante pour couvrir les frais de gas.`,
          );
          logger.warn(
            `Il est recommandé d'avoir au moins ${requiredGas} ${nativeToken} pour les transactions sur ${effectiveSourceChain}.`,
          );
        } else {
          logger.info(`\n✅ Balance de tokens natifs suffisante pour les frais de gas.`);
        }
      } else {
        logger.warn(
          `\n⚠️ Attention: Impossible de trouver la balance de ${nativeToken} pour les frais de gas.`,
        );
        logger.warn(
          "Assurez-vous d'avoir suffisamment de tokens natifs pour couvrir les frais de transaction.",
        );
      }
    }

    // ÉTAPE 1: Obtenir un devis de swap (quote)
    logger.info("\nℹ️ ÉTAPE 1: Obtention d'un devis de swap (quote)...");

    // Débogage détaillé de l'API SwapKit
    logger.info("🔍 [API Debug] Débogage détaillé de l'API SwapKit:");
    logger.info("🔍 [API Debug] - Type de swapKit.api:", typeof swapKit.api);
    logger.info("🔍 [API Debug] - swapKit.api existe:", !!swapKit.api);

    try {
      // Utiliser notre utilitaire de nettoyage pour éviter d'afficher trop de détails
      logger.info(
        "🔍 [API Debug] - Propriétés de swapKit.api:",
        swapKit.api ? Object.keys(swapKit.api) : "Non disponible",
      );

      if (swapKit.api) {
        logger.info("🔍 [API Debug] - swapKit.api.getSwapQuote existe:", typeof swapKit.api.getSwapQuote);
      }
    } catch (debugError) {
      logger.error("🔍 [API Debug] Erreur lors du debug de l'API:", debugError.message);
    }

    // Vérifier si la clé API est configurée
    logger.info("🔍 [API Debug] Vérification de la disponibilité de l'API...");
    logger.info("🔍 [API Debug] - !swapKit.api:", !swapKit.api);
    logger.info("🔍 [API Debug] - !swapKit.api.getSwapQuote:", swapKit.api ? !swapKit.api.getSwapQuote : "swapKit.api n'existe pas");

    if (!swapKit.api || !swapKit.api.getSwapQuote) {
      logger.error(
        "\n❌ API SwapKit non disponible. Vérifiez que votre clé API est configurée correctement.",
      );
      logger.error("La clé API actuelle est:", process.env.SWAPKIT_API_KEY || "Non définie");
      logger.error("Si vous voyez 'VOTRE_CLE_API_ICI', vous devez définir une clé API valide.");

      // Essayer d'utiliser directement l'API de ThorChain
      logger.info("\nℹ️ Tentative d'utilisation directe de l'API ThorChain...");
      if (swapKit.thorchain && swapKit.thorchain.swap) {
        logger.info(
          "\n✅ L'API ThorChain est disponible. Vous pouvez utiliser swapKit.thorchain.swap directement.",
        );
        logger.info(
          "Exemple: swapKit.thorchain.swap({ assetValue: sourceAsset, destinationAsset: 'BNB.BNB' })",
        );
      }

      return null;
    }

    logger.info("🔍 [API Debug] ✅ API SwapKit disponible, continuons...");

    // Préparer la requête de devis avec les fournisseurs spécifiés
    logger.info("🔍 [Quote Debug] Préparation de la requête de devis...");

    let quoteRequest: any;
    try {
      quoteRequest = {
        sellAsset: sourceAsset.toString(),
        buyAsset: destinationAsset.toString(),
        sellAmount: sourceAsset.getValue("string"),
        sourceAddress,
        destinationAddress,
        slippage, // Utiliser le slippage des options
        includeTx: true,
        // Utiliser le fournisseur préféré s'il est spécifié, sinon utiliser la liste des fournisseurs
        allowSmartContractSender: true,
        allowSmartContractReceiver: true,
        // disableSecurityChecks: true,
        // cfBoost: true,
        // referrer: "string"
      };

      logger.info("🔍 [Quote Debug] Requête de devis préparée:", JSON.stringify(quoteRequest, null, 2));
    } catch (quoteError) {
      logger.error("🔍 [Quote Debug] Erreur lors de la préparation de la requête:", quoteError.message);
      throw quoteError;
    }

    // TODO gerer les erreurs : insufficient funds et autres
    // logger.info("Requête de devis:", quoteRequest);

    // Obtenir le devis de swap
    let quoteResponse: any;
    try {
      logger.info("\n⏳ Appel de l'API getSwapQuote...");

      // Vérifier que l'API est disponible
      logger.info("🔍 [Quote Debug] Vérification de l'API avant l'appel...");
      if (!swapKit.api || !swapKit.api.getSwapQuote) {
        logger.error("🔍 [Quote Debug] API non disponible!");
        throw new Error("L'API SwapKit n'est pas disponible. Vérifiez votre configuration.");
      }
      logger.info("🔍 [Quote Debug] API disponible, appel en cours...");

      // Afficher les paramètres de la requête pour le débogage
      logger.info(
        "Paramètres de la requête:",
        JSON.stringify(
          {
            sellAsset: quoteRequest.sellAsset,
            buyAsset: quoteRequest.buyAsset,
            sellAmount: quoteRequest.sellAmount,
            sourceAddress: quoteRequest.sourceAddress,
            destinationAddress: quoteRequest.destinationAddress,
            slippage: quoteRequest.slippage,
          },
          null,
          2,
        ),
      );

      // Afficher la configuration de SwapKit
      logger.info("🔍 [Quote Debug] Configuration SwapKit:", {
        apiKeyConfigured: !!process.env.SWAPKIT_API_KEY,
        apiKeyLength: process.env.SWAPKIT_API_KEY ? process.env.SWAPKIT_API_KEY.length : 0,
        apiAvailable: !!swapKit.api,
        apiMethods: swapKit.api ? Object.keys(swapKit.api) : [],
      });

      logger.info("🔍 [Quote Debug] Appel de swapKit.api.getSwapQuote...");

      // DEBUG: Vérifier si la clé API est dans SKConfig
      const skApiKeys = SKConfig.get("apiKeys");
      logger.info("🔑 [API KEY DEBUG] SKConfig.apiKeys.swapKit:", skApiKeys.swapKit ? `${skApiKeys.swapKit.substring(0, 8)}...` : "NON DÉFINI");
      logger.info("🔑 [API KEY DEBUG] process.env.SWAPKIT_API_KEY:", process.env.SWAPKIT_API_KEY ? `${process.env.SWAPKIT_API_KEY.substring(0, 8)}...` : "NON DÉFINI");

      const startTime = Date.now();

      try {
        quoteResponse = await swapKit.api.getSwapQuote(quoteRequest);
        const duration = Date.now() - startTime;
        logger.info(`🔍 [Quote Debug] ✅ Appel API réussi en ${duration}ms`);
        logger.info("🔍 [Quote Debug] Réponse reçue:", typeof quoteResponse, Object.keys(quoteResponse || {}));
      } catch (apiError) {
        const duration = Date.now() - startTime;
        logger.error(`🔍 [Quote Debug] ❌ Erreur API après ${duration}ms:`, apiError.message);
        logger.error("🔍 [Quote Debug] Stack trace:", apiError.stack);
        throw apiError;
      }

      // Vérifier si la réponse est vide
      if (!quoteResponse || Object.keys(quoteResponse).length === 0) {
        logger.error("\n❌ L'API a retourné une réponse vide.");

        return {
          status: "error",
          errorCode: "EMPTY_QUOTE_RESPONSE",
          errorMessage:
            "Impossible d'obtenir un devis de swap (SwapKit). Aucune route disponible pour cette paire d'actifs.",
          errorDetails: {
            requestedPair: {
              sellAsset: quoteRequest.sellAsset,
              buyAsset: quoteRequest.buyAsset,
              sellAmount: quoteRequest.sellAmount,
            },
            possibleCauses: [
              "Paire d'actifs non supportée",
              "Liquidité insuffisante pour cette paire",
              "Montant trop petit ou trop grand",
              "Problème temporaire avec le service de devis",
            ],
            suggestedActions: [
              "Essayez avec un montant différent",
              "Essayez une autre paire d'actifs",
              "Réessayez ultérieurement",
            ],
          },
          timestamp: new Date().toISOString(),
        };
      }

      logger.info("✅ Devis de swap obtenu avec succès.");

      // Afficher un résumé des routes disponibles
      if (quoteResponse.routes && quoteResponse.routes.length > 0) {
        logger.info(`Nombre de routes disponibles: ${quoteResponse.routes.length}`);
        logger.info(`Meilleure route: ${quoteResponse.routes[0].provider}`);
      } else {
        logger.info("Aucune route disponible dans la réponse.");
      }
    } catch (error) {
      logger.error("\n❌ Erreur lors de l'obtention du devis de swap:");

      // Afficher des informations détaillées sur l'erreur
      logger.error("Message:", error.message || "Aucun message");
      logger.error("Nom:", error.name || "Aucun nom");

      // Afficher la stack trace en mode développement
      if (process.env.NODE_ENV === "development") {
        logger.error("Stack:", error.stack || "Aucune stack");
      }

      // Gérer spécifiquement l'erreur "undefined is not an object (evaluating 'C.error')"
      if (
        error.message &&
        error.message.includes("undefined is not an object (evaluating 'C.error')")
      ) {
        logger.error("\n⚠️ Erreur spécifique détectée: Problème avec la réponse de l'API.");

        return {
          status: "error",
          errorCode: "API_RESPONSE_PROCESSING_ERROR",
          errorMessage:
            "Impossible de traiter la réponse de l'API (SwapKit) de devis. Format de réponse inattendu.",
          errorDetails: {
            requestedPair: {
              sellAsset: quoteRequest.sellAsset,
              buyAsset: quoteRequest.buyAsset,
              sellAmount: quoteRequest.sellAmount,
            },
            originalError: {
              message: error.message,
              name: error.name,
            },
            possibleCauses: [
              "Réponse vide ou mal formatée de l'API",
              "Clé API invalide ou expirée",
              "Problème temporaire avec le service API",
            ],
            suggestedActions: [
              "Vérifiez votre clé API",
              "Essayez avec une autre paire d'actifs",
              "Réessayez ultérieurement",
            ],
          },
          timestamp: new Date().toISOString(),
        };
      }

      // Vérifier si l'erreur a une réponse (erreur HTTP)
      if (error.response) {
        logger.error("Données de réponse:", JSON.stringify(error.response.data, null, 2));
        logger.error("Statut:", error.response.status);
      }

      // Afficher l'erreur complète (convertie en objet pour éviter les problèmes de sérialisation)
      try {
        const errorObj = JSON.stringify(
          error,
          (_key, value) => {
            if (value instanceof Error) {
              return {
                message: value.message,
                name: value.name,
                stack: value.stack,
                ...Object.getOwnPropertyNames(value).reduce((acc, prop) => {
                  acc[prop] = value[prop];
                  return acc;
                }, {}),
              };
            }
            return value;
          },
          2,
        );
        logger.error("Erreur complète:", errorObj);
      } catch (jsonError) {
        logger.error("Impossible de sérialiser l'erreur complète:", jsonError.message);
        logger.error("Propriétés de l'erreur:", Object.getOwnPropertyNames(error));
      }

      // Vérifier si c'est une erreur api_v2_server_error
      if (error.message && error.message.includes("api_v2_server_error")) {
        logger.error(
          "\n⚠️ Erreur de serveur API V2 détectée. Cela peut indiquer qu'aucune route n'est disponible pour ce swap.",
        );

        // Vérifier si nous avons des détails supplémentaires dans la réponse
        if (error.response && error.response.data) {
          logger.error("Détails de l'erreur API:", error.response.data);

          // Vérifier si le message d'erreur mentionne des routes
          const errorData = error.response.data;
          if (typeof errorData === "object" && errorData.message) {
            if (
              errorData.message.includes("no route") ||
              errorData.message.includes("no available route") ||
              errorData.message.includes("no provider")
            ) {
              return {
                status: "error",
                error:
                  "Aucune route disponible pour ce swap. Vérifiez les paires d'assets ou essayez avec un montant différent.",
                details: errorData,
              };
            }
          }
        }

        return {
          status: "error",
          error:
            "Erreur de serveur lors de la recherche de routes. Aucune route disponible pour ce swap.",
          details: error.message,
        };
      }

      // Pour les autres types d'erreurs
      if (error.response) {
        logger.error("Statut de la réponse:", error.response.status);
        logger.error("Données de la réponse:", error.response.data);
      }

      return {
        status: "error",
        error: `Erreur lors de l'obtention du devis de swap: ${error.message}`,
        details: error.response?.data || error,
      };
    }

    // Vérifier si nous avons des routes disponibles
    if (!quoteResponse || !quoteResponse.routes || quoteResponse.routes.length === 0) {
      logger.error(
        "\n❌ Aucune route disponible pour ce swap. Vérifiez les paramètres ou réessayez plus tard.",
      );
      return {
        status: "error",
        error:
          "Aucune route disponible pour ce swap. Vérifiez les paires d'assets ou essayez avec un montant différent.",
      };
    }

    // Trier les routes par montant attendu (du plus élevé au plus bas)
    const sortedRoutes = [...quoteResponse.routes].sort(
      (a, b) => Number.parseFloat(b.expectedBuyAmount) - Number.parseFloat(a.expectedBuyAmount),
    );

    // Sélectionner la meilleure route
    const bestRoute = sortedRoutes[0];
    logger.info("Provider de la meilleure route:", bestRoute);

    // VÉRIFICATION PRÉCISE DE LA BALANCE avec la quote réelle
    logger.info("\n🔍 [Balance Check] Vérification précise avec la quote réelle...");

    try {
      // Récupérer le montant USDT nécessaire depuis la route
      const requiredUsdtAmount = Number.parseFloat(bestRoute.sellAmount);
      const sourceBalanceValue = sourceBalance.getValue("number");
      const targetAmount = Number.parseFloat(amount);

      logger.info("🔍 [Balance Check] Comparaison précise:");
      logger.info(`  - Balance USDT disponible: ${sourceBalanceValue} USDT`);
      logger.info(`  - USDT nécessaire (quote): ${requiredUsdtAmount} USDT`);
      logger.info(`  - Token cible désiré: ${targetAmount}`);
      logger.info(`  - Provider: ${bestRoute.provider}`);
      logger.info(`  - Expected output: ${bestRoute.expectedBuyAmount}`);

      if (sourceBalanceValue < requiredUsdtAmount) {
        logger.error("🔍 [Balance Check] ❌ Balance insuffisante avec la quote réelle!");
        logger.error(
          `\n❌ Balance insuffisante. Vous avez ${sourceBalanceValue} USDT mais il faut ${requiredUsdtAmount} USDT selon la quote.`,
        );
        return {
          status: "error",
          errorCode: "INSUFFICIENT_BALANCE_PRECISE",
          errorMessage: `Balance insuffisante. Vous avez ${sourceBalanceValue} USDT mais il faut ${requiredUsdtAmount} USDT pour ce swap.`,
          errorDetails: {
            sourceBalanceValue,
            requiredUsdtAmount,
            targetAmount,
            provider: bestRoute.provider,
            expectedOutput: bestRoute.expectedBuyAmount,
            calculationMethod: "quote-precise"
          },
          timestamp: new Date().toISOString(),
        };
      }

      logger.info("🔍 [Balance Check] ✅ Balance suffisante avec la quote réelle!");
      logger.info(`\n✅ Balance suffisante: ${sourceBalanceValue} USDT disponible pour ${requiredUsdtAmount} USDT nécessaire.`);

    } catch (balanceCheckError) {
      logger.warn("⚠️ [Balance Check] Erreur lors de la vérification précise:", balanceCheckError.message);
      // Continuer quand même, la vérification basique a déjà été faite
    }

    // Vérifier où se trouvent les avertissements
    logger.info("\n🔧 Débogage des avertissements:");
    logger.info("bestRoute contient warnings?", bestRoute.hasOwnProperty("warnings"));
    logger.info("quoteResponse contient warnings?", quoteResponse.hasOwnProperty("warnings"));

    // Vérifier les avertissements de prix d'impact élevé
    const routeWarnings = bestRoute.warnings || [];
    const responseWarnings = quoteResponse.warnings || [];

    logger.info("Nombre d'avertissements dans bestRoute:", routeWarnings.length);
    logger.info("Nombre d'avertissements dans quoteResponse:", responseWarnings.length);

    // Combiner les avertissements des deux sources
    const allWarnings = [...routeWarnings, ...responseWarnings];

    if (allWarnings.length > 0) {
      logger.info("\nListe de tous les avertissements:");
      allWarnings.forEach((warning, index) => {
        logger.info(`Avertissement ${index + 1}:`);
        logger.info(`- Code: ${warning.code || "N/A"}`);
        logger.info(`- Affichage: ${warning.display || "N/A"}`);
        logger.info(`- Détail: ${warning.tooltip || "N/A"}`);
      });
    }

    // Rechercher les avertissements de type "highPriceImpact"
    const highImpactWarning = allWarnings.find((warning) => warning.code === "highPriceImpact");

    if (highImpactWarning) {
      logger.info(`\n⚠️ Avertissement détecté: ${highImpactWarning.code}`);
      logger.info(`Impact affiché: ${highImpactWarning.display}`);
      logger.info(`Détail: ${highImpactWarning.tooltip}`);

      // Vérifier si l'impact de prix est disponible dans les métadonnées
      if (quoteResponse.meta && typeof quoteResponse.meta.priceImpact === "number") {
        const priceImpact = quoteResponse.meta.priceImpact;
        logger.info(`Impact de prix: ${priceImpact}%`);

        // Annuler le swap si l'impact de prix est inférieur à -50%
        if (priceImpact <= -50) {
          logger.error(`\n❌ Swap annulé: L'impact de prix est trop élevé (${priceImpact}%).`);
          logger.error(
            "Pour des raisons de sécurité, les swaps avec un impact de prix inférieur à -50% sont automatiquement annulés.",
          );
          logger.error("Vous pouvez essayer avec un montant plus petit ou un autre fournisseur.");
          return null;
        } else if (priceImpact <= -10) {
          // Avertissement pour les impacts entre -10% et -50%
          logger.warn(`\n⚠️ Attention: L'impact de prix est élevé (${priceImpact}%).`);
          logger.warn(
            "Cela signifie que vous pourriez recevoir significativement moins que la valeur marchande.",
          );
        }
      } else if (highImpactWarning.display) {
        // Si l'impact numérique n'est pas disponible, essayer de parser l'affichage
        const displayImpact = highImpactWarning.display.replace("%", "");
        const parsedImpact = Number.parseFloat(displayImpact);

        if (!isNaN(parsedImpact) && parsedImpact <= -50) {
          logger.error(`\n❌ Swap annulé: L'impact de prix est trop élevé (${displayImpact}%).`);
          logger.error(
            "Pour des raisons de sécurité, les swaps avec un impact de prix inférieur à -50% sont automatiquement annulés.",
          );
          logger.error("Vous pouvez essayer avec un montant plus petit ou un autre fournisseur.");
          return null;
        }
      }
    }

    logger.info("\n✅ Devis obtenu avec succès!");
    logger.info(`Meilleure route: ${bestRoute.providers.join(", ")}`);
    logger.info(`Montant d'entrée: ${bestRoute.sellAmount} ${sourceAsset.toString()}`);
    logger.info(
      `Montant de sortie estimé: ${bestRoute.expectedBuyAmount} ${destinationAsset.toString()}`,
    );
    // Afficher le slippage configuré plutôt que d'essayer d'accéder à des propriétés qui peuvent ne pas exister
    logger.info(`Slippage configuré: ${slippage}%`);

    // Afficher des informations sur le fournisseur utilisé
    logger.info(`\nFournisseur utilisé: ${bestRoute.providers[0]}`);

    // Vérifier le fournisseur utilisé
    const provider = bestRoute.providers[0];
    // Utiliser toString() pour éviter les problèmes de typage
    const providerStr = String(provider);

    if (providerStr.includes("THORCHAIN")) {
      logger.info("Utilisation de ThorChain pour le swap");
    } else if (providerStr.includes("MAYA")) {
      logger.info("Utilisation de Maya Protocol pour le swap");
    } else if (providerStr.includes("UNISWAP")) {
      logger.info("Utilisation d'Uniswap pour le swap");
    } else {
      logger.info(`Utilisation de ${providerStr} pour le swap`);
    }

    // Afficher les informations sur les frais de réseau (gas)
    logger.info("\n💸 Informations sur les frais de réseau (gas):");

    // Débogage pour vérifier où se trouvent les informations sur les frais
    logger.info("\n🔧 Débogage des structures de données:");
    logger.info(
      "bestRoute contient estimatedNetworkFees?",
      bestRoute.hasOwnProperty("estimatedNetworkFees"),
    );
    logger.info(
      "quoteResponse contient estimatedNetworkFees?",
      quoteResponse.hasOwnProperty("estimatedNetworkFees"),
    );

    // Afficher les propriétés de premier niveau de bestRoute
    logger.info("\nPropriétés de bestRoute:", Object.keys(bestRoute));

    // Afficher les propriétés de premier niveau de quoteResponse
    logger.info("Propriétés de quoteResponse:", Object.keys(quoteResponse));

    // Afficher les propriétés liées aux frais dans bestRoute
    logger.info("\nPropriétés liées aux frais dans bestRoute:");
    if (bestRoute.estimatedNetworkFees) logger.info("- estimatedNetworkFees");
    if (bestRoute.fees) logger.info("- fees");
    if (bestRoute.estimatedGasFee) logger.info("- estimatedGasFee");
    if (bestRoute.estimatedGasPrice) logger.info("- estimatedGasPrice");
    if (bestRoute.estimatedGasLimit) logger.info("- estimatedGasLimit");

    // Examiner la structure des frais dans bestRoute
    if (bestRoute.fees) {
      logger.info("\nStructure de bestRoute.fees:", JSON.stringify(bestRoute.fees, null, 2));
    }

    // Examiner la structure de tx dans bestRoute
    if (bestRoute.tx) {
      logger.info("\nStructure de bestRoute.tx:");
      logger.info("- to:", bestRoute.tx.to);
      logger.info("- from:", bestRoute.tx.from);
      logger.info("- gas:", bestRoute.tx.gas);
      logger.info("- gasPrice:", bestRoute.tx.gasPrice);
      logger.info("- value:", bestRoute.tx.value);
      // Ne pas afficher data car c'est trop long
      logger.info("- data: [trop long pour être affiché]");
    }

    // Vérifier si les informations sur les frais sont disponibles
    if (bestRoute.estimatedNetworkFees) {
      const fees = bestRoute.estimatedNetworkFees;

      // Afficher les frais totaux si disponibles
      if (fees.totalFees) {
        logger.info(`Frais totaux estimés: ${fees.totalFees} USD`);
      }

      // Afficher les frais détaillés par étape si disponibles
      if (fees.steps && fees.steps.length > 0) {
        logger.info("Détail des frais par étape:");
        fees.steps.forEach((step: any, index: number) => {
          logger.info(`  Étape ${index + 1}: ${step.name || "Sans nom"}`);
          if (step.gasPrice) logger.info(`    Prix du gas: ${step.gasPrice}`);
          if (step.gasLimit) logger.info(`    Limite de gas: ${step.gasLimit}`);
          if (step.estimatedGasFee)
            logger.info(`    Frais de gas estimés: ${step.estimatedGasFee} ${step.asset || "USD"}`);
        });
      }

      // Afficher les frais spécifiques à la chaîne si disponibles
      if (fees.inboundFee)
        logger.info(`Frais d'entrée: ${fees.inboundFee} ${fees.inboundFeeAsset || "USD"}`);
      if (fees.outboundFee)
        logger.info(`Frais de sortie: ${fees.outboundFee} ${fees.outboundFeeAsset || "USD"}`);
      if (fees.affiliateFee)
        logger.info(`Frais d'affiliation: ${fees.affiliateFee} ${fees.affiliateFeeAsset || "USD"}`);
    } else {
      logger.info("Aucune information détaillée sur les frais n'est disponible pour cette route.");

      // Essayer d'extraire les frais de gas à partir d'autres propriétés
      if (bestRoute.estimatedGasPrice) {
        logger.info(`Prix du gas estimé: ${bestRoute.estimatedGasPrice}`);
      }
      if (bestRoute.estimatedGasLimit) {
        logger.info(`Limite de gas estimée: ${bestRoute.estimatedGasLimit}`);
      }
      if (bestRoute.estimatedGasFee) {
        logger.info(`Frais de gas estimés: ${bestRoute.estimatedGasFee}`);
      }
    }

    // ÉTAPE 2: Exécuter le swap avec la meilleure route
    logger.info("\nℹ️ ÉTAPE 2: Exécution du swap avec la meilleure route...");

    // Demander confirmation à l'utilisateur si nécessaire
    if (waitForConfirmation) {
      logger.info(
        "\n⚠️ ATTENTION: Vous êtes sur le point d'exécuter un swap réel qui engagera vos fonds.",
      );
      logger.info(
        "Appuyez sur Entrée pour confirmer et exécuter le swap, ou Ctrl+C pour annuler...",
      );

      // Simuler une attente de l'entrée utilisateur (dans un environnement réel, vous utiliseriez readline ou un autre mécanisme)
      await new Promise((resolve) => setTimeout(resolve, confirmationTimeout));
    }

    // Exécuter le swap
    // Utiliser l'option de frais spécifiée dans les options et le nom du plugin si spécifié
    const swapParams: any = {
      route: bestRoute,
      feeOptionKey: feeOption,
    };

    // Ajouter le nom du plugin si spécifié
    if (pluginName) {
      swapParams.pluginName = pluginName;
      logger.info(`Utilisation du plugin spécifié: ${pluginName}`);
    }

    // Utiliser une assertion de type pour contourner les problèmes de typage
    logger.debug("\nExécution du swap avec les paramètres:", swapParams);
    // const txHash = "DEBUG_TX_HASH"; // Pour le débogage, on utilise une valeur factice
    // ### execution Utiliser l'API SwapKit pour exécuter le swap
    // Dans un environnement réel, décommentez la ligne suivante:
    let txHash;
    try {
      // Vérifier que swapKit.swap existe
      if (typeof swapKit.swap !== 'function') {
        throw new Error(`swapKit.swap n'est pas une fonction. Type: ${typeof swapKit.swap}`);
      }

      // Vérification des paramètres avant l'exécution
      logger.debug("Vérification des paramètres de swap:");
      logger.debug("- swapParams:", JSON.stringify(swapParams, null, 2));
      logger.debug("- swapKit disponible:", !!swapKit);
      logger.debug("- swapKit.swap disponible:", typeof swapKit.swap);

      // Debug détaillé des plugins
      logger.debug("🔍 [Plugin Debug] Analyse complète des plugins:");
      logger.debug("🔍 [Plugin Debug] - Propriétés de swapKit:", Object.keys(swapKit));

      // Les plugins sont directement sur swapKit, pas dans swapKit.plugins
      const pluginNames = ['evm', 'thorchain', 'mayachain', 'chainflip', 'radix', 'near', 'solana'];
      const availablePlugins = pluginNames.filter(name => swapKit[name]);

      logger.debug("🔍 [Plugin Debug] - Plugins disponibles:", availablePlugins);

      availablePlugins.forEach(pluginName => {
        const plugin = swapKit[pluginName];
        logger.debug(`🔍 [Plugin Debug] - Plugin ${pluginName}:`, {
          hasSwapMethod: typeof plugin?.swap === 'function',
          supportedProviders: plugin?.supportedSwapkitProviders || 'Non défini',
          methods: Object.keys(plugin || {})
        });
      });

      // Déterminer quel plugin sera utilisé pour ce swap
      let pluginName = swapParams.pluginName || swapParams.route.providers[0];
      logger.info(`🎯 Plugin sélectionné pour le swap: ${pluginName}`);

      // Déboguer le plugin spécifique avant l'exécution
      // Les plugins sont directement sur swapKit, pas dans swapKit.plugins
      // Essayer d'abord avec le nom exact, puis en minuscules
      let plugin = swapKit[pluginName] || swapKit[pluginName.toLowerCase()];

      // Si le plugin n'est pas trouvé par nom, chercher par provider supporté
      if (!plugin) {
        logger.info(`🔍 Plugin ${pluginName} non trouvé par nom, recherche par provider...`);

        const allPluginNames = ['evm', 'thorchain', 'mayachain', 'chainflip', 'radix', 'near', 'solana'];
        for (const availablePluginName of allPluginNames) {
          const availablePlugin = swapKit[availablePluginName];
          if (availablePlugin?.supportedSwapkitProviders?.includes(pluginName)) {
            logger.info(`🎯 Plugin ${availablePluginName} supporte le provider ${pluginName}!`);
            plugin = availablePlugin;
            // Mettre à jour le nom du plugin pour les logs
            pluginName = availablePluginName;
            break;
          }
        }
      }

      if (plugin) {
        logger.info(`🔍 Debug du plugin ${pluginName}:`);
        logger.info(`  - Méthodes disponibles: ${Object.keys(plugin)}`);
        logger.info(`  - Méthode swap disponible: ${typeof plugin.swap === 'function'}`);

        if (plugin.supportedSwapkitProviders) {
          logger.info(`  - Providers supportés: ${plugin.supportedSwapkitProviders}`);
        }

        // Vérifier si le provider de la route est supporté
        const routeProvider = swapParams.route.providers[0];
        if (plugin.supportedSwapkitProviders && !plugin.supportedSwapkitProviders.includes(routeProvider)) {
          logger.warn(`⚠️ Provider ${routeProvider} n'est pas dans la liste des providers supportés par ${pluginName}`);
        }

        // Debug spécialisé selon le type de plugin
        debugPluginSpecifics(pluginName, swapParams);

        // Déboguer le wallet spécifique au plugin
        if (swapParams.route && swapParams.route.sellAsset) {
          try {
            const sellAssetChain = swapParams.route.sellAsset.split('.')[0];
            const wallet = swapKit.getWallet(sellAssetChain);
            if (wallet) {
              logger.info(`[${pluginName}] 💼 Wallet pour ${sellAssetChain}:`);
              logger.info(`  - Address: ${wallet.address}`);
              logger.info(`  - Type: ${wallet.walletType}`);
              logger.info(`  - Connected: ${!!wallet.address}`);

              // Vérifier les méthodes nécessaires selon le plugin
              if (pluginName.toLowerCase() === 'evm') {
                logger.info(`  - sendTransaction: ${typeof wallet.sendTransaction === 'function' ? '✅' : '❌'}`);
                logger.info(`  - signTransaction: ${typeof wallet.signTransaction === 'function' ? '✅' : '❌'}`);
              } else if (pluginName.toLowerCase().includes('thorchain') || pluginName.toLowerCase().includes('maya')) {
                logger.info(`  - transfer: ${typeof wallet.transfer === 'function' ? '✅' : '❌'}`);
                logger.info(`  - deposit: ${typeof wallet.deposit === 'function' ? '✅' : '❌'}`);
              }
            } else {
              logger.warn(`[${pluginName}] ⚠️ Aucun wallet trouvé pour ${sellAssetChain}`);
            }
          } catch (walletError) {
            logger.error(`[${pluginName}] ❌ Erreur lors du debug du wallet:`, walletError.message);
          }
        }

        // Intercepter et déboguer l'appel au plugin
        if (typeof plugin.swap === 'function') {
          logger.info(`🚀 Appel direct au plugin ${pluginName}.swap()...`);

          try {
            // Appel direct au plugin avec debug
            const pluginStartTime = Date.now();
            logger.info(`[${pluginName}] 📥 Paramètres envoyés au plugin:`, JSON.stringify(swapParams, null, 2));

            const pluginResult = await plugin.swap(swapParams);
            const pluginDuration = Date.now() - pluginStartTime;

            logger.info(`[${pluginName}] ✅ Plugin swap réussi en ${pluginDuration}ms`);
            logger.info(`[${pluginName}] 📤 Résultat du plugin:`, pluginResult);

            txHash = pluginResult;
          } catch (pluginError) {
            logger.error(`[${pluginName}] ❌ Erreur dans le plugin:`);
            logger.error(`[${pluginName}] Type: ${pluginError.constructor.name}`);
            logger.error(`[${pluginName}] Message: ${pluginError.message}`);

            if (pluginError.stack) {
              logger.error(`[${pluginName}] Stack trace:`, pluginError.stack);
            }

            // Informations spécifiques SwapKit
            if (pluginError.errorKey) {
              logger.error(`[${pluginName}] Code SwapKit: ${pluginError.errorKey}`);
            }
            if (pluginError.info) {
              logger.error(`[${pluginName}] Détails SwapKit:`, JSON.stringify(pluginError.info, null, 2));
            }

            // Analyse spécialisée des erreurs selon le plugin
            analyzePluginError(pluginName, pluginError, swapParams);

            // Tentative de récupération pour les erreurs 1inch
            if (pluginError.message.includes('0xf4059071') && pluginName === 'evm') {
              logger.warn("🔄 [Recovery] Tentative de récupération pour erreur 1inch...");

              // Suggérer une nouvelle quote avec plus de slippage
              logger.warn("💡 [Recovery] Recommandation: Relancez le swap avec:");
              logger.warn("  - Slippage plus élevé (5-10%)");
              logger.warn("  - Montant légèrement réduit");
              logger.warn("  - Vérifiez que le token est approuvé");
            }

            throw pluginError;
          }
        } else {
          logger.error(`❌ Plugin ${pluginName} n'a pas de méthode swap!`);
          throw new Error(`Plugin ${pluginName} ne supporte pas les swaps`);
        }
      } else {
        logger.error(`❌ Plugin ${pluginName} non trouvé!`);
        logger.error("🔍 [Plugin Debug] Analyse détaillée:");

        const pluginNames = ['evm', 'thorchain', 'mayachain', 'chainflip', 'radix', 'near', 'solana'];
        const availablePlugins = pluginNames.filter(name => swapKit[name]);
        logger.error("- Plugins disponibles:", availablePlugins);

        logger.error("🔍 [Plugin Debug] Détails de chaque plugin:");
        availablePlugins.forEach(availablePluginName => {
          const availablePlugin = swapKit[availablePluginName];
          logger.error(`  - ${availablePluginName}:`, {
            hasSwapMethod: typeof availablePlugin?.swap === 'function',
            supportedProviders: availablePlugin?.supportedSwapkitProviders || 'Non défini'
          });

          // Vérifier si ce plugin supporte le provider recherché
          if (availablePlugin?.supportedSwapkitProviders?.includes(pluginName)) {
            logger.error(`  🎯 Plugin ${availablePluginName} supporte ${pluginName}!`);
          }
        });

        throw new Error(`Plugin ${pluginName} non disponible`);
      }
      logger.info(`\n✅ Swap initié avec succès! Hash de transaction: ${txHash}`);
    } catch (swapError) {
      // Gestion détaillée de l'erreur avec plus d'informations
      logger.error(`\n❌ Erreur lors de l'exécution du swap:`);
      logger.error(`Type d'erreur: ${swapError.constructor.name}`);
      logger.error(`Message: ${swapError.message}`);

      // Afficher la stack trace si disponible
      if (swapError.stack) {
        logger.error(`Stack trace: ${swapError.stack}`);
      }

      // Afficher les détails de l'erreur si c'est un SwapKitError
      if (swapError.errorKey) {
        logger.error(`Code d'erreur SwapKit: ${swapError.errorKey}`);
        if (swapError.info) {
          logger.error(`Détails: ${JSON.stringify(swapError.info, null, 2)}`);
        }
      }

      // Afficher les paramètres qui ont causé l'erreur
      logger.error(`Paramètres utilisés: ${JSON.stringify(swapParams, null, 2)}`);

      // Analyse de l'erreur pour fournir des informations plus précises
      let errorCode = "SWAP_EXECUTION_FAILED";
      const errorMessage = swapError.message || "Erreur inconnue lors de l'exécution du swap";
      let errorDetails: any = {};

      // Extraire les détails de l'erreur si disponibles
      if (swapError.code) {
        errorCode = swapError.code;
      }

      if (swapError.details) {
        errorDetails = swapError.details;
      } else if (swapError.data) {
        errorDetails = swapError.data;
      }

      // Vérifier si l'erreur est liée au wallet
      if (
        errorMessage.includes("wallet") ||
        errorMessage.includes("signer") ||
        errorMessage.includes("connect")
      ) {
        errorCode = "WALLET_ERROR";
        errorDetails.suggestion = "Vérifiez que le wallet est correctement connecté et configuré";
      }

      // Retourner une réponse d'erreur structurée
      return {
        status: "error",
        errorCode,
        errorMessage,
        errorDetails,
        timestamp: new Date().toISOString(),
      };
    }

    // Si on arrive ici, c'est que le swap a été initié avec succès
    // Continuer avec le reste du code qui utilise txHash

    // ÉTAPE 3: Suivre la transaction
    logger.info("\nℹ️ ÉTAPE 3: Suivi de la transaction...");
    logger.info(`\n✅ Swap initié avec succès!`);
    logger.info(`Transaction hash: ${txHash}`);

    // Générer l'URL de l'explorateur
    // Déterminer la chaîne appropriée pour l'explorateur en fonction du provider et de la route
    const explorerChain = (bestRoute.providers[0] as string).includes("THORCHAIN")
      ? Chain.THORChain
      : (bestRoute.providers[0] as string).includes("MAYACHAIN")
        ? Chain.Maya
        : effectiveSourceChain;

    const explorerUrl = getExplorerTxUrl({ chain: explorerChain, txHash });
    logger.info(`Explorer URL: ${explorerUrl}`);

    // Attendre que la transaction soit confirmée (dans un environnement réel, vous utiliseriez un mécanisme de polling)
    logger.info("\nAttente de la confirmation de la transaction...");
    logger.info(
      "Ce processus peut prendre plusieurs minutes. Veuillez consulter l'explorateur pour plus de détails.",
    );

    // Afficher le résumé des logs réseau
    logger.info("\n===== Résumé des appels réseau =====\n");
    printNetworkSummary();

    // Récupérer les détails de la transaction pour obtenir le bloc et le chainId
    let blockNumber;
    let transactionChainId;

    try {
      // Préparer les paramètres pour l'appel à l'API
      const trackerParams = {
        chainId: ChainToChainId[explorerChain], // Convertir la chaîne en chainId
        hash: txHash,
      };

      // Appeler l'API pour obtenir les détails de la transaction
      logger.info("\nRécupération des détails de la transaction...");
      const trackerResponse = await swapKit.api.getTrackerDetails(trackerParams);

      logger.info("trackerResponse", trackerResponse);
      // Extraire le bloc et le chainId
      blockNumber = trackerResponse.block;
      transactionChainId = trackerResponse.chainId;

      logger.info(`Bloc: ${blockNumber}, ChainId: ${transactionChainId}`);
    } catch (trackerError) {
      logger.warn("\n⚠️ Impossible de récupérer les détails de la transaction:", trackerError);
      logger.warn("Les informations de bloc et de chainId ne seront pas incluses dans la réponse.");
    }

    return {
      status: "success",
      txHash,
      explorerUrl,
      sourceAsset: sourceAsset.toString(),
      destinationAsset: destinationAsset.toString(),
      amount,
      expectedOutput: bestRoute.expectedBuyAmount,
      ...(blockNumber && { block: blockNumber }),
      ...(transactionChainId && { chainId: transactionChainId }),
    };
  } catch (error) {
    logger.error("\n🔍 [Main Catch] ❌ Erreur capturée dans le catch principal:");
    logger.error("🔍 [Main Catch] Type d'erreur:", typeof error);
    logger.error("🔍 [Main Catch] Constructor:", error?.constructor?.name || 'Unknown');
    logger.error("🔍 [Main Catch] Message:", error?.message || 'Pas de message');
    logger.error("🔍 [Main Catch] Stack:", error?.stack || 'Pas de stack');
    logger.error("🔍 [Main Catch] Erreur complète:", error);

    // Essayer de sérialiser l'erreur de différentes façons
    try {
      logger.error("🔍 [Main Catch] JSON.stringify(error):", JSON.stringify(error));
    } catch (jsonError) {
      logger.error("🔍 [Main Catch] Impossible de sérialiser avec JSON.stringify");
    }

    try {
      logger.error("🔍 [Main Catch] Object.keys(error):", Object.keys(error));
      logger.error("🔍 [Main Catch] Object.getOwnPropertyNames(error):", Object.getOwnPropertyNames(error));
    } catch (keysError) {
      logger.error("🔍 [Main Catch] Impossible d'obtenir les clés de l'erreur");
    }

    // Afficher le résumé des logs réseau même en cas d'erreur
    logger.info("\n===== Résumé des appels réseau (avant erreur) =====\n");
    printNetworkSummary();

    // Analyser l'erreur pour fournir un message plus précis
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = error.message || "Erreur inconnue";
    let errorDetails = {};

    // Extraire les détails de l'erreur
    if (error.error) {
      // Cas des erreurs EVM structurées
      errorDetails = {
        code: error.error.code,
        action: error.error.action,
        reason: error.error.reason,
        transaction: error.error.transaction,
        data: error.error.data,
      };

      // Gérer les cas spécifiques
      if (error.error.reason === "STF") {
        errorCode = "SAFE_TRANSACTION_FAILURE";
        errorMessage =
          "La transaction a échoué pour des raisons de sécurité. Vérifiez votre balance et vos autorisations.";
        errorDetails = {
          ...errorDetails,
          reason: "STF",
          description:
            "Safe Transaction Failure - La transaction a été rejetée pour des raisons de sécurité",
          possibleCauses: [
            "Balance insuffisante pour le token demandé",
            "Autorisation (allowance) insuffisante pour le contrat",
            "Slippage trop restrictif par rapport aux conditions du marché",
            "Liquidité insuffisante dans le pool",
          ],
          suggestedActions: [
            "Vérifiez votre balance de tokens",
            "Approuvez le contrat pour dépenser vos tokens",
            "Augmentez la tolérance de slippage",
            "Essayez avec un montant plus petit",
          ],
        };
      } else if (error.error.code === "CALL_EXCEPTION") {
        errorCode = "CONTRACT_EXECUTION_FAILED";
        errorMessage = `L'exécution du contrat a échoué: ${error.error.reason || "raison inconnue"}`;
      }
    } else if (error.shortMessage) {
      // Cas des erreurs avec shortMessage
      errorMessage = error.shortMessage;

      if (error.shortMessage.includes("STF")) {
        errorCode = "SAFE_TRANSACTION_FAILURE";
        errorMessage =
          "La transaction a échoué pour des raisons de sécurité. Vérifiez votre balance et vos autorisations.";
        errorDetails = {
          ...errorDetails,
          reason: "STF",
          description:
            "Safe Transaction Failure - La transaction a été rejetée pour des raisons de sécurité",
          possibleCauses: [
            "Balance insuffisante pour le token demandé",
            "Autorisation (allowance) insuffisante pour le contrat",
            "Slippage trop restrictif par rapport aux conditions du marché",
            "Liquidité insuffisante dans le pool",
          ],
          suggestedActions: [
            "Vérifiez votre balance de tokens",
            "Approuvez le contrat pour dépenser vos tokens",
            "Augmentez la tolérance de slippage",
            "Essayez avec un montant plus petit",
          ],
        };
      } else if (error.shortMessage.includes("execution reverted")) {
        errorCode = "CONTRACT_EXECUTION_FAILED";
      }

      errorDetails = {
        info: error.info,
        code: error.code,
      };
    } else if (typeof error === "string") {
      // Cas où l'erreur est une simple chaîne
      errorMessage = error;
    }

    // Gérer les erreurs liées aux balances insuffisantes
    if (errorMessage.includes("balance") && errorMessage.includes("insuffisante")) {
      errorCode = "INSUFFICIENT_BALANCE";
    } else if (errorMessage.includes("Aucune balance")) {
      errorCode = "NO_BALANCE_FOUND";
    }

    return {
      status: "error",
      errorCode,
      errorMessage,
      errorDetails,
      timestamp: new Date().toISOString(),
    };
  }
}

// Exports des fonctions utilitaires pour le mode de calcul des montants
export {
  setAmountModeToTargetToken,
  setAmountModeToUsdtAmount,
  getCurrentAmountMode
};
