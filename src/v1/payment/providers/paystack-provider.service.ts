import { RpcBadRequestError } from "@/common/exceptions/rpc-errors";
import { BasePaymentProviderService } from "@/v1/payment/providers/provider.interface";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "node:crypto";
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
    amount,
    email,
    currency,
    callbackUrl,
    metadata,
  }: {
    amount: number;
    email: string;
    currency: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    const defaultCallback = `${this.configService.get('app.frontendBaseUrl')}/payment/callback`;
    const response = await this.paystack.transaction.initialize({
      amount: amount.toString(),
      email,
      currency,
      callback_url: callbackUrl || defaultCallback,
      metadata: metadata ?? {},
    });

    if (!response.data) {
      throw new RpcBadRequestError(response.message)
    }

    return {
      paymentLink: response.data.authorization_url,
      reference: response.data.reference,
    };
  }

  async verifyTransaction(reference: string) {
    const response = await this.paystack.transaction.verify({ reference });
    const data = response.data as
      | {
          status?: string;
          amount?: number;
          currency?: string;
          metadata?: Record<string, unknown>;
        }
      | undefined;
    if (!data) {
      throw new RpcBadRequestError(response.message || 'Verification failed');
    }
    return {
      status: (data.status ?? '').toLowerCase(),
      amountMinor: typeof data.amount === 'number' ? data.amount : 0,
      currency: (data.currency ?? '').toUpperCase(),
      metadata: data.metadata,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const secret = this.configService.get<string>('paystack.secretKey');
    if (!secret || !signatureHeader) {
      return false;
    }
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    return hash === signatureHeader;
  }
}