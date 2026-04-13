import { RpcBadRequestError } from "@/common/exceptions/rpc-errors";
import { BasePaymentProviderService } from "@/v1/payment/providers/provider.interface";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Paystack from "paystack-sdk";

@Injectable()
export class PaystackProviderService implements BasePaymentProviderService {
  private paystack: Paystack;
  constructor(@Inject(ConfigService) private configService: ConfigService) { }

  onModuleInit() {
    const secretKey = this.configService.get('paystack.secretKey');

    // this might cause the app to crash if this provider is not used but another provider is used and the secret key is not set
    if (!secretKey || typeof secretKey !== 'string') {
      throw new Error('Paystack secret key is not configured');
    }

    this.paystack = new Paystack(secretKey);
  }

  async createPaymentLink({
    amount, email, currency
  }: {
    amount: number;
    email: string;
    currency: string;
  }) {
    const response = await this.paystack.transaction.initialize({
      amount: amount.toString(),
      email,
      currency,
      callback_url: `${this.configService.get('app.frontendBaseUrl')}/payment/callback`,
      metadata: {
        // cancael_action_url: https://paystack.com/docs/payments/metadata/#cancel-action
        // cancel_action: 
      }
    })

    if (!response.data) {
      throw new RpcBadRequestError(response.message)
    }

    return {
      paymentLink: response.data.authorization_url,
      reference: response.data.reference,
    }
  }
}