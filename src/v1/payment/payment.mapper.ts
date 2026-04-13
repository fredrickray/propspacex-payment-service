import { CurrencyMapper } from "@/common/mappers";
import { PaymentDtoType } from "@/database/schemas";

export class PaymentMapper {
  static toResponse(payment: PaymentDtoType) {
    const currency = payment.currency ? CurrencyMapper.toResponse(payment.currency) : undefined;

    return {
      id: payment.id,
      buyerId: payment.buyerId,
      propertyId: payment.propertyId,
      amount: payment.currency?.exponent ? payment.amount / payment.currency.exponent : payment.amount,
      currency,
      provider: {
        name: payment.provider,
        reference: payment.providerReference,
      },
      status: payment.status,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      completedAt: payment.completedAt,
      failedAt: payment.failedAt,
      cancelledAt: payment.cancelledAt,
    }
  }

  static toCreatePaymentResponse(payment: Pick<PaymentDtoType, 'id' | 'providerReference' | 'paymentLink'>) {
    return { id: payment.id, reference: payment.providerReference, paymentLink: payment.paymentLink }
  }
}