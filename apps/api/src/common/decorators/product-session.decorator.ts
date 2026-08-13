import { SetMetadata } from '@nestjs/common';

/**
 * Explicit opt-in for routes that accept an organization-less product session.
 *
 * Product sessions must never become a second globally accepted actor type:
 * most protected platform controllers rely on AppAuthGuard itself and do not
 * add another guard that could reject a missing request.user. Only a surface
 * that deliberately reads request.productUser may carry this metadata.
 */
export const PRODUCT_SESSION_ROUTE = 'product_session_route';

export const AllowProductSession = () => SetMetadata(PRODUCT_SESSION_ROUTE, true);
