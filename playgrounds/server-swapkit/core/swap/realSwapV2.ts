/**
 * SwapKit V2 Swap Execution - Following the recommended SwapKit SDK documentation
 *
 * This implementation follows the patterns from:
 * https://swapkit.github.io/SwapKit/start/getting-started/
 * https://swapkit.github.io/SwapKit/guides/actions/swap/
 *
 * Key features:
 * - Uses SwapKitApi.getSwapQuote() for getting quotes
 * - Uses swapKit.swap({ route, feeOptionKey }) for executing swaps
 * - Proper token approval handling
 * - Clean separation between quote and execution
 */

import { Chain, FeeOption } from "@swapkit/helpers";
import { SwapKitApi } from "@swapkit/helpers/api";
import { getSwapKitClientV2, connectWalletsV2 } from "./clientV2.js";

/**
 * Options for V2 swap quote
 */
export interface QuoteOptionsV2 {
  /** Asset to sell (e.g., "ETH.ETH") */
  sellAsset: string;
  /** Asset to buy (e.g., "BTC.BTC") */
  buyAsset: string;
  /** Amount to sell as string */
  sellAmount: string;
  /** Source wallet address */
  sourceAddress?: string;
  /** Destination address for the swapped tokens */
  destinationAddress?: string;
  /** Slippage tolerance in percentage (default: 3) */
  slippage?: number;
}

/**
 * Options for V2 swap execution
 */
export interface SwapOptionsV2 {
  /** Route object returned from getSwapQuoteV2 */
  route: any;
  /** Fee option for transaction (default: Fast) */
  feeOptionKey?: FeeOption;
}

/**
 * Full options for getting quote and executing swap in one call
 */
export interface SwapFullOptionsV2 {
  sellAsset: string;
  buyAsset: string;
  sellAmount: string;
  sourceAddress?: string;
  destinationAddress?: string;
  slippage?: number;
  feeOptionKey?: FeeOption;
  /** Optional: specific route index to use (default: 0 = best route) */
  routeIndex?: number;
}

/**
 * Response from getSwapQuoteV2
 */
export interface QuoteResponseV2 {
  success: boolean;
  routes?: any[];
  error?: string;
  meta?: any;
}

/**
 * Response from executeSwapV2
 */
export interface SwapResultV2 {
  success: boolean;
  txHash?: string;
  txUrl?: string;
  route?: any;
  error?: string;
  errorCode?: string;
  timestamp: string;
}

/**
 * Get a swap quote using the recommended SwapKitApi.getSwapQuote method
 *
 * From docs:
 * ```
 * const quoteParams = {
 *   sellAsset: "ETH.ETH",
 *   sellAmount: "1000000000000000000",
 *   buyAsset: "BTC.BTC",
 *   sourceAddress: swapKit.getAddress(Chain.Ethereum),
 *   destinationAddress: swapKit.getAddress(Chain.Bitcoin),
 *   slippage: 3,
 * };
 * const { routes } = await SwapKitApi.getSwapQuote(quoteParams);
 * ```
 */
export async function getSwapQuoteV2(options: QuoteOptionsV2): Promise<QuoteResponseV2> {
  const {
    sellAsset,
    buyAsset,
    sellAmount,
    sourceAddress,
    destinationAddress,
    slippage = 3,
  } = options;

  console.log(`📊 [V2] Getting swap quote: ${sellAmount} ${sellAsset} → ${buyAsset}`);

  try {
    // Build the quote request following the documentation
    const quoteParams: any = {
      sellAsset,
      buyAsset,
      sellAmount,
      slippage,
    };

    // Add optional parameters
    if (sourceAddress) {
      quoteParams.sourceAddress = sourceAddress;
    }
    if (destinationAddress) {
      quoteParams.destinationAddress = destinationAddress;
    }

    console.log("📝 [V2] Quote params:", JSON.stringify(quoteParams, null, 2));

    // Call the SwapKit API to get quote - following the docs pattern
    const quoteResponse = await SwapKitApi.getSwapQuote(quoteParams);

    // Handle the response
    const routes = (quoteResponse as any).routes || [];

    if (routes.length === 0) {
      return {
        success: false,
        error: "No swap routes available for this pair",
      };
    }

    console.log(`✅ [V2] Got ${routes.length} route(s)`);

    // Log the best route details
    const bestRoute = routes[0];
    console.log(`🏆 [V2] Best route:`);
    console.log(`   Provider: ${bestRoute.providers?.join(", ") || "Unknown"}`);
    console.log(`   Expected output: ${bestRoute.expectedBuyAmount || bestRoute.expectedOutput}`);
    if (bestRoute.estimatedTime) {
      console.log(`   Estimated time: ${bestRoute.estimatedTime.total}s`);
    }

    return {
      success: true,
      routes,
      meta: (quoteResponse as any).meta,
    };
  } catch (error: any) {
    console.error("❌ [V2] Error getting quote:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}


/**
 * Execute a swap using the recommended swapKit.swap({ route, feeOptionKey }) method
 *
 * From docs:
 * ```
 * const txHash = await swapKit.swap({
 *   route: bestRoute,
 *   feeOptionKey: FeeOption.Fast,
 * });
 * ```
 */
export async function executeSwapV2(options: SwapOptionsV2): Promise<SwapResultV2> {
  const { route, feeOptionKey = FeeOption.Fast } = options;

  console.log(`🔄 [V2] Executing swap with route...`);
  console.log(`   Provider: ${route.providers?.join(", ") || "Unknown"}`);
  console.log(`   Fee option: ${feeOptionKey}`);

  try {
    const swapKit = getSwapKitClientV2();

    // Execute the swap following the documentation pattern
    const txHash = await swapKit.swap({
      route,
      feeOptionKey,
    });

    console.log(`✅ [V2] Swap executed successfully!`);
    console.log(`   Transaction hash: ${txHash}`);

    return {
      success: true,
      txHash: txHash as string,
      route,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("❌ [V2] Swap execution failed:", error.message);
    return {
      success: false,
      error: error.message,
      errorCode: error.code || "SWAP_ERROR",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Complete swap flow: get quote + execute swap
 * This is the convenience method that combines both steps
 *
 * Following the full flow from the documentation:
 * 1. Get quote with SwapKitApi.getSwapQuote()
 * 2. Select best route (routes[0])
 * 3. Execute with swapKit.swap({ route, feeOptionKey })
 */
export async function executeFullSwapV2(options: SwapFullOptionsV2): Promise<SwapResultV2> {
  const {
    sellAsset,
    buyAsset,
    sellAmount,
    sourceAddress,
    destinationAddress,
    slippage = 3,
    feeOptionKey = FeeOption.Fast,
    routeIndex = 0,
  } = options;

  console.log(`🚀 [V2] Starting full swap flow: ${sellAmount} ${sellAsset} → ${buyAsset}`);

  // Step 1: Get quote
  const quoteResult = await getSwapQuoteV2({
    sellAsset,
    buyAsset,
    sellAmount,
    sourceAddress,
    destinationAddress,
    slippage,
  });

  if (!quoteResult.success || !quoteResult.routes || quoteResult.routes.length === 0) {
    return {
      success: false,
      error: quoteResult.error || "No routes available",
      errorCode: "NO_ROUTES",
      timestamp: new Date().toISOString(),
    };
  }

  // Step 2: Select route (default: best route = index 0)
  const selectedRoute = quoteResult.routes[routeIndex];
  if (!selectedRoute) {
    return {
      success: false,
      error: `Route index ${routeIndex} not available (${quoteResult.routes.length} routes found)`,
      errorCode: "INVALID_ROUTE_INDEX",
      timestamp: new Date().toISOString(),
    };
  }

  console.log(`📋 [V2] Selected route ${routeIndex}:`);
  console.log(`   Providers: ${selectedRoute.providers?.join(", ") || "Unknown"}`);
  console.log(`   Expected output: ${selectedRoute.expectedBuyAmount || selectedRoute.expectedOutput}`);

  // Step 3: Execute swap
  return executeSwapV2({
    route: selectedRoute,
    feeOptionKey,
  });
}

/**
 * Get wallet address for a chain using the connected SwapKit client
 */
export function getAddressV2(chain: Chain): string | undefined {
  const swapKit = getSwapKitClientV2();
  return swapKit.getAddress(chain);
}

/**
 * Get wallet balance for a chain
 * Following: https://swapkit.github.io/SwapKit/start/getting-started/
 *
 * From docs:
 * ```
 * const ethBalance = await swapKit.getBalance(Chain.Ethereum);
 * const freshBalance = await swapKit.getBalance(Chain.Ethereum, true); // Force refresh
 * ```
 */
export async function getBalanceV2(chain: Chain, refresh = false): Promise<any> {
  const swapKit = getSwapKitClientV2();
  return swapKit.getBalance(chain, refresh);
}

/**
 * Get all connected wallets with balances
 */
export async function getWalletWithBalanceV2(chain: Chain): Promise<any> {
  const swapKit = getSwapKitClientV2();
  return swapKit.getWalletWithBalance(chain);
}

// Re-export the connection function for convenience
export { connectWalletsV2 } from "./clientV2.js";

