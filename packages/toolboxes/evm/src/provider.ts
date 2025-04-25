import { JsonRpcProvider } from "ethers";
import { ChainToRPC, type EVMChain } from "../../../swapkit/helpers/src/index";

export const getProvider = (chain: EVMChain, customUrl?: string) => {
  return new JsonRpcProvider(customUrl || ChainToRPC[chain]);
};
