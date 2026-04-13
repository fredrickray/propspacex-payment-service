import { OnModuleInit } from "@nestjs/common";

export interface BasePaymentProviderService extends OnModuleInit {
  createPaymentLink(data: {
    amount: number;
    email: string;
    currency: string;
  }): Promise<{
    paymentLink: string;
    reference: string;
  }>;
}