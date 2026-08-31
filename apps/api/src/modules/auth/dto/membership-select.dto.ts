import { IsString, MaxLength, MinLength } from 'class-validator';

export class MembershipSelectDto {
  @IsString()
  @MinLength(48)
  @MaxLength(512)
  challengeToken!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  membershipId!: string;
}
