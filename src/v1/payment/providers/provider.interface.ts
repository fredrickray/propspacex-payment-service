import { OnModuleInit } from "@nestjs/common";

export interface BasePaymentProviderService extends OnModuleInit {
  createPaymentLink(data: {
    amount: number;
    email: string;
    currency: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    paymentLink: string;
    reference: string;
  }>;

  verifyTransaction(reference: string): Promise<{
    status: string;
    amountMinor: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }>;

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
}