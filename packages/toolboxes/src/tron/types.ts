import type {
  DerivationPathArray,
  GenericCreateTransactionParams,
  GenericTransferParams,
} from "@swapkit/helpers";
import type { Contract, Types } from "tronweb";

// Re-export TronWeb types for convenience
export type TronTransaction = Types.Transaction;
export type TronContract = Contract;
export type TronSignedTransaction = Types.SignedTransaction;

// Signer interface compatible with TronWeb and wallet implementations
export interface TronSigner {
  getAddress(): Promise<string>;
  signTransaction(transaction: TronTransaction): Promise<TronSignedTransaction>;
}

export type TronToolboxOptions =
  | { signer?: TronSigner }
  | { phrase?: string; derivationPath?: DerivationPathArray; index?: number }
  | {};

export interface TronTransferParams extends GenericTransferParams {
  // No additional fields needed - all inherited from GenericTransferParams
}

export interface TronCreateTransactionParams
  extends Omit<GenericCreateTransactionParams, "feeRate"> {
  // No additional fields needed - all inherited from GenericCreateTransactionParams
}

// TronGrid API Types
export interface TronGridTRC20Balance {
  [contractAddress: string]: string; // Balance as string
}

export interface TronGridAccountResponse {
  data: Array<{
    address: string;
    balance: number; // TRX balance in SUN
    create_time: number;
    latest_operation_time: number;
    free_net_usage: number;
    net_usage: number;
    trc20: TronGridTRC20Balance;
    // Other fields exist but we only need these
  }>;
  success: boolean;
  meta: {
    at: number;
    page_size: number;
  };
}

export interface TronGridTokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  name: string;
  totalSupply: string;
  owner: string;
}
