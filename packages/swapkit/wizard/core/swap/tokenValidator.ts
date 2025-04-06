import { getTokens } from './apiWrapper';

// Interface pour les tokens
interface Token {
  name: string;
  symbol: string;
  ticker: string;
  decimals: number;
  chainId: string;
  chain: string;
  address?: string;
  logoURI?: string;
  identifier?: string;
  coingeckoId?: string;
  extensions?: Record<string, any>;
}

// Interface pour la réponse de l'API tokens
interface TokenResponse {
  provider: string;
  name: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  keywords: string[];
  tags?: Record<string, any>;
  count: number;
  tokens: Token[];
  logoURI?: string;
  url?: string;
  supportedActions?: string[];
  supportedChainIds?: string[];
}

// Note: Cette interface est utilisée pour comprendre la structure de la réponse de l'API

// Énumération des fournisseurs disponibles
export enum TokenProvider {
  ALL = '',
  UNISWAP_V2 = 'UNISWAP_V2',
  UNISWAP_V3 = 'UNISWAP_V3',
  SUSHISWAP = 'SUSHISWAP',
  THORCHAIN = 'THORCHAIN',
  MAYA = 'MAYA',
  PANCAKESWAP = 'PANCAKESWAP',
  QUICKSWAP = 'QUICKSWAP',
  TRADER_JOE = 'TRADER_JOE'
}

// Cache pour éviter des appels API répétés
const tokenCache: Record<string, Token[]> = {};

/**
 * Récupère la liste des tokens disponibles depuis l'API SwapKit
 * @param provider Fournisseur de tokens (optionnel)
 * @returns Liste des tokens
 */
export async function fetchAvailableTokens(provider: TokenProvider = TokenProvider.ALL): Promise<Token[]> {
  try {
    // Créer une clé de cache unique pour ce fournisseur
    const cacheKey = `tokens_${provider}`;

    // Utiliser le cache si disponible pour ce fournisseur
    if (tokenCache[cacheKey] && tokenCache[cacheKey].length > 0) {
      return tokenCache[cacheKey];
    }

    console.log(`Récupération des tokens pour le fournisseur: ${'ALL'}`);
    console.time('Durée de la récupération des tokens');

    // Utiliser la fonction getTokens de notre apiWrapper
    const responseData = await getTokens(provider);

    console.timeEnd('Durée de la récupération des tokens');

    // Extraire tous les tokens de la réponse
    let allTokens: Token[] = [];

    // Traiter la réponse selon sa structure
    if (Array.isArray(responseData)) {
      // La réponse est un tableau d'objets providers
      console.log(`Réponse: tableau de ${responseData.length} providers`);

      // Parcourir chaque provider et extraire ses tokens
      responseData.forEach((providerData, index) => {
        if (providerData.tokens && Array.isArray(providerData.tokens)) {
          console.log(`Provider ${index + 1} (${providerData.provider || 'inconnu'}): ${providerData.tokens.length} tokens`);
          allTokens = [...allTokens, ...providerData.tokens];
        }
      });
    } else if (responseData.tokens && Array.isArray(responseData.tokens)) {
      // La réponse est un objet unique avec un tableau tokens
      console.log(`Réponse: provider unique (${responseData.provider || 'inconnu'})`);
      console.log(`Tokens récupérés: ${responseData.tokens.length}`);
      allTokens = responseData.tokens;
    } else {
      // Format inconnu
      console.log('Structure de réponse inconnue:', Object.keys(responseData).join(', '));
      allTokens = [];
    }

    console.log(`Total de tokens extraits: ${allTokens.length}`);

    // Afficher les informations essentielles sur les tokens
    if (allTokens.length > 0) {
      // Compter les tokens par chaîne (information utile)
      const tokensByChain: Record<string, number> = {};
      allTokens.forEach((token: Token) => {
        const chain = token.chain || 'unknown';
        tokensByChain[chain] = (tokensByChain[chain] || 0) + 1;
      });

      // Afficher les 5 chaînes principales
      const topChains = Object.entries(tokensByChain)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      console.log('Top 5 des chaines:',
        topChains.map(([chain, count]) => `${chain}(${count})`).join(', '));

      // Afficher un exemple de structure de token
      console.log('Structure de token:', Object.keys(allTokens[0]).join(', '));
    }

    // Mettre en cache les tokens extraits
    tokenCache[cacheKey] = allTokens;

    // Retourner tous les tokens extraits
    return allTokens;
  } catch (error) {
    console.error('Erreur lors de la récupération des tokens:', error);
    return [];
  }
}

/**
 * Vérifie si un asset existe dans la liste des tokens disponibles
 * @param assetString Chaîne d'identification de l'asset (ex: "THOR.RUNE", "ETH.ETH")
 * @param provider Fournisseur de tokens à utiliser pour la validation (optionnel)
 * @returns Objet contenant le résultat de la vérification et les détails du token si trouvé
 */
export async function validateAsset(
  assetString: string,
  provider: TokenProvider = TokenProvider.ALL
): Promise<{
  isValid: boolean;
  token?: Token;
  message: string;
  provider?: string;
}> {
  try {
    console.log(`Validation de l'asset: ${assetString} (fournisseur: ${provider || 'ALL'})`);

    // Récupérer la liste des tokens pour le fournisseur spécifié
    const tokens = await fetchAvailableTokens(provider);

    if (tokens.length === 0) {
      return {
        isValid: true, // Considérer comme valide si on ne peut pas vérifier
        message: `Impossible de vérifier l'asset car la liste des tokens n'a pas pu être récupérée pour le fournisseur ${provider || 'ALL'}`,
        provider: provider
      };
    }

    // Vérifier d'abord si l'identifiant complet existe
    console.log(`Vérification de l'identifiant complet: ${assetString}`);

    // Recherche directe par identifiant complet
    const exactMatchByIdentifier = tokens.find(token =>
      token.identifier && token.identifier.toUpperCase() === assetString.toUpperCase()
    );

    if (exactMatchByIdentifier) {
      console.log(`✅ Identifiant exact trouvé: ${exactMatchByIdentifier.identifier}`);
      console.log(`Token trouvé: ${exactMatchByIdentifier.name} (${exactMatchByIdentifier.symbol}, ${exactMatchByIdentifier.decimals} décimales)`);

      // Afficher toutes les propriétés du token trouvé
      console.log('Toutes les propriétés du token trouvé:');
      Object.entries(exactMatchByIdentifier).forEach(([key, value]) => {
        // Formater la valeur pour l'affichage
        let displayValue: string;
        if (typeof value === 'string') {
          // Tronquer les longues chaines (comme les adresses)
          displayValue = value.length > 30 ? `${value.substring(0, 27)}...` : value;
        } else if (value === null) {
          displayValue = 'null';
        } else if (value === undefined) {
          displayValue = 'undefined';
        } else if (typeof value === 'object') {
          // Convertir les objets en JSON et tronquer
          const json = JSON.stringify(value);
          displayValue = json.length > 50 ? `${json.substring(0, 47)}...` : json;
        } else {
          displayValue = String(value);
        }

        console.log(`  ${key}: ${displayValue}`);
      });

      return {
        isValid: true,
        token: exactMatchByIdentifier,
        message: `Asset valide: ${assetString}`,
        provider: provider
      };
    }

    // Si aucune correspondance exacte n'est trouvée, procéder à la recherche par parties
    console.log(`⚠️ Aucune correspondance exacte pour l'identifiant complet. Tentative de recherche par parties...`);

    // Extraire la chaîne et le symbole de l'asset
    const [chain, symbolWithAddress] = assetString.split('.');

    if (!chain || !symbolWithAddress) {
      return {
        isValid: false,
        message: `Format d'asset invalide: ${assetString}. Format attendu: CHAIN.SYMBOL`,
        provider: provider
      };
    }

    // Gérer les cas spéciaux comme les tokens avec adresse (ex: ETH.USDC-0x...)
    const symbol = symbolWithAddress.split('-')[0];
    const address = symbolWithAddress.includes('-') ? symbolWithAddress.split('-')[1] : undefined;

    console.log(`Recherche de ${chain}.${symbol}${address ? `-${address.substring(0, 8)}...` : ''} parmi ${tokens.length} tokens`);

    // Rechercher le token correspondant
    console.log(`Debug detaille des tokens avant filtrage:`);
    console.log(`Nombre total de tokens a analyser: ${tokens.length}`);

    // Afficher un echantillon des tokens pour debug
    const sampleSize = Math.min(1, tokens.length);
    console.log(`Echantillon de ${sampleSize} tokens:`);
    for (let i = 0; i < sampleSize; i++) {
      const sampleToken = tokens[i];
      console.log(`Token #${i+1}:`);

      // Afficher toutes les proprietes du token
      console.log('  Toutes les proprietes:');
      Object.entries(sampleToken).forEach(([key, value]) => {
        // Formater la valeur pour l'affichage
        let displayValue: string;
        if (typeof value === 'string') {
          // Tronquer les longues chaines (comme les adresses)
          displayValue = value.length > 30 ? `${value.substring(0, 27)}...` : value;
        } else if (value === null) {
          displayValue = 'null';
        } else if (value === undefined) {
          displayValue = 'undefined';
        } else if (typeof value === 'object') {
          // Convertir les objets en JSON et tronquer
          const json = JSON.stringify(value);
          displayValue = json.length > 50 ? `${json.substring(0, 47)}...` : json;
        } else {
          displayValue = String(value);
        }

        console.log(`  ${key}: ${displayValue}`);
      });
    }

    // Afficher les proprietes disponibles dans les tokens
    if (tokens.length > 0) {
      const firstToken = tokens[0];
      console.log(`Proprietes disponibles dans les tokens:`);
      Object.keys(firstToken).forEach(key => {
        console.log(`  ${key}: ${typeof firstToken[key]}`);
      });
    }

    // Recherche de tokens specifiques pour debug
    const searchTerms = [chain, symbol];
    console.log(`Recherche de tokens contenant '${searchTerms.join("' ou '")}':`);
    const relevantTokens = tokens.filter(t =>
      (t.chain && t.chain.toUpperCase().includes(chain.toUpperCase())) ||
      (t.symbol && t.symbol.toUpperCase().includes(symbol.toUpperCase())) ||
      (t.ticker && t.ticker.toUpperCase().includes(symbol.toUpperCase()))
    ).slice(0, 3);

    if (relevantTokens.length > 0) {
      console.log(`Trouve ${relevantTokens.length} tokens pertinents:`);
      relevantTokens.forEach((t, i) => {
        console.log(`Token pertinent #${i+1}: ${t.chain}.${t.symbol} (${t.name})`);
      });
    } else {
      console.log(`Aucun token pertinent trouve pour '${searchTerms.join("' ou '")}':`);
    }

    // Proceder au filtrage reel
    console.log(`Debut du filtrage avec chain=${chain}, symbol=${symbol}${address ? `, address=${address.substring(0, 8)}...` : ''}`);

    const matchingTokens = tokens.filter(token => {
      // Correspondance par chaîne et symbole
      // Débogage de la correspondance des chaînes
      const tokenChain = token.chain ? token.chain.toUpperCase() : 'NON_DEFINI';
      const tokenChainId = token.chainId ? token.chainId.toUpperCase() : 'NON_DEFINI';
      const searchChain = chain.toUpperCase();
      const mappedChainId = getChainIdFromName(chain).toUpperCase();

      // Afficher les détails pour les 5 premiers tokens ou si on trouve une correspondance partielle
      const debugThisToken = token.symbol?.toUpperCase() === symbol.toUpperCase() ||
                           Math.random() < 0.00005; // Afficher ~1% des tokens aléatoirement

      if (debugThisToken) {
        console.log(`Débogage correspondance pour token: ${token.symbol || 'inconnu'} (${token.name || 'sans nom'})`);
        console.log(`  Recherche: chain=${searchChain}, mappedChainId=${mappedChainId}`);
        console.log(`  Token: chain=${tokenChain}, chainId=${tokenChainId}`);
        console.log(`  Match chain: ${tokenChain === searchChain}`);
        console.log(`  Match chainId direct: ${tokenChainId === searchChain}`);
        console.log(`  Match chainId mappé: ${tokenChainId === mappedChainId}`);
      }

      const chainMatch =
        // Vérifier la correspondance avec le champ chain
        (token.chain && token.chain.toUpperCase() === chain.toUpperCase()) ||
        // Vérifier la correspondance avec le champ chainId
        token.chainId.toUpperCase() === chain.toUpperCase() ||
        token.chainId.toUpperCase() === getChainIdFromName(chain);

      // Vérifier la correspondance du symbole
      const tokenSymbol = token.symbol ? token.symbol.toUpperCase() : 'NON_DEFINI';
      const tokenTicker = token.ticker ? token.ticker.toUpperCase() : 'NON_DEFINI';
      const searchSymbol = symbol.toUpperCase();

      if (debugThisToken) {
        console.log(`  Symbole recherché: ${searchSymbol}`);
        console.log(`  Token symbole: ${tokenSymbol}, ticker: ${tokenTicker}`);
        console.log(`  Match symbole: ${tokenSymbol === searchSymbol}`);
        console.log(`  Match ticker: ${tokenTicker === searchSymbol}`);
      }

      const symbolMatch = tokenSymbol === searchSymbol || tokenTicker === searchSymbol;

      // Si une adresse est spécifiée, vérifier également l'adresse
      if (address && token.address) {
        const tokenAddress = token.address.toLowerCase();
        const searchAddress = address.toLowerCase();
        const addressMatch = tokenAddress === searchAddress;

        if (debugThisToken) {
          console.log(`  Adresse recherchée: ${searchAddress.substring(0, 10)}...`);
          console.log(`  Token adresse: ${tokenAddress.substring(0, 10)}...`);
          console.log(`  Match adresse: ${addressMatch}`);
          console.log(`  Match final (chain && symbol && address): ${chainMatch && symbolMatch && addressMatch}`);
        }

        return chainMatch && symbolMatch && addressMatch;
      }

      // Si l'identifiant complet est disponible, l'utiliser pour une correspondance exacte
      // Note: Cette vérification est redondante car nous avons déjà vérifié l'identifiant complet
      // avant d'arriver ici, mais nous la gardons pour être sûr
      if (token.identifier) {
        const tokenIdentifier = token.identifier.toUpperCase();
        const searchIdentifier = assetString.toUpperCase();
        const identifierMatch = tokenIdentifier === searchIdentifier;

        if (debugThisToken) {
          console.log(`  Identifiant recherché: ${searchIdentifier}`);
          console.log(`  Token identifiant: ${tokenIdentifier}`);
          console.log(`  Match identifiant: ${identifierMatch}`);
        }

        if (identifierMatch) {
          return true;
        }
      }

      // Match final basé sur la chaîne et le symbole
      if (debugThisToken) {
        console.log(`  Match final (chain && symbol): ${chainMatch && symbolMatch}`);
      }

      return chainMatch && symbolMatch;
    });

    // Résumé des résultats de la recherche
    console.log(`Résultats de la recherche pour ${assetString}: ${matchingTokens.length} tokens trouvés`);

    if (matchingTokens.length > 0) {
      // Token trouve
      const token = matchingTokens[0];
      console.log(`Token trouve: ${token.ticker} (${token.ticker}, ${token.decimals} decimales)`);

      // Afficher toutes les proprietes du token trouve
      console.log('Toutes les proprietes du token trouve:');
      Object.entries(token).forEach(([key, value]) => {
        // Formater la valeur pour l'affichage
        let displayValue: string;
        if (typeof value === 'string') {
          // Tronquer les longues chaines (comme les adresses)
          displayValue = value.length > 30 ? `${value.substring(0, 27)}...` : value;
        } else if (value === null) {
          displayValue = 'null';
        } else if (value === undefined) {
          displayValue = 'undefined';
        } else if (typeof value === 'object') {
          // Convertir les objets en JSON et tronquer
          const json = JSON.stringify(value);
          displayValue = json.length > 50 ? `${json.substring(0, 47)}...` : json;
        } else {
          displayValue = String(value);
        }

        console.log(`  ${key}: ${displayValue}`);
      });

      return {
        isValid: true,
        token: token,
        message: `Asset valide: ${assetString}`,
        provider: provider
      };
    }

    // Si aucun token n'est trouvé et que le fournisseur est spécifique, essayer avec tous les fournisseurs
    if (provider !== TokenProvider.ALL) {
      console.log(`Asset non trouvé pour ${provider}, essai avec tous les fournisseurs...`);
      return validateAsset(assetString, TokenProvider.ALL);
    }

    console.log(`Asset non trouvé: ${assetString}`);
    return {
      isValid: false,
      message: `Asset non valide: ${assetString}. Cet identifiant complet n'existe pas dans la liste des tokens disponibles.`,
      provider: provider
    };
  } catch (error) {
    console.error('Erreur lors de la validation de l\'asset:', error.message);

    // Considérer comme valide en cas d'erreur pour ne pas bloquer le swap
    return {
      isValid: true,
      message: `Erreur lors de la validation de l'asset: ${error.message}`,
      provider: provider
    };
  }
}

/**
 * Convertit un nom de chaîne en identifiant de chaîne
 * @param chainName Nom de la chaîne (ex: "THOR", "ETH")
 * @returns Identifiant de la chaîne
 */
function getChainIdFromName(chainName: string): string {
  const chainMap: Record<string, string> = {
    'THOR': 'THORCHAIN',
    'ETH': 'ETHEREUM',
    'BTC': 'BITCOIN',
    'BSC': 'BINANCESMARTCHAIN',
    'AVAX': 'AVALANCHE',
    'MATIC': 'POLYGON',
    'ARB': 'ARBITRUM',
    'OP': 'OPTIMISM',
    'BASE': 'BASE',
    'MAYA': 'MAYA',
    'SOL': 'SOLANA',
    'DOGE': 'DOGECOIN',
    'LTC': 'LITECOIN',
    'BCH': 'BITCOINCASH',
    'GAIA': 'COSMOS',
    'DASH': 'DASH',
    'KUJI': 'KUJIRA',
  };

  return chainMap[chainName.toUpperCase()] || chainName;
}
