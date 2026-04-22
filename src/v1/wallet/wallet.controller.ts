import {
  WalletServiceControllerMethods,
  type CreateWalletRequest,
  type CreateWalletResponse,
  type CreditWalletRequest,
  type DebitWalletRequest,
  type GetWalletByIdRequest,
  type GetWalletByUserIdRequest,
  type GetWalletResponse,
  type ListWalletTransactionsRequest,
  type ListWalletTransactionsResponse,
  type ListWithdrawalsRequest,
  type ListWithdrawalsResponse,
  type RequestWithdrawalRequest,
  type RequestWithdrawalResponse,
  type WalletMutationResponse,
  type WalletServiceController,
} from "@/v1/wallet/wallet";
import { WalletService } from '@/v1/wallet/wallet.service';
import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";

@Controller()
@WalletServiceControllerMethods()
export class WalletController implements WalletServiceController {
  constructor(private walletService: WalletService) { }

  @GrpcMethod('WalletService', 'CreateWallet')
  async createWallet(data: CreateWalletRequest): Promise<CreateWalletResponse> {
    return this.walletService.createWallet(data);
  }

  @GrpcMethod('WalletService', 'GetWalletByUserId')
  async getWalletByUserId(data: GetWalletByUserIdRequest): Promise<GetWalletResponse> {
    return this.walletService.getWalletByUserId(data);
  }

  @GrpcMethod('WalletService', 'GetWalletById')
  async getWalletById(data: GetWalletByIdRequest): Promise<GetWalletResponse> {
    return this.walletService.getWalletById(data);
  }

  @GrpcMethod('WalletService', 'CreditWallet')
  async creditWallet(data: CreditWalletRequest): Promise<WalletMutationResponse> {
    return this.walletService.creditWallet(data);
  }

  @GrpcMethod('WalletService', 'DebitWallet')
  async debitWallet(data: DebitWalletRequest): Promise<WalletMutationResponse> {
    return this.walletService.debitWallet(data);
  }

  @GrpcMethod('WalletService', 'ListWalletTransactions')
  async listWalletTransactions(data: ListWalletTransactionsRequest): Promise<ListWalletTransactionsResponse> {
    return this.walletService.listWalletTransactions(data);
  }

  @GrpcMethod('WalletService', 'RequestWithdrawal')
  async requestWithdrawal(data: RequestWithdrawalRequest): Promise<RequestWithdrawalResponse> {
    return this.walletService.requestWithdrawal(data);
  }

  @GrpcMethod('WalletService', 'ListWithdrawals')
  async listWithdrawals(data: ListWithdrawalsRequest): Promise<ListWithdrawalsResponse> {
    return this.walletService.listWithdrawals(data);
  }
}