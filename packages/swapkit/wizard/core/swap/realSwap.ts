import { Chain, FeeOption, ProviderName, AssetValue, ChainToChainId } from "../../../core/src/index";
import { getSwapKitClient } from "./client";
import { printNetworkSummary, clearNetworkLogs } from "./networkUtils";
import { validateAsset, TokenProvider } from "./tokenValidator";
import { cleanWalletForLogging, cleanSwapKitForLogging } from "./walletLogger";
import { applyLogPatch } from "../logPatch";

// Utilitaire de logging simple
const logger = {
  // Fonction pour les logs essentiels (toujours affichés)
  info: (message: string, ...args: any[]) => {
    // Si le message commence par un espace ou un caractère spécial, il est considéré comme détaillé
    const isDetailedLog = message.startsWith(' ') || message.startsWith('\n') || message.startsWith('-') || message.startsWith('  ');

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
  }
};

// Configuration globale des logs
const globalLogConfig = {
  enableDebug: false,
  verboseInfo: false // Contrôle le niveau de détail des logs d'information
};

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
    forceExecution = false
  } = options;
  try {
    // Extraire les chaînes à partir des assets si elles ne sont pas spécifiées
    const extractChainFromAsset = (assetString: string): Chain => {
      // Extraire le préfixe de l'asset (par exemple, "THOR" de "THOR.RUNE")
      const chainString = assetString.split('.')[0];

      // Cas spéciaux qui nécessitent une conversion
      if (chainString.toUpperCase() === 'BNB') {
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
      if (effectiveSourceChain === Chain.THORChain && effectiveDestinationChain === Chain.THORChain) {
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
      if (effectiveSourceChain === Chain.BinanceSmartChain || effectiveDestinationChain === Chain.BinanceSmartChain) {
        return TokenProvider.PANCAKESWAP;
      }

      // Par défaut, utiliser tous les fournisseurs
      return TokenProvider.ALL;
    };

    const suggestedProvider = determineProvider();
    logger.info(`Fournisseur suggéré pour la validation des tokens: ${suggestedProvider || 'ALL'}`);

    // Vérifier que les assets existent dans l'API SwapKit tokens
    logger.info("\nVérification des assets dans l'API SwapKit tokens...");

    // Vérifier l'asset source
    const sourceAssetValidation = await validateAsset(sourceAssetString, suggestedProvider);
    logger.info(`Asset source (${sourceAssetString}): ${sourceAssetValidation.isValid ? '✅ Valide' : '❌ Non valide'}`);
    if (!sourceAssetValidation.isValid) {
      logger.warn(`⚠️ Avertissement: ${sourceAssetValidation.message}`);
    } else if (sourceAssetValidation.token) {
      logger.info(`  Nom: ${sourceAssetValidation.token.name}`);
      logger.info(`  Décimales: ${sourceAssetValidation.token.decimals}`);
      logger.info(`  Fournisseur: ${sourceAssetValidation.provider || 'ALL'}`);
      if (sourceAssetValidation.token.logoURI) {
        logger.info(`  Logo: ${sourceAssetValidation.token.logoURI}`);
      }
      if (sourceAssetValidation.token.coingeckoId) {
        logger.info(`  CoinGecko ID: ${sourceAssetValidation.token.coingeckoId}`);
      }
    }

    // Vérifier l'asset destination
    const destinationAssetValidation = await validateAsset(destinationAssetString, suggestedProvider);
    logger.info(`Asset destination (${destinationAssetString}): ${destinationAssetValidation.isValid ? '✅ Valide' : '❌ Non valide'}`);
    if (!destinationAssetValidation.isValid) {
      logger.warn(`⚠️ Avertissement: ${destinationAssetValidation.message}`);
    } else if (destinationAssetValidation.token) {
      logger.info(`  Nom: ${destinationAssetValidation.token.name}`);
      logger.info(`  Décimales: ${destinationAssetValidation.token.decimals}`);
      logger.info(`  Fournisseur: ${destinationAssetValidation.provider || 'ALL'}`);
      if (destinationAssetValidation.token.logoURI) {
        logger.info(`  Logo: ${destinationAssetValidation.token.logoURI}`);
      }
      if (destinationAssetValidation.token.coingeckoId) {
        logger.info(`  CoinGecko ID: ${destinationAssetValidation.token.coingeckoId}`);
      }
    }

    // Si l'un des assets n'est pas valide, demander confirmation à l'utilisateur
    if (!sourceAssetValidation.isValid || !destinationAssetValidation.isValid) {
      if (!forceExecution) {
        logger.warn("\n⚠️ Un ou plusieurs assets ne sont pas reconnus dans l'API SwapKit tokens.");
        logger.warn("Cela peut indiquer que vous utilisez un asset non supporté ou mal formaté.");
        logger.warn("Pour forcer l'exécution malgré cet avertissement, utilisez l'option 'forceExecution: true'.");
        return {
          status: "error",
          error: "Assets non reconnus dans l'API SwapKit tokens. Utilisez forceExecution: true pour ignorer cette vérification."
        };
      } else {
        logger.warn("\n⚠️ Exécution forcée malgré des assets non reconnus.");
      }
    }

    // Connecter dynamiquement les chaînes nécessaires
    const swapKit = await getSwapKitClient([effectiveSourceChain, effectiveDestinationChain]);

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

      logger.info('\nDébogage SwapKit:');
      logger.info('- swapKit object keys:', Object.keys(cleanedSwapKit));
      logger.info('- swapKit.api exists:', !!cleanedSwapKit.api);

      if (cleanedSwapKit.api) {
        logger.info('- swapKit.api object keys:', Object.keys(cleanedSwapKit.api));
        logger.info('- swapKit.api.getSwapQuote exists:', !!cleanedSwapKit.api.getSwapQuote);
      }

      // Vérifier si la propriété thorchain existe
      logger.info('- swapKit.thorchain exists:', !!cleanedSwapKit.thorchain);
      if (cleanedSwapKit.thorchain) {
        logger.info('- swapKit.thorchain object keys:', Object.keys(cleanedSwapKit.thorchain));
      }
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
      Chain.Solana
    ]);

    // Ajouter également les chaînes source et destination pour s'assurer qu'elles sont incluses
    chainsToConnect.add(effectiveSourceChain);
    chainsToConnect.add(effectiveDestinationChain);

    // Convertir le Set en tableau
    const chainsArray = Array.from(chainsToConnect);

    // Connecter toutes les chaînes disponibles
    logger.info(`\nConnexion de toutes les chaînes disponibles: ${chainsArray.join(', ')}...`);

    // Utiliser la phrase mnémonique fournie dans les options ou celle par défaut
    const phrase = options.mnemonic || process.env.MNEMONIC || "test test test test test test test test test test test junk";

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

    logger.info("\n✅ Plugin ThorChain disponible. Nous allons utiliser swapKit.thorchain.swap directement.");

    // logger.info(`\n⚡️ Exécution d'un swap réel de ${amount} ${sourceAssetString} vers ${destinationAssetString}...`);

    // Déterminer l'adresse source
    // 1. Utiliser l'adresse source personnalisée si fournie
    // 2. Sinon, utiliser l'adresse du portefeuille de la chaîne source si connecté
    const sourceAddress = customSourceAddress || swapKit.getAddress(effectiveSourceChain);

    // Vérifier si une adresse source est disponible
    if (!sourceAddress) {
      logger.error(`\n❌ Aucune adresse source disponible. Veuillez fournir une adresse source personnalisée ou connecter un portefeuille ${effectiveSourceChain}.`);
      return null;
    }

    // Déterminer l'adresse de destination
    // 1. Utiliser l'adresse personnalisée si fournie
    // 2. Sinon, utiliser l'adresse du portefeuille de la chaîne de destination si connecté
    // 3. Sinon, utiliser une adresse de secours (adresse THORChain)
    const destinationAddress = customDestinationAddress ||
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

      logger.debug(`Création de sourceAsset avec asyncTokenLookup: true`);
      sourceAsset = await AssetValue.from({
        asset: sourceAssetString,
        value: amount,
        asyncTokenLookup: true
      });

      logger.debug(`sourceAsset créé avec succès:`);
      logger.debug(`- Type: ${typeof sourceAsset}`);
      logger.debug(`- Constructor: ${sourceAsset.constructor?.name}`);
      logger.debug(`- toString(): ${sourceAsset.toString()}`);

      // Utiliser une fonction personnalisée pour sérialiser l'objet sans les BigInt
      const customStringify = (obj) => {
        try {
          return JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() + 'n' : value
          );
        } catch (error) {
          return `[Non sérialisable: ${error.message}]`;
        }
      };

      logger.debug(`- toJSON (personnalisé): ${customStringify(sourceAsset)}`);
      logger.debug(`- Prototype: ${Object.getPrototypeOf(sourceAsset)?.constructor?.name}`);
      logger.debug(`- hasOwnProperty('decimal'): ${sourceAsset.hasOwnProperty('decimal')}`);
      logger.debug(`- Object.keys(): ${Object.keys(sourceAsset)}`);
      logger.debug(`- Object.getOwnPropertyNames(): ${Object.getOwnPropertyNames(sourceAsset)}`);

      // Extraire manuellement les propriétés importantes
      logger.debug(`- Propriétés importantes:`);
      logger.debug(`- decimal: ${sourceAsset.decimal}`);
      logger.debug(`- chain: ${sourceAsset.chain}`);
      logger.debug(`- symbol: ${sourceAsset.symbol}`);
      logger.debug(`- ticker: ${sourceAsset.ticker}`);
      logger.debug(`- address: ${sourceAsset.address || 'N/A'}`);
      logger.debug(`- value (string): ${sourceAsset.getValue("string")}`);
      logger.debug(`- value (number): ${sourceAsset.getValue("number")}`);

      // Ne pas essayer de sérialiser les descripteurs de propriétés car ils peuvent contenir des BigInt
      logger.debug(`- Descripteurs de propriétés disponibles: ${Object.getOwnPropertyNames(sourceAsset).join(', ')}`);

      // Vérifier spécifiquement la propriété decimal
      const decimalDescriptor = Object.getOwnPropertyDescriptor(sourceAsset, 'decimal');
      logger.debug(`- Descripteur de decimal: ${decimalDescriptor ? 'Existe' : 'N\'existe pas'}`);
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
      destinationAsset = await AssetValue.from({
        asset: destinationAssetString,
        value: 0,
        asyncTokenLookup: true
      });

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
      logger.debug(`- address: ${destinationAsset.address || 'N/A'}`);

      // Vérifier spécifiquement la propriété decimal
      const destDecimalDescriptor = Object.getOwnPropertyDescriptor(destinationAsset, 'decimal');
      logger.debug(`- Descripteur de decimal: ${destDecimalDescriptor ? 'Existe' : 'N\'existe pas'}`);
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
    logger.info('Verif de la balance')
    let balance = [{
      ticker: 'RUNE',
      chain: 'THORChain',
      value: 1000000000000000000000,
      symbol: 'RUNE',
      address: 'RUNE',
      getValue(str) {
        return 10000
      }
    }]
    // Récupérer toutes les balances du wallet pour la chaîne source
    // Cette méthode utilise swapKit.getBalance pour obtenir toutes les balances de la chaîne source
    // puis recherche l'asset spécifique en vérifiant le ticker, la chaîne et l'adresse du contrat (pour les tokens ERC20)
    balance = await swapKit.getBalance(effectiveSourceChain, true);

    logger.info('balance', balance)

    // Extraire le ticker et l'adresse du contrat de l'asset source (par exemple, "RUNE" de "THOR.RUNE" ou "USDC-0x..." de "ETH.USDC-0x...")
    const sourceAssetParts = sourceAssetString.split('.');
    const sourceTickerWithAddress = sourceAssetParts.length > 1 ? sourceAssetParts[1] : sourceAssetParts[0];
    const sourceTickerParts = sourceTickerWithAddress.split('-');
    const sourceTicker = sourceTickerParts[0];
    const sourceTokenAddress = sourceTickerParts.length > 1 ? sourceTickerParts[1] : null;

    // Chercher l'asset dans les balances
    const sourceBalance = balance.find((asset) => {
      // Vérifier si le ticker correspond
      const tickerMatch = asset.ticker === sourceTicker ||
                         asset.symbol.toLowerCase() === sourceTicker.toLowerCase();

      // Vérifier si la chaîne correspond
      const chainMatch = asset.chain === effectiveSourceChain;

      // Vérifier si l'adresse correspond (pour les tokens ERC20)
      const addressMatch = sourceTokenAddress ?
                          (asset.address && asset.address.toLowerCase() === sourceTokenAddress.toLowerCase()) :
                          true;

      return tickerMatch && chainMatch && addressMatch;
    });

    if (!sourceBalance) {
      logger.error(`\n❌ Aucune balance ${sourceAssetString} trouvée. Impossible d'exécuter le swap.`);

      // Construire une réponse d'erreur détaillée pour l'absence de balance
      return {
        status: "error",
        errorCode: "NO_BALANCE_FOUND",
        errorMessage: `Aucune balance ${sourceAssetString} trouvée pour l'adresse ${sourceAddress}`,
        errorDetails: {
          address: sourceAddress,
          asset: sourceAssetString,
          chain: effectiveSourceChain,
          balancesDisponibles: balance.map(b => ({
            chain: b.chain,
            symbol: b.symbol,
            ticker: b.ticker,
            value: b.getValue("string"),
            address: b.address
          })),
          requiredAction: "Veuillez approvisionner ce compte avec des tokens avant d'effectuer un swap"
        },
        timestamp: new Date().toISOString()
      };
    }

    const sourceBalanceValue = sourceBalance.getValue("number");
    const swapAmount = parseFloat(amount);

    if (sourceBalanceValue < swapAmount) {
      logger.error(`\n❌ Balance insuffisante. Vous avez ${sourceBalanceValue} ${sourceTicker} mais essayez d'en swapper ${swapAmount}.`);
      return {
        status: "error",
        errorCode: "INSUFFICIENT_BALANCE",
        errorMessage: `Balance insuffisante. Vous avez ${sourceBalanceValue} ${sourceTicker} mais essayez d'en swapper ${swapAmount}.`,
        errorDetails: {
          sourceBalanceValue,
          swapAmount
        },
        timestamp: new Date().toISOString()
      };
    }

    logger.info(`\n✅ Balance suffisante: ${sourceBalanceValue} ${sourceTicker} disponible pour swapper ${swapAmount} ${sourceTicker}.`);

    // Vérifier la balance de tokens natifs pour les frais de gas
    // Cette vérification est particulièrement importante pour les chaînes EVM (Ethereum, BSC, etc.)
    if (effectiveSourceChain.includes('ETH') ||
        effectiveSourceChain === Chain.BinanceSmartChain ||
        effectiveSourceChain === Chain.Avalanche ||
        effectiveSourceChain === Chain.Polygon) {

      // Déterminer le token natif en fonction de la chaîne
      let nativeToken = '';
      switch(effectiveSourceChain) {
        case Chain.Ethereum:
          nativeToken = 'ETH';
          break;
        case Chain.BinanceSmartChain:
          nativeToken = 'BNB';
          break;
        case Chain.Avalanche:
          nativeToken = 'AVAX';
          break;
        case Chain.Polygon:
          nativeToken = 'MATIC';
          break;
        default:
          nativeToken = effectiveSourceChain;
      }

      // Trouver la balance du token natif
      const nativeBalance = balance.find(asset =>
        asset.ticker === nativeToken &&
        asset.chain === effectiveSourceChain
      );

      if (!nativeBalance) {
        logger.warn(`\n⚠️ Attention: Impossible de trouver la balance de ${nativeToken} pour les frais de gas.`);
        logger.warn('Assurez-vous d\'avoir suffisamment de tokens natifs pour couvrir les frais de transaction.');
      } else {
        const nativeBalanceValue = nativeBalance.getValue("number");
        logger.info(`\n💰 Balance de tokens natifs pour les frais: ${nativeBalanceValue} ${nativeToken}`);

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
          logger.warn(`\n⚠️ Attention: Votre balance de ${nativeToken} (${nativeBalanceValue}) pourrait être insuffisante pour couvrir les frais de gas.`);
          logger.warn(`Il est recommandé d'avoir au moins ${requiredGas} ${nativeToken} pour les transactions sur ${effectiveSourceChain}.`);
        } else {
          logger.info(`\n✅ Balance de tokens natifs suffisante pour les frais de gas.`);
        }
      }
    }

    // ÉTAPE 1: Obtenir un devis de swap (quote)
    logger.info("\nℹ️ ÉTAPE 1: Obtention d'un devis de swap (quote)...");

    // Débogage détaillé de l'API SwapKit
    logger.info('\nDébogage détaillé de l\'API SwapKit:');
    logger.info('- Type de swapKit.api:', typeof swapKit.api);
    // Utiliser notre utilitaire de nettoyage pour éviter d'afficher trop de détails
    logger.info('- Propriétés de swapKit.api:', swapKit.api ? Object.keys(swapKit.api) : 'Non disponible');

    // Vérifier si la clé API est configurée
    if (!swapKit.api || !swapKit.api.getSwapQuote) {
      logger.error("\n❌ API SwapKit non disponible. Vérifiez que votre clé API est configurée correctement.");
      logger.error("La clé API actuelle est:", process.env.SWAPKIT_API_KEY || 'Non définie');
      logger.error("Si vous voyez 'VOTRE_CLE_API_ICI', vous devez définir une clé API valide.");

      // Essayer d'utiliser directement l'API de ThorChain
      logger.info("\nℹ️ Tentative d'utilisation directe de l'API ThorChain...");
      if (swapKit.thorchain && swapKit.thorchain.swap) {
        logger.info("\n✅ L'API ThorChain est disponible. Vous pouvez utiliser swapKit.thorchain.swap directement.");
        logger.info("Exemple: swapKit.thorchain.swap({ assetValue: sourceAsset, destinationAsset: 'BNB.BNB' })");
      }

      return null;
    }

    // Préparer la requête de devis avec les fournisseurs spécifiés
    const quoteRequest = {
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

    // TODO gerer les erreurs : insufficient funds et autres
    // logger.info("Requête de devis:", quoteRequest);

    // Obtenir le devis de swap
    let quoteResponse: any;
    try {
      logger.info("\n⏳ Appel de l'API getSwapQuote...");

      // Vérifier que l'API est disponible
      if (!swapKit.api || !swapKit.api.getSwapQuote) {
        throw new Error("L'API SwapKit n'est pas disponible. Vérifiez votre configuration.");
      }

      // Afficher les paramètres de la requête pour le débogage
      logger.info("Paramètres de la requête:", JSON.stringify({
        sellAsset: quoteRequest.sellAsset,
        buyAsset: quoteRequest.buyAsset,
        sellAmount: quoteRequest.sellAmount,
        sourceAddress: quoteRequest.sourceAddress,
        destinationAddress: quoteRequest.destinationAddress,
        slippage: quoteRequest.slippage
      }, null, 2));

      // Afficher la configuration de SwapKit
      logger.info("Configuration SwapKit:", {
        apiKeyConfigured: !!process.env.SWAPKIT_API_KEY,
        apiKeyLength: process.env.SWAPKIT_API_KEY ? process.env.SWAPKIT_API_KEY.length : 0,
        apiAvailable: !!swapKit.api,
        apiMethods: swapKit.api ? Object.keys(swapKit.api) : []
      });

      quoteResponse = await swapKit.api.getSwapQuote(quoteRequest);

      // Vérifier si la réponse est vide
      if (!quoteResponse || Object.keys(quoteResponse).length === 0) {
        logger.error("\n❌ L'API a retourné une réponse vide.");

        return {
          status: "error",
          errorCode: "EMPTY_QUOTE_RESPONSE",
          errorMessage: "Impossible d'obtenir un devis de swap (SwapKit). Aucune route disponible pour cette paire d'actifs.",
          errorDetails: {
            requestedPair: {
              sellAsset: quoteRequest.sellAsset,
              buyAsset: quoteRequest.buyAsset,
              sellAmount: quoteRequest.sellAmount
            },
            possibleCauses: [
              "Paire d'actifs non supportée",
              "Liquidité insuffisante pour cette paire",
              "Montant trop petit ou trop grand",
              "Problème temporaire avec le service de devis"
            ],
            suggestedActions: [
              "Essayez avec un montant différent",
              "Essayez une autre paire d'actifs",
              "Réessayez ultérieurement"
            ]
          },
          timestamp: new Date().toISOString()
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
      if (process.env.NODE_ENV === 'development') {
        logger.error("Stack:", error.stack || "Aucune stack");
      }

      // Gérer spécifiquement l'erreur "undefined is not an object (evaluating 'C.error')"
      if (error.message && error.message.includes("undefined is not an object (evaluating 'C.error')")) {
        logger.error("\n⚠️ Erreur spécifique détectée: Problème avec la réponse de l'API.");

        return {
          status: "error",
          errorCode: "API_RESPONSE_PROCESSING_ERROR",
          errorMessage: "Impossible de traiter la réponse de l'API (SwapKit) de devis. Format de réponse inattendu.",
          errorDetails: {
            requestedPair: {
              sellAsset: quoteRequest.sellAsset,
              buyAsset: quoteRequest.buyAsset,
              sellAmount: quoteRequest.sellAmount
            },
            originalError: {
              message: error.message,
              name: error.name
            },
            possibleCauses: [
              "Réponse vide ou mal formatée de l'API",
              "Clé API invalide ou expirée",
              "Problème temporaire avec le service API"
            ],
            suggestedActions: [
              "Vérifiez votre clé API",
              "Essayez avec une autre paire d'actifs",
              "Réessayez ultérieurement"
            ]
          },
          timestamp: new Date().toISOString()
        };
      }

      // Vérifier si l'erreur a une réponse (erreur HTTP)
      if (error.response) {
        logger.error("Données de réponse:", JSON.stringify(error.response.data, null, 2));
        logger.error("Statut:", error.response.status);
      }

      // Afficher l'erreur complète (convertie en objet pour éviter les problèmes de sérialisation)
      try {
        const errorObj = JSON.stringify(error, (_key, value) => {
          if (value instanceof Error) {
            return {
              message: value.message,
              name: value.name,
              stack: value.stack,
              ...Object.getOwnPropertyNames(value).reduce((acc, prop) => {
                acc[prop] = value[prop];
                return acc;
              }, {})
            };
          }
          return value;
        }, 2);
        logger.error("Erreur complète:", errorObj);
      } catch (jsonError) {
        logger.error("Impossible de sérialiser l'erreur complète:", jsonError.message);
        logger.error("Propriétés de l'erreur:", Object.getOwnPropertyNames(error));
      }

      // Vérifier si c'est une erreur api_v2_server_error
      if (error.message && error.message.includes('api_v2_server_error')) {
        logger.error("\n⚠️ Erreur de serveur API V2 détectée. Cela peut indiquer qu'aucune route n'est disponible pour ce swap.");

        // Vérifier si nous avons des détails supplémentaires dans la réponse
        if (error.response && error.response.data) {
          logger.error("Détails de l'erreur API:", error.response.data);

          // Vérifier si le message d'erreur mentionne des routes
          const errorData = error.response.data;
          if (typeof errorData === 'object' && errorData.message) {
            if (errorData.message.includes('no route') ||
                errorData.message.includes('no available route') ||
                errorData.message.includes('no provider')) {
              return {
                status: "error",
                error: "Aucune route disponible pour ce swap. Vérifiez les paires d'assets ou essayez avec un montant différent.",
                details: errorData
              };
            }
          }
        }

        return {
          status: "error",
          error: "Erreur de serveur lors de la recherche de routes. Aucune route disponible pour ce swap.",
          details: error.message
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
        details: error.response?.data || error
      };
    }

    // Vérifier si nous avons des routes disponibles
    if (!quoteResponse || !quoteResponse.routes || quoteResponse.routes.length === 0) {
      logger.error("\n❌ Aucune route disponible pour ce swap. Vérifiez les paramètres ou réessayez plus tard.");
      return {
        status: "error",
        error: "Aucune route disponible pour ce swap. Vérifiez les paires d'assets ou essayez avec un montant différent."
      };
    }

    // Trier les routes par montant attendu (du plus élevé au plus bas)
    const sortedRoutes = [...quoteResponse.routes].sort(
      (a, b) => parseFloat(b.expectedBuyAmount) - parseFloat(a.expectedBuyAmount)
    );

    // Sélectionner la meilleure route
    const bestRoute = sortedRoutes[0];
    logger.info("Provider de la meilleure route:", bestRoute);

    // Vérifier où se trouvent les avertissements
    logger.info("\n🔧 Débogage des avertissements:");
    logger.info("bestRoute contient warnings?", bestRoute.hasOwnProperty('warnings'));
    logger.info("quoteResponse contient warnings?", quoteResponse.hasOwnProperty('warnings'));

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
        logger.info(`- Code: ${warning.code || 'N/A'}`);
        logger.info(`- Affichage: ${warning.display || 'N/A'}`);
        logger.info(`- Détail: ${warning.tooltip || 'N/A'}`);
      });
    }

    // Rechercher les avertissements de type "highPriceImpact"
    const highImpactWarning = allWarnings.find(warning => warning.code === "highPriceImpact");

      if (highImpactWarning) {
        logger.info(`\n⚠️ Avertissement détecté: ${highImpactWarning.code}`);
        logger.info(`Impact affiché: ${highImpactWarning.display}`);
        logger.info(`Détail: ${highImpactWarning.tooltip}`);

        // Vérifier si l'impact de prix est disponible dans les métadonnées
        if (quoteResponse.meta && typeof quoteResponse.meta.priceImpact === 'number') {
          const priceImpact = quoteResponse.meta.priceImpact;
          logger.info(`Impact de prix: ${priceImpact}%`);

          // Annuler le swap si l'impact de prix est inférieur à -50%
          if (priceImpact <= -50) {
            logger.error(`\n❌ Swap annulé: L'impact de prix est trop élevé (${priceImpact}%).`);
            logger.error("Pour des raisons de sécurité, les swaps avec un impact de prix inférieur à -50% sont automatiquement annulés.");
            logger.error("Vous pouvez essayer avec un montant plus petit ou un autre fournisseur.");
            return null;
          } else if (priceImpact <= -10) {
            // Avertissement pour les impacts entre -10% et -50%
            logger.warn(`\n⚠️ Attention: L'impact de prix est élevé (${priceImpact}%).`);
            logger.warn("Cela signifie que vous pourriez recevoir significativement moins que la valeur marchande.");
          }
        } else if (highImpactWarning.display) {
          // Si l'impact numérique n'est pas disponible, essayer de parser l'affichage
          const displayImpact = highImpactWarning.display.replace('%', '');
          const parsedImpact = parseFloat(displayImpact);

          if (!isNaN(parsedImpact) && parsedImpact <= -50) {
            logger.error(`\n❌ Swap annulé: L'impact de prix est trop élevé (${displayImpact}%).`);
            logger.error("Pour des raisons de sécurité, les swaps avec un impact de prix inférieur à -50% sont automatiquement annulés.");
            logger.error("Vous pouvez essayer avec un montant plus petit ou un autre fournisseur.");
            return null;
          }
        }
      }

    logger.info("\n✅ Devis obtenu avec succès!");
    logger.info(`Meilleure route: ${bestRoute.providers.join(", ")}`);
    logger.info(`Montant d'entrée: ${bestRoute.sellAmount} ${sourceAsset.toString()}`);
    logger.info(`Montant de sortie estimé: ${bestRoute.expectedBuyAmount} ${destinationAsset.toString()}`);
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
    logger.info("bestRoute contient estimatedNetworkFees?", bestRoute.hasOwnProperty('estimatedNetworkFees'));
    logger.info("quoteResponse contient estimatedNetworkFees?", quoteResponse.hasOwnProperty('estimatedNetworkFees'));

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
          logger.info(`  Étape ${index + 1}: ${step.name || 'Sans nom'}`);
          if (step.gasPrice) logger.info(`    Prix du gas: ${step.gasPrice}`);
          if (step.gasLimit) logger.info(`    Limite de gas: ${step.gasLimit}`);
          if (step.estimatedGasFee) logger.info(`    Frais de gas estimés: ${step.estimatedGasFee} ${step.asset || 'USD'}`);
        });
      }

      // Afficher les frais spécifiques à la chaîne si disponibles
      if (fees.inboundFee) logger.info(`Frais d'entrée: ${fees.inboundFee} ${fees.inboundFeeAsset || 'USD'}`);
      if (fees.outboundFee) logger.info(`Frais de sortie: ${fees.outboundFee} ${fees.outboundFeeAsset || 'USD'}`);
      if (fees.affiliateFee) logger.info(`Frais d'affiliation: ${fees.affiliateFee} ${fees.affiliateFeeAsset || 'USD'}`);
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
      logger.info("\n⚠️ ATTENTION: Vous êtes sur le point d'exécuter un swap réel qui engagera vos fonds.");
      logger.info("Appuyez sur Entrée pour confirmer et exécuter le swap, ou Ctrl+C pour annuler...");

      // Simuler une attente de l'entrée utilisateur (dans un environnement réel, vous utiliseriez readline ou un autre mécanisme)
      await new Promise(resolve => setTimeout(resolve, confirmationTimeout));
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
      // Tentative d'exécution du swap
      txHash = await (swapKit.swap as any)(swapParams);
      logger.info(`\n✅ Swap initié avec succès! Hash de transaction: ${txHash}`);
    } catch (swapError) {
      // Gestion détaillée de l'erreur
      logger.error(`\n❌ Erreur lors de l'exécution du swap: ${swapError.message}`);
      
      // Analyse de l'erreur pour fournir des informations plus précises
      let errorCode = "SWAP_EXECUTION_FAILED";
      let errorMessage = swapError.message || "Erreur inconnue lors de l'exécution du swap";
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
      if (errorMessage.includes("wallet") || errorMessage.includes("signer") || errorMessage.includes("connect")) {
        errorCode = "WALLET_ERROR";
        errorDetails.suggestion = "Vérifiez que le wallet est correctement connecté et configuré";
      }
      
      // Retourner une réponse d'erreur structurée
      return {
        status: "error",
        errorCode,
        errorMessage,
        errorDetails,
        timestamp: new Date().toISOString()
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
    const explorerChain = (bestRoute.providers[0] as string).includes('THORCHAIN') ? Chain.THORChain :
                         (bestRoute.providers[0] as string).includes('MAYACHAIN') ? Chain.Maya :
                         effectiveSourceChain;

    const explorerUrl = swapKit.getExplorerTxUrl({ chain: explorerChain, txHash });
    logger.info(`Explorer URL: ${explorerUrl}`);

    // Attendre que la transaction soit confirmée (dans un environnement réel, vous utiliseriez un mécanisme de polling)
    logger.info("\nAttente de la confirmation de la transaction...");
    logger.info("Ce processus peut prendre plusieurs minutes. Veuillez consulter l'explorateur pour plus de détails.");

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
        hash: txHash
      };

      // Appeler l'API pour obtenir les détails de la transaction
      logger.info("\nRécupération des détails de la transaction...");
      const trackerResponse = await swapKit.api.getTrackerDetails(trackerParams);

      logger.info('trackerResponse', trackerResponse)
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
      ...(transactionChainId && { chainId: transactionChainId })
    };
  } catch (error) {
    logger.error("\n❌ Erreur lors de l'exécution du swap:", error);

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
        data: error.error.data
      };

      // Gérer les cas spécifiques
      if (error.error.reason === "STF") {
        errorCode = "SAFE_TRANSACTION_FAILURE";
        errorMessage = "La transaction a échoué pour des raisons de sécurité. Vérifiez votre balance et vos autorisations.";
        errorDetails = {
          ...errorDetails,
          reason: "STF",
          description: "Safe Transaction Failure - La transaction a été rejetée pour des raisons de sécurité",
          possibleCauses: [
            "Balance insuffisante pour le token demandé",
            "Autorisation (allowance) insuffisante pour le contrat",
            "Slippage trop restrictif par rapport aux conditions du marché",
            "Liquidité insuffisante dans le pool"
          ],
          suggestedActions: [
            "Vérifiez votre balance de tokens",
            "Approuvez le contrat pour dépenser vos tokens",
            "Augmentez la tolérance de slippage",
            "Essayez avec un montant plus petit"
          ]
        };
      } else if (error.error.code === "CALL_EXCEPTION") {
        errorCode = "CONTRACT_EXECUTION_FAILED";
        errorMessage = `L'exécution du contrat a échoué: ${error.error.reason || 'raison inconnue'}`;
      }
    } else if (error.shortMessage) {
      // Cas des erreurs avec shortMessage
      errorMessage = error.shortMessage;

      if (error.shortMessage.includes("STF")) {
        errorCode = "SAFE_TRANSACTION_FAILURE";
        errorMessage = "La transaction a échoué pour des raisons de sécurité. Vérifiez votre balance et vos autorisations.";
        errorDetails = {
          ...errorDetails,
          reason: "STF",
          description: "Safe Transaction Failure - La transaction a été rejetée pour des raisons de sécurité",
          possibleCauses: [
            "Balance insuffisante pour le token demandé",
            "Autorisation (allowance) insuffisante pour le contrat",
            "Slippage trop restrictif par rapport aux conditions du marché",
            "Liquidité insuffisante dans le pool"
          ],
          suggestedActions: [
            "Vérifiez votre balance de tokens",
            "Approuvez le contrat pour dépenser vos tokens",
            "Augmentez la tolérance de slippage",
            "Essayez avec un montant plus petit"
          ]
        };
      } else if (error.shortMessage.includes("execution reverted")) {
        errorCode = "CONTRACT_EXECUTION_FAILED";
      }

      errorDetails = {
        info: error.info,
        code: error.code
      };
    } else if (typeof error === 'string') {
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
      timestamp: new Date().toISOString()
    };
  }
}
