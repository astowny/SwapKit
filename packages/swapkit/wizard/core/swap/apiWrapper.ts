import { SwapKitApi } from '@swapkit/api';
import { withNetworkMonitoring } from './networkMonitor';

// Wrapper pour getSwapQuote
export const getSwapQuote = withNetworkMonitoring(
  SwapKitApi.getSwapQuote,
  (searchParams, isDev) => {
    const baseUrl = isDev ? 'https://dev-api.thorswap.net' : 'https://api.thorswap.net';
    return `${baseUrl}/thorchain/quote`;
  },
  'POST'
);

// Wrapper pour getPrice
export const getPrice = withNetworkMonitoring(
  SwapKitApi.getPrice,
  (body, isDev) => {
    const baseUrl = isDev ? 'https://dev-api.thorswap.net' : 'https://api.thorswap.net';
    return `${baseUrl}/thorchain/price`;
  },
  'POST'
);

// Wrapper pour getGasRate
export const getGasRate = withNetworkMonitoring(
  SwapKitApi.getGasRate,
  (isDev) => {
    const baseUrl = isDev ? 'https://dev-api.thorswap.net' : 'https://api.thorswap.net';
    return `${baseUrl}/thorchain/gas_rate`;
  },
  'GET'
);

// Wrapper pour getTrackerDetails
export const getTrackerDetails = withNetworkMonitoring(
  SwapKitApi.getTrackerDetails,
  (payload, apiKey, referer) => {
    return `https://api.thorswap.net/thorchain/tracker/${payload.txId}`;
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
};
