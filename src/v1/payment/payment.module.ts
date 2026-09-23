import { PaymentController } from "@/v1/payment/payment.controller";
import { PaymentService } from "@/v1/payment/payment.service";
import { PaymentProvidersModule } from "@/v1/payment/providers/provider.module";
import { EscrowModule } from "@/v1/escrow/escrow.module";
import { WalletModule } from "@/v1/wallet/wallet.module";
import { Module } from "@nestjs/common";

@Module({
  controllers: [PaymentController],
  providers: [PaymentService],
  imports: [PaymentProvidersModule, EscrowModule, WalletModule],
  exports: [PaymentService],
})
export class PaymentModule { }