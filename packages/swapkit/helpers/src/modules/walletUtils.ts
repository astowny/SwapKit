import type { Chain } from "../types/chains";
import type { WalletOption } from "../types/wallet";
import { SwapKitError } from "./swapKitError";

export function filterSupportedChains<T extends Chain>(
  chains: Chain[],
  supportedChains: readonly T[],
  walletOption: WalletOption,
) {
  // S'assurer que chains est un tableau
  const chainsArray = Array.isArray(chains) ? chains : [chains];
  // console.log('chainsArray', chainsArray)

  const supported = chainsArray.filter((chain): chain is T => supportedChains.includes(chain as T));
  // console.log('supported', supported)

  if (supported.length === 0) {
    throw new SwapKitError("wallet_chain_not_supported", {
      wallet: walletOption,
      chain: chainsArray.join(", "),
    });
  }

  const unsupported = chainsArray.filter((chain) => !supportedChains.includes(chain as T));
  // console.log('unsupported', unsupported)

  if (unsupported.length > 0) {
    console.warn(
      `${walletOption} wallet does not support the following chains: ${unsupported.join(
        ", ",
      )}. These chains will be ignored.`,
    );
  }

  return supported;
}
