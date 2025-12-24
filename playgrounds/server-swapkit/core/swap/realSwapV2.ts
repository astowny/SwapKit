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
 * - Automatic wallet connection before swap execution
 */

import { Chain, FeeOption, AssetValue, EVMChains, type EVMChain } from "@swapkit/helpers";
import { SwapKitApi } from "@swapkit/helpers/api";
import { getSwapKitClientV2, connectWalletsV2 } from "./clientV2.js";

/**
 * Extracts the chain identifier from an asset string (e.g., "ETH.ETH" -> "ETH")
 */
function getChainFromAsset(assetString: string): Chain | null {
  if (!assetString) return null;
  const chainPart = assetString.split(".")[0];
  // Map common chain identifiers to Chain enum
  const chainMap: Record<string, Chain> = {
    ETH: Chain.Ethereum,
    BTC: Chain.Bitcoin,
    LTC: Chain.Litecoin,
    BCH: Chain.BitcoinCash,
    DOGE: Chain.Dogecoin,
    AVAX: Chain.Avalanche,
    BSC: Chain.BinanceSmartChain,
    THOR: Chain.THORChain,
    MAYA: Chain.Maya,
    GAIA: Chain.Cosmos,
    ARB: Chain.Arbitrum,
    OP: Chain.Optimism,
    MATIC: Chain.Polygon,
    BASE: Chain.Base,
    SOL: Chain.Solana,
    NEAR: Chain.Near,
    XRD: Chain.Radix,
  };
  return chainMap[chainPart] || null;
}

/**
 * Ensures wallet is connected for the specified chain
 */
async function ensureWalletConnected(chain: Chain): Promise<void> {
  const swapKit = getSwapKitClientV2();
  const address = swapKit.getAddress(chain);

  if (!address) {
    console.log(`🔐 [V2] Wallet non connecté pour ${chain}, connexion en cours...`);
    await connectWalletsV2([chain]);

    // Verify connection
    const newAddress = swapKit.getAddress(chain);
    if (!newAddress) {
      throw new Error(`Impossible de connecter le wallet pour la chaîne ${chain}`);
    }
    console.log(`✅ [V2] Wallet connecté pour ${chain}: ${newAddress}`);
  } else {
    console.log(`✅ [V2] Wallet déjà connecté pour ${chain}: ${address}`);
  }
}

/**
 * Check and approve token if needed before swap execution
 * Following the documentation pattern:
 * 1. Create AssetValue for the token
 * 2. Check if it's not a gas asset (native tokens don't need approval)
 * 3. Check if approved using isAssetValueApproved
 * 4. If not approved, call approveAssetValue
 *
 * @param route - The swap route containing sellAsset, sellAmount, and tx info
 * @returns true if approved (or no approval needed), false if approval failed
 */
async function ensureTokenApproval(route: any): Promise<{ approved: boolean; error?: string }> {
  const swapKit = getSwapKitClientV2();

  try {
    // Create AssetValue from the sell asset
    const assetValue = await AssetValue.from({
      asset: route.sellAsset,
      value: route.sellAmount,
      asyncTokenLookup: true,
    });

    console.log(`🔍 [V2] Vérification de l'approbation pour: ${route.sellAsset}`);
    console.log(`   Montant: ${route.sellAmount}`);
    console.log(`   Est un gas asset: ${assetValue.isGasAsset}`);
    console.log(`   Chain: ${assetValue.chain}`);

    // Native tokens (gas assets) don't need approval
    if (assetValue.isGasAsset) {
      console.log(`✅ [V2] Token natif (gas asset), pas besoin d'approbation`);
      return { approved: true };
    }

    // Check if chain is EVM (only EVM chains need token approval)
    const chain = assetValue.chain as EVMChain;
    if (!EVMChains.includes(chain)) {
      console.log(`✅ [V2] Chaîne non-EVM (${chain}), pas besoin d'approbation`);
      return { approved: true };
    }

    // Get the spender address from the route
    // The spender can be in multiple locations depending on the provider:
    // 1. route.tx.from - Used by official SwapKit playground for EVM transactions
    // 2. route.tx.to - Transaction destination (router contract)
    // 3. route.meta.approvalAddress - Explicit approval address in metadata
    // 4. route.targetAddress - Target address for some providers
    // 5. route.contract - Contract address for some providers
    const tx = route.tx as any;
    const meta = route.meta as any;

    // Priority order: meta.approvalAddress > tx.from > tx.to > targetAddress > contract
    const spenderAddress =
      meta?.approvalAddress ||
      tx?.from ||
      tx?.to ||
      route.targetAddress ||
      route.contract;

    console.log(`🔍 [V2] Recherche du spender dans la route:`);
    console.log(`   - meta.approvalAddress: ${meta?.approvalAddress || 'non défini'}`);
    console.log(`   - tx.from: ${tx?.from || 'non défini'}`);
    console.log(`   - tx.to: ${tx?.to || 'non défini'}`);
    console.log(`   - route.targetAddress: ${route.targetAddress || 'non défini'}`);
    console.log(`   - route.contract: ${route.contract || 'non défini'}`);

    if (!spenderAddress) {
      console.error(`❌ [V2] Aucune adresse spender trouvée dans la route!`);
      console.error(`   La route complète:`, JSON.stringify(route, null, 2).substring(0, 500));
      return {
        approved: false,
        error: "Impossible de trouver l'adresse du spender pour l'approbation. Vérifiez que la route contient tx.from, tx.to, meta.approvalAddress ou targetAddress."
      };
    }

    console.log(`📋 [V2] Spender address sélectionné: ${spenderAddress}`);

    // Check if already approved
    const isApproved = await swapKit.isAssetValueApproved(assetValue, spenderAddress);

    if (isApproved) {
      console.log(`✅ [V2] Token déjà approuvé pour le spender`);
      return { approved: true };
    }

    // Token not approved, need to approve
    console.log(`⏳ [V2] Token non approuvé, approbation en cours...`);
    console.log(`   Token: ${assetValue.symbol} (${assetValue.address})`);
    console.log(`   Spender: ${spenderAddress}`);

    const approvalTxHash = await swapKit.approveAssetValue(assetValue, spenderAddress);

    console.log(`✅ [V2] Token approuvé avec succès!`);
    console.log(`   TX Hash d'approbation: ${approvalTxHash}`);

    // Wait a bit for the approval to be confirmed on chain
    console.log(`⏳ [V2] Attente de 5 secondes pour confirmation de l'approbation...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    return { approved: true };

  } catch (error: any) {
    console.error(`❌ [V2] Erreur lors de la vérification/approbation:`, error.message);
    return {
      approved: false,
      error: `Erreur d'approbation du token: ${error.message}`
    };
  }
}

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
    // Extract source chain from route and ensure wallet is connected
    const sellAsset = route.sellAsset;
    const buyAsset = route.buyAsset;

    console.log(`📋 [V2] Route details: ${sellAsset} → ${buyAsset}`);

    // Connect wallet for source chain (required for swap execution)
    const sourceChain = getChainFromAsset(sellAsset);
    if (sourceChain) {
      await ensureWalletConnected(sourceChain);
    } else {
      console.warn(`⚠️ [V2] Impossible de déterminer la chaîne source depuis: ${sellAsset}`);
    }

    // Optionally connect destination chain wallet (useful for cross-chain swaps)
    const destChain = getChainFromAsset(buyAsset);
    if (destChain && destChain !== sourceChain) {
      try {
        await ensureWalletConnected(destChain);
      } catch (destError: any) {
        console.warn(`⚠️ [V2] Impossible de connecter le wallet destination (${destChain}): ${destError.message}`);
        // Continue anyway - destination wallet is not always required
      }
    }

    // IMPORTANT: Check and approve token before swap execution
    // This prevents "EXECUTION_REVERTED" errors due to missing token approval
    const approvalResult = await ensureTokenApproval(route);
    if (!approvalResult.approved) {
      return {
        success: false,
        error: approvalResult.error || "Token approval failed",
        errorCode: "TOKEN_APPROVAL_FAILED",
        timestamp: new Date().toISOString(),
      };
    }

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

    // Provide more helpful error message for wallet connection issues
    let errorMessage = error.message;
    let errorCode = error.code || error.errorKey || "SWAP_ERROR";

    if (error.errorKey === "core_wallet_connection_not_found" || error.message.includes("wallet")) {
      errorMessage = `Wallet non connecté pour exécuter le swap. ${error.message}. Vérifiez que MNEMONIC est configuré dans .env`;
      errorCode = "WALLET_NOT_CONNECTED";
    }

    return {
      success: false,
      error: errorMessage,
      errorCode,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Complete swap flow: get quote + execute swap
 * This is the convenience method that combines both steps
 *
 * Following the full flow from the documentation:
 * 1. Connect wallets for source and destination chains
 * 2. Get quote with SwapKitApi.getSwapQuote()
 * 3. Select best route (routes[0])
 * 4. Execute with swapKit.swap({ route, feeOptionKey })
 */
export async function executeFullSwapV2(options: SwapFullOptionsV2): Promise<SwapResultV2> {
  const {
    sellAsset,
    buyAsset,
    sellAmount,
    slippage = 3,
    feeOptionKey = FeeOption.Fast,
    routeIndex = 0,
  } = options;

  // Allow override of source/destination addresses
  let { sourceAddress, destinationAddress } = options;

  console.log(`🚀 [V2] Starting full swap flow: ${sellAmount} ${sellAsset} → ${buyAsset}`);

  try {
    // Step 0: Connect wallets and get addresses if not provided
    const sourceChain = getChainFromAsset(sellAsset);
    const destChain = getChainFromAsset(buyAsset);

    if (sourceChain) {
      await ensureWalletConnected(sourceChain);
      const swapKit = getSwapKitClientV2();
      if (!sourceAddress) {
        sourceAddress = swapKit.getAddress(sourceChain);
        console.log(`📍 [V2] Source address auto-detected: ${sourceAddress}`);
      }
    }

    if (destChain) {
      try {
        await ensureWalletConnected(destChain);
        const swapKit = getSwapKitClientV2();
        if (!destinationAddress) {
          destinationAddress = swapKit.getAddress(destChain);
          console.log(`📍 [V2] Destination address auto-detected: ${destinationAddress}`);
        }
      } catch (destError: any) {
        console.warn(`⚠️ [V2] Impossible de connecter le wallet destination: ${destError.message}`);
        // Continue - destination might be optional for some swaps
      }
    }

    // Step 1: Get quote with wallet addresses
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

    // Step 3: Execute swap (wallet connection already done above)
    return executeSwapV2({
      route: selectedRoute,
      feeOptionKey,
    });
  } catch (error: any) {
    console.error("❌ [V2] Full swap flow failed:", error.message);

    let errorMessage = error.message;
    let errorCode = error.code || error.errorKey || "SWAP_FLOW_ERROR";

    if (error.errorKey === "core_wallet_connection_not_found" || error.message.includes("wallet") || error.message.includes("MNEMONIC")) {
      errorMessage = `Erreur de connexion wallet: ${error.message}. Vérifiez que MNEMONIC est configuré dans .env`;
      errorCode = "WALLET_CONNECTION_ERROR";
    }

    return {
      success: false,
      error: errorMessage,
      errorCode,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get wallet address for a chain using the connected SwapKit client
 * Automatically connects the wallet if not already connected
 */
export async function getAddressV2(chain: Chain): Promise<string | undefined> {
  await ensureWalletConnected(chain);
  const swapKit = getSwapKitClientV2();
  return swapKit.getAddress(chain);
}

/**
 * Get wallet balance for a chain
 * Following: https://swapkit.github.io/SwapKit/start/getting-started/
 * Automatically connects the wallet if not already connected
 *
 * From docs:
 * ```
 * const ethBalance = await swapKit.getBalance(Chain.Ethereum);
 * const freshBalance = await swapKit.getBalance(Chain.Ethereum, true); // Force refresh
 * ```
 */
export async function getBalanceV2(chain: Chain, refresh = false): Promise<any> {
  await ensureWalletConnected(chain);
  const swapKit = getSwapKitClientV2();
  return swapKit.getBalance(chain, refresh);
}

/**
 * Get all connected wallets with balances
 * Automatically connects the wallet if not already connected
 */
export async function getWalletWithBalanceV2(chain: Chain): Promise<any> {
  await ensureWalletConnected(chain);
  const swapKit = getSwapKitClientV2();
  return swapKit.getWalletWithBalance(chain);
}

// Re-export the connection function for convenience
export { connectWalletsV2 } from "./clientV2.js";

