import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * ASVS 5.0 V15.3.7: HTTP parameter pollution.
 *
 * A query string may repeat a name. `?region=a&region=b` reaches a handler
 * declared `@Query('region') region: string` as the array `['a', 'b']` — the
 * annotation says string and the runtime hands over an array, because a
 * decorator is not a check. Downstream the value is compared, interpolated or
 * passed to a query builder as though it were the scalar it claims to be, and
 * which of the two values wins is decided by whichever line touches it first.
 *
 * Seven query parameters in this API are bound to a DTO class and the global
 * ValidationPipe already refuses the array for them: "region must be a string".
 * The other 120 are named scalars taking the raw value, and nothing looked. This
 * makes the whole surface behave the way the validated part already behaves,
 * rather than leaving one rule for the seven and no rule for the rest.
 *
 * Refusing rather than taking the first value is deliberate. Picking one silently
 * would hide a request nobody meant to send, and it would still differ from what
 * the DTO-bound parameters do. Every named query parameter in this API is
 * scalar-typed - 116 `string` and 4 `string | undefined`, none an array - so no
 * caller loses a behaviour it had.
 */
@Injectable()
export class ScalarQueryPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // `@Query()` with no name carries a DTO; ValidationPipe owns that case and
    // rejects an array against a declared scalar field.
    if (metadata.type !== 'query' || !metadata.data) return value;
    if (!Array.isArray(value)) return value;
    throw new BadRequestException(
      `${metadata.data} must be sent once; the request repeated it ${value.length} times`,
    );
  }
}
