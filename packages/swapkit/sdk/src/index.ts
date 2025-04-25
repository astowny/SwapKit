import { ChainflipPlugin } from "../../../plugins/chainflip/src/index";
import { EVMPlugin } from "../../../plugins/evm/src/index";
import { KadoPlugin } from "../../../plugins/kado/src/index";
import { RadixPlugin } from "../../../plugins/radix/src/index";
import { MayachainPlugin, ThorchainPlugin } from "../../../plugins/thorchain/src/index";
import {
  type PluginsType,
  SwapKit,
  type SwapKitParams,
  type WalletsType,
} from "../../core/src/index";
import { wallets as defaultWallets } from "../../wallets/src/index";

export * from "../../core/src/index";
export { getTokenIcon, tokenLists } from "../../tokens/src/index";

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

export { SwapKitApi } from "../../api/src/index";
