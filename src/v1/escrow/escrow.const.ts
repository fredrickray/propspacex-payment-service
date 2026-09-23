/** DB string values for escrows.status */
export const EscrowDbStatus = {
  HELD: 'held',
  IN_PROGRESS: 'in_progress',
  PENDING_BUYER_RELEASE: 'pending_buyer_release',
  RELEASED: 'released',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
} as const;

export type EscrowDbStatusType = (typeof EscrowDbStatus)[keyof typeof EscrowDbStatus];

/** DB → proto EscrowStatus enum (payment.proto). */
export const EscrowStatusToProto: Record<string, number> = {
  [EscrowDbStatus.HELD]: 1,
  [EscrowDbStatus.IN_PROGRESS]: 2,
  [EscrowDbStatus.PENDING_BUYER_RELEASE]: 3,
  [EscrowDbStatus.RELEASED]: 4,
  [EscrowDbStatus.REFUNDED]: 5,
  [EscrowDbStatus.DISPUTED]: 6,
  [EscrowDbStatus.CANCELLED]: 7,
};

export const DisputeDbStatus = {
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  RESOLVED_BUYER: 'resolved_buyer',
  RESOLVED_AGENT: 'resolved_agent',
  SPLIT: 'split',
  REJECTED: 'rejected',
} as const;

export const DisputeStatusToProto: Record<string, number> = {
  [DisputeDbStatus.OPEN]: 1,
  [DisputeDbStatus.UNDER_REVIEW]: 2,
  [DisputeDbStatus.RESOLVED_BUYER]: 3,
  [DisputeDbStatus.RESOLVED_AGENT]: 4,
  [DisputeDbStatus.SPLIT]: 5,
  [DisputeDbStatus.REJECTED]: 6,
};

export const EscrowEventDbType = {
  CREATED: 'created',
  FUNDS_HELD: 'funds_held',
  MARKED_COMPLETE: 'marked_complete',
  RELEASED: 'released',
  DISPUTE_OPENED: 'dispute_opened',
  DISPUTE_RESOLVED: 'dispute_resolved',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
} as const;

export const EscrowEventTypeToProto: Record<string, number> = {
  [EscrowEventDbType.CREATED]: 1,
  [EscrowEventDbType.FUNDS_HELD]: 2,
  [EscrowEventDbType.MARKED_COMPLETE]: 3,
  [EscrowEventDbType.RELEASED]: 4,
  [EscrowEventDbType.DISPUTE_OPENED]: 5,
  [EscrowEventDbType.DISPUTE_RESOLVED]: 6,
  [EscrowEventDbType.REFUNDED]: 7,
  [EscrowEventDbType.CANCELLED]: 8,
};

export const ActorRoleToProto: Record<string, number> = {
  buyer: 1,
  agent: 2,
  admin: 3,
  system: 4,
};

export const ActorRoleFromProto: Record<number, string> = {
  1: 'buyer',
  2: 'agent',
  3: 'admin',
  4: 'system',
};

export const IdempotencyScope = {
  CREATE_ESCROW: 'escrow.create',
  MARK_SERVICE_COMPLETE: 'escrow.mark_complete',
  RELEASE: 'escrow.release',
  CANCEL: 'escrow.cancel',
  OPEN_DISPUTE: 'escrow.dispute.open',
  RESOLVE_DISPUTE: 'escrow.dispute.resolve',
  CREATE_PAYMENT_INTENT: 'payment.intent.create',
  VERIFY_PAYMENT: 'payment.verify',
  WEBHOOK_PAYMENT: 'payment.webhook',
} as const;
