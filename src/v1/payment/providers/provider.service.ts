import { PaymentProvider } from "@/v1/payment/payment.const";
import { PaystackProviderService } from "@/v1/payment/providers/paystack-provider.service";
import { BasePaymentProviderService } from "@/v1/payment/providers/provider.interface";
import { Inject, Injectable } from "@nestjs/common";

@Injectable()
export class PaymentProviderService {
  private providers: Map<PaymentProvider, BasePaymentProviderService> = new Map();

  constructor(@Inject(PaystackProviderService) private paystackProviderService: PaystackProviderService) {
    this.providers.set(PaymentProvider.PAYSTACK, this.paystackProviderService);
  }

  private getProvider(provider: PaymentProvider) {
    return this.providers.get(provider)!;
  }

  createPaymentLink(provider: PaymentProvider, data: {
    amount: number;
    email: string;
    currency: string;
  }) {
    return this.getProvider(provider).createPaymentLink(data)
  }
}