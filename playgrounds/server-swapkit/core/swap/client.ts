import { Chain } from "@swapkit/helpers";
import { SwapKit } from "@swapkit/core";
import { SwapKitApi } from "@swapkit/helpers/api";

import { ChainflipPlugin } from "@swapkit/plugins/chainflip";
import { EVMPlugin } from "@swapkit/plugins/evm";
import { NearPlugin } from "@swapkit/plugins/near";
import { RadixPlugin } from "@swapkit/plugins/radix";
import { SolanaPlugin } from "@swapkit/plugins/solana";
// Importer les plugins disponibles
import {
  MayachainPlugin,
  ThorchainPlugin,
} from "@swapkit/plugins/thorchain";

// Importer les wallets
import { keystoreWallet } from "@swapkit/wallet-keystore";

// Importer notre factory d'API
import { ApiType, createEvmApiFactory } from "./apiFactory";

// Import dotenv configuration
import * as dotenv from "dotenv";
// Importer notre API wrappée avec monitoring réseau
import { SwapKitApiWithMonitoring } from "./apiWrapper";
import { networkMonitor } from "./networkMonitor";

// Load environment variables from .env file
dotenv.config();
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
      Chain.Ethereum, // Ethereum Mainnet (ChainId: 1)
      Chain.BinanceSmartChain, // Binance Smart Chain (ChainId: 56)
      Chain.Polygon, // Polygon/Matic (ChainId: 137)
      Chain.Arbitrum, // Arbitrum One (ChainId: 42161)
      Chain.Avalanche, // Avalanche C-Chain (ChainId: 43114)
      Chain.Optimism, // Optimism (ChainId: 10)
      Chain.Base, // Base (ChainId: 8453)
    ];
    return apiFactory.createApisForChains(evmChains);
  })(),
  // Configuration de connexion
  config: {
    apiKeys: {
      swapKit: process.env.SWAPKIT_API_KEY,
      blockchair: process.env.BLOCKCHAIR_API_KEY || "",
      walletConnectProjectId: "",
    },
    stagenet: false,
    swapkitApiKey: process.env.SWAPKIT_API_KEY,
  },
  // URLs RPC personnalisées (optionnel)
  // rpcUrls: {
  //   // Exemple: 'ETH': 'https://mainnet.infura.io/v3/your-api-key'
  //   // 'ETH': 'https://mainnet.infura.io/v3/' + process.env.INFURA_API_KEY
  // },
  // Tous les plugins disponibles
  plugins: {
    ...ThorchainPlugin,
    ...MayachainPlugin,
    ...EVMPlugin,
    ...ChainflipPlugin,
    ...NearPlugin,
    ...SolanaPlugin,
    // ...KadoPlugin,
    ...RadixPlugin,
  },
  // Wallet Keystore
  wallets: {
    ...keystoreWallet,
  },
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
export const getSwapKitClient = (chainsToConnect: Chain[] = []): SwapKitClient => {
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
      logFilePath: "./network_logs.json",
      includeRequestPayload: true,
      includeResponseData: false,
    });

    // Debug des paramètres avant création
    console.log("🔍 [Client Debug] Paramètres SwapKit avant création:");
    console.log("- Plugins configurés:", Object.keys(swapKitParams.plugins || {}));
    console.log("- Config:", !!swapKitParams.config);
    console.log("- APIs:", !!swapKitParams.apis);
    console.log("- Wallets:", Object.keys(swapKitParams.wallets || {}));

    // Debug détaillé des plugins importés
    console.log("🔍 [Client Debug] Détails des plugins importés:");
    console.log("- ThorchainPlugin:", typeof ThorchainPlugin, Object.keys(ThorchainPlugin));
    console.log("- MayachainPlugin:", typeof MayachainPlugin, Object.keys(MayachainPlugin));
    console.log("- EVMPlugin:", typeof EVMPlugin, Object.keys(EVMPlugin));
    console.log("- ChainflipPlugin:", typeof ChainflipPlugin, Object.keys(ChainflipPlugin));
    console.log("- RadixPlugin:", typeof RadixPlugin, Object.keys(RadixPlugin));
    console.log("- NearPlugin:", typeof NearPlugin, Object.keys(NearPlugin));
    console.log("- SolanaPlugin:", typeof SolanaPlugin, Object.keys(SolanaPlugin));

    // Vérifier le contenu du plugin EVM spécifiquement
    if (EVMPlugin && typeof EVMPlugin === 'object') {
      console.log("🔍 [Client Debug] Contenu du plugin EVM:");
      Object.keys(EVMPlugin).forEach(key => {
        const plugin = EVMPlugin[key];
        console.log(`  - ${key}:`, typeof plugin, plugin?.supportedSwapkitProviders);
      });
    }

    // Créer l'instance avec les paramètres correctement structurés
    // Créer le client SwapKit avec une meilleure gestion des erreurs
    let client: any;
    try {
      console.log("🔍 [Client Debug] Création du client SwapKit avec SwapKit() directement...");
      client = SwapKit(swapKitParams as any);
      console.log("🔍 [Client Debug] Client créé avec succès");

      // Vérifier que le client a été créé correctement
      if (!client) {
        throw new Error("Le client SwapKit n'a pas été créé correctement");
      }

      // Debug de l'état du client après création
      console.log("🔍 [Client Debug] État du client après création:");
      console.log("- Type du client:", typeof client);
      console.log("- Propriétés du client:", Object.keys(client));
      console.log("- client.plugins existe:", !!client.plugins);
      console.log("- Type de client.plugins:", typeof client.plugins);

      if (client.plugins) {
        console.log("- Plugins dans le client:", Object.keys(client.plugins));
      } else {
        console.log("❌ PROBLÈME: client.plugins n'existe pas!");
        // Vérifier d'autres propriétés possibles
        if (client.plugin) console.log("- client.plugin existe:", Object.keys(client.plugin));
        if (client._plugins) console.log("- client._plugins existe:", Object.keys(client._plugins));
      }

      // Ajouter manuellement l'API SwapKit si elle n'est pas présente
      if (!client.api) {
        console.log("🔧 Ajout manuel de l'API SwapKit au client...");
        client.api = SwapKitApi;
        console.log("✅ API SwapKit ajoutée avec succès");
        console.log("Méthodes API disponibles:", Object.keys(client.api));
      }

      // Vérifier que l'API est maintenant disponible
      if (!client.api || !client.api.getSwapQuote) {
        console.warn("⚠️ Avertissement: L'API SwapKit n'est toujours pas complètement disponible.");
        console.warn("API disponible:", client.api ? Object.keys(client.api) : "null");
        console.warn("Clé API configurée:", process.env.SWAPKIT_API_KEY ? "Oui" : "Non");
      } else {
        console.log("✅ API SwapKit complètement configurée");
        console.log("getSwapQuote disponible:", typeof client.api.getSwapQuote);
      }

      // Debug des plugins disponibles - CORRECTION: les plugins sont directement sur le client
      console.log("🔍 [Plugin Debug] Plugins disponibles dans le client:");
      const pluginNames = ['evm', 'thorchain', 'mayachain', 'chainflip', 'radix', 'near', 'solana'];
      const availablePlugins = pluginNames.filter(name => client[name]);

      console.log("- Plugins trouvés:", availablePlugins);

      availablePlugins.forEach(pluginName => {
        const plugin = client[pluginName];
        console.log(`- Plugin ${pluginName}:`, {
          hasSwapMethod: typeof plugin?.swap === 'function',
          supportedProviders: plugin?.supportedSwapkitProviders || 'Non défini',
          methods: Object.keys(plugin || {})
        });
      });

      if (availablePlugins.length === 0) {
        console.log("❌ PROBLÈME: Aucun plugin trouvé dans le client!");
        console.log("- Toutes les propriétés du client:", Object.keys(client));

        // Vérifier si les plugins sont configurés dans les paramètres
        console.log("- Plugins dans swapKitParams:", Object.keys(swapKitParams.plugins || {}));
      }

      // Vérifier spécifiquement le plugin EVM et ONEINCH
      console.log("🔍 [Plugin Debug] Vérification spécifique pour ONEINCH:");
      const evmPlugin = client.evm; // Correction: directement sur client
      if (evmPlugin) {
        console.log("- Plugin EVM trouvé:", !!evmPlugin);
        console.log("- Providers supportés par EVM:", evmPlugin.supportedSwapkitProviders);
        console.log("- ONEINCH supporté:", evmPlugin.supportedSwapkitProviders?.includes('ONEINCH'));
      } else {
        console.log("❌ Plugin EVM non trouvé sur client.evm!");
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
