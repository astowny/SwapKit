import { Chain } from "../../../../swapkit/core/src/index";
import { createSwapKit } from "../../../../swapkit/sdk/src/index";

// Importer les plugins disponibles
import { ThorchainPlugin, MayachainPlugin } from "../../../../plugins/thorchain/src/index";
import { EVMPlugin } from "../../../../plugins/evm/src/index";
import { ChainflipPlugin } from "../../../../plugins/chainflip/src/index";
import { KadoPlugin } from "../../../../plugins/kado/src/index";
import { RadixPlugin } from "../../../../plugins/radix/src/index";

// Importer les wallets
import { keystoreWallet } from "../../../../wallets/keystore/src/index";
import {wallets} from "../../../../swapkit/wallets/src/index"; // necessaire de mettre tous les wallets si on veut supporter toutes les chaines en asset from pour l'execution des swaps

// Importer notre factory d'API
import { createEvmApiFactory, ApiType } from "./apiFactory";

// Importer notre API wrappée avec monitoring réseau
import { SwapKitApiWithMonitoring } from "./apiWrapper";
import { networkMonitor } from "./networkMonitor";

// Utiliser any pour éviter les problèmes de type
export type SwapKitClient = any;

// Cache pour les instances de SwapKit
const clientCache = new Map<string, SwapKitClient>();

/**
 * Paramètres de base pour SwapKit conformément au type SwapKitParams<P, W>
 *
 * Structure attendue par SwapKit:
 * type SwapKitParams<P, W> = {
 *   apis?: ChainApis;           // Configuration des APIs pour différentes chaînes
 *   config?: ConnectConfig;     // Configuration de connexion
 *   plugins?: P;               // Plugins à utiliser
 *   rpcUrls?: { [key in CryptoChain]?: string }; // URLs RPC personnalisées
 *   wallets?: W;               // Wallets à utiliser
 * };
 */
const swapKitParams = {
  // Configuration des APIs pour différentes chaînes
  apiKey: {
    ethplorerApiKey: `'${process.env.ETHPLORER_API_KEY || "freekey"}'`,
    blockchairApiKey: `'${process.env.BLOCKCHAIR_API_KEY || ""}'`,
    covalentApiKey: `'${process.env.COVALENT_API_KEY || ""}'`,
    alchemyApiKey: `'${process.env.ALCHEMY_API_KEY || ""}'`,
    // walletConnectProjectId: "''",
  },
  // Utiliser notre factory pour créer les APIs
  apis: (() => {
    // Créer une instance de la factory
    const apiFactory = createEvmApiFactory({
      apiKeys: {
        alchemy: process.env.ALCHEMY_API_KEY || "",
        covalent: process.env.COVALENT_API_KEY || "",
        ethplorer: process.env.ETHPLORER_API_KEY || "freekey",
      },
      defaultApiType: ApiType.ALCHEMY, // Type d'API par défaut
    });

    // Créer les APIs pour toutes les chaînes EVM
    const evmChains = [
      // Chaînes EVM principales
      Chain.Ethereum,         // Ethereum Mainnet (ChainId: 1)
      Chain.BinanceSmartChain, // Binance Smart Chain (ChainId: 56)
      Chain.Polygon,         // Polygon/Matic (ChainId: 137)
      Chain.Arbitrum,        // Arbitrum One (ChainId: 42161)
      Chain.Avalanche,       // Avalanche C-Chain (ChainId: 43114)
      Chain.Optimism,        // Optimism (ChainId: 10)
      Chain.Base,            // Base (ChainId: 8453)
    ];
    return apiFactory.createApisForChains(evmChains);
  })(),
  // Configuration de connexion
  config: {
    walletConnectProjectId: '',
    stagenet: false,
    swapkitApiKey: process.env.SWAPKIT_API_KEY,
    thorswapApiKey: process.env.THORSWAP_API_KEY, 
    covalentApiKey: process.env.COVALENT_API_KEY, // non required
    ethplorerApiKey: process.env.ETHPLORER_API_KEY 
  },
  // URLs RPC personnalisées (optionnel)
  rpcUrls: {
    // Exemple: 'ETH': 'https://mainnet.infura.io/v3/your-api-key'
    // 'ETH': 'https://mainnet.infura.io/v3/' + process.env.INFURA_API_KEY
  },
  // Tous les plugins disponibles
  plugins: {
    ...ThorchainPlugin,
    ...MayachainPlugin,
    ...EVMPlugin,
    ...ChainflipPlugin,
    ...KadoPlugin,
    ...RadixPlugin
  },
  // Wallet Keystore
  wallets: {
    ...keystoreWallet,
    ...wallets
  }
};

/**
 * Obtient une instance de SwapKit client avec tous les plugins disponibles
 * et le wallet Keystore préconfigurés.
 *
 * Plugins inclus :
 * - THORChain : Pour les swaps cross-chain via THORChain
 * - Maya : Pour les swaps cross-chain via Maya
 * - EVM : Pour les interactions avec les chaînes compatibles EVM (Ethereum, BSC, etc.)
 *
 * Cette configuration permet de :
 * - Effectuer des swaps via THORChain, Maya et les DEX sur les chaînes EVM
 * - Connecter des portefeuilles via la méthode connectKeystore
 * - Gérer les transactions sur toutes les chaînes supportées
 *
 * @param chainsToConnect Chaînes à connecter (optionnel)
 * @returns Instance de SwapKit client
 */
export const getSwapKitClient = (
  chainsToConnect: Chain[] = []
): SwapKitClient => {
  try {
    // Créer une clé unique pour le cache
    const key = JSON.stringify(swapKitParams);

    // Vérifier si le client est déjà en cache
    if (clientCache.has(key)) {
      console.log("✅ Réutilisation d'une instance existante du client SwapKit");

      // Suppression du log pour réduire le bruit
      return clientCache.get(key)!;
    }
    console.log("🆕 Création d'une nouvelle instance du client SwapKit");

    // Créer une nouvelle instance de SwapKit
    // Logs réduits pour éviter d'afficher trop d'informations

    // Configurer le monitoring réseau avec logs réduits
    networkMonitor.configure({
      enabled: true,
      logToConsole: false, // Désactivé pour réduire les logs
      logToFile: true,
      logFilePath: './network_logs.json',
      includeRequestPayload: true,
      includeResponseData: false,
    });

    // Créer l'instance avec les paramètres correctement structurés
    // Créer le client SwapKit avec une meilleure gestion des erreurs
    let client: any;
    try {
      client = createSwapKit(swapKitParams as any);

      // Vérifier que le client a été créé correctement
      if (!client) {
        throw new Error("Le client SwapKit n'a pas été créé correctement");
      }

      // Vérifier que l'API est disponible
      if (!client.api || !client.api.getSwapQuote) {
        console.warn("Avertissement: L'API SwapKit n'est pas complètement disponible.");
        console.warn("API disponible:", client.api ? Object.keys(client.api) : "null");
        console.warn("Clé API configurée:", process.env.SWAPKIT_API_KEY ? "Oui" : "Non");
      }
    } catch (initError) {
      console.error("Erreur lors de l'initialisation du client SwapKit:", initError);
      throw initError;
    }

    // Remplacer les méthodes d'API standard par nos méthodes wrappées avec monitoring
    if (client.api) {
      client.api.getSwapQuote = SwapKitApiWithMonitoring.getSwapQuote;
      client.api.getPrice = SwapKitApiWithMonitoring.getPrice;
      client.api.getGasRate = SwapKitApiWithMonitoring.getGasRate;
      client.api.getTrackerDetails = SwapKitApiWithMonitoring.getTrackerDetails;

      // Suppression du log pour réduire le bruit
    }

    // Mettre en cache le client
    clientCache.set(key, client);

    // Ne pas afficher les chaînes à connecter pour réduire les logs

    return client;
  } catch (error) {
    console.error("Erreur lors de l'initialisation de SwapKit:", error);
    throw error;
  }
};
