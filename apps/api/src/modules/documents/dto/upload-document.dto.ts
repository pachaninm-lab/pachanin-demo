import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DOCUMENT_REQUIREMENTS } from '../document-matrix.service';

const DOCUMENT_TYPES = DOCUMENT_REQUIREMENTS.map((requirement) => requirement.docType);

/** Promotes a verified immutable storage object into a workflow document version. */
export class UploadDocumentDto {
  @IsString()
  @MaxLength(200)
  sourceFileId!: string;

  @IsString()
  @IsIn(DOCUMENT_TYPES)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supersedesId?: string;

  @IsString()
  @MaxLength(200)
  commandId!: string;

  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
