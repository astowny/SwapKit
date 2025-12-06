import { Chain, ChainToChainId } from "@swapkit/helpers";
import { getEvmApi } from "@swapkit/toolboxes/evm";
import type { EVMChain } from "@swapkit/helpers";

// Types d'API supportés
export enum ApiType {
  ALCHEMY = "alchemy",
  COVALENT = "covalent",
  ETHPLORER = "ethplorer",
}

// Configuration pour la factory
export interface ApiFactoryConfig {
  apiType?: ApiType;
  apiKeys: {
    alchemy?: string;
    covalent?: string;
    ethplorer?: string;
  };
  defaultApiType?: ApiType;
}

/**
 * Factory pour créer des instances d'API pour différentes chaînes EVM
 * Note: Cette implémentation utilise getEvmApi de @swapkit/toolboxes/evm
 * car alchemyApi, covalentApi et ethplorerApi ne sont pas disponibles dans le package.
 */
export class EvmApiFactory {
  private apiKeys: {
    alchemy: string;
    covalent: string;
    ethplorer: string;
  };
  private defaultApiType: ApiType;

  constructor(config: ApiFactoryConfig) {
    this.apiKeys = {
      alchemy: config.apiKeys.alchemy || process.env.ALCHEMY_API_KEY || "",
      covalent: config.apiKeys.covalent || process.env.COVALENT_API_KEY || "",
      ethplorer: config.apiKeys.ethplorer || process.env.ETHPLORER_API_KEY || "",
    };
    this.defaultApiType = config.defaultApiType || ApiType.ALCHEMY;
  }

  /**
   * Crée une instance d'API pour une chaîne spécifique
   * @param chain La chaîne pour laquelle créer l'API
   * @param apiType Le type d'API à utiliser (optionnel, utilise la valeur par défaut si non spécifié)
   * @returns L'instance d'API
   */
  createApi(chain: Chain, apiType: ApiType = ApiType.ALCHEMY) {
    // Utiliser getEvmApi qui est disponible dans @swapkit/toolboxes/evm
    // Note: Les APIs spécifiques (alchemy, covalent, ethplorer) ne sont pas disponibles
    // dans le package actuel, donc on utilise l'API EVM générique
    return getEvmApi(chain as EVMChain);
  }

  /**
   * Crée des instances d'API pour toutes les chaînes EVM spécifiées
   * @param chains Les chaînes pour lesquelles créer des APIs
   * @param apiTypeMap Mapping optionnel des types d'API à utiliser pour chaque chaîne
   * @returns Un objet avec les instances d'API pour chaque chaîne
   */
  createApisForChains(
    chains: Chain[],
    apiTypeMap?: Partial<Record<Chain, ApiType>>,
  ): Record<Chain, ReturnType<typeof getEvmApi>> {
    return chains.reduce(
      (apis, chain) => {
        const apiType = apiTypeMap?.[chain];
        apis[chain] = this.createApi(chain, apiType);
        return apis;
      },
      {} as Record<Chain, ReturnType<typeof getEvmApi>>,
    );
  }

  // ======== Méthodes pour les chaînes EVM principales ========

  /**
   * Crée une instance d'API pour Ethereum (ETH)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour Ethereum
   */
  createEthereumApi(apiType?: ApiType) {
    return this.createApi(Chain.Ethereum, apiType);
  }

  /**
   * Crée une instance d'API pour Binance Smart Chain (BSC)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour BSC
   */
  createBscApi(apiType?: ApiType) {
    return this.createApi(Chain.BinanceSmartChain, apiType);
  }

  /**
   * Crée une instance d'API pour Polygon (MATIC)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour Polygon
   */
  createPolygonApi(apiType?: ApiType) {
    return this.createApi(Chain.Polygon, apiType);
  }

  /**
   * Crée une instance d'API pour Arbitrum (ARB)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour Arbitrum
   */
  createArbitrumApi(apiType?: ApiType) {
    return this.createApi(Chain.Arbitrum, apiType);
  }

  /**
   * Crée une instance d'API pour Avalanche (AVAX)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour Avalanche
   */
  createAvalancheApi(apiType?: ApiType) {
    return this.createApi(Chain.Avalanche, apiType);
  }

  /**
   * Crée une instance d'API pour Optimism (OP)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour Optimism
   */
  createOptimismApi(apiType?: ApiType) {
    return this.createApi(Chain.Optimism, apiType);
  }

  /**
   * Crée une instance d'API pour Base (BASE)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour Base
   */
  createBaseApi(apiType?: ApiType) {
    return this.createApi(Chain.Base, apiType);
  }

  // ======== Méthodes pour les autres chaînes EVM ========
  // Note: Ces méthodes sont commentées car les chaînes correspondantes ne sont pas disponibles
  // dans l'énumération Chain actuelle. Décommentez-les si vous ajoutez ces chaînes à l'énumération.

  /*
  // Fantom (FTM)
  createFantomApi(apiType?: ApiType) {
    return this.createApi(Chain.Fantom, apiType);
  }

  // Gnosis Chain (ex-xDai)
  createGnosisApi(apiType?: ApiType) {
    return this.createApi(Chain.Gnosis, apiType);
  }

  // Celo
  createCeloApi(apiType?: ApiType) {
    return this.createApi(Chain.Celo, apiType);
  }

  // Moonbeam
  createMoonbeamApi(apiType?: ApiType) {
    return this.createApi(Chain.Moonbeam, apiType);
  }

  // Harmony
  createHarmonyApi(apiType?: ApiType) {
    return this.createApi(Chain.Harmony, apiType);
  }

  // Metis
  createMetisApi(apiType?: ApiType) {
    return this.createApi(Chain.Metis, apiType);
  }

  // Aurora
  createAuroraApi(apiType?: ApiType) {
    return this.createApi(Chain.Aurora, apiType);
  }

  // Cronos
  createCronosApi(apiType?: ApiType) {
    return this.createApi(Chain.Cronos, apiType);
  }
  */

  // ======== Méthodes pour les chaînes non-EVM ========
  // Note: Ces méthodes sont incluses pour complétude, mais les APIs EVM ne fonctionneront pas avec ces chaînes

  /**
   * Crée une instance d'API pour Bitcoin (BTC)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour Bitcoin
   */
  createBitcoinApi(apiType?: ApiType) {
    return this.createApi(Chain.Bitcoin, apiType);
  }

  /**
   * Crée une instance d'API pour THORChain (THOR)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour THORChain
   */
  createThorchainApi(apiType?: ApiType) {
    return this.createApi(Chain.THORChain, apiType);
  }

  /**
   * Crée une instance d'API pour Maya (MAYA)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour Maya
   */
  createMayaApi(apiType?: ApiType) {
    return this.createApi(Chain.Maya, apiType);
  }

  /**
   * Crée une instance d'API pour Solana (SOL)
   * @param apiType Le type d'API à utiliser (optionnel)
   * @returns L'instance d'API pour Solana
   */
  createSolanaApi(apiType?: ApiType) {
    return this.createApi(Chain.Solana, apiType);
  }
}

/**
 * Crée une instance de la factory d'API EVM avec la configuration spécifiée
 * @param config La configuration pour la factory
 * @returns Une instance de EvmApiFactory
 */
export const createEvmApiFactory = (config: ApiFactoryConfig) => {
  return new EvmApiFactory(config);
};
