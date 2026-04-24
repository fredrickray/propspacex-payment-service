import {
  RpcBadRequestError,
  RpcForbiddenError,
  RpcInternalServerErrorError,
  RpcNotFoundError,
  RpcPreconditionFailedError,
} from '@/common/exceptions/rpc-errors';
import {
  escrowDisputesTable,
  escrowEventsTable,
  escrowsTable,
  grpcIdempotencyTable,
} from '@/database/schemas';
import { type DrizzleDatabaseType } from '@/database/types';
import { DRIZZLE_SERVICE_TAG } from '@/drizzle/drizzle.definition';
import {
  ActorRoleFromProto,
  DisputeDbStatus,
  EscrowDbStatus,
  EscrowEventDbType,
  IdempotencyScope,
} from '@/v1/escrow/escrow.const';
import { EscrowMapper } from '@/v1/escrow/escrow.mapper';
import type {
  CancelEscrowRequest,
  CreateEscrowRequest,
  EscrowResponse,
  GetEscrowByDealRefRequest,
  GetEscrowByIdRequest,
  GetEscrowTimelineRequest,
  GetEscrowTimelineResponse,
  ListEscrowsByUserRequest,
  ListEscrowsResponse,
  MarkEscrowServiceCompleteRequest,
  OpenEscrowDisputeRequest,
  OpenEscrowDisputeResponse,
  ReleaseEscrowRequest,
  ResolveEscrowDisputeRequest,
  ResolveEscrowDisputeResponse,
} from '@/v1/escrow/escrow.grpc.types';
import { WalletService } from '@/v1/wallet/wallet.service';
import { CurrencyCodeFromProto } from '@/v1/wallet/wallet.const';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class EscrowService {
  constructor(
    @Inject(DRIZZLE_SERVICE_TAG) private readonly db: DrizzleDatabaseType,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
  ) {}

  private platformWalletUserId(): string | null {
    const v = this.configService.get<string>('app.platformWalletUserId');
    return v && UUID_RE.test(v) ? v : null;
  }

  private assertUuid(value: string, label: string): void {
    if (!value || !UUID_RE.test(value)) {
      throw new RpcBadRequestError(`Invalid ${label}`);
    }
  }

  private async recordIdempotency(
    tx: DrizzleDatabaseType,
    scope: string,
    idempotencyKey: string,
    resourceId: string,
  ): Promise<void> {
    await tx.insert(grpcIdempotencyTable).values({
      scope,
      idempotencyKey,
      resourceId,
    });
  }

  private async findIdempotency(scope: string, idempotencyKey: string) {
    if (!idempotencyKey) {
      return null;
    }
    return this.db.query.grpcIdempotencyTable.findFirst({
      where: and(eq(grpcIdempotencyTable.scope, scope), eq(grpcIdempotencyTable.idempotencyKey, idempotencyKey)),
    });
  }

  private async loadEscrowWithCurrency(escrowId: string) {
    return this.db.query.escrowsTable.findFirst({
      where: eq(escrowsTable.id, escrowId),
      with: { currency: true },
    });
  }

  private successEscrow(escrowId: string, message: string): Promise<EscrowResponse> {
    return this.buildEscrowResponse(escrowId, message);
  }

  private async buildEscrowResponse(escrowId: string, message: string): Promise<EscrowResponse> {
    const row = await this.loadEscrowWithCurrency(escrowId);
    if (!row) {
      throw new RpcNotFoundError('Escrow not found');
    }
    return {
      success: true,
      message,
      escrow: EscrowMapper.toProtoEscrow(row, row.currency ?? undefined),
    };
  }

  private async appendEvent(
    tx: DrizzleDatabaseType,
    params: {
      escrowId: string;
      eventType: string;
      actorRole?: string;
      actorUserId?: string;
      note?: string;
      metadataJson?: string;
    },
  ): Promise<void> {
    await tx.insert(escrowEventsTable).values({
      escrowId: params.escrowId,
      eventType: params.eventType,
      actorRole: params.actorRole ?? null,
      actorUserId: params.actorUserId ?? null,
      note: params.note ?? null,
      metadataJson: params.metadataJson ?? null,
    });
  }

  async createEscrow(req: CreateEscrowRequest): Promise<EscrowResponse> {
    if (!req.idempotencyKey) {
      throw new RpcBadRequestError('idempotency_key is required');
    }
    const existingKey = await this.findIdempotency(IdempotencyScope.CREATE_ESCROW, req.idempotencyKey);
    if (existingKey) {
      return this.successEscrow(existingKey.resourceId, 'Idempotent replay');
    }

    const currencyCode = CurrencyCodeFromProto[req.currencyCode];
    if (!currencyCode) {
      throw new RpcBadRequestError('Invalid currency_code');
    }
    this.assertUuid(req.buyerUserId, 'buyer_user_id');
    this.assertUuid(req.agentUserId, 'agent_user_id');
    this.assertUuid(req.propertyId, 'property_id');
    if (req.buyerUserId === req.agentUserId) {
      throw new RpcBadRequestError('buyer and agent must differ');
    }
    const amount = Math.abs(Number(req.amountMinor));
    const platformFee = Math.abs(Number(req.platformFeeMinor ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RpcBadRequestError('amount_minor must be positive');
    }
    if (!Number.isFinite(platformFee) || platformFee < 0 || platformFee > amount) {
      throw new RpcBadRequestError('platform_fee_minor is invalid');
    }
    const netToAgent = amount - platformFee;
    if (netToAgent < 0) {
      throw new RpcBadRequestError('net_to_agent would be negative');
    }

    const dealRef = (req.dealRef ?? '').trim();
    if (!dealRef) {
      throw new RpcBadRequestError('deal_ref is required');
    }

    const existingDeal = await this.db.query.escrowsTable.findFirst({
      where: eq(escrowsTable.dealRef, dealRef),
    });
    if (existingDeal) {
      throw new RpcPreconditionFailedError('deal_ref already exists');
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(escrowsTable)
          .values({
            dealRef,
            buyerUserId: req.buyerUserId,
            agentUserId: req.agentUserId,
            propertyId: req.propertyId,
            currencyCode,
            amountMinor: amount,
            platformFeeMinor: platformFee,
            netToAgentMinor: netToAgent,
            status: EscrowDbStatus.HELD,
            fundedAt: null,
            metadataJson: req.metadataJson || null,
          })
          .returning();

        if (!created) {
          throw new RpcInternalServerErrorError('Escrow create failed');
        }

        await this.appendEvent(tx, {
          escrowId: created.id,
          eventType: EscrowEventDbType.CREATED,
          actorRole: 'system',
          note: 'Escrow created',
        });

        if (req.holdFundsNow) {
          await this.walletService.ledgerHoldAvailableForEscrow(tx, {
            userId: req.buyerUserId,
            amountMinor: amount,
            escrowId: created.id,
            note: 'Initial escrow hold',
          });
          await tx
            .update(escrowsTable)
            .set({
              status: EscrowDbStatus.IN_PROGRESS,
              fundedAt: sql`now()`,
            })
            .where(eq(escrowsTable.id, created.id));

          await this.appendEvent(tx, {
            escrowId: created.id,
            eventType: EscrowEventDbType.FUNDS_HELD,
            actorRole: 'system',
            note: 'Buyer funds held on-wallet for escrow',
          });
        }

        await this.recordIdempotency(tx, IdempotencyScope.CREATE_ESCROW, req.idempotencyKey, created.id);

        return this.buildEscrowResponseFromTx(tx, created.id, 'Escrow created');
      });
    } catch (e: unknown) {
      if (this.isUniqueIdempotencyViolation(e)) {
        const row = await this.findIdempotency(IdempotencyScope.CREATE_ESCROW, req.idempotencyKey);
        if (row) {
          return this.successEscrow(row.resourceId, 'Idempotent replay');
        }
      }
      throw e;
    }
  }

  private isUniqueIdempotencyViolation(e: unknown): boolean {
    return Boolean(e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505');
  }

  private async buildEscrowResponseFromTx(
    tx: DrizzleDatabaseType,
    escrowId: string,
    message: string,
  ): Promise<EscrowResponse> {
    const row = await tx.query.escrowsTable.findFirst({
      where: eq(escrowsTable.id, escrowId),
      with: { currency: true },
    });
    if (!row) {
      throw new RpcNotFoundError('Escrow not found');
    }
    return {
      success: true,
      message,
      escrow: EscrowMapper.toProtoEscrow(row, row.currency ?? undefined),
    };
  }

  async getEscrowById(req: GetEscrowByIdRequest): Promise<EscrowResponse> {
    this.assertUuid(req.escrowId, 'escrow_id');
    return this.buildEscrowResponse(req.escrowId, 'OK');
  }

  async getEscrowByDealRef(req: GetEscrowByDealRefRequest): Promise<EscrowResponse> {
    const dealRef = (req.dealRef ?? '').trim();
    if (!dealRef) {
      throw new RpcBadRequestError('deal_ref is required');
    }
    const row = await this.db.query.escrowsTable.findFirst({
      where: eq(escrowsTable.dealRef, dealRef),
      with: { currency: true },
    });
    if (!row) {
      throw new RpcNotFoundError('Escrow not found');
    }
    return {
      success: true,
      message: 'OK',
      escrow: EscrowMapper.toProtoEscrow(row, row.currency ?? undefined),
    };
  }

  async listEscrowsByUser(req: ListEscrowsByUserRequest): Promise<ListEscrowsResponse> {
    this.assertUuid(req.userId, 'user_id');
    const page = req.pagination?.page && req.pagination.page > 0 ? req.pagination.page : 1;
    const limit = req.pagination?.limit && req.pagination.limit > 0 ? Math.min(req.pagination.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const role = req.role;
    const buyer = role === 1;
    const agent = role === 2;
    if (!buyer && !agent) {
      throw new RpcBadRequestError('role must be buyer or agent');
    }

    const statusDb =
      req.status && req.status > 0 ? this.protoEscrowStatusToDb(req.status) : null;
    if (req.status && req.status > 0 && !statusDb) {
      throw new RpcBadRequestError('Invalid escrow status filter');
    }

    const roleCond = buyer ? eq(escrowsTable.buyerUserId, req.userId) : eq(escrowsTable.agentUserId, req.userId);
    const whereParts = [roleCond];
    if (statusDb) {
      whereParts.push(eq(escrowsTable.status, statusDb));
    }
    const whereClause = and(...whereParts);

    const [rows, [totalRow]] = await Promise.all([
      this.db.query.escrowsTable.findMany({
        where: whereClause,
        orderBy: desc(escrowsTable.createdAt),
        limit,
        offset,
        with: { currency: true },
      }),
      this.db.select({ total: count() }).from(escrowsTable).where(whereClause),
    ]);

    const total = totalRow?.total ?? 0;

    return {
      success: true,
      escrows: rows.map((r) => EscrowMapper.toProtoEscrow(r, r.currency ?? undefined)),
      meta: EscrowMapper.pagination(page, limit, total),
    };
  }

  private protoEscrowStatusToDb(protoStatus: number): string | null {
    const map: Record<number, string> = {
      1: EscrowDbStatus.HELD,
      2: EscrowDbStatus.IN_PROGRESS,
      3: EscrowDbStatus.PENDING_BUYER_RELEASE,
      4: EscrowDbStatus.RELEASED,
      5: EscrowDbStatus.REFUNDED,
      6: EscrowDbStatus.DISPUTED,
      7: EscrowDbStatus.CANCELLED,
    };
    return map[protoStatus] ?? null;
  }

  async markEscrowServiceComplete(req: MarkEscrowServiceCompleteRequest): Promise<EscrowResponse> {
    if (!req.idempotencyKey) {
      throw new RpcBadRequestError('idempotency_key is required');
    }
    this.assertUuid(req.escrowId, 'escrow_id');
    this.assertUuid(req.agentUserId, 'agent_user_id');

    const idem = await this.findIdempotency(IdempotencyScope.MARK_SERVICE_COMPLETE, req.idempotencyKey);
    if (idem) {
      return this.successEscrow(idem.resourceId, 'Idempotent replay');
    }

    const escrow = await this.loadEscrowWithCurrency(req.escrowId);
    if (!escrow) {
      throw new RpcNotFoundError('Escrow not found');
    }
    if (escrow.agentUserId !== req.agentUserId) {
      throw new RpcForbiddenError('agent_user_id does not match this escrow');
    }
    if (escrow.status === EscrowDbStatus.PENDING_BUYER_RELEASE || escrow.status === EscrowDbStatus.RELEASED) {
      await this.recordIdempotencyIfNeeded(IdempotencyScope.MARK_SERVICE_COMPLETE, req.idempotencyKey, req.escrowId);
      return this.buildEscrowResponse(req.escrowId, 'Already marked complete');
    }
    if (escrow.status !== EscrowDbStatus.IN_PROGRESS) {
      throw new RpcPreconditionFailedError('Escrow is not in progress');
    }
    if (!escrow.fundedAt) {
      throw new RpcPreconditionFailedError('Escrow is not funded yet');
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(escrowsTable)
          .set({
            status: EscrowDbStatus.PENDING_BUYER_RELEASE,
            serviceMarkedCompleteAt: sql`now()`,
          })
          .where(
            and(eq(escrowsTable.id, req.escrowId), eq(escrowsTable.status, EscrowDbStatus.IN_PROGRESS)),
          )
          .returning();

        if (!updated) {
          const current = await tx.query.escrowsTable.findFirst({ where: eq(escrowsTable.id, req.escrowId) });
          if (current?.status === EscrowDbStatus.PENDING_BUYER_RELEASE) {
            await this.recordIdempotency(tx, IdempotencyScope.MARK_SERVICE_COMPLETE, req.idempotencyKey, req.escrowId);
            return this.buildEscrowResponseFromTx(tx, req.escrowId, 'Already marked complete');
          }
          throw new RpcPreconditionFailedError('Concurrent update; retry');
        }

        await this.appendEvent(tx, {
          escrowId: req.escrowId,
          eventType: EscrowEventDbType.MARKED_COMPLETE,
          actorRole: 'agent',
          actorUserId: req.agentUserId,
          note: req.note || null,
        });

        await this.recordIdempotency(tx, IdempotencyScope.MARK_SERVICE_COMPLETE, req.idempotencyKey, req.escrowId);
        return this.buildEscrowResponseFromTx(tx, req.escrowId, 'Service marked complete');
      });
    } catch (e: unknown) {
      if (this.isUniqueIdempotencyViolation(e)) {
        const row = await this.findIdempotency(IdempotencyScope.MARK_SERVICE_COMPLETE, req.idempotencyKey);
        if (row) {
          return this.successEscrow(row.resourceId, 'Idempotent replay');
        }
      }
      throw e;
    }
  }

  private async recordIdempotencyIfNeeded(scope: string, key: string, resourceId: string): Promise<void> {
    if (!key) {
      return;
    }
    await this.db
      .insert(grpcIdempotencyTable)
      .values({ scope, idempotencyKey: key, resourceId })
      .onConflictDoNothing({ target: [grpcIdempotencyTable.scope, grpcIdempotencyTable.idempotencyKey] });
  }

  async releaseEscrow(req: ReleaseEscrowRequest): Promise<EscrowResponse> {
    if (!req.idempotencyKey) {
      throw new RpcBadRequestError('idempotency_key is required');
    }
    this.assertUuid(req.escrowId, 'escrow_id');
    this.assertUuid(req.buyerUserId, 'buyer_user_id');

    const idem = await this.findIdempotency(IdempotencyScope.RELEASE, req.idempotencyKey);
    if (idem) {
      return this.successEscrow(idem.resourceId, 'Idempotent replay');
    }

    const escrow = await this.loadEscrowWithCurrency(req.escrowId);
    if (!escrow) {
      throw new RpcNotFoundError('Escrow not found');
    }
    if (escrow.buyerUserId !== req.buyerUserId) {
      throw new RpcForbiddenError('buyer_user_id does not match this escrow');
    }
    if (escrow.status === EscrowDbStatus.RELEASED) {
      await this.recordIdempotencyIfNeeded(IdempotencyScope.RELEASE, req.idempotencyKey, req.escrowId);
      return this.buildEscrowResponse(req.escrowId, 'Already released');
    }
    if (escrow.status !== EscrowDbStatus.PENDING_BUYER_RELEASE) {
      throw new RpcPreconditionFailedError('Escrow is not pending buyer release');
    }

    const platformUserId = this.platformWalletUserId();

    try {
      return await this.db.transaction(async (tx) => {
        await this.walletService.ledgerDisburseReleasedEscrow(tx, {
          buyerUserId: escrow.buyerUserId,
          agentUserId: escrow.agentUserId,
          platformUserId,
          escrowAmountMinor: escrow.amountMinor,
          platformFeeMinor: escrow.platformFeeMinor,
          netToAgentMinor: escrow.netToAgentMinor,
          escrowId: escrow.id,
          note: req.note || undefined,
        });

        const [released] = await tx
          .update(escrowsTable)
          .set({ status: EscrowDbStatus.RELEASED, releasedAt: sql`now()` })
          .where(
            and(
              eq(escrowsTable.id, req.escrowId),
              eq(escrowsTable.status, EscrowDbStatus.PENDING_BUYER_RELEASE),
            ),
          )
          .returning();

        if (!released) {
          throw new RpcPreconditionFailedError('Escrow is not pending buyer release');
        }

        await this.appendEvent(tx, {
          escrowId: req.escrowId,
          eventType: EscrowEventDbType.RELEASED,
          actorRole: 'buyer',
          actorUserId: req.buyerUserId,
          note: req.note || null,
        });

        await this.recordIdempotency(tx, IdempotencyScope.RELEASE, req.idempotencyKey, req.escrowId);
        return this.buildEscrowResponseFromTx(tx, req.escrowId, 'Escrow released');
      });
    } catch (e: unknown) {
      if (this.isUniqueIdempotencyViolation(e)) {
        const row = await this.findIdempotency(IdempotencyScope.RELEASE, req.idempotencyKey);
        if (row) {
          return this.successEscrow(row.resourceId, 'Idempotent replay');
        }
      }
      throw e;
    }
  }

  async cancelEscrow(req: CancelEscrowRequest): Promise<EscrowResponse> {
    if (!req.idempotencyKey) {
      throw new RpcBadRequestError('idempotency_key is required');
    }
    this.assertUuid(req.escrowId, 'escrow_id');
    this.assertUuid(req.cancelledByUserId, 'cancelled_by_user_id');

    const idem = await this.findIdempotency(IdempotencyScope.CANCEL, req.idempotencyKey);
    if (idem) {
      return this.successEscrow(idem.resourceId, 'Idempotent replay');
    }

    const role = ActorRoleFromProto[req.cancelledByRole];
    if (!role) {
      throw new RpcBadRequestError('cancelled_by_role is invalid');
    }

    const escrow = await this.loadEscrowWithCurrency(req.escrowId);
    if (!escrow) {
      throw new RpcNotFoundError('Escrow not found');
    }

    if (escrow.status === EscrowDbStatus.CANCELLED) {
      await this.recordIdempotencyIfNeeded(IdempotencyScope.CANCEL, req.idempotencyKey, req.escrowId);
      return this.buildEscrowResponse(req.escrowId, 'Already cancelled');
    }
    if (
      escrow.status === EscrowDbStatus.RELEASED ||
      escrow.status === EscrowDbStatus.REFUNDED ||
      escrow.status === EscrowDbStatus.DISPUTED
    ) {
      throw new RpcPreconditionFailedError('Escrow cannot be cancelled in this state');
    }

    if (role === 'buyer' && escrow.buyerUserId !== req.cancelledByUserId) {
      throw new RpcForbiddenError('cancelled_by_user_id must be the buyer');
    }
    if (role === 'agent' && escrow.agentUserId !== req.cancelledByUserId) {
      throw new RpcForbiddenError('cancelled_by_user_id must be the agent');
    }
    if (role !== 'admin' && role !== 'buyer' && role !== 'agent') {
      throw new RpcForbiddenError('cancelled_by_role must be buyer, agent, or admin');
    }

    const funded = Boolean(escrow.fundedAt);
    if (funded && escrow.status === EscrowDbStatus.PENDING_BUYER_RELEASE) {
      throw new RpcPreconditionFailedError('Buyer release pending; cancel is not allowed');
    }
    if (funded && role === 'agent') {
      throw new RpcForbiddenError('Agent cannot cancel a funded escrow');
    }

    try {
      return await this.db.transaction(async (tx) => {
        const cur = await tx.query.escrowsTable.findFirst({ where: eq(escrowsTable.id, req.escrowId) });
        if (!cur) {
          throw new RpcNotFoundError('Escrow not found');
        }
        if (cur.status === EscrowDbStatus.CANCELLED) {
          await this.recordIdempotency(tx, IdempotencyScope.CANCEL, req.idempotencyKey, req.escrowId);
          return this.buildEscrowResponseFromTx(tx, req.escrowId, 'Already cancelled');
        }
        if (
          cur.status === EscrowDbStatus.RELEASED ||
          cur.status === EscrowDbStatus.REFUNDED ||
          cur.status === EscrowDbStatus.DISPUTED
        ) {
          throw new RpcPreconditionFailedError('Escrow cannot be cancelled in this state');
        }

        if (cur.fundedAt && cur.status === EscrowDbStatus.IN_PROGRESS) {
          await this.walletService.ledgerRefundHeldToAvailable(tx, {
            userId: cur.buyerUserId,
            amountMinor: cur.amountMinor,
            escrowId: cur.id,
            note: req.reason || 'Escrow cancelled — refund held funds',
          });
        }

        const [cancelled] = await tx
          .update(escrowsTable)
          .set({ status: EscrowDbStatus.CANCELLED, cancelledAt: sql`now()` })
          .where(
            and(
              eq(escrowsTable.id, req.escrowId),
              inArray(escrowsTable.status, [EscrowDbStatus.HELD, EscrowDbStatus.IN_PROGRESS]),
            ),
          )
          .returning();

        if (!cancelled) {
          throw new RpcPreconditionFailedError('Escrow cannot be cancelled in this state');
        }

        await this.appendEvent(tx, {
          escrowId: req.escrowId,
          eventType: EscrowEventDbType.CANCELLED,
          actorRole: role,
          actorUserId: req.cancelledByUserId,
          note: req.reason || null,
        });

        await this.recordIdempotency(tx, IdempotencyScope.CANCEL, req.idempotencyKey, req.escrowId);
        return this.buildEscrowResponseFromTx(tx, req.escrowId, 'Escrow cancelled');
      });
    } catch (e: unknown) {
      if (this.isUniqueIdempotencyViolation(e)) {
        const row = await this.findIdempotency(IdempotencyScope.CANCEL, req.idempotencyKey);
        if (row) {
          return this.successEscrow(row.resourceId, 'Idempotent replay');
        }
      }
      throw e;
    }
  }

  async openEscrowDispute(req: OpenEscrowDisputeRequest): Promise<OpenEscrowDisputeResponse> {
    if (!req.idempotencyKey) {
      throw new RpcBadRequestError('idempotency_key is required');
    }
    this.assertUuid(req.escrowId, 'escrow_id');
    this.assertUuid(req.openedByUserId, 'opened_by_user_id');

    const idem = await this.findIdempotency(IdempotencyScope.OPEN_DISPUTE, req.idempotencyKey);
    if (idem) {
      const dispute = await this.db.query.escrowDisputesTable.findFirst({
        where: eq(escrowDisputesTable.id, idem.resourceId),
      });
      if (!dispute) {
        throw new RpcNotFoundError('Dispute not found for idempotency replay');
      }
      const escrowResp = await this.buildEscrowResponse(dispute.escrowId, 'Idempotent replay');
      return {
        success: true,
        message: 'Idempotent replay',
        dispute: EscrowMapper.toProtoDispute(dispute),
        escrow: escrowResp.escrow,
      };
    }

    const role = ActorRoleFromProto[req.openedByRole];
    if (role !== 'buyer' && role !== 'agent') {
      throw new RpcForbiddenError('opened_by_role must be buyer or agent');
    }

    const escrow = await this.loadEscrowWithCurrency(req.escrowId);
    if (!escrow) {
      throw new RpcNotFoundError('Escrow not found');
    }
    if (role === 'buyer' && escrow.buyerUserId !== req.openedByUserId) {
      throw new RpcForbiddenError('opened_by_user_id must be the buyer');
    }
    if (role === 'agent' && escrow.agentUserId !== req.openedByUserId) {
      throw new RpcForbiddenError('opened_by_user_id must be the agent');
    }

    if (
      escrow.status !== EscrowDbStatus.IN_PROGRESS &&
      escrow.status !== EscrowDbStatus.PENDING_BUYER_RELEASE
    ) {
      throw new RpcPreconditionFailedError('Disputes can only be opened for active escrows');
    }
    if (!escrow.fundedAt) {
      throw new RpcPreconditionFailedError('Escrow must be funded before a dispute');
    }

    const reason = (req.reason ?? '').trim();
    if (!reason) {
      throw new RpcBadRequestError('reason is required');
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [dispute] = await tx
          .insert(escrowDisputesTable)
          .values({
            escrowId: req.escrowId,
            openedByUserId: req.openedByUserId,
            reason,
            details: req.details || null,
            status: DisputeDbStatus.OPEN,
            escrowStatusBefore: escrow.status,
          })
          .returning();

        if (!dispute) {
          throw new RpcInternalServerErrorError('Dispute create failed');
        }

        await tx
          .update(escrowsTable)
          .set({ status: EscrowDbStatus.DISPUTED })
          .where(eq(escrowsTable.id, req.escrowId));

        await this.appendEvent(tx, {
          escrowId: req.escrowId,
          eventType: EscrowEventDbType.DISPUTE_OPENED,
          actorRole: role,
          actorUserId: req.openedByUserId,
          note: reason,
        });

        await this.recordIdempotency(tx, IdempotencyScope.OPEN_DISPUTE, req.idempotencyKey, dispute.id);

        const escrowRow = await tx.query.escrowsTable.findFirst({
          where: eq(escrowsTable.id, req.escrowId),
          with: { currency: true },
        });
        if (!escrowRow) {
          throw new RpcNotFoundError('Escrow not found');
        }

        return {
          success: true,
          message: 'Dispute opened',
          dispute: EscrowMapper.toProtoDispute(dispute),
          escrow: EscrowMapper.toProtoEscrow(escrowRow, escrowRow.currency ?? undefined),
        };
      });
    } catch (e: unknown) {
      if (this.isUniqueIdempotencyViolation(e)) {
        const row = await this.findIdempotency(IdempotencyScope.OPEN_DISPUTE, req.idempotencyKey);
        if (row) {
          const dispute = await this.db.query.escrowDisputesTable.findFirst({
            where: eq(escrowDisputesTable.id, row.resourceId),
          });
          if (dispute) {
            const escrowResp = await this.buildEscrowResponse(dispute.escrowId, 'Idempotent replay');
            return {
              success: true,
              message: 'Idempotent replay',
              dispute: EscrowMapper.toProtoDispute(dispute),
              escrow: escrowResp.escrow,
            };
          }
        }
      }
      throw e;
    }
  }

  async resolveEscrowDispute(req: ResolveEscrowDisputeRequest): Promise<ResolveEscrowDisputeResponse> {
    if (!req.idempotencyKey) {
      throw new RpcBadRequestError('idempotency_key is required');
    }
    this.assertUuid(req.disputeId, 'dispute_id');
    this.assertUuid(req.adminUserId, 'admin_user_id');

    const idem = await this.findIdempotency(IdempotencyScope.RESOLVE_DISPUTE, req.idempotencyKey);
    if (idem) {
      const dispute = await this.db.query.escrowDisputesTable.findFirst({
        where: eq(escrowDisputesTable.id, idem.resourceId),
      });
      if (!dispute) {
        throw new RpcNotFoundError('Dispute not found for idempotency replay');
      }
      const escrowResp = await this.buildEscrowResponse(dispute.escrowId, 'Idempotent replay');
      return {
        success: true,
        message: 'Idempotent replay',
        dispute: EscrowMapper.toProtoDispute(dispute),
        escrow: escrowResp.escrow,
      };
    }

    const resolution = req.resolution;
    if (![3, 4, 5, 6].includes(resolution)) {
      throw new RpcBadRequestError('resolution must be buyer, agent, split, or rejected');
    }

    const platformUserId = this.platformWalletUserId();

    try {
      return await this.db.transaction(async (tx) => {
        const dispute = await tx.query.escrowDisputesTable.findFirst({
          where: eq(escrowDisputesTable.id, req.disputeId),
        });
        if (!dispute) {
          throw new RpcNotFoundError('Dispute not found');
        }
        if (dispute.status !== DisputeDbStatus.OPEN && dispute.status !== DisputeDbStatus.UNDER_REVIEW) {
          throw new RpcPreconditionFailedError('Dispute is not open for resolution');
        }

        const escrow = await tx.query.escrowsTable.findFirst({
          where: eq(escrowsTable.id, dispute.escrowId),
        });
        if (!escrow) {
          throw new RpcNotFoundError('Escrow not found');
        }
        if (escrow.status !== EscrowDbStatus.DISPUTED) {
          throw new RpcPreconditionFailedError('Escrow is not disputed');
        }

        const buyerAward = Math.abs(Number(req.buyerAwardMinor ?? 0));
        const agentAward = Math.abs(Number(req.agentAwardMinor ?? 0));

        if (resolution === 3) {
          await this.walletService.ledgerRefundHeldToAvailable(tx, {
            userId: escrow.buyerUserId,
            amountMinor: escrow.amountMinor,
            escrowId: escrow.id,
            note: req.adminNote || 'Dispute resolved in favor of buyer',
          });
          await tx
            .update(escrowDisputesTable)
            .set({
              status: DisputeDbStatus.RESOLVED_BUYER,
              buyerAwardMinor: escrow.amountMinor,
              agentAwardMinor: 0,
              adminNote: req.adminNote || null,
              resolvedAt: sql`now()`,
            })
            .where(eq(escrowDisputesTable.id, dispute.id));

          await tx
            .update(escrowsTable)
            .set({ status: EscrowDbStatus.REFUNDED, refundedAt: sql`now()` })
            .where(eq(escrowsTable.id, escrow.id));
        } else if (resolution === 4) {
          await this.walletService.ledgerDisburseReleasedEscrow(tx, {
            buyerUserId: escrow.buyerUserId,
            agentUserId: escrow.agentUserId,
            platformUserId,
            escrowAmountMinor: escrow.amountMinor,
            platformFeeMinor: escrow.platformFeeMinor,
            netToAgentMinor: escrow.netToAgentMinor,
            escrowId: escrow.id,
            note: req.adminNote || 'Dispute resolved in favor of agent',
          });
          await tx
            .update(escrowDisputesTable)
            .set({
              status: DisputeDbStatus.RESOLVED_AGENT,
              buyerAwardMinor: 0,
              agentAwardMinor: escrow.netToAgentMinor,
              adminNote: req.adminNote || null,
              resolvedAt: sql`now()`,
            })
            .where(eq(escrowDisputesTable.id, dispute.id));

          await tx
            .update(escrowsTable)
            .set({ status: EscrowDbStatus.RELEASED, releasedAt: sql`now()` })
            .where(eq(escrowsTable.id, escrow.id));
        } else if (resolution === 5) {
          if (buyerAward + agentAward !== escrow.amountMinor) {
            throw new RpcBadRequestError('buyer_award_minor + agent_award_minor must equal escrow amount');
          }
          await this.walletService.ledgerConsumeBuyerHeld(tx, {
            buyerUserId: escrow.buyerUserId,
            amountMinor: escrow.amountMinor,
            escrowId: escrow.id,
            note: 'Dispute split payout',
          });
          if (buyerAward > 0) {
            await this.walletService.ledgerCreditAvailableSimple(tx, {
              userId: escrow.buyerUserId,
              amountMinor: buyerAward,
              escrowId: escrow.id,
              entryType: 'refund',
              note: 'Dispute split — buyer portion',
            });
          }
          if (agentAward > 0) {
            await this.walletService.ledgerCreditAvailableSimple(tx, {
              userId: escrow.agentUserId,
              amountMinor: agentAward,
              escrowId: escrow.id,
              entryType: 'escrow_release',
              note: 'Dispute split — agent portion',
            });
          }
          await tx
            .update(escrowDisputesTable)
            .set({
              status: DisputeDbStatus.SPLIT,
              buyerAwardMinor: buyerAward,
              agentAwardMinor: agentAward,
              adminNote: req.adminNote || null,
              resolvedAt: sql`now()`,
            })
            .where(eq(escrowDisputesTable.id, dispute.id));

          await tx
            .update(escrowsTable)
            .set({ status: EscrowDbStatus.RELEASED, releasedAt: sql`now()` })
            .where(eq(escrowsTable.id, escrow.id));
        } else {
          const restore = dispute.escrowStatusBefore ?? EscrowDbStatus.IN_PROGRESS;
          await tx
            .update(escrowDisputesTable)
            .set({
              status: DisputeDbStatus.REJECTED,
              adminNote: req.adminNote || null,
              resolvedAt: sql`now()`,
            })
            .where(eq(escrowDisputesTable.id, dispute.id));

          await tx
            .update(escrowsTable)
            .set({ status: restore })
            .where(eq(escrowsTable.id, escrow.id));
        }

        await this.appendEvent(tx, {
          escrowId: escrow.id,
          eventType: EscrowEventDbType.DISPUTE_RESOLVED,
          actorRole: 'admin',
          actorUserId: req.adminUserId,
          note: req.adminNote || null,
          metadataJson: JSON.stringify({ resolution, buyerAward, agentAward }),
        });

        await this.recordIdempotency(tx, IdempotencyScope.RESOLVE_DISPUTE, req.idempotencyKey, dispute.id);

        const escrowRow = await tx.query.escrowsTable.findFirst({
          where: eq(escrowsTable.id, escrow.id),
          with: { currency: true },
        });
        const disputeRow = await tx.query.escrowDisputesTable.findFirst({
          where: eq(escrowDisputesTable.id, dispute.id),
        });
        if (!escrowRow || !disputeRow) {
          throw new RpcNotFoundError('State load failed');
        }

        return {
          success: true,
          message: 'Dispute resolved',
          dispute: EscrowMapper.toProtoDispute(disputeRow),
          escrow: EscrowMapper.toProtoEscrow(escrowRow, escrowRow.currency ?? undefined),
        };
      });
    } catch (e: unknown) {
      if (this.isUniqueIdempotencyViolation(e)) {
        const row = await this.findIdempotency(IdempotencyScope.RESOLVE_DISPUTE, req.idempotencyKey);
        if (row) {
          const dispute = await this.db.query.escrowDisputesTable.findFirst({
            where: eq(escrowDisputesTable.id, row.resourceId),
          });
          if (dispute) {
            const escrowResp = await this.buildEscrowResponse(dispute.escrowId, 'Idempotent replay');
            return {
              success: true,
              message: 'Idempotent replay',
              dispute: EscrowMapper.toProtoDispute(dispute),
              escrow: escrowResp.escrow,
            };
          }
        }
      }
      throw e;
    }
  }

  /**
   * Records successful off-wallet settlement (e.g. Paystack) as on-ledger credit to buyer + escrow hold.
   * Idempotent when escrow.funded_at is already set.
   */
  async applyExternalFundingInTx(
    tx: DrizzleDatabaseType,
    params: { escrowId: string; buyerUserId: string; amountMinor: number; paymentReference: string },
  ): Promise<void> {
    const escrow = await tx.query.escrowsTable.findFirst({
      where: eq(escrowsTable.id, params.escrowId),
    });
    if (!escrow) {
      throw new RpcNotFoundError('Escrow not found');
    }
    if (escrow.buyerUserId !== params.buyerUserId) {
      throw new RpcForbiddenError('buyer does not own this escrow');
    }
    if (escrow.amountMinor !== params.amountMinor) {
      throw new RpcBadRequestError('payment amount does not match escrow amount');
    }
    if (escrow.fundedAt) {
      return;
    }
    if (escrow.status !== EscrowDbStatus.HELD) {
      throw new RpcPreconditionFailedError('Escrow is not awaiting funding');
    }

    const [claimed] = await tx
      .update(escrowsTable)
      .set({
        status: EscrowDbStatus.IN_PROGRESS,
        fundedAt: sql`now()`,
      })
      .where(
        and(
          eq(escrowsTable.id, params.escrowId),
          eq(escrowsTable.status, EscrowDbStatus.HELD),
          sql`${escrowsTable.fundedAt} IS NULL`,
        ),
      )
      .returning();

    if (!claimed) {
      return;
    }

    await this.walletService.ledgerCreditAvailable(tx, {
      userId: params.buyerUserId,
      amountMinor: params.amountMinor,
      referenceType: 'payment',
      referenceId: params.paymentReference,
      entryType: 'topup',
      note: 'Provider payment settled on-ledger',
    });

    await this.walletService.ledgerHoldAvailableForEscrow(tx, {
      userId: params.buyerUserId,
      amountMinor: params.amountMinor,
      escrowId: params.escrowId,
      note: 'Escrow funded via provider',
    });

    await this.appendEvent(tx, {
      escrowId: params.escrowId,
      eventType: EscrowEventDbType.FUNDS_HELD,
      actorRole: 'system',
      note: 'Escrow funded via payment provider',
    });
  }

  async getEscrowTimeline(req: GetEscrowTimelineRequest): Promise<GetEscrowTimelineResponse> {
    this.assertUuid(req.escrowId, 'escrow_id');
    const escrow = await this.db.query.escrowsTable.findFirst({
      where: eq(escrowsTable.id, req.escrowId),
    });
    if (!escrow) {
      throw new RpcNotFoundError('Escrow not found');
    }
    const events = await this.db.query.escrowEventsTable.findMany({
      where: eq(escrowEventsTable.escrowId, req.escrowId),
      orderBy: desc(escrowEventsTable.createdAt),
    });
    return {
      success: true,
      events: events.map(EscrowMapper.toProtoEvent),
    };
  }
}
