import { getSwapKitClient } from "./client";
import { AssetValue } from "@swapkit/sdk";

AssetValue.loadStaticAssets()

export const swapKit = getSwapKitClient();
