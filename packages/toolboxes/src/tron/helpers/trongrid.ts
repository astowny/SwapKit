import { AssetValue, Chain, SwapKitError, warnOnce } from "@swapkit/helpers";
import type { TronGridAccountResponse, TronGridTokenInfo } from "../types.js";

const TRONGRID_API_BASE = "https://api.trongrid.io";

// Cache for token info to avoid repeated API calls
const tokenInfoCache = new Map<string, TronGridTokenInfo>();

/**
 * Fetch account information including TRC20 balances from TronGrid API
 */
export async function fetchAccountFromTronGrid(address: string): Promise<TronGridAccountResponse> {
  try {
    const response = await fetch(`${TRONGRID_API_BASE}/v1/accounts/${address}`);

    if (!response.ok) {
      throw new Error(`TronGrid API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TronGridAccountResponse;

    if (!(data.success && data.data) || data.data.length === 0) {
      throw new Error("Invalid response from TronGrid API");
    }

    return data;
  } catch (error) {
    throw new SwapKitError("toolbox_tron_trongrid_api_error", {
      message: error instanceof Error ? error.message : "Unknown error",
      address,
    });
  }
}

/**
 * Fetch token information from TronGrid API
 */
export async function fetchTokenInfo(contractAddress: string): Promise<TronGridTokenInfo | null> {
  // Check cache first
  if (tokenInfoCache.has(contractAddress)) {
    return tokenInfoCache.get(contractAddress) || null;
  }

  try {
    const response = await fetch(`${TRONGRID_API_BASE}/v1/contracts/${contractAddress}`);

    if (!response.ok) {
      warnOnce(true, `Failed to fetch token info for ${contractAddress}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    const contractData = data.data[0];

    // Extract token info from contract data
    if (contractData.tokenInfo) {
      const tokenInfo: TronGridTokenInfo = {
        symbol: contractData.tokenInfo.symbol || "",
        address: contractAddress,
        decimals: contractData.tokenInfo.decimals || 0,
        name: contractData.tokenInfo.name || "",
        totalSupply: contractData.tokenInfo.totalSupply || "0",
        owner: contractData.tokenInfo.owner || "",
      };

      // Cache the result
      tokenInfoCache.set(contractAddress, tokenInfo);
      return tokenInfo;
    }

    return null;
  } catch (error) {
    warnOnce(
      true,
      `Error fetching token info for ${contractAddress}: ${error instanceof Error ? error.message : error}`,
    );
    return null;
  }
}

/**
 * Convert TronGrid API response to AssetValue array
 */
export async function parseTronGridBalances(accountData: TronGridAccountResponse["data"][0]) {
  const balances: AssetValue[] = [];

  // Add TRX balance
  if (accountData.balance > 0) {
    balances.push(
      AssetValue.from({
        chain: Chain.Tron,
        value: accountData.balance,
        fromBaseDecimal: 6, // TRX has 6 decimals
      }),
    );
  }

  // Add TRC20 balances
  if (accountData.trc20 && Object.keys(accountData.trc20).length > 0) {
    for (const [contractAddress, balance] of Object.entries(accountData.trc20)) {
      if (Number(balance) === 0) continue;

      // Fetch token info to get decimals and symbol
      const tokenInfo = await fetchTokenInfo(contractAddress);

      if (tokenInfo) {
        balances.push(
          AssetValue.from({
            asset: `TRON.${tokenInfo.symbol}-${contractAddress}`,
            value: balance,
            fromBaseDecimal: tokenInfo.decimals,
          }),
        );
      } else {
        // If we can't get token info, skip this token
        warnOnce(true, `Skipping unknown token ${contractAddress} with balance ${balance}`);
      }
    }
  }

  return balances;
}
