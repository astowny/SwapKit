import { SwapKitApi } from '../../../api/src/index';
import { withNetworkMonitoring } from './networkMonitor';

// Configuration de base pour les API
const API_CONFIG = {
  baseUrl: process.env.SWAPKIT_API_URL || 'https://api.swapkit.dev',
  devBaseUrl: process.env.SWAPKIT_DEV_API_URL || 'https://dev-api.swapkit.dev',
};

// Fonction pour obtenir l'URL de base
const getBaseUrl = (isDev?: boolean) => {
  const baseUrl = isDev ? API_CONFIG.devBaseUrl : API_CONFIG.baseUrl;
  // S'assurer que l'URL se termine par un slash
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

// Wrapper pour getSwapQuote
export const getSwapQuote = withNetworkMonitoring(
  SwapKitApi.getSwapQuote,
  (searchParams, isDev) => {
    console.log('post request to :', `${getBaseUrl(isDev)}quote`)
    return `${getBaseUrl(isDev)}quote`;
  },
  'POST'
);

// Wrapper pour getPrice
export const getPrice = withNetworkMonitoring(
  SwapKitApi.getPrice,
  (body, isDev) => {
    return `${getBaseUrl(isDev)}price`;
  },
  'POST'
);

// Wrapper pour getGasRate
export const getGasRate = withNetworkMonitoring(
  SwapKitApi.getGasRate,
  (isDev) => {
    return `${getBaseUrl(isDev)}gas_rate`;
  },
  'GET'
);

// Wrapper pour getTrackerDetails
export const getTrackerDetails = withNetworkMonitoring(
  SwapKitApi.getTrackerDetails,
  (payload, apiKey, referer) => {
    return `${getBaseUrl()}tracker/${payload.txId}`;
  },
  'GET'
);

// Wrapper pour getTokens
export const getTokens = withNetworkMonitoring(
  SwapKitApi.getTokens || ((provider?: string) => fetch(`${getBaseUrl()}tokens${provider ? `?provider=${provider}` : ''}`, {
    headers: {
      'x-api-key': process.env.SWAPKIT_API_KEY,
    }
  }).then(res => res.json())),
  (provider) => {
    return `${getBaseUrl()}tokens${provider ? `?provider=${provider}` : ''}`;
  },
  'GET'
);

// Exporter un objet API complet avec nos fonctions wrappées
export const SwapKitApiWithMonitoring = {
  ...SwapKitApi,
  getSwapQuote,
  getPrice,
  getGasRate,
  getTrackerDetails,
  getTokens,
  // Configuration
  config: API_CONFIG,
};
