import { Module } from '@nestjs/common';

/**
 * Emptied, not deleted, and that distinction is forced rather than chosen.
 *
 * This module used to register a controller whose three routes were mounted and
 * answered any authenticated caller. The setup-verify route replied
 * "MFA enabled. Save backup codes securely." while storing neither the secret
 * nor the codes; setup-init returned a plaintext TOTP secret it never saved.
 * The service behind them held the weaker of two crypto implementations -
 * randomBytes(4), 32 bits, digested with a bare unsalted createHash('sha256'),
 * against randomBytes(6) under a keyed HMAC on the live path - and a third TOTP
 * verifier with the wide acceptance window removed in #4686. Both files are
 * gone, so all of that is gone with them.
 *
 * What remains is this husk, still listed in the root module. Removing that one
 * line is currently impossible for any contour but one: apps/api/src/app.module.ts
 * sits outside the default autopilot scope, so touching it requires a
 * source-controlled scope file, while .github/workflows/pc-crop-01b3.yml fails
 * any pull request that touches app.module.ts and contains anything else - and
 * a scope file is "anything else". The two gates are individually reasonable
 * and jointly exclusive. The deadlock is reported in #4765; it is not worked
 * around here, and the one escape the gate offers - editing pc-crop-01b4.yml so
 * it skips its own scope check - is a bypass, not a fix.
 *
 * An empty module registers nothing and mounts no route.
 */
@Module({})
export class MfaModule {}
