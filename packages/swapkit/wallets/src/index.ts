import { bitgetWallet } from "../../../wallets/bitget/src/index";
import { coinbaseWallet } from "../../../wallets/coinbase/src/index";
import { ctrlWallet } from "../../../wallets/ctrl/src/index";
import { evmWallet } from "../../../wallets/evm-extensions/src/index";
import { keepkeyBexWallet } from "../../../wallets/keepkey-bex/src/index";
import { keepkeyWallet } from "../../../wallets/keepkey/src/index";
import { keplrWallet } from "../../../wallets/keplr/src/index";
import { keystoreWallet } from "../../../wallets/keystore/src/index";
import { ledgerWallet } from "../../../wallets/ledger/src/index";
import { okxWallet } from "../../../wallets/okx/src/index";
import { phantomWallet } from "../../../wallets/phantom/src/index";
import { polkadotWallet } from "../../../wallets/polkadotjs/src/index";
import { radixWallet } from "../../../wallets/radix/src/index";
import { talismanWallet } from "../../../wallets/talisman/src/index";
import { trezorWallet } from "../../../wallets/trezor/src/index";
import { walletconnectWallet } from "../../../wallets/wc/src/index";

export const wallets = {
  ...bitgetWallet,
  ...coinbaseWallet,
  ...evmWallet,
  ...keepkeyBexWallet,
  ...keepkeyWallet,
  ...keplrWallet,
  ...keystoreWallet,
  ...ledgerWallet,
  ...okxWallet,
  ...phantomWallet,
  ...polkadotWallet,
  ...radixWallet,
  ...talismanWallet,
  ...trezorWallet,
  ...walletconnectWallet,
  ...ctrlWallet,
};
