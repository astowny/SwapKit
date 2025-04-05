import type { EVMTransaction, QuoteResponseRoute } from "@swapkit/api";
import {
  ApproveMode,
  type ApproveReturnType,
  AssetValue,
  type EVMChain,
  EVMChains,
  ProviderName,
  SwapKitError,
  type SwapKitPluginParams,
  type SwapParams,
} from "@swapkit/helpers";

type ApproveParams = {
  assetValue: AssetValue;
  spenderAddress: string;
};

function plugin({ getWallet }: SwapKitPluginParams) {
  async function swap({ route, feeOptionKey }: SwapParams<"evm", QuoteResponseRoute>) {
    const { tx, sellAsset } = route;

    console.log(`\n[DEBUG] Création d'AssetValue pour l'asset: ${sellAsset}`);
    console.log(`[DEBUG] Vérification si @swapkit/tokens est installé...`);

    let assetValue;
    let evmChain;
    let wallet;

    try {
      // Essayer de charger les assets statiques directement
      console.log(`[DEBUG] Chargement des assets statiques...`);
      await AssetValue.loadStaticAssets();
      console.log(`[DEBUG] Assets statiques chargés avec succès`);

      console.log(`[DEBUG] Création de l'AssetValue avec asyncTokenLookup: true`);
      assetValue = await AssetValue.from({
        asset: sellAsset,
        asyncTokenLookup: true,
      });

      console.log(`[DEBUG] AssetValue créé avec succès:`);
      console.log(`[DEBUG] - Chain: ${assetValue.chain}`);
      console.log(`[DEBUG] - Symbol: ${assetValue.symbol}`);
      console.log(`[DEBUG] - Decimals: ${assetValue.decimal}`);
      console.log(`[DEBUG] - Address: ${assetValue.address || "N/A"}`);

      evmChain = assetValue.chain as EVMChain;
      console.log(`[DEBUG] Chain EVM détectée: ${evmChain}`);

      wallet = getWallet(evmChain);
      console.log(`[DEBUG] Portefeuille récupéré: ${wallet ? "OK" : "NON TROUVÉ"}`);
    } catch (error) {
      console.error(`[DEBUG] ERREUR lors de la création de l'AssetValue:`, error);
      throw error;
    }

    if (!(EVMChains.includes(evmChain) && tx)) throw new SwapKitError("core_swap_invalid_params");

    const { from, to, data, value } = tx as EVMTransaction;
    return wallet.sendTransaction({ from, to, data, value: BigInt(value) }, feeOptionKey);
  }

  /**
   * @Private
   * Wallet interaction helpers
   */
  function approve<T extends ApproveMode>({
    assetValue,
    spenderAddress,
    type = "checkOnly" as T,
  }: { type: T; spenderAddress: string; assetValue: AssetValue }) {
    const { address, chain, isGasAsset, isSynthetic } = assetValue;
    const isEVMChain = EVMChains.includes(chain as EVMChain);
    const isNativeEVM = isEVMChain && isGasAsset;

    if (isNativeEVM || !isEVMChain || isSynthetic) {
      return Promise.resolve(type === "checkOnly" ? true : "approved") as ApproveReturnType<T>;
    }

    const wallet = getWallet(chain as EVMChain);

    if (!wallet) {
      throw new SwapKitError("core_wallet_connection_not_found");
    }

    const walletAction = type === "checkOnly" ? wallet.isApproved : wallet.approve;
    const from = wallet.address;

    if (!(address && from)) {
      throw new SwapKitError("core_approve_asset_address_or_from_not_found");
    }

    return walletAction({
      amount: assetValue.getBaseValue("bigint"),
      assetAddress: address,
      from,
      spenderAddress,
    });
  }

  function approveAssetValue(params: ApproveParams) {
    return approve({ ...params, type: ApproveMode.Approve });
  }

  function isAssetValueApproved(params: ApproveParams) {
    return approve({ ...params, type: ApproveMode.CheckOnly });
  }

  return {
    swap,
    approveAssetValue,
    isAssetValueApproved,
    supportedSwapkitProviders: [
      ProviderName.CAMELOT_V3,
      ProviderName.OPENOCEAN_V2,
      ProviderName.ONEINCH,
      ProviderName.PANCAKESWAP,
      ProviderName.PANGOLIN_V1,
      ProviderName.SUSHISWAP_V2,
      ProviderName.TRADERJOE_V2,
      ProviderName.UNISWAP_V2,
      ProviderName.UNISWAP_V3,
    ],
  };
}

export const EVMPlugin = { evm: { plugin } } as const;
