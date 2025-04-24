/**
 * Client SwapKit utilisant directement la fonction SwapKit du dossier swapkit/core
 * 
 * Ce fichier crée une version du client SwapKit qui utilise directement la fonction SwapKit
 * du dossier swapkit/core au lieu de passer par createSwapKit du dossier swapkit/sdk.
 */

import { Chain } from "../../../../swapkit/core/src/index";
import { SwapKit } from "../../../../swapkit/core/src/client";

// Importer les plugins disponibles
import { ThorchainPlugin, MayachainPlugin } from "../../../../plugins/thorchain/src/index";
import { EVMPlugin } from "../../../../plugins/evm/src/index";
import { ChainflipPlugin } from "../../../../plugins/chainflip/src/index";
import { KadoPlugin } from "../../../../plugins/kado/src/index";
import { RadixPlugin } from "../../../../plugins/radix/src/index";

// Importer les wallets
import { wallets } from "../../../../swapkit/wallets"; // necessaire de mettre tous les wallets si on veut supporter toutes les chaines en asset from

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
 */
const swapKitParams = {
  // Configuration des APIs pour différentes chaînes
  apiKey: {
    ethplorerApiKey: `'${process.env.ETHPLORER_API_KEY || "freekey"}'`,
    blockchairApiKey: `'${process.env.BLOCKCHAIR_API_KEY || ""}'`,
    covalentApiKey: `'${process.env.COVALENT_API_KEY || ""}'`,
    alchemyApiKey: `'${process.env.ALCHEMY_API_KEY || ""}'`,
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
    covalentApiKey: process.env.COVALENT_API_KEY,
    ethplorerApiKey: process.env.ETHPLORER_API_KEY
  },
  // URLs RPC personnalisées (optionnel)
  rpcUrls: {
    // Exemple: 'ETH': 'https://mainnet.infura.io/v3/your-api-key'
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
  // Wallets
  wallets: {
    ...wallets
  }
};

/**
 * Obtient une instance de SwapKit client en utilisant directement la fonction SwapKit
 * du dossier swapkit/core.
 * 
 * Cette approche évite les problèmes liés à la fonction filterSupportedChains
 * en utilisant directement l'implémentation de base.
 * 
 * @returns Instance de SwapKit client
 */
export const getDirectSwapKitClient = (): SwapKitClient => {
  try {
    // Créer une clé unique pour le cache
    const key = JSON.stringify(swapKitParams);

    // Vérifier si le client est déjà en cache
    if (clientCache.has(key)) {
      return clientCache.get(key)!;
    }

    // Configurer le monitoring réseau
    networkMonitor.configure({
      enabled: true,
      logToConsole: false,
      logToFile: true,
      logFilePath: './network_logs.json',
      includeRequestPayload: true,
      includeResponseData: false,
    });

    console.log("Création d'une instance SwapKit directement depuis swapkit/core...");
    
    // Créer l'instance avec la fonction SwapKit du dossier swapkit/core
    let client: any;
    try {
      client = SwapKit(swapKitParams as any);

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
    }

    // Mettre en cache le client
    clientCache.set(key, client);

    console.log("Instance SwapKit créée avec succès");
    console.log("Méthodes disponibles:", Object.keys(client));
    
    // Vérifier si la méthode connectKeystore existe
    if (typeof client.connectKeystore === 'function') {
      console.log("La méthode connectKeystore est disponible");
    } else {
      console.warn("La méthode connectKeystore n'est pas disponible");
    }

    return client;
  } catch (error) {
    console.error("Erreur lors de l'initialisation de SwapKit:", error);
    throw error;
  }
};

/**
 * Fonction pour connecter un wallet avec une phrase mnémonique
 * 
 * Cette fonction utilise directement la méthode connectKeystore du client SwapKit
 * et gère correctement les cas où l'argument chains n'est pas un tableau.
 * 
 * @param phrase Phrase mnémonique
 * @param chains Chaînes à connecter (peut être un tableau ou une seule chaîne)
 * @returns Résultat de la connexion
 */
export const connectKeystoreDirect = async (
  phrase: string,
  chains: Chain[] | Chain
): Promise<any> => {
  try {
    console.log("[DIRECT] Connexion du wallet avec la phrase mnémonique...");
    
    // Obtenir l'instance de SwapKit
    const swapKit = getDirectSwapKitClient();
    
    // Vérifier si la méthode connectKeystore existe
    if (typeof swapKit.connectKeystore !== 'function') {
      throw new Error("La méthode connectKeystore n'existe pas dans l'instance de SwapKit");
    }
    
    // S'assurer que chains est un tableau
    const chainsArray = Array.isArray(chains) ? chains : [chains];
    
    console.log("[DIRECT] Chaînes à connecter:", chainsArray);
    
    // Appeler la méthode connectKeystore
    const result = await swapKit.connectKeystore({
      phrase,
      chains: chainsArray
    });
    
    console.log("[DIRECT] Wallet connecté avec succès");
    return result;
  } catch (error) {
    console.error("[DIRECT] Erreur lors de la connexion du wallet:", error);
    throw error;
  }
};
