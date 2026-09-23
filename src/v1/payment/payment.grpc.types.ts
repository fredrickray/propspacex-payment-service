/**
 * Types matching proto/payment/v1/payment.proto — PaymentService (provider RPCs).
 */

import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';

export interface CreatePaymentIntentRequest {
  buyerUserId: string;
  escrowId: string;
  amountMinor: string | number;
  currencyCode: number;
  provider: string;
  email: string;
  callbackUrl: string;
  idempotencyKey: string;
  purpose: number;
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

export interface CreateWalletTopupIntentRequest {
  userId: string;
  amountMinor: string | number;
  currencyCode: number;
  provider: string;
  email: string;
  callbackUrl: string;
  idempotencyKey: string;
}

export interface CreateWalletTopupIntentResponse {
  success: boolean;
  message: string;
  paymentId: string;
  providerReference: string;
  paymentLink: string;
}

export interface VerifyWalletTopupRequest {
  provider: string;
  reference: string;
}

export interface VerifyWalletTopupResponse {
  success: boolean;
  message: string;
  paymentId: string;
  providerReference: string;
  status: string;
  userId: string;
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
  createWalletTopupIntent(
    request: CreateWalletTopupIntentRequest,
  ): Promise<CreateWalletTopupIntentResponse> | CreateWalletTopupIntentResponse;
  verifyWalletTopup(
    request: VerifyWalletTopupRequest,
  ): Promise<VerifyWalletTopupResponse> | VerifyWalletTopupResponse;
}

export function PaymentServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = [
      'createPaymentIntent',
      'verifyPaymentByReference',
      'handleProviderWebhook',
      'createWalletTopupIntent',
      'verifyWalletTopup',
    ];
    for (const method of grpcMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      const protoMethod = method.charAt(0).toUpperCase() + method.slice(1);
      GrpcMethod('PaymentService', protoMethod)(constructor.prototype[method], method, descriptor);
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcStreamMethod('PaymentService', method)(constructor.prototype[method], method, descriptor);
    }
  };
}

export const PAYMENT_SERVICE_GRPC_NAME = 'PaymentService';
