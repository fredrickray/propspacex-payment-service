import { PaymentProviderService } from "@/v1/payment/providers/provider.service";
import { PaystackProviderService } from "@/v1/payment/providers/paystack-provider.service";
import { Module } from "@nestjs/common";

@Module({
  providers: [PaymentProviderService, PaystackProviderService],
  exports: [PaymentProviderService],
})
export class PaymentProvidersModule { }