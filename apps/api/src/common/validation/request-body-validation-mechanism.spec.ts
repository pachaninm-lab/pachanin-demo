import 'reflect-metadata';
import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { IsInt, IsString, Length } from 'class-validator';

/**
 * V2.2.1 / V2.2.2 — почему глобальный ValidationPipe закрывает лишь половину
 * поверхности записи, измерено, а не выведено из документации Nest.
 *
 * Пайп в main.ts настроен правильно (`whitelist: true`, `transform: true`), но
 * действовать он может только на параметр, у которого runtime-метатип несёт
 * метаданные class-validator. Инлайн-тип таких метаданных не оставляет.
 *
 * Этот набор — доказательство, на котором стоит рэтчет
 * scripts/security/verify-request-validation-coverage.mjs. Если поведение Nest
 * когда-нибудь изменится, падать должно здесь, а не молча в production.
 */

class CreateThingDto {
  @IsString()
  @Length(1, 10)
  name!: string;

  @IsInt()
  size!: number;
}

@Controller('validation-mechanism-probe')
class ProbeController {
  @Post('inline')
  inline(@Body() body: { name: string; size: number }) {
    return body;
  }

  @Post('record')
  record(@Body() body: Record<string, unknown>) {
    return body;
  }

  @Post('dto')
  dto(@Body() body: CreateThingDto) {
    return body;
  }
}

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });

function metatypeOf(method: string): unknown {
  const types = Reflect.getMetadata('design:paramtypes', ProbeController.prototype, method) as unknown[];
  return types[0];
}

describe('что остаётся от типа параметра @Body() во время выполнения', () => {
  it('инлайн-литерал стирается до Object', () => {
    expect(metatypeOf('inline')).toBe(Object);
  });

  it('Record<string, unknown> стирается до того же Object', () => {
    expect(metatypeOf('record')).toBe(Object);
  });

  it('класс DTO сохраняется — именно поэтому пайп его и видит', () => {
    expect(metatypeOf('dto')).toBe(CreateThingDto);
  });
});

describe('что ValidationPipe делает с каждым из этих метатипов', () => {
  const smuggled = { name: 'ok', size: 1, smuggled: 'x' };

  it('на метатипе Object не срезает ничего и не проверяет ничего', async () => {
    const result = await pipe.transform(smuggled, { type: 'body', metatype: Object } as never);
    // Лишнее поле доходит до обработчика целиком, несмотря на whitelist: true.
    expect(result).toEqual({ name: 'ok', size: 1, smuggled: 'x' });
  });

  it('на метатипе DTO срезает необъявленное поле', async () => {
    const result = await pipe.transform(smuggled, { type: 'body', metatype: CreateThingDto } as never);
    expect(result).toEqual({ name: 'ok', size: 1 });
  });

  it('на метатипе DTO отказывает нарушению ограничения', async () => {
    await expect(
      pipe.transform({ name: 'слишком длинное имя', size: 1 }, { type: 'body', metatype: CreateThingDto } as never),
    ).rejects.toThrow();
  });

  it('на метатипе Object то же самое нарушение проходит беспрепятственно', async () => {
    // Обратное направление: иначе «пайп отказывает всегда» прошло бы как успех.
    const result = await pipe.transform(
      { name: 'слишком длинное имя', size: 'не число' },
      { type: 'body', metatype: Object } as never,
    );
    expect(result).toEqual({ name: 'слишком длинное имя', size: 'не число' });
  });
});
