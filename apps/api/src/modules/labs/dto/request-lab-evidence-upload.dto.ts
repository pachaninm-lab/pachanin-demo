import {
  IsIn,
  IsInt,
  IsMimeType,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const LAB_OPERATION_EVIDENCE_PURPOSES = [
  'COLLECTION',
  'SEALED',
  'HANDOFF',
  'RECEIVED',
  'OPENED',
  'TEST',
  'PROTOCOL',
] as const;

export const LAB_PROVISIONING_EVIDENCE_PURPOSES = [
  'LAB_AUTHORITY',
  'ACTOR_AUTHORITY',
  'METHOD_AUTHORITY',
  'EQUIPMENT_AUTHORITY',
  'ADMISSION',
] as const;

export type LabOperationEvidencePurpose = typeof LAB_OPERATION_EVIDENCE_PURPOSES[number];
export type LabProvisioningEvidencePurpose = typeof LAB_PROVISIONING_EVIDENCE_PURPOSES[number];

class LabEvidenceUploadFileDto {
  @IsString()
  @MaxLength(180)
  filename!: string;

  @IsString()
  @IsMimeType()
  @MaxLength(160)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(200 * 1024 * 1024)
  sizeBytes!: number;
}

export class RequestSampleEvidenceUploadDto extends LabEvidenceUploadFileDto {
  @IsIn(LAB_OPERATION_EVIDENCE_PURPOSES)
  purpose!: LabOperationEvidencePurpose;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  protocolNumber?: string;
}

export class RequestProvisioningEvidenceUploadDto extends LabEvidenceUploadFileDto {
  @IsIn(LAB_PROVISIONING_EVIDENCE_PURPOSES)
  purpose!: LabProvisioningEvidencePurpose;

  @IsString()
  @MaxLength(180)
  dealId!: string;

  @IsString()
  @MaxLength(180)
  laboratoryOrgId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  shipmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  acceptanceId?: string;
}
