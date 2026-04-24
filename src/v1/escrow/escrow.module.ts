/**
 * Escrow gRPC (EscrowService) — manual smoke (grpcurl), replace UUIDs and port:
 *
 * grpcurl -plaintext -import-path proto -proto payment/v1/payment.proto \
 *   -d '{"deal_ref":"deal-1","buyer_user_id":"<uuid>","agent_user_id":"<uuid>","property_id":"<uuid>","currency_code":1,"amount_minor":500000,"platform_fee_minor":25000,"hold_funds_now":false,"metadata_json":"{}","idempotency_key":"idem-create-1"}' \
 *   localhost:50053 payment.EscrowService/CreateEscrow
 *
 * grpcurl -plaintext -import-path proto -proto payment/v1/payment.proto \
 *   -d '{"escrow_id":"<escrow-uuid>","buyer_user_id":"<buyer-uuid>","amount_minor":500000,"currency_code":1,"provider":"paystack","email":"a@b.com","callback_url":"https://example.com/cb","idempotency_key":"idem-pay-1"}' \
 *   localhost:50053 payment.PaymentService/CreatePaymentIntent
 */

import { EscrowController } from '@/v1/escrow/escrow.controller';
import { EscrowService } from '@/v1/escrow/escrow.service';
import { WalletModule } from '@/v1/wallet/wallet.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [WalletModule],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
