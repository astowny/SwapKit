import { ChainflipPlugin } from "@swapkit/plugin-chainflip";
import { EVMPlugin } from "@swapkit/plugin-evm";
import { KadoPlugin } from "@swapkit/plugin-kado";
import { RadixPlugin } from "@swapkit/plugin-radix";
import { MayachainPlugin, ThorchainPlugin } from "@swapkit/plugin-thorchain";
import { wallets as defaultWallets } from "@swapkit/wallets";
import { type PluginsType, SwapKit, type SwapKitParams, type WalletsType } from "../../core/src";

export * from "../../core/src/index";
export { getTokenIcon, tokenLists } from "@swapkit/tokens";

export const defaultPlugins = {
  ...ChainflipPlugin,
  ...EVMPlugin,
  ...KadoPlugin,
  ...MayachainPlugin,
  ...ThorchainPlugin,
  ...RadixPlugin,
};

export const createSwapKit = <
  P extends PluginsType = typeof defaultPlugins,
  W extends WalletsType = typeof defaultWallets,
>({
  plugins,
  wallets,
  ...extendParams
}: SwapKitParams<P, W> = {}) => {
  return SwapKit<P, W>({
    ...extendParams,
    wallets: (wallets || defaultWallets) as W,
    plugins: (plugins || defaultPlugins) as P,
  });
};

export { SwapKitApi } from "@swapkit/api";
