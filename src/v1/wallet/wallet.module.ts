import { WalletController } from "@/v1/wallet/wallet.controller";
import { WalletService } from "@/v1/wallet/wallet.service";
import { Module } from "@nestjs/common";

@Module({
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService]
})
export class WalletModule { }