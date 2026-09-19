import { Injectable } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import type { AddDisputeEvidenceDto } from './dto/add-dispute-evidence.dto';
import type { AppealDisputeDto } from './dto/appeal-dispute.dto';
import type { BindDisputeOperationsDto } from './dto/bind-dispute-operations.dto';
import type { CreateDisputeDto } from './dto/create-dispute.dto';
import type { DecideDisputeDto } from './dto/decide-dispute.dto';
import type { DisputeVersionCommandDto } from './dto/dispute-version-command.dto';
import type { ResolveDisputeAppealDto } from './dto/resolve-dispute-appeal.dto';
import { PostgresqlDisputeRepository } from './postgresql-dispute.repository';

@Injectable()
export class DisputesService {
  constructor(private readonly repository: PostgresqlDisputeRepository) {}

  list(user: RequestUser) {
    return this.repository.list(user);
  }

  getOne(id: string, user: RequestUser) {
    return this.repository.getOne(id, user);
  }

  create(dto: CreateDisputeDto, user: RequestUser) {
    return this.repository.open(dto, user);
  }

  triage(id: string, dto: DisputeVersionCommandDto, user: RequestUser) {
    return this.repository.triage(id, dto, user);
  }

  addEvidence(id: string, dto: AddDisputeEvidenceDto, user: RequestUser) {
    return this.repository.addEvidence(id, dto, user);
  }

  decision(id: string, dto: DecideDisputeDto, user: RequestUser) {
    return this.repository.decide(id, dto, user);
  }

  appeal(id: string, dto: AppealDisputeDto, user: RequestUser) {
    return this.repository.appeal(id, dto, user);
  }

  resolveAppeal(id: string, dto: ResolveDisputeAppealDto, user: RequestUser) {
    return this.repository.resolveAppeal(id, dto, user);
  }

  finalize(id: string, dto: DisputeVersionCommandDto, user: RequestUser) {
    return this.repository.finalize(id, dto, user);
  }

  bindOperations(id: string, dto: BindDisputeOperationsDto, user: RequestUser) {
    return this.repository.bindOperations(id, dto, user);
  }

  close(id: string, dto: DisputeVersionCommandDto, user: RequestUser) {
    return this.repository.close(id, dto, user);
  }
}
