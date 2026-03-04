import { RpcExistsError, RpcNotFoundError } from "@/common/exceptions/rpc-errors";
import { paymentsTable } from "@/database/schemas";
import { type DrizzleDatabaseType } from "@/database/types";
import { DRIZZLE_SERVICE_TAG } from "@/drizzle/drizzle.definition";
import { PaymentProvider, PaymentStatus } from "@/v1/payment/payment.const";
import { PaymentMapper } from "@/v1/payment/payment.mapper";
import { PaymentProviderService } from "@/v1/payment/providers/provider.service";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

@Injectable()
export class PaymentService {
  constructor(@Inject(DRIZZLE_SERVICE_TAG) private drizzleClient: DrizzleDatabaseType, @Inject(PaymentProviderService) private paymentProviderService: PaymentProviderService) {}

  async createPayment(data: {
    userId: string,
    propertyId: string,
    idempotencyKey: string,
    currencyCode: string,
    provider: PaymentProvider,
  }) {
    const existingPayment = await this.drizzleClient.query.paymentsTable.findFirst({
      where: and(
        eq(paymentsTable.buyerId, data.userId),
        eq(paymentsTable.propertyId, data.propertyId),
        eq(paymentsTable.idempotencyKey, data.idempotencyKey),
        eq(paymentsTable.provider, data.provider),
      )
    })

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.SUCCESS) {
        throw new RpcExistsError('Payment already completed');
      }

      return PaymentMapper.toCreatePaymentResponse(existingPayment);
    }

    // get user from user service
    // const property = await
    // get property from property service
    // const property = await

    const amount = 100 * 1200;
    const email = 'test@test.com';

    const paymentData = await this.paymentProviderService.createPaymentLink(data.provider, {
      amount,
      currency: data.currencyCode.toLowerCase(),
      email,
    })
    
    const [paymentIntent] = await this.drizzleClient.insert(paymentsTable).values({
      amount,
      buyerId: data.userId,
      idempotencyKey: data.idempotencyKey,
      paymentLink: paymentData.paymentLink,
      propertyId: data.propertyId,
      provider: data.provider,
      providerReference: paymentData.reference,
      currencyCode: data.currencyCode,
    }).onConflictDoNothing().returning();

    if (!paymentIntent) {
      throw new RpcExistsError('Payment already exists');
    }

    return PaymentMapper.toCreatePaymentResponse(paymentIntent);
  }

  async getPaymentByReference(data: {
    reference: string,
  }) {
    const payment = await this.drizzleClient.query.paymentsTable.findFirst({
      where: eq(paymentsTable.providerReference, data.reference),
      with: {
        currency: true,
      }
    })

    if (!payment) {
      throw new RpcNotFoundError('Payment not found');
    }

    return PaymentMapper.toResponse(payment);
  }
}