import { IsString, Matches, MinLength } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  @MinLength(40)
  challengeToken!: string;

  @IsString()
  @Matches(/^(?:\d{6}|[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4})$/)
  code!: string;
}
