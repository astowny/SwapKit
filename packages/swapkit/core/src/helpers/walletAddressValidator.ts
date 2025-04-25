import { Chain } from "../../../helpers/src/index";

export async function getAddressValidator() {
  const { cosmosValidateAddress } = await import("../../../../toolboxes/cosmos/src/index");
  const { evmValidateAddress } = await import("../../../../toolboxes/evm/src/index");
  const { substrateValidateAddress } = await import("../../../../toolboxes/substrate/src/index");
  const { utxoValidateAddress } = await import("../../../../toolboxes/utxo/src/index");
  const { validateAddress: solanaValidateAddress } = await import(
    "../../../../toolboxes/solana/src/index"
  );
  const { validateAddress: validateRadixAddress } = await import(
    "../../../../toolboxes/radix/src/index"
  );

  return function validateAddress({ address, chain }: { address: string; chain: Chain }) {
    switch (chain) {
      case Chain.Arbitrum:
      case Chain.Avalanche:
      case Chain.Optimism:
      case Chain.BinanceSmartChain:
      case Chain.Base:
      case Chain.Polygon:
      case Chain.Ethereum:
        return evmValidateAddress({ address });

      case Chain.Litecoin:
      case Chain.Dash:
      case Chain.Dogecoin:
      case Chain.BitcoinCash:
      case Chain.Bitcoin:
        return utxoValidateAddress({ address, chain });

      case Chain.Cosmos:
      case Chain.Kujira:
      case Chain.Maya:
      case Chain.THORChain: {
        return cosmosValidateAddress({ address, chain });
      }

      case Chain.Polkadot: {
        return substrateValidateAddress({ address, chain });
      }

      case Chain.Radix: {
        return validateRadixAddress(address);
      }

      case Chain.Solana: {
        return solanaValidateAddress(address);
      }

      default:
        return false;
    }
  };
}
