import {
  EscrowServiceControllerMethods,
  type CancelEscrowRequest,
  type CreateEscrowRequest,
  type EscrowResponse,
  type EscrowServiceController,
  type GetEscrowByDealRefRequest,
  type GetEscrowByIdRequest,
  type GetEscrowTimelineRequest,
  type GetEscrowTimelineResponse,
  type ListEscrowsByUserRequest,
  type ListEscrowsResponse,
  type MarkEscrowServiceCompleteRequest,
  type OpenEscrowDisputeRequest,
  type OpenEscrowDisputeResponse,
  type ReleaseEscrowRequest,
  type ResolveEscrowDisputeRequest,
  type ResolveEscrowDisputeResponse,
} from '@/v1/escrow/escrow.grpc.types';
import { EscrowService } from '@/v1/escrow/escrow.service';
import { Controller } from '@nestjs/common';

@Controller()
@EscrowServiceControllerMethods()
export class EscrowController implements EscrowServiceController {
  constructor(private readonly escrowService: EscrowService) {}

  async createEscrow(data: CreateEscrowRequest): Promise<EscrowResponse> {
    return this.escrowService.createEscrow(data);
  }

  async getEscrowById(data: GetEscrowByIdRequest): Promise<EscrowResponse> {
    return this.escrowService.getEscrowById(data);
  }

  async getEscrowByDealRef(data: GetEscrowByDealRefRequest): Promise<EscrowResponse> {
    return this.escrowService.getEscrowByDealRef(data);
  }

  async listEscrowsByUser(data: ListEscrowsByUserRequest): Promise<ListEscrowsResponse> {
    return this.escrowService.listEscrowsByUser(data);
  }

  async markEscrowServiceComplete(data: MarkEscrowServiceCompleteRequest): Promise<EscrowResponse> {
    return this.escrowService.markEscrowServiceComplete(data);
  }

  async releaseEscrow(data: ReleaseEscrowRequest): Promise<EscrowResponse> {
    return this.escrowService.releaseEscrow(data);
  }

  async cancelEscrow(data: CancelEscrowRequest): Promise<EscrowResponse> {
    return this.escrowService.cancelEscrow(data);
  }

  async openEscrowDispute(data: OpenEscrowDisputeRequest): Promise<OpenEscrowDisputeResponse> {
    return this.escrowService.openEscrowDispute(data);
  }

  async resolveEscrowDispute(data: ResolveEscrowDisputeRequest): Promise<ResolveEscrowDisputeResponse> {
    return this.escrowService.resolveEscrowDispute(data);
  }

  async getEscrowTimeline(data: GetEscrowTimelineRequest): Promise<GetEscrowTimelineResponse> {
    return this.escrowService.getEscrowTimeline(data);
  }
}
