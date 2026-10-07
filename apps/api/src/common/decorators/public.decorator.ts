import { SetMetadata, applyDecorators } from '@nestjs/common';

export const PUBLIC_ROUTE = 'public_route';
export const PUBLIC_ROUTE_OPTIONS = 'public_route_options';

export type PublicRouteOptions = {
  envFlag?: string;
};

export const Public = (options: PublicRouteOptions = {}) => applyDecorators(
  SetMetadata(PUBLIC_ROUTE, true),
  SetMetadata(PUBLIC_ROUTE_OPTIONS, options)
);

// This permits only an authenticated password session to complete its own
// MFA proof or end its own session. It does not make a route public.
export const PASSWORD_SESSION_AUTH_ACTION = 'password_session_auth_action';
export const PasswordSessionAuthAction = () => SetMetadata(PASSWORD_SESSION_AUTH_ACTION, true);
