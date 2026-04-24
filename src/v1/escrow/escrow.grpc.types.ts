/**
 * Types matching proto/payment/v1/payment.proto — EscrowService (+ shared pagination).
 * Manual hand-written types to match the canonical proto.
 */

import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';

export const PAYMENT_PACKAGE_NAME = 'payment';

export interface Timestamp {
  seconds: number;
  nanos: number;
}

export interface PaginationRequest {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Currency {
  code: number;
  name: string;
  symbol: string;
}

export interface Escrow {
  escrowId: string;
  dealRef: string;
  buyerUserId: string;
  agentUserId: string;
  propertyId: string;
  currency: Currency | undefined;
  amountMinor: number;
  platformFeeMinor: number;
  netToAgentMinor: number;
  status: number;
  createdAt: Timestamp | undefined;
  fundedAt: Timestamp | undefined;
  serviceMarkedCompleteAt: Timestamp | undefined;
  releasedAt: Timestamp | undefined;
  refundedAt: Timestamp | undefined;
  cancelledAt: Timestamp | undefined;
  updatedAt: Timestamp | undefined;
  metadataJson: string;
}

export interface EscrowEvent {
  eventId: string;
  escrowId: string;
  eventType: number;
  actorRole: number;
  actorUserId: string;
  note: string;
  metadataJson: string;
  createdAt: Timestamp | undefined;
}

export interface EscrowDispute {
  disputeId: string;
  escrowId: string;
  openedByUserId: string;
  reason: string;
  details: string;
  status: number;
  buyerAwardMinor: number;
  agentAwardMinor: number;
  adminNote: string;
  createdAt: Timestamp | undefined;
  resolvedAt: Timestamp | undefined;
  updatedAt: Timestamp | undefined;
}

export interface CreateEscrowRequest {
  dealRef: string;
  buyerUserId: string;
  agentUserId: string;
  propertyId: string;
  currencyCode: number;
  amountMinor: number;
  platformFeeMinor: number;
  holdFundsNow: boolean;
  metadataJson: string;
  idempotencyKey: string;
}

export interface EscrowResponse {
  success: boolean;
  message: string;
  escrow: Escrow | undefined;
}

export interface GetEscrowByIdRequest {
  escrowId: string;
}

export interface GetEscrowByDealRefRequest {
  dealRef: string;
}

export interface ListEscrowsByUserRequest {
  userId: string;
  role: number;
  pagination: PaginationRequest | undefined;
  status: number;
}

export interface ListEscrowsResponse {
  success: boolean;
  escrows: Escrow[];
  meta: PaginationMeta | undefined;
}

export interface MarkEscrowServiceCompleteRequest {
  escrowId: string;
  agentUserId: string;
  note: string;
  idempotencyKey: string;
}

export interface ReleaseEscrowRequest {
  escrowId: string;
  buyerUserId: string;
  note: string;
  idempotencyKey: string;
}

export interface CancelEscrowRequest {
  escrowId: string;
  cancelledByUserId: string;
  cancelledByRole: number;
  reason: string;
  idempotencyKey: string;
}

export interface OpenEscrowDisputeRequest {
  escrowId: string;
  openedByUserId: string;
  openedByRole: number;
  reason: string;
  details: string;
  idempotencyKey: string;
}

export interface OpenEscrowDisputeResponse {
  success: boolean;
  message: string;
  dispute: EscrowDispute | undefined;
  escrow: Escrow | undefined;
}

export interface ResolveEscrowDisputeRequest {
  disputeId: string;
  adminUserId: string;
  resolution: number;
  buyerAwardMinor: number;
  agentAwardMinor: number;
  adminNote: string;
  idempotencyKey: string;
}

export interface ResolveEscrowDisputeResponse {
  success: boolean;
  message: string;
  dispute: EscrowDispute | undefined;
  escrow: Escrow | undefined;
}

export interface GetEscrowTimelineRequest {
  escrowId: string;
}

export interface GetEscrowTimelineResponse {
  success: boolean;
  events: EscrowEvent[];
}

export interface EscrowServiceController {
  createEscrow(request: CreateEscrowRequest): Promise<EscrowResponse> | EscrowResponse;
  getEscrowById(request: GetEscrowByIdRequest): Promise<EscrowResponse> | EscrowResponse;
  getEscrowByDealRef(request: GetEscrowByDealRefRequest): Promise<EscrowResponse> | EscrowResponse;
  listEscrowsByUser(request: ListEscrowsByUserRequest): Promise<ListEscrowsResponse> | ListEscrowsResponse;
  markEscrowServiceComplete(
    request: MarkEscrowServiceCompleteRequest,
  ): Promise<EscrowResponse> | EscrowResponse;
  releaseEscrow(request: ReleaseEscrowRequest): Promise<EscrowResponse> | EscrowResponse;
  cancelEscrow(request: CancelEscrowRequest): Promise<EscrowResponse> | EscrowResponse;
  openEscrowDispute(request: OpenEscrowDisputeRequest): Promise<OpenEscrowDisputeResponse> | OpenEscrowDisputeResponse;
  resolveEscrowDispute(
    request: ResolveEscrowDisputeRequest,
  ): Promise<ResolveEscrowDisputeResponse> | ResolveEscrowDisputeResponse;
  getEscrowTimeline(request: GetEscrowTimelineRequest): Promise<GetEscrowTimelineResponse> | GetEscrowTimelineResponse;
}

export function EscrowServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = [
      'createEscrow',
      'getEscrowById',
      'getEscrowByDealRef',
      'listEscrowsByUser',
      'markEscrowServiceComplete',
      'releaseEscrow',
      'cancelEscrow',
      'openEscrowDispute',
      'resolveEscrowDispute',
      'getEscrowTimeline',
    ];
    for (const method of grpcMethods) {
      const descriptor: unknown = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      const protoMethod = method.charAt(0).toUpperCase() + method.slice(1);
      GrpcMethod('EscrowService', protoMethod)(constructor.prototype[method], method, descriptor);
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: unknown = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcStreamMethod('EscrowService', method)(constructor.prototype[method], method, descriptor);
    }
  };
}

export const ESCROW_SERVICE_NAME = 'EscrowService';
