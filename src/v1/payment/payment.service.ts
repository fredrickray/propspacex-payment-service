import {
  RpcBadRequestError,
  RpcExistsError,
  RpcNotFoundError,
  RpcPreconditionFailedError,
} from '@/common/exceptions/rpc-errors';
import { escrowsTable, grpcIdempotencyTable, paymentsTable } from '@/database/schemas';
import { type DrizzleDatabaseType } from '@/database/types';
import { DRIZZLE_SERVICE_TAG } from '@/drizzle/drizzle.definition';
import { EscrowDbStatus, IdempotencyScope } from '@/v1/escrow/escrow.const';
import { EscrowService } from '@/v1/escrow/escrow.service';
import { PaymentProvider, PaymentPurpose, PaymentStatus } from '@/v1/payment/payment.const';
import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  CreateWalletTopupIntentRequest,
  CreateWalletTopupIntentResponse,
  HandleProviderWebhookRequest,
  HandleProviderWebhookResponse,
  VerifyPaymentByReferenceRequest,
  VerifyPaymentByReferenceResponse,
  VerifyWalletTopupRequest,
  VerifyWalletTopupResponse,
} from '@/v1/payment/payment.grpc.types';
import { PaymentProviderService } from '@/v1/payment/providers/provider.service';
import { CurrencyCodeFromProto } from '@/v1/wallet/wallet.const';
import { WalletService } from '@/v1/wallet/wallet.service';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

type PaystackChargePayload = {
  event?: string;
  data?: {
    id?: number;
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: { escrow_id?: string; payment_id?: string; [k: string]: unknown };
  };
};

@Injectable()
export class PaymentService {
  constructor(
    @Inject(DRIZZLE_SERVICE_TAG) private readonly drizzleClient: DrizzleDatabaseType,
    @Inject(PaymentProviderService) private readonly paymentProviderService: PaymentProviderService,
    @Inject(EscrowService) private readonly escrowService: EscrowService,
    @Inject(WalletService) private readonly walletService: WalletService,
  ) {}

  private isUniqueViolation(e: unknown): boolean {
    return Boolean(e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505');
  }

  private async findIdempotency(scope: string, key: string) {
    return this.drizzleClient.query.grpcIdempotencyTable.findFirst({
      where: and(eq(grpcIdempotencyTable.scope, scope), eq(grpcIdempotencyTable.idempotencyKey, key)),
    });
  }

  private parseProvider(name: string): PaymentProvider {
    const n = (name ?? '').toLowerCase().trim();
    if (n === PaymentProvider.PAYSTACK) {
      return PaymentProvider.PAYSTACK;
    }
    throw new RpcBadRequestError('Unsupported provider');
  }

  private parseAmountMinor(
    input: string | number | { toString: () => string },
    label: string,
  ): number {
    const raw =
      typeof input === 'number'
        ? input
        : typeof input === 'string'
          ? Number(input)
          : Number(input?.toString?.());
    if (!Number.isFinite(raw) || raw <= 0) {
      throw new RpcBadRequestError(`${label} must be a positive integer in minor units`);
    }
    if (!Number.isSafeInteger(raw)) {
      throw new RpcBadRequestError(`${label} exceeds safe integer range`);
    }
    return Math.trunc(raw);
  }

  private parsePaymentPurpose(value: number): PaymentPurpose {
    if (value === 2) {
      return PaymentPurpose.WALLET_TOPUP;
    }
    return PaymentPurpose.ESCROW_FUNDING;
  }

  private async settleSuccessfulPayment(
    tx: DrizzleDatabaseType,
    payment: typeof paymentsTable.$inferSelect,
  ): Promise<void> {
    if (payment.purpose === PaymentPurpose.WALLET_TOPUP) {
      await this.walletService.ledgerCreditAvailable(tx, {
        userId: payment.buyerId,
        amountMinor: payment.amount,
        referenceType: 'payment',
        referenceId: payment.providerReference,
        entryType: 'topup',
        note: 'Wallet topup settled via provider',
      });
      return;
    }

    if (payment.escrowId) {
      await this.escrowService.applyExternalFundingInTx(tx, {
        escrowId: payment.escrowId,
        buyerUserId: payment.buyerId,
        amountMinor: payment.amount,
        paymentReference: payment.providerReference,
      });
    }
  }

  async createPaymentIntent(req: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    if (!req.idempotencyKey) {
      throw new RpcBadRequestError('idempotency_key is required');
    }
    const provider = this.parseProvider(req.provider);
    const purpose = this.parsePaymentPurpose(req.purpose);
    const currencyCode = CurrencyCodeFromProto[req.currencyCode];
    if (!currencyCode) {
      throw new RpcBadRequestError('Invalid currency_code');
    }
    const amountMinor = this.parseAmountMinor(req.amountMinor, 'amount_minor');

    const existingIdem = await this.findIdempotency(IdempotencyScope.CREATE_PAYMENT_INTENT, req.idempotencyKey);
    if (existingIdem) {
      const payment = await this.drizzleClient.query.paymentsTable.findFirst({
        where: eq(paymentsTable.id, Number(existingIdem.resourceId)),
      });
      if (!payment) {
        throw new RpcNotFoundError('Payment not found for idempotency replay');
      }
      return {
        success: true,
        message: 'Idempotent replay',
        paymentId: payment.id.toString(),
        providerReference: payment.providerReference,
        paymentLink: payment.paymentLink,
      };
    }

    let escrow: typeof escrowsTable.$inferSelect | undefined;
    if (purpose === PaymentPurpose.ESCROW_FUNDING) {
      escrow = await this.drizzleClient.query.escrowsTable.findFirst({
        where: eq(escrowsTable.id, req.escrowId),
      });
      if (!escrow) {
        throw new RpcNotFoundError('Escrow not found');
      }
      if (escrow.buyerUserId !== req.buyerUserId) {
        throw new RpcPreconditionFailedError('buyer_user_id does not match escrow buyer');
      }
      if (escrow.amountMinor !== amountMinor) {
        throw new RpcBadRequestError('amount_minor must match escrow amount');
      }
      if (escrow.currencyCode !== currencyCode) {
        throw new RpcBadRequestError('currency does not match escrow');
      }
      if (escrow.fundedAt) {
        throw new RpcPreconditionFailedError('Escrow is already funded');
      }
      if (escrow.status !== EscrowDbStatus.HELD) {
        throw new RpcPreconditionFailedError('Escrow is not awaiting payment funding');
      }
    } else if (!req.buyerUserId) {
      throw new RpcBadRequestError('buyer_user_id is required');
    }

    const email = (req.email ?? '').trim();
    if (!email) {
      throw new RpcBadRequestError('email is required');
    }

    const linkData = await this.paymentProviderService.createPaymentLink(provider, {
      amount: amountMinor,
      email,
      currency: currencyCode.toUpperCase(),
      callbackUrl: req.callbackUrl || undefined,
      metadata: {
        escrow_id: escrow?.id,
        purpose,
        buyer_user_id: req.buyerUserId,
      },
    });

    try {
      return await this.drizzleClient.transaction(async (tx) => {
        const [paymentIntent] = await tx
          .insert(paymentsTable)
          .values({
            amount: amountMinor,
            buyerId: req.buyerUserId,
            idempotencyKey: req.idempotencyKey,
            paymentLink: linkData.paymentLink,
            propertyId: escrow?.propertyId ?? null,
            escrowId: escrow?.id ?? null,
            provider,
            purpose,
            providerReference: linkData.reference,
            currencyCode,
          })
          .returning();

        if (!paymentIntent) {
          throw new RpcExistsError('Payment intent could not be created');
        }

        await tx.insert(grpcIdempotencyTable).values({
          scope: IdempotencyScope.CREATE_PAYMENT_INTENT,
          idempotencyKey: req.idempotencyKey,
          resourceId: paymentIntent.id.toString(),
        });

        return {
          success: true,
          message: 'Payment intent created',
          paymentId: paymentIntent.id.toString(),
          providerReference: paymentIntent.providerReference,
          paymentLink: paymentIntent.paymentLink,
        };
      });
    } catch (e: unknown) {
      if (this.isUniqueViolation(e)) {
        const row = await this.findIdempotency(IdempotencyScope.CREATE_PAYMENT_INTENT, req.idempotencyKey);
        if (row) {
          const payment = await this.drizzleClient.query.paymentsTable.findFirst({
            where: eq(paymentsTable.id, Number(row.resourceId)),
          });
          if (payment) {
            return {
              success: true,
              message: 'Idempotent replay',
              paymentId: payment.id.toString(),
              providerReference: payment.providerReference,
              paymentLink: payment.paymentLink,
            };
          }
        }
      }
      throw e;
    }
  }

  async verifyPaymentByReference(req: VerifyPaymentByReferenceRequest): Promise<VerifyPaymentByReferenceResponse> {
    const provider = this.parseProvider(req.provider);
    const reference = (req.reference ?? '').trim();
    if (!reference) {
      throw new RpcBadRequestError('reference is required');
    }

    const idemKey = `${provider}:${reference}`;
    const existing = await this.findIdempotency(IdempotencyScope.VERIFY_PAYMENT, idemKey);
    if (existing) {
      const payment = await this.drizzleClient.query.paymentsTable.findFirst({
        where: eq(paymentsTable.providerReference, reference),
      });
      if (!payment) {
        throw new RpcNotFoundError('Payment not found');
      }
      return {
        success: true,
        message: 'Idempotent replay',
        paymentId: payment.id.toString(),
        providerReference: payment.providerReference,
        status: payment.status,
        escrowId: payment.escrowId ?? '',
      };
    }

    const remote = await this.paymentProviderService.verifyTransaction(provider, reference);

    const payment = await this.drizzleClient.query.paymentsTable.findFirst({
      where: eq(paymentsTable.providerReference, reference),
    });
    if (!payment) {
      throw new RpcNotFoundError('Payment not found');
    }

    if (remote.status !== 'success') {
      return {
        success: true,
        message: 'Provider reports non-success',
        paymentId: payment.id.toString(),
        providerReference: payment.providerReference,
        status: remote.status || PaymentStatus.PENDING,
        escrowId: payment.escrowId ?? '',
      };
    }

    await this.drizzleClient.transaction(async (tx) => {
      const transitioned = await tx
        .update(paymentsTable)
        .set({
          status: PaymentStatus.SUCCESS,
          completedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, PaymentStatus.PENDING)))
        .returning({ id: paymentsTable.id });

      if (transitioned.length > 0) {
        await this.settleSuccessfulPayment(tx, payment);
      }

      await tx
        .insert(grpcIdempotencyTable)
        .values({
          scope: IdempotencyScope.VERIFY_PAYMENT,
          idempotencyKey: idemKey,
          resourceId: payment.id.toString(),
        })
        .onConflictDoNothing({
          target: [grpcIdempotencyTable.scope, grpcIdempotencyTable.idempotencyKey],
        });
    });

    const finalRow = await this.drizzleClient.query.paymentsTable.findFirst({
      where: eq(paymentsTable.id, payment.id),
    });

    return {
      success: true,
      message: 'OK',
      paymentId: payment.id.toString(),
      providerReference: payment.providerReference,
      status: finalRow?.status ?? PaymentStatus.SUCCESS,
      escrowId: finalRow?.escrowId ?? '',
    };
  }

  async handleProviderWebhook(req: HandleProviderWebhookRequest): Promise<HandleProviderWebhookResponse> {
    const provider = this.parseProvider(req.provider);
    const raw = req.payloadJson ?? '';
    const okSig = this.paymentProviderService.verifyWebhookSignature(provider, raw, req.signature ?? '');
    if (!okSig) {
      throw new RpcPreconditionFailedError('Invalid webhook signature');
    }

    let parsed: PaystackChargePayload;
    try {
      parsed = JSON.parse(raw) as PaystackChargePayload;
    } catch {
      throw new RpcBadRequestError('Invalid payload_json');
    }

    const event = (req.event || parsed.event || '').toLowerCase();
    const reference = parsed.data?.reference;
    if (!reference) {
      return { success: true, message: 'No reference in payload' };
    }

    const idemKey = `${provider}:webhook:${parsed.data?.id ?? reference}:${event}`;
    const seen = await this.findIdempotency(IdempotencyScope.WEBHOOK_PAYMENT, idemKey);
    if (seen) {
      return { success: true, message: 'Duplicate webhook ignored' };
    }

    if (event !== 'charge.success') {
      return { success: true, message: `Ignored event ${event}` };
    }

    const payment = await this.drizzleClient.query.paymentsTable.findFirst({
      where: eq(paymentsTable.providerReference, reference),
    });
    if (!payment) {
      return { success: true, message: 'Payment row not found — acknowledged' };
    }

    await this.drizzleClient.transaction(async (tx) => {
      const transitioned = await tx
        .update(paymentsTable)
        .set({
          status: PaymentStatus.SUCCESS,
          rawProviderPayload: parsed as object,
          completedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, PaymentStatus.PENDING)))
        .returning({ id: paymentsTable.id });

      if (transitioned.length > 0) {
        await this.settleSuccessfulPayment(tx, payment);
      }

      await tx
        .insert(grpcIdempotencyTable)
        .values({
          scope: IdempotencyScope.WEBHOOK_PAYMENT,
          idempotencyKey: idemKey,
          resourceId: payment.id.toString(),
        })
        .onConflictDoNothing({
          target: [grpcIdempotencyTable.scope, grpcIdempotencyTable.idempotencyKey],
        });
    });

    return { success: true, message: 'Webhook processed' };
  }

  async createWalletTopupIntent(
    req: CreateWalletTopupIntentRequest,
  ): Promise<CreateWalletTopupIntentResponse> {
    if (!req.idempotencyKey) {
      throw new RpcBadRequestError('idempotency_key is required');
    }
    if (!req.userId) {
      throw new RpcBadRequestError('user_id is required');
    }
    return this.createPaymentIntent({
      buyerUserId: req.userId,
      escrowId: '',
      amountMinor: req.amountMinor,
      currencyCode: req.currencyCode,
      provider: req.provider,
      email: req.email,
      callbackUrl: req.callbackUrl,
      idempotencyKey: `wallet_topup:${req.idempotencyKey}`,
      purpose: 2,
    });
  }

  async verifyWalletTopup(req: VerifyWalletTopupRequest): Promise<VerifyWalletTopupResponse> {
    const response = await this.verifyPaymentByReference({
      provider: req.provider,
      reference: req.reference,
    });
    const payment = await this.drizzleClient.query.paymentsTable.findFirst({
      where: eq(paymentsTable.providerReference, req.reference),
    });
    if (!payment) {
      throw new RpcNotFoundError('Payment not found');
    }
    if (payment.purpose !== PaymentPurpose.WALLET_TOPUP) {
      throw new RpcPreconditionFailedError('Referenced payment is not a wallet topup');
    }
    return {
      success: response.success,
      message: response.message,
      paymentId: response.paymentId,
      providerReference: response.providerReference,
      status: response.status,
      userId: payment.buyerId,
    };
  }

  /** Legacy helper (non-gRPC); kept for compatibility with older call sites. */
  async createPayment(data: {
    userId: string;
    propertyId: string;
    idempotencyKey: string;
    currencyCode: string;
    provider: PaymentProvider;
  }) {
    const existingPayment = await this.drizzleClient.query.paymentsTable.findFirst({
      where: and(
        eq(paymentsTable.buyerId, data.userId),
        eq(paymentsTable.propertyId, data.propertyId),
        eq(paymentsTable.idempotencyKey, data.idempotencyKey),
        eq(paymentsTable.provider, data.provider),
      ),
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.SUCCESS) {
        throw new RpcExistsError('Payment already completed');
      }

      return {
        id: existingPayment.id,
        reference: existingPayment.providerReference,
        paymentLink: existingPayment.paymentLink,
      };
    }

    const amount = 100 * 1200;
    const email = 'test@test.com';

    const paymentData = await this.paymentProviderService.createPaymentLink(data.provider, {
      amount,
      currency: data.currencyCode.toLowerCase(),
      email,
    });

    const [paymentIntent] = await this.drizzleClient
      .insert(paymentsTable)
      .values({
        amount,
        buyerId: data.userId,
        idempotencyKey: data.idempotencyKey,
        paymentLink: paymentData.paymentLink,
        propertyId: data.propertyId,
        provider: data.provider,
        providerReference: paymentData.reference,
        currencyCode: data.currencyCode,
      })
      .onConflictDoNothing()
      .returning();

    if (!paymentIntent) {
      throw new RpcExistsError('Payment already exists');
    }

    return {
      id: paymentIntent.id,
      reference: paymentIntent.providerReference,
      paymentLink: paymentIntent.paymentLink,
    };
  }

  async getPaymentByReference(data: { reference: string }) {
    const payment = await this.drizzleClient.query.paymentsTable.findFirst({
      where: eq(paymentsTable.providerReference, data.reference),
      with: {
        currency: true,
      },
    });

    if (!payment) {
      throw new RpcNotFoundError('Payment not found');
    }

    return payment;
  }
}
