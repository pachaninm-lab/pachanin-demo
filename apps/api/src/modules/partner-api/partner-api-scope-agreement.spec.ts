import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { PartnerApiService } from './partner-api.service';
import { PARTNER_API_SCOPES } from './partner-api.scopes';
import { GenerateApiKeyDto } from './dto/partner-api.dto';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * Граница и сервис должны принимать РОВНО один и тот же набор scope.
 *
 * Этот набор существует из-за настоящего дефекта первой версии правки: DTO
 * объявляла собственную копию списка рядом с комментарием о том, что ничего не
 * дублируется. Две копии расходятся молча — по одному файлу это не видно.
 * Список теперь один (`partner-api.scopes.ts`), а согласие проверяется здесь, а
 * не подразумевается.
 */

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const throughPipe = (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype: GenerateApiKeyDto } as never);

const user: RequestUser = {
  id: 'u-1', orgId: 'org-1', role: Role.ADMIN, email: 'a@example.test', tenantId: 't-1',
};

describe('scope партнёрского API: граница и сервис согласны', () => {
  it.each(PARTNER_API_SCOPES.map((scope) => [scope]))('«%s» принимается и пайпом, и сервисом', async (scope) => {
    await expect(throughPipe({ name: 'k', scopes: [scope] })).resolves.toMatchObject({ scopes: [scope] });
    expect(() => new PartnerApiService().generateApiKey({ name: 'k', scopes: [scope] }, user)).not.toThrow();
  });

  it('неизвестный scope отвергают оба', async () => {
    await expect(throughPipe({ name: 'k', scopes: ['billing:admin'] })).rejects.toThrow();
    expect(() => new PartnerApiService().generateApiKey({ name: 'k', scopes: ['billing:admin'] }, user)).toThrow();
  });

  it('верхняя граница длины массива не отсекает полный набор', async () => {
    // ArrayMaxSize привязан к длине списка. Если список вырастет, а граница
    // останется прежней, законный запрос со всеми scope перестанет проходить.
    await expect(
      throughPipe({ name: 'k', scopes: [...PARTNER_API_SCOPES] }),
    ).resolves.toMatchObject({ scopes: [...PARTNER_API_SCOPES] });
  });
});
