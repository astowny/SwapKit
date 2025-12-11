/**
 * SwapKit Client V2 - Following the recommended SwapKit SDK documentation
 *
 * This implementation follows the "All-in-one Approach (Backend)" from:
 * https://swapkit.github.io/SwapKit/start/getting-started/
 * https://swapkit.github.io/SwapKit/guides/actions/swap/
 *
 * Key differences from v1:
 * - Uses createSwapKit() as recommended for backend
 * - Uses SwapKitApi.getSwapQuote for getting quotes
 * - Uses swapKit.swap({ route, feeOptionKey }) for executing swaps
 * - Cleaner separation between quote and execution
 * - Better error handling following SDK patterns
 * - Auto-connects all keystore-supported chains at initialization
 */

import { Chain } from "@swapkit/helpers";
import { createSwapKit } from "@swapkit/sdk";
import { SwapKitApi } from "@swapkit/helpers/api";
import { KEYSTORE_SUPPORTED_CHAINS } from "@swapkit/wallets/keystore";

import * as dotenv from "dotenv";
dotenv.config();

// Type for the SwapKit client
export type SwapKitClientV2 = ReturnType<typeof createSwapKit>;

// Cache for the client instance
let cachedClient: SwapKitClientV2 | null = null;
let walletsConnected = false;

/**
 * Creates a SwapKit client following the recommended SDK pattern
 * Uses createSwapKit() - the all-in-one approach recommended for backend
 *
 * From docs: "All-in-one approach - Import everything from the SDK (better for backend/Node.js)"
 */
export function getSwapKitClientV2(): SwapKitClientV2 {
  if (cachedClient) {
    console.log("✅ [V2] Réutilisation de l'instance existante du client SwapKit");
    return cachedClient;
  }

  console.log("🆕 [V2] Création d'une nouvelle instance du client SwapKit avec createSwapKit()");

  // Following the documentation: https://swapkit.github.io/SwapKit/start/getting-started/
  const client = createSwapKit({
    config: {
      apiKeys: {
        swapKit: process.env.SWAPKIT_API_KEY || "",
        blockchair: process.env.BLOCKCHAIR_API_KEY || "",
        walletConnectProjectId: "",
      },
    },
  });

  cachedClient = client;
  console.log("✅ [V2] Client SwapKit créé avec succès");

  return client;
}

/**
 * Connects wallets for specified chains using keystore
 * Following: https://swapkit.github.io/SwapKit/guides/actions/connecting/
 */
export async function connectWalletsV2(chains: Chain[]): Promise<void> {
  const client = getSwapKitClientV2();
  const phrase = process.env.MNEMONIC;

  if (!phrase) {
    throw new Error("MNEMONIC non configurée dans .env");
  }

  console.log(`🔐 [V2] Connexion des wallets pour: ${chains.join(", ")}`);
  // From docs: await swapKit.connectKeystore([Chain.Ethereum, Chain.Bitcoin], "your twelve word mnemonic phrase here");
  await client.connectKeystore(chains, phrase);
  console.log("✅ [V2] Wallets connectés avec succès");
}

/**
 * Connects ALL keystore-supported chains at once
 * Uses KEYSTORE_SUPPORTED_CHAINS from @swapkit/wallets/keystore
 * Following: https://swapkit.github.io/SwapKit/guides/actions/connecting/
 */
export async function connectAllWalletsV2(): Promise<void> {
  if (walletsConnected) {
    console.log("✅ [V2] Wallets déjà connectés, skip");
    return;
  }

  const client = getSwapKitClientV2();
  const phrase = process.env.MNEMONIC;

  if (!phrase) {
    throw new Error("MNEMONIC non configurée dans .env");
  }

  console.log(`🔐 [V2] Connexion de TOUTES les chaînes keystore supportées...`);
  console.log(`📋 [V2] Chaînes à connecter (${KEYSTORE_SUPPORTED_CHAINS.length}): ${KEYSTORE_SUPPORTED_CHAINS.join(", ")}`);

  try {
    // Following the bun-backend example: swapKit.connectKeystore(KEYSTORE_SUPPORTED_CHAINS, phrase)
    await client.connectKeystore(KEYSTORE_SUPPORTED_CHAINS, phrase);
    walletsConnected = true;
    console.log("✅ [V2] Toutes les chaînes keystore connectées avec succès!");

    // Log addresses for each connected chain
    console.log("\n📍 [V2] Adresses des wallets connectés:");
    for (const chain of KEYSTORE_SUPPORTED_CHAINS) {
      try {
        const address = client.getAddress(chain);
        if (address) {
          console.log(`  ${chain}: ${address}`);
        }
      } catch (e) {
        // Some chains might not have addresses yet, skip silently
      }
    }
  } catch (error) {
    console.error("❌ [V2] Erreur lors de la connexion des wallets:", error);
    throw error;
  }
}

/**
 * Initialize the SwapKit client and connect all wallets
 * This should be called at server startup
 */
export async function initializeSwapKitV2(): Promise<SwapKitClientV2> {
  console.log("\n🚀 [V2] Initialisation du client SwapKit V2...");

  // Create the client
  const client = getSwapKitClientV2();

  // Connect all wallets
  await connectAllWalletsV2();

  console.log("✅ [V2] Client SwapKit V2 initialisé et wallets connectés!\n");

  return client;
}

/**
 * Get the SwapKit API instance for making API calls
 * This is the recommended way to access the API for quotes, prices, etc.
 */
export function getSwapKitApiV2() {
  return SwapKitApi;
}

/**
 * Check if wallets are connected
 */
export function areWalletsConnected(): boolean {
  return walletsConnected;
}

/**
 * Get list of all keystore supported chains
 */
export function getKeystoreSupportedChains(): readonly Chain[] {
  return KEYSTORE_SUPPORTED_CHAINS;
}

/**
 * Clears the cached client (useful for testing or reconnecting)
 */
export function clearClientCacheV2(): void {
  cachedClient = null;
  walletsConnected = false;
  console.log("🗑️ [V2] Cache du client SwapKit vidé");
}

