import { WalletServiceControllerMethods, type CreateWalletReq, type CreateWalletRes, type GetWalletByIdReq, type GetWalletByUserIdReq, type WalletResponseType, type WalletServiceController } from "@/v1/wallet/wallet";
import { WalletService } from '@/v1/wallet/wallet.service';
import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";

@Controller()
@WalletServiceControllerMethods()
export class WalletController implements WalletServiceController {
  constructor(private walletService: WalletService) { }

  @GrpcMethod('WalletService', 'CreateWallet')
  async createWallet(data: CreateWalletReq): Promise<CreateWalletRes> {
    return this.walletService.createWallet(data);
  }

  @GrpcMethod('WalletService', 'GetWalletByUserId')
  async getWalletByUserId(data: GetWalletByUserIdReq): Promise<WalletResponseType> {
    return this.walletService.getWalletByUserId(data);
  }

  @GrpcMethod('WalletService', 'GetWalletById')
  async getWalletById(data: GetWalletByIdReq): Promise<WalletResponseType> {
    return this.walletService.getWalletById(data);
  }
}