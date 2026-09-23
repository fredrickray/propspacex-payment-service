import {
  PaymentServiceControllerMethods,
  type CreatePaymentIntentRequest,
  type CreatePaymentIntentResponse,
  type CreateWalletTopupIntentRequest,
  type CreateWalletTopupIntentResponse,
  type HandleProviderWebhookRequest,
  type HandleProviderWebhookResponse,
  type PaymentServiceController,
  type VerifyPaymentByReferenceRequest,
  type VerifyPaymentByReferenceResponse,
  type VerifyWalletTopupRequest,
  type VerifyWalletTopupResponse,
} from '@/v1/payment/payment.grpc.types';
import { PaymentService } from '@/v1/payment/payment.service';
import { Controller } from '@nestjs/common';

@Controller()
@PaymentServiceControllerMethods()
export class PaymentController implements PaymentServiceController {
  constructor(private readonly paymentService: PaymentService) {}

  async createPaymentIntent(data: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    return this.paymentService.createPaymentIntent(data);
  }

  async verifyPaymentByReference(
    data: VerifyPaymentByReferenceRequest,
  ): Promise<VerifyPaymentByReferenceResponse> {
    return this.paymentService.verifyPaymentByReference(data);
  }

  async handleProviderWebhook(
    data: HandleProviderWebhookRequest,
  ): Promise<HandleProviderWebhookResponse> {
    return this.paymentService.handleProviderWebhook(data);
  }

  async createWalletTopupIntent(
    data: CreateWalletTopupIntentRequest,
  ): Promise<CreateWalletTopupIntentResponse> {
    return this.paymentService.createWalletTopupIntent(data);
  }

  async verifyWalletTopup(data: VerifyWalletTopupRequest): Promise<VerifyWalletTopupResponse> {
    return this.paymentService.verifyWalletTopup(data);
  }
}