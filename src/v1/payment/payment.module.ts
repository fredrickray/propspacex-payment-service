import { PaymentController } from "@/v1/payment/payment.controller";
import { PaymentService } from "@/v1/payment/payment.service";
import { PaymentProvidersModule } from "@/v1/payment/providers/provider.module";
import { Module } from "@nestjs/common";

@Module({
  controllers: [PaymentController],
  providers: [PaymentService],
  imports: [PaymentProvidersModule]
})
export class PaymentModule { }