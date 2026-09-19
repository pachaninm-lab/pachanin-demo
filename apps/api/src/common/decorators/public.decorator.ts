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
