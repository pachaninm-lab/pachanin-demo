import { IsBoolean, IsIn, IsObject, IsString, MaxLength } from 'class-validator';

import { Role } from '../../../common/types/request-user';

/**
 * Admin request bodies, as classes the global ValidationPipe can see.
 *
 * Five handlers declared their body inline. Two of them - updateRole and
 * updateOrg - reach nothing: legacy-admin-identity-boundary.ts replaces
 * AuthService.updateUserRole and updateUserOrg with functions that throw
 * ServiceUnavailableException, because direct identity mutation was retired in
 * favour of the membership administration workflow. They are typed here anyway,
 * since a DTO costs nothing and the day somebody re-enables the service is not
 * the day to discover the body was never checked - but no claim is made that
 * typing them closed an exposure.
 *
 * The three that do something are the point. requeueOutbox redrives a durable
 * outbox entry under an idempotency key; blockUser answers on a user's blocked
 * state; evaluatePolicy runs the policy engine on a caller-supplied subject and
 * resource, which is the one place in the API where an unauthenticated shape
 * decides what an authorization decision is computed from.
 */

export class UpdateUserRoleDto {
  @IsIn(Object.values(Role)) role!: Role;
}

export class UpdateUserOrgDto {
  @IsString() @MaxLength(240) orgId!: string;
}

export class RequeueOutboxEntryDto {
  @IsString() @MaxLength(2000) reason!: string;
  @IsString() @MaxLength(240) idempotencyKey!: string;
}

/**
 * `blocked` was a bare `boolean`, which erases at runtime. The handler answers
 * with a different message for true and false, so a string, a number or an
 * object decided which sentence the operator was shown while `blocked: body.blocked`
 * echoed whatever arrived.
 */
export class BlockUserDto {
  @IsBoolean() blocked!: boolean;
}

/**
 * user and resource stay open objects because PolicyInput is open by design -
 * the engine reads role, organizationId, tenantId, mfaVerified and a resource
 * type with optional ids, and different call sites carry different subsets.
 * @IsObject refuses the shapes that are not shapes at all: a string, an array,
 * a number, null. The action is a name the engine matches, so it is bounded in
 * length rather than enumerated; the engine's own default-deny answers an action
 * it does not recognise.
 */
export class EvaluatePolicyDto {
  @IsString() @MaxLength(240) action!: string;
  @IsObject() user!: Record<string, unknown>;
  @IsObject() resource!: Record<string, unknown>;
}
