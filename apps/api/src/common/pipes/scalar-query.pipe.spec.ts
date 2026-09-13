import { ArgumentMetadata, BadRequestException } from '@nestjs/common';

import { ScalarQueryPipe } from './scalar-query.pipe';

/**
 * ASVS 5.0 V15.3.7.
 *
 * `?region=a&region=b` reaches a handler declared `@Query('region') region: string`
 * as `['a','b']`. The decorator says string; the runtime hands over an array.
 */
describe('ScalarQueryPipe', () => {
  const pipe = new ScalarQueryPipe();
  const named = (data: string): ArgumentMetadata => ({ type: 'query', data, metatype: String });

  it('refuses a repeated named query parameter, and says which one and how often', () => {
    expect(() => pipe.transform(['a', 'b'], named('region'))).toThrow(BadRequestException);
    try {
      pipe.transform(['a', 'b', 'c'], named('region'));
      fail('the pipe must not accept a repeated parameter');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: 'region must be sent once; the request repeated it 3 times',
      });
    }
  });

  it('passes a single value through untouched', () => {
    expect(pipe.transform('a', named('region'))).toBe('a');
    expect(pipe.transform(undefined, named('region'))).toBeUndefined();
    expect(pipe.transform('', named('region'))).toBe('');
  });

  /**
   * `@Query()` with no name carries a DTO, and ValidationPipe already refuses an
   * array against a declared scalar field. Refusing here too would be harmless
   * but would move the diagnostic away from the field that caused it.
   */
  it('leaves a DTO-bound query alone, because ValidationPipe owns that case', () => {
    const dtoBound: ArgumentMetadata = { type: 'query', data: undefined, metatype: Object };
    const value = { region: ['a', 'b'] };
    expect(pipe.transform(value, dtoBound)).toBe(value);
  });

  it('touches nothing that is not a query parameter', () => {
    for (const type of ['body', 'param', 'custom'] as const) {
      const value = ['a', 'b'];
      expect(pipe.transform(value, { type, data: 'region', metatype: String })).toBe(value);
    }
  });
});
