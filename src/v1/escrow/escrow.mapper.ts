import { CurrencyMapper } from '@/common/mappers';
import type { EscrowDisputeRow, EscrowDtoType, EscrowEventRow, EscrowRow } from '@/database/schemas';
import { CurrencyCodeToProto } from '@/v1/wallet/wallet.const';
import { WalletMapper } from '@/v1/wallet/wallet.mapper';
import {
  ActorRoleToProto,
  DisputeStatusToProto,
  EscrowEventTypeToProto,
  EscrowStatusToProto,
} from '@/v1/escrow/escrow.const';
import type {
  Escrow,
  EscrowDispute,
  EscrowEvent,
  PaginationMeta,
} from '@/v1/escrow/escrow.grpc.types';

export class EscrowMapper {
  static toProtoEscrow(row: EscrowRow, currency?: EscrowDtoType['currency']): Escrow {
    return {
      escrowId: row.id,
      dealRef: row.dealRef,
      buyerUserId: row.buyerUserId,
      agentUserId: row.agentUserId,
      propertyId: row.propertyId,
      currency: currency
        ? {
            ...CurrencyMapper.toResponse(currency),
            code: CurrencyCodeToProto[currency.code] ?? 0,
          }
        : undefined,
      amountMinor: row.amountMinor,
      platformFeeMinor: row.platformFeeMinor,
      netToAgentMinor: row.netToAgentMinor,
      status: EscrowStatusToProto[row.status] ?? 0,
      createdAt: WalletMapper.toTimestamp(row.createdAt),
      fundedAt: row.fundedAt ? WalletMapper.toTimestamp(row.fundedAt) : undefined,
      serviceMarkedCompleteAt: row.serviceMarkedCompleteAt
        ? WalletMapper.toTimestamp(row.serviceMarkedCompleteAt)
        : undefined,
      releasedAt: row.releasedAt ? WalletMapper.toTimestamp(row.releasedAt) : undefined,
      refundedAt: row.refundedAt ? WalletMapper.toTimestamp(row.refundedAt) : undefined,
      cancelledAt: row.cancelledAt ? WalletMapper.toTimestamp(row.cancelledAt) : undefined,
      updatedAt: row.updatedAt ? WalletMapper.toTimestamp(row.updatedAt) : undefined,
      metadataJson: row.metadataJson ?? '',
    };
  }

  static toProtoEvent(row: EscrowEventRow): EscrowEvent {
    return {
      eventId: row.id,
      escrowId: row.escrowId,
      eventType: EscrowEventTypeToProto[row.eventType] ?? 0,
      actorRole: row.actorRole ? ActorRoleToProto[row.actorRole] ?? 0 : 0,
      actorUserId: row.actorUserId ?? '',
      note: row.note ?? '',
      metadataJson: row.metadataJson ?? '',
      createdAt: WalletMapper.toTimestamp(row.createdAt),
    };
  }

  static toProtoDispute(row: EscrowDisputeRow): EscrowDispute {
    return {
      disputeId: row.id,
      escrowId: row.escrowId,
      openedByUserId: row.openedByUserId,
      reason: row.reason,
      details: row.details ?? '',
      status: DisputeStatusToProto[row.status] ?? 0,
      buyerAwardMinor: row.buyerAwardMinor,
      agentAwardMinor: row.agentAwardMinor,
      adminNote: row.adminNote ?? '',
      createdAt: WalletMapper.toTimestamp(row.createdAt),
      resolvedAt: row.resolvedAt ? WalletMapper.toTimestamp(row.resolvedAt) : undefined,
      updatedAt: row.updatedAt ? WalletMapper.toTimestamp(row.updatedAt) : undefined,
    };
  }

  static pagination(page: number, limit: number, total: number): PaginationMeta {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }
}
