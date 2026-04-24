/**
 * Types matching proto/payment/v1/payment.proto — PaymentService (provider RPCs).
 */

import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';

export interface CreatePaymentIntentRequest {
  buyerUserId: string;
  escrowId: string;
  amountMinor: number;
  currencyCode: number;
  provider: string;
  email: string;
  callbackUrl: string;
  idempotencyKey: string;
}

export interface CreatePaymentIntentResponse {
  success: boolean;
  message: string;
  paymentId: string;
  providerReference: string;
  paymentLink: string;
}

export interface VerifyPaymentByReferenceRequest {
  provider: string;
  reference: string;
}

export interface VerifyPaymentByReferenceResponse {
  success: boolean;
  message: string;
  paymentId: string;
  providerReference: string;
  status: string;
  escrowId: string;
}

export interface HandleProviderWebhookRequest {
  provider: string;
  signature: string;
  event: string;
  payloadJson: string;
}

export interface HandleProviderWebhookResponse {
  success: boolean;
  message: string;
}

export interface PaymentServiceController {
  createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<CreatePaymentIntentResponse> | CreatePaymentIntentResponse;
  verifyPaymentByReference(
    request: VerifyPaymentByReferenceRequest,
  ): Promise<VerifyPaymentByReferenceResponse> | VerifyPaymentByReferenceResponse;
  handleProviderWebhook(
    request: HandleProviderWebhookRequest,
  ): Promise<HandleProviderWebhookResponse> | HandleProviderWebhookResponse;
}

export function PaymentServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = ['createPaymentIntent', 'verifyPaymentByReference', 'handleProviderWebhook'];
    for (const method of grpcMethods) {
      const descriptor: unknown = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      const protoMethod = method.charAt(0).toUpperCase() + method.slice(1);
      GrpcMethod('PaymentService', protoMethod)(constructor.prototype[method], method, descriptor);
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: unknown = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcStreamMethod('PaymentService', method)(constructor.prototype[method], method, descriptor);
    }
  };
}

export const PAYMENT_SERVICE_GRPC_NAME = 'PaymentService';
