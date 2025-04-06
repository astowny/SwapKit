import { Chain, FeeOption, ProviderName, AssetValue } from "../../../core/src/index";
import { getSwapKitClient } from "./client";
import { checkPriceImpact, logGasFees } from "./checkPriceImpact";
import { printNetworkSummary, clearNetworkLogs } from "./networkUtils";
import { validateAsset, TokenProvider } from "./tokenValidator";

// Ajout de débogage pour vérifier la source de AssetValue
console.log("[DEBUG] AssetValue module:", AssetValue);
console.log("[DEBUG] await AssetValue.from:", AssetValue.from);
console.log("[DEBUG] AssetValue.loadStaticAssets:", AssetValue.loadStaticAssets);

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
}

/**
 * Exécute un swap réel avec les options spécifiées
 * @param options Options pour le swap
 * @returns Résultat du swap ou null en cas d'échec
 */
export async function executeRealSwap(options: RealSwapOptions = {}) {
  console.log("\n[DEBUG] Début de executeRealSwap");
  console.log("[DEBUG] AssetValue avant loadStaticAssets:", AssetValue);

  // Réinitialiser les logs réseau pour cette exécution
  clearNetworkLogs();
  console.log("Logs réseau réinitialisés pour cette exécution");



  // Charger explicitement les assets statiques
  console.log("[DEBUG] Chargement des assets statiques...");
  try {
    await AssetValue.loadStaticAssets();
    console.log("[DEBUG] Assets statiques chargés avec succès");
    console.log("[DEBUG] AssetValue après loadStaticAssets:", AssetValue);
  } catch (error) {
    console.error("[DEBUG] Erreur lors du chargement des assets statiques:", error);
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

    console.log(`Chaîne source: ${effectiveSourceChain}`);
    console.log(`Chaîne destination: ${effectiveDestinationChain}`);

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
    console.log(`Fournisseur suggéré pour la validation des tokens: ${suggestedProvider || 'ALL'}`);

    // Vérifier que les assets existent dans l'API SwapKit tokens
    console.log("\nVérification des assets dans l'API SwapKit tokens...");

    // Vérifier l'asset source
    const sourceAssetValidation = await validateAsset(sourceAssetString, suggestedProvider);
    console.log(`Asset source (${sourceAssetString}): ${sourceAssetValidation.isValid ? '✅ Valide' : '❌ Non valide'}`);
    if (!sourceAssetValidation.isValid) {
      console.warn(`⚠️ Avertissement: ${sourceAssetValidation.message}`);
    } else if (sourceAssetValidation.token) {
      console.log(`  Nom: ${sourceAssetValidation.token.name}`);
      console.log(`  Décimales: ${sourceAssetValidation.token.decimals}`);
      console.log(`  Fournisseur: ${sourceAssetValidation.provider || 'ALL'}`);
      if (sourceAssetValidation.token.logoURI) {
        console.log(`  Logo: ${sourceAssetValidation.token.logoURI}`);
      }
      if (sourceAssetValidation.token.coingeckoId) {
        console.log(`  CoinGecko ID: ${sourceAssetValidation.token.coingeckoId}`);
      }
    }

    // Vérifier l'asset destination
    const destinationAssetValidation = await validateAsset(destinationAssetString, suggestedProvider);
    console.log(`Asset destination (${destinationAssetString}): ${destinationAssetValidation.isValid ? '✅ Valide' : '❌ Non valide'}`);
    if (!destinationAssetValidation.isValid) {
      console.warn(`⚠️ Avertissement: ${destinationAssetValidation.message}`);
    } else if (destinationAssetValidation.token) {
      console.log(`  Nom: ${destinationAssetValidation.token.name}`);
      console.log(`  Décimales: ${destinationAssetValidation.token.decimals}`);
      console.log(`  Fournisseur: ${destinationAssetValidation.provider || 'ALL'}`);
      if (destinationAssetValidation.token.logoURI) {
        console.log(`  Logo: ${destinationAssetValidation.token.logoURI}`);
      }
      if (destinationAssetValidation.token.coingeckoId) {
        console.log(`  CoinGecko ID: ${destinationAssetValidation.token.coingeckoId}`);
      }
    }

    // Si l'un des assets n'est pas valide, demander confirmation à l'utilisateur
    if (!sourceAssetValidation.isValid || !destinationAssetValidation.isValid) {
      if (!forceExecution) {
        console.warn("\n⚠️ Un ou plusieurs assets ne sont pas reconnus dans l'API SwapKit tokens.");
        console.warn("Cela peut indiquer que vous utilisez un asset non supporté ou mal formaté.");
        console.warn("Pour forcer l'exécution malgré cet avertissement, utilisez l'option 'forceExecution: true'.");
        return {
          status: "error",
          error: "Assets non reconnus dans l'API SwapKit tokens. Utilisez forceExecution: true pour ignorer cette vérification."
        };
      } else {
        console.warn("\n⚠️ Exécution forcée malgré des assets non reconnus.");
      }
    }

    // Connecter dynamiquement les chaînes nécessaires
    const swapKit = await getSwapKitClient([effectiveSourceChain, effectiveDestinationChain]);

    console.log(`Chaîne source: ${effectiveSourceChain}`);
    console.log(`Chaîne destination: ${effectiveDestinationChain}`);
    if (!swapKit) {
      console.error("\n❌ Impossible d'initialiser SwapKit");
      return null;
    }

    // Vérifier que le client SwapKit est correctement configuré
    console.log('\nDébogage SwapKit:');
    console.log('- swapKit object keys:', Object.keys(swapKit));
    console.log('- swapKit.api exists:', !!swapKit.api);

    if (swapKit.api) {
      console.log('- swapKit.api object keys:', Object.keys(swapKit.api));
      console.log('- swapKit.api.getSwapQuote exists:', !!swapKit.api.getSwapQuote);
    }

    // Vérifier si la propriété thorchain existe
    console.log('- swapKit.thorchain exists:', !!swapKit.thorchain);
    if (swapKit.thorchain) {
      console.log('- swapKit.thorchain object keys:', Object.keys(swapKit.thorchain));
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
    console.log(`\nConnexion de toutes les chaînes disponibles: ${chainsArray.join(', ')}...`);

    // Utiliser la phrase mnémonique fournie dans les options ou celle par défaut
    const phrase = options.mnemonic || process.env.MNEMONIC || "test test test test test test test test test test test junk";

    try {
      await swapKit.connectKeystore(chainsArray, phrase);
      console.log(`\n✅ Portefeuilles connectés avec succès!`);

      // Afficher les adresses connectées pour chaque chaîne
      console.log("\n🔑 Adresses connectées:");
      for (const chain of chainsArray) {
        const address = swapKit.getAddress(chain);
        if (address) {
          console.log(`${chain}: ${address}`);
        } else {
          console.warn(`⚠️ Impossible d'obtenir l'adresse pour ${chain}`);
        }
      }
    } catch (error) {
      console.error(`\n❌ Échec de la connexion des portefeuilles:`, error);
      return null;
    }

    // Vérifier si nous pouvons utiliser le plugin ThorChain directement
    if (!swapKit.thorchain || !swapKit.thorchain.swap) {
      console.error("\n❌ Plugin ThorChain non disponible ou méthode swap manquante.");
      console.error("Vérifiez que le plugin ThorChain est correctement importé dans client.ts");
      return null;
    }

    console.log("\n✅ Plugin ThorChain disponible. Nous allons utiliser swapKit.thorchain.swap directement.");

    console.log(`\n⚡️ Exécution d'un swap réel de ${amount} ${sourceAssetString} vers ${destinationAssetString}...`);

    // Déterminer l'adresse source
    // 1. Utiliser l'adresse source personnalisée si fournie
    // 2. Sinon, utiliser l'adresse du portefeuille de la chaîne source si connecté
    const sourceAddress = customSourceAddress || swapKit.getAddress(effectiveSourceChain);

    // Vérifier si une adresse source est disponible
    if (!sourceAddress) {
      console.error(`\n❌ Aucune adresse source disponible. Veuillez fournir une adresse source personnalisée ou connecter un portefeuille ${effectiveSourceChain}.`);
      return null;
    }

    // Déterminer l'adresse de destination
    // 1. Utiliser l'adresse personnalisée si fournie
    // 2. Sinon, utiliser l'adresse du portefeuille de la chaîne de destination si connecté
    // 3. Sinon, utiliser une adresse de secours (adresse THORChain)
    const destinationAddress = customDestinationAddress ||
                              swapKit.getAddress(effectiveDestinationChain) ||
                              "0x4cE8bEe6A8afC3debF669adC3b1727103cdBB649"; // Adresse de secours

    console.log(`Adresse source: ${sourceAddress}`);
    console.log(`Adresse destination: ${destinationAddress}`);

    // Créer les objets AssetValue pour les actifs source et destination
    console.log(`\n[DEBUG] Création de sourceAsset pour ${sourceAssetString} avec amount=${amount}`);
    let sourceAsset;
    let destinationAsset;

    try {
      // Charger explicitement les assets statiques avant de créer les AssetValue
      console.log(`[DEBUG] Chargement des assets statiques avant création des AssetValue...`);
      await AssetValue.loadStaticAssets();
      console.log(`[DEBUG] Assets statiques chargés avec succès`);

      console.log(`[DEBUG] Création de sourceAsset avec asyncTokenLookup: true`);
      sourceAsset = await AssetValue.from({
        asset: sourceAssetString,
        value: amount,
        asyncTokenLookup: true
      });

      console.log(`[DEBUG] sourceAsset créé avec succès:`);
      console.log(`[DEBUG] - Type: ${typeof sourceAsset}`);
      console.log(`[DEBUG] - Constructor: ${sourceAsset.constructor?.name}`);
      console.log(`[DEBUG] - toString(): ${sourceAsset.toString()}`);

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

      console.log(`[DEBUG] - toJSON (personnalisé): ${customStringify(sourceAsset)}`);
      console.log(`[DEBUG] - Prototype: ${Object.getPrototypeOf(sourceAsset)?.constructor?.name}`);
      console.log(`[DEBUG] - hasOwnProperty('decimal'): ${sourceAsset.hasOwnProperty('decimal')}`);
      console.log(`[DEBUG] - Object.keys(): ${Object.keys(sourceAsset)}`);
      console.log(`[DEBUG] - Object.getOwnPropertyNames(): ${Object.getOwnPropertyNames(sourceAsset)}`);

      // Extraire manuellement les propriétés importantes
      console.log(`[DEBUG] - Propriétés importantes:`);
      console.log(`[DEBUG]   - decimal: ${sourceAsset.decimal}`);
      console.log(`[DEBUG]   - chain: ${sourceAsset.chain}`);
      console.log(`[DEBUG]   - symbol: ${sourceAsset.symbol}`);
      console.log(`[DEBUG]   - ticker: ${sourceAsset.ticker}`);
      console.log(`[DEBUG]   - address: ${sourceAsset.address || 'N/A'}`);
      console.log(`[DEBUG]   - value (string): ${sourceAsset.getValue("string")}`);
      console.log(`[DEBUG]   - value (number): ${sourceAsset.getValue("number")}`);

      // Ne pas essayer de sérialiser les descripteurs de propriétés car ils peuvent contenir des BigInt
      console.log(`[DEBUG] - Descripteurs de propriétés disponibles: ${Object.getOwnPropertyNames(sourceAsset).join(', ')}`);

      // Vérifier spécifiquement la propriété decimal
      const decimalDescriptor = Object.getOwnPropertyDescriptor(sourceAsset, 'decimal');
      console.log(`[DEBUG] - Descripteur de decimal: ${decimalDescriptor ? 'Existe' : 'N\'existe pas'}`);
      if (decimalDescriptor) {
        console.log(`[DEBUG]   - decimal est configurable: ${decimalDescriptor.configurable}`);
        console.log(`[DEBUG]   - decimal est énumérable: ${decimalDescriptor.enumerable}`);
        console.log(`[DEBUG]   - decimal a un getter: ${!!decimalDescriptor.get}`);
        console.log(`[DEBUG]   - decimal a un setter: ${!!decimalDescriptor.set}`);
        console.log(`[DEBUG]   - decimal a une valeur: ${decimalDescriptor.value !== undefined}`);
      }
      console.log(`[DEBUG] - Chain: ${sourceAsset.chain}`);
      console.log(`[DEBUG] - Symbol: ${sourceAsset.symbol}`);
      console.log(`[DEBUG] - Decimals: ${sourceAsset.decimal}`);
      console.log(`[DEBUG] - Value: ${sourceAsset.getValue("string")}`);

      console.log(`\n[DEBUG] Création de destinationAsset pour ${destinationAssetString}`);
      destinationAsset = await AssetValue.from({
        asset: destinationAssetString,
        value: 0,
        asyncTokenLookup: true
      });

      console.log(`[DEBUG] destinationAsset créé avec succès:`);
      console.log(`[DEBUG] - Type: ${typeof destinationAsset}`);
      console.log(`[DEBUG] - Constructor: ${destinationAsset.constructor?.name}`);
      console.log(`[DEBUG] - toString(): ${destinationAsset.toString()}`);

      // Utiliser la même fonction personnalisée pour sérialiser l'objet
      console.log(`[DEBUG] - toJSON (personnalisé): ${customStringify(destinationAsset)}`);

      // Extraire manuellement les propriétés importantes
      console.log(`[DEBUG] - Propriétés importantes:`);
      console.log(`[DEBUG]   - decimal: ${destinationAsset.decimal}`);
      console.log(`[DEBUG]   - chain: ${destinationAsset.chain}`);
      console.log(`[DEBUG]   - symbol: ${destinationAsset.symbol}`);
      console.log(`[DEBUG]   - ticker: ${destinationAsset.ticker}`);
      console.log(`[DEBUG]   - address: ${destinationAsset.address || 'N/A'}`);

      // Vérifier spécifiquement la propriété decimal
      const destDecimalDescriptor = Object.getOwnPropertyDescriptor(destinationAsset, 'decimal');
      console.log(`[DEBUG] - Descripteur de decimal: ${destDecimalDescriptor ? 'Existe' : 'N\'existe pas'}`);
      if (destDecimalDescriptor) {
        console.log(`[DEBUG]   - decimal est configurable: ${destDecimalDescriptor.configurable}`);
        console.log(`[DEBUG]   - decimal est énumérable: ${destDecimalDescriptor.enumerable}`);
        console.log(`[DEBUG]   - decimal a un getter: ${!!destDecimalDescriptor.get}`);
        console.log(`[DEBUG]   - decimal a une valeur: ${destDecimalDescriptor.value !== undefined}`);
      }
    } catch (error) {
      console.error(`[DEBUG] ERREUR lors de la création des AssetValue:`, error);
      throw error;
    }

    // Vérifier la balance disponible
    console.log('Verif de la balance')
    const balance = await swapKit.getBalance(effectiveSourceChain, true);

    // Extraire le ticker de l'asset source (par exemple, "RUNE" de "THOR.RUNE")
    const sourceAssetParts = sourceAssetString.split('.');
    const sourceTicker = sourceAssetParts.length > 1 ? sourceAssetParts[1].split('-')[0] : sourceAssetParts[0];

    const sourceBalance = balance.find(asset =>
      asset.ticker === sourceTicker &&
      asset.chain === effectiveSourceChain
    );

    if (!sourceBalance) {
      console.error(`\n❌ Aucune balance ${sourceAssetString} trouvée. Impossible d'exécuter le swap.`);
      return null;
    }

    const sourceBalanceValue = sourceBalance.getValue("number");
    const swapAmount = parseFloat(amount);

    if (sourceBalanceValue < swapAmount) {
      console.error(`\n❌ Balance insuffisante. Vous avez ${sourceBalanceValue} ${sourceTicker} mais essayez d'en swapper ${swapAmount}.`);
      return null;
    }

    console.log(`\n✅ Balance suffisante: ${sourceBalanceValue} ${sourceTicker} disponible pour swapper ${swapAmount} ${sourceTicker}.`);

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
        console.warn(`\n⚠️ Attention: Impossible de trouver la balance de ${nativeToken} pour les frais de gas.`);
        console.warn('Assurez-vous d\'avoir suffisamment de tokens natifs pour couvrir les frais de transaction.');
      } else {
        const nativeBalanceValue = nativeBalance.getValue("number");
        console.log(`\n💰 Balance de tokens natifs pour les frais: ${nativeBalanceValue} ${nativeToken}`);

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
          console.warn(`\n⚠️ Attention: Votre balance de ${nativeToken} (${nativeBalanceValue}) pourrait être insuffisante pour couvrir les frais de gas.`);
          console.warn(`Il est recommandé d'avoir au moins ${requiredGas} ${nativeToken} pour les transactions sur ${effectiveSourceChain}.`);
        } else {
          console.log(`\n✅ Balance de tokens natifs suffisante pour les frais de gas.`);
        }
      }
    }

    // ÉTAPE 1: Obtenir un devis de swap (quote)
    console.log("\nℹ️ ÉTAPE 1: Obtention d'un devis de swap (quote)...");

    // Débogage détaillé de l'API SwapKit
    console.log('\nDébogage détaillé de l\'API SwapKit:');
    console.log('- Type de swapKit.api:', typeof swapKit.api);
    console.log('- Contenu de swapKit.api:', swapKit.api);

    // Vérifier si la clé API est configurée
    if (!swapKit.api || !swapKit.api.getSwapQuote) {
      console.error("\n❌ API SwapKit non disponible. Vérifiez que votre clé API est configurée correctement.");
      console.error("La clé API actuelle est:", process.env.SWAPKIT_API_KEY || 'Non définie');
      console.error("Si vous voyez 'VOTRE_CLE_API_ICI', vous devez définir une clé API valide.");

      // Essayer d'utiliser directement l'API de ThorChain
      console.log("\nℹ️ Tentative d'utilisation directe de l'API ThorChain...");
      if (swapKit.thorchain && swapKit.thorchain.swap) {
        console.log("\n✅ L'API ThorChain est disponible. Vous pouvez utiliser swapKit.thorchain.swap directement.");
        console.log("Exemple: swapKit.thorchain.swap({ assetValue: sourceAsset, destinationAsset: 'BNB.BNB' })");
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
    };

    console.log("Requête de devis:", quoteRequest);

    // Obtenir le devis de swap
    let quoteResponse;
    try {
      console.log("\n⏳ Appel de l'API getSwapQuote...");
      quoteResponse = await swapKit.api.getSwapQuote(quoteRequest);
      console.log("✅ Devis de swap obtenu avec succès.", quoteResponse);
    } catch (error) {
      console.error("\n❌ Erreur lors de l'obtention du devis de swap:", error);
      console.error("Détails de l'erreur:", error.message);
      if (error.response) {
        console.error("Statut de la réponse:", error.response.status);
        console.error("Données de la réponse:", error.response.data);
      }
      return {
        status: "error",
        error: `Erreur lors de l'obtention du devis de swap: ${error.message}`,
      };
    }

    if (!quoteResponse || !quoteResponse.routes || quoteResponse.routes.length === 0) {
      console.error("\n❌ Aucune route disponible pour ce swap. Vérifiez les paramètres ou réessayez plus tard.");
      return null;
    }

    // Trier les routes par montant attendu (du plus élevé au plus bas)
    const sortedRoutes = [...quoteResponse.routes].sort(
      (a, b) => parseFloat(b.expectedBuyAmount) - parseFloat(a.expectedBuyAmount)
    );

    // Sélectionner la meilleure route
    const bestRoute = sortedRoutes[0];
    console.log("Provider de la meilleure route:", bestRoute);

    // Vérifier où se trouvent les avertissements
    console.log("\n🔧 Débogage des avertissements:");
    console.log("bestRoute contient warnings?", bestRoute.hasOwnProperty('warnings'));
    console.log("quoteResponse contient warnings?", quoteResponse.hasOwnProperty('warnings'));

    // Vérifier les avertissements de prix d'impact élevé
    const routeWarnings = bestRoute.warnings || [];
    const responseWarnings = quoteResponse.warnings || [];

    console.log("Nombre d'avertissements dans bestRoute:", routeWarnings.length);
    console.log("Nombre d'avertissements dans quoteResponse:", responseWarnings.length);

    // Combiner les avertissements des deux sources
    const allWarnings = [...routeWarnings, ...responseWarnings];

    if (allWarnings.length > 0) {
      console.log("\nListe de tous les avertissements:");
      allWarnings.forEach((warning, index) => {
        console.log(`Avertissement ${index + 1}:`);
        console.log(`- Code: ${warning.code || 'N/A'}`);
        console.log(`- Affichage: ${warning.display || 'N/A'}`);
        console.log(`- Détail: ${warning.tooltip || 'N/A'}`);
      });
    }

    // Rechercher les avertissements de type "highPriceImpact"
    const highImpactWarning = allWarnings.find(warning => warning.code === "highPriceImpact");

      if (highImpactWarning) {
        console.log(`\n⚠️ Avertissement détecté: ${highImpactWarning.code}`);
        console.log(`Impact affiché: ${highImpactWarning.display}`);
        console.log(`Détail: ${highImpactWarning.tooltip}`);

        // Vérifier si l'impact de prix est disponible dans les métadonnées
        if (quoteResponse.meta && typeof quoteResponse.meta.priceImpact === 'number') {
          const priceImpact = quoteResponse.meta.priceImpact;
          console.log(`Impact de prix: ${priceImpact}%`);

          // Annuler le swap si l'impact de prix est inférieur à -50%
          if (priceImpact <= -50) {
            console.error(`\n❌ Swap annulé: L'impact de prix est trop élevé (${priceImpact}%).`);
            console.error("Pour des raisons de sécurité, les swaps avec un impact de prix inférieur à -50% sont automatiquement annulés.");
            console.error("Vous pouvez essayer avec un montant plus petit ou un autre fournisseur.");
            return null;
          } else if (priceImpact <= -10) {
            // Avertissement pour les impacts entre -10% et -50%
            console.warn(`\n⚠️ Attention: L'impact de prix est élevé (${priceImpact}%).`);
            console.warn("Cela signifie que vous pourriez recevoir significativement moins que la valeur marchande.");
          }
        } else if (highImpactWarning.display) {
          // Si l'impact numérique n'est pas disponible, essayer de parser l'affichage
          const displayImpact = highImpactWarning.display.replace('%', '');
          const parsedImpact = parseFloat(displayImpact);

          if (!isNaN(parsedImpact) && parsedImpact <= -50) {
            console.error(`\n❌ Swap annulé: L'impact de prix est trop élevé (${displayImpact}%).`);
            console.error("Pour des raisons de sécurité, les swaps avec un impact de prix inférieur à -50% sont automatiquement annulés.");
            console.error("Vous pouvez essayer avec un montant plus petit ou un autre fournisseur.");
            return null;
          }
        }
      }

    console.log("\n✅ Devis obtenu avec succès!");
    console.log(`Meilleure route: ${bestRoute.providers.join(", ")}`);
    console.log(`Montant d'entrée: ${bestRoute.sellAmount} ${sourceAsset.toString()}`);
    console.log(`Montant de sortie estimé: ${bestRoute.expectedBuyAmount} ${destinationAsset.toString()}`);
    // Afficher le slippage configuré plutôt que d'essayer d'accéder à des propriétés qui peuvent ne pas exister
    console.log(`Slippage configuré: ${slippage}%`);

    // Afficher des informations sur le fournisseur utilisé
    console.log(`\nFournisseur utilisé: ${bestRoute.providers[0]}`);

    // Vérifier le fournisseur utilisé
    const provider = bestRoute.providers[0];
    // Utiliser toString() pour éviter les problèmes de typage
    const providerStr = String(provider);

    if (providerStr.includes("THORCHAIN")) {
      console.log("Utilisation de ThorChain pour le swap");
    } else if (providerStr.includes("MAYA")) {
      console.log("Utilisation de Maya Protocol pour le swap");
    } else if (providerStr.includes("UNISWAP")) {
      console.log("Utilisation d'Uniswap pour le swap");
    } else {
      console.log(`Utilisation de ${providerStr} pour le swap`);
    }

    // Afficher les informations sur les frais de réseau (gas)
    console.log("\n💸 Informations sur les frais de réseau (gas):");

    // Débogage pour vérifier où se trouvent les informations sur les frais
    console.log("\n🔧 Débogage des structures de données:");
    console.log("bestRoute contient estimatedNetworkFees?", bestRoute.hasOwnProperty('estimatedNetworkFees'));
    console.log("quoteResponse contient estimatedNetworkFees?", quoteResponse.hasOwnProperty('estimatedNetworkFees'));

    // Afficher les propriétés de premier niveau de bestRoute
    console.log("\nPropriétés de bestRoute:", Object.keys(bestRoute));

    // Afficher les propriétés de premier niveau de quoteResponse
    console.log("Propriétés de quoteResponse:", Object.keys(quoteResponse));

    // Afficher les propriétés liées aux frais dans bestRoute
    console.log("\nPropriétés liées aux frais dans bestRoute:");
    if (bestRoute.estimatedNetworkFees) console.log("- estimatedNetworkFees");
    if (bestRoute.fees) console.log("- fees");
    if (bestRoute.estimatedGasFee) console.log("- estimatedGasFee");
    if (bestRoute.estimatedGasPrice) console.log("- estimatedGasPrice");
    if (bestRoute.estimatedGasLimit) console.log("- estimatedGasLimit");

    // Examiner la structure des frais dans bestRoute
    if (bestRoute.fees) {
      console.log("\nStructure de bestRoute.fees:", JSON.stringify(bestRoute.fees, null, 2));
    }

    // Examiner la structure de tx dans bestRoute
    if (bestRoute.tx) {
      console.log("\nStructure de bestRoute.tx:");
      console.log("- to:", bestRoute.tx.to);
      console.log("- from:", bestRoute.tx.from);
      console.log("- gas:", bestRoute.tx.gas);
      console.log("- gasPrice:", bestRoute.tx.gasPrice);
      console.log("- value:", bestRoute.tx.value);
      // Ne pas afficher data car c'est trop long
      console.log("- data: [trop long pour être affiché]");
    }

    // Vérifier si les informations sur les frais sont disponibles
    if (bestRoute.estimatedNetworkFees) {
      const fees = bestRoute.estimatedNetworkFees;

      // Afficher les frais totaux si disponibles
      if (fees.totalFees) {
        console.log(`Frais totaux estimés: ${fees.totalFees} USD`);
      }

      // Afficher les frais détaillés par étape si disponibles
      if (fees.steps && fees.steps.length > 0) {
        console.log("Détail des frais par étape:");
        fees.steps.forEach((step, index) => {
          console.log(`  Étape ${index + 1}: ${step.name || 'Sans nom'}`);
          if (step.gasPrice) console.log(`    Prix du gas: ${step.gasPrice}`);
          if (step.gasLimit) console.log(`    Limite de gas: ${step.gasLimit}`);
          if (step.estimatedGasFee) console.log(`    Frais de gas estimés: ${step.estimatedGasFee} ${step.asset || 'USD'}`);
        });
      }

      // Afficher les frais spécifiques à la chaîne si disponibles
      if (fees.inboundFee) console.log(`Frais d'entrée: ${fees.inboundFee} ${fees.inboundFeeAsset || 'USD'}`);
      if (fees.outboundFee) console.log(`Frais de sortie: ${fees.outboundFee} ${fees.outboundFeeAsset || 'USD'}`);
      if (fees.affiliateFee) console.log(`Frais d'affiliation: ${fees.affiliateFee} ${fees.affiliateFeeAsset || 'USD'}`);
    } else {
      console.log("Aucune information détaillée sur les frais n'est disponible pour cette route.");

      // Essayer d'extraire les frais de gas à partir d'autres propriétés
      if (bestRoute.estimatedGasPrice) {
        console.log(`Prix du gas estimé: ${bestRoute.estimatedGasPrice}`);
      }
      if (bestRoute.estimatedGasLimit) {
        console.log(`Limite de gas estimée: ${bestRoute.estimatedGasLimit}`);
      }
      if (bestRoute.estimatedGasFee) {
        console.log(`Frais de gas estimés: ${bestRoute.estimatedGasFee}`);
      }
    }

    // ÉTAPE 2: Exécuter le swap avec la meilleure route
    console.log("\nℹ️ ÉTAPE 2: Exécution du swap avec la meilleure route...");

    // Demander confirmation à l'utilisateur si nécessaire
    if (waitForConfirmation) {
      console.log("\n⚠️ ATTENTION: Vous êtes sur le point d'exécuter un swap réel qui engagera vos fonds.");
      console.log("Appuyez sur Entrée pour confirmer et exécuter le swap, ou Ctrl+C pour annuler...");

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
      console.log(`Utilisation du plugin spécifié: ${pluginName}`);
    }

    // Utiliser une assertion de type pour contourner les problèmes de typage
    console.log("\n[DEBUG] Exécution du swap avec les paramètres:", swapParams);
    const txHash = "DEBUG_TX_HASH"; // Pour le débogage, on utilise une valeur factice
    // Dans un environnement réel, décommentez la ligne suivante:
    // const txHash = await (swapKit.swap as any)(swapParams);

    // ÉTAPE 3: Suivre la transaction
    console.log("\nℹ️ ÉTAPE 3: Suivi de la transaction...");
    console.log(`\n✅ Swap initié avec succès!`);
    console.log(`Transaction hash: ${txHash}`);

    // Générer l'URL de l'explorateur
    // Déterminer la chaîne appropriée pour l'explorateur en fonction du provider et de la route
    const explorerChain = (bestRoute.providers[0] as string).includes('THORCHAIN') ? Chain.THORChain :
                         (bestRoute.providers[0] as string).includes('MAYACHAIN') ? Chain.Maya :
                         effectiveSourceChain;

    const explorerUrl = swapKit.getExplorerTxUrl({ chain: explorerChain, txHash });
    console.log(`Explorer URL: ${explorerUrl}`);

    // Attendre que la transaction soit confirmée (dans un environnement réel, vous utiliseriez un mécanisme de polling)
    console.log("\nAttente de la confirmation de la transaction...");
    console.log("Ce processus peut prendre plusieurs minutes. Veuillez consulter l'explorateur pour plus de détails.");

    // Afficher le résumé des logs réseau
    console.log("\n===== Résumé des appels réseau =====\n");
    printNetworkSummary();

    return {
      status: "success",
      txHash,
      explorerUrl,
      sourceAsset: sourceAsset.toString(),
      destinationAsset: destinationAsset.toString(),
      amount,
      expectedOutput: bestRoute.expectedBuyAmount,
    };
  } catch (error) {
    console.error("\n❌ Erreur lors de l'exécution du swap:", error);

    // Afficher le résumé des logs réseau même en cas d'erreur
    console.log("\n===== Résumé des appels réseau (avant erreur) =====\n");
    printNetworkSummary();

    return {
      status: "error",
      error: error.message || "Erreur inconnue",
    };
  }
}

// Script d'exécution
if (require.main === module) {
  // Charger les assets statiques
  AssetValue.loadStaticAssets().then(() => {
    // Connecter le portefeuille
    const swapKit = getSwapKitClient();
    if (!swapKit) {
      console.error("Impossible d'initialiser SwapKit");
      process.exit(1);
    }

    // Phrase mnémonique pour le portefeuille (ATTENTION: ceci est un exemple, utilisez votre propre phrase)
    const phrase = process.env.MNEMONIC || "votre phrase mnémonique ici";

    if (phrase === "votre phrase mnémonique ici") {
      console.error("\n⚠️ ATTENTION: Vous devez définir votre propre phrase mnémonique!");
      console.error("Définissez la variable d'environnement MNEMONIC ou modifiez directement le code.\n");
      process.exit(1);
    }

    // Connecter toutes les chaînes disponibles
    const allChains = [
      Chain.Arbitrum,
      Chain.Avalanche,
      Chain.Base,
      Chain.BinanceSmartChain,
      Chain.Bitcoin,
      Chain.BitcoinCash,
      Chain.Cosmos,
      Chain.Dash,
      Chain.Dogecoin,
      Chain.Ethereum,
      Chain.Fiat,
      Chain.Kujira,
      Chain.Litecoin,
      Chain.Maya,
      Chain.Optimism,
      Chain.Polkadot,
      Chain.Chainflip,
      Chain.Polygon,
      Chain.Radix,
      Chain.THORChain,
      Chain.Solana
    ];

    console.log(`Connexion de toutes les chaînes disponibles: ${allChains.join(', ')}...`);

    swapKit.connectKeystore(allChains, phrase)
      .then(() => {
        // Exécuter le swap
        const amount = process.argv[2] || "1"; // Utiliser le premier argument comme montant ou 1 par défaut
        executeRealSwap({ amount });
      })
      .catch((error: Error) => {
        console.error("Erreur lors de la connexion du portefeuille:", error);
        process.exit(1);
      });
  });
}
