import { getSwapKitClient } from "./client";
import { AssetValue } from "../../sdk/src/index";

AssetValue.loadStaticAssets()

export const swapKit = getSwapKitClient();
