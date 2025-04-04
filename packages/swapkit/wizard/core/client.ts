import { Chain } from "@swapkit/core";
import { createSwapKit } from "@swapkit/sdk";

// Importer les plugins disponibles
import { ThorchainPlugin, MayachainPlugin } from "@swapkit/plugin-thorchain";
import { EVMPlugin } from "@swapkit/plugin-evm";

// Importer les wallets
import { keystoreWallet } from "@swapkit/wallet-keystore";

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
  apis: {
    ethplorer: { apiKey: 'freekey' },
    covalent: { apiKey: '' },
    blockchair: { apiKey: '' }
  },
  // Configuration de connexion
  config: {
    walletConnectProjectId: '',
    stagenet: false,
    swapkitApiKey: process.env.SWAPKIT_API_KEY,
  },
  // URLs RPC personnalisées (optionnel)
  rpcUrls: {
    // Exemple: 'ETH': 'https://mainnet.infura.io/v3/your-api-key'
  },
  // Tous les plugins disponibles
  plugins: {
    ...ThorchainPlugin,
    ...MayachainPlugin,
    ...EVMPlugin
  },
  // Wallet Keystore
  wallets: {
    ...keystoreWallet
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
      console.log(`Utilisation d'une instance SwapKit existante`);
      return clientCache.get(key)!;
    }

    // Créer une nouvelle instance de SwapKit
    console.log(`Création d'une nouvelle instance SwapKit`);
    console.log(`Plugins configurés: THORChain, Maya, EVM`);
    console.log(`Wallets configurés: Keystore`);

    // Créer l'instance avec les paramètres correctement structurés
    const client = createSwapKit(swapKitParams as any);

    // Mettre en cache le client
    clientCache.set(key, client);

    // Afficher les chaînes à connecter
    if (chainsToConnect.length > 0) {
      console.log(`Chaînes à connecter: ${chainsToConnect.join(', ')}`);
      console.log(`Utilisez client.connectKeystore(chainsToConnect, phrase) pour connecter les portefeuilles`);
    }

    return client;
  } catch (error) {
    console.error("Erreur lors de l'initialisation de SwapKit:", error);
    throw error;
  }
};
