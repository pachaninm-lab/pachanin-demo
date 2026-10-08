import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

/** Верхняя граница пакета. Названа здесь один раз и переиспользуется сервисом. */
export const REPUTATION_BATCH_MAX = 200;

/**
 * Пакетный запрос оценок деловой репутации.
 *
 * Замерено на живом сервисе до правки, три отдельных дефекта:
 *
 *   orgIds: ['__proto__', ...]  → ключ не появляется в ответе ВООБЩЕ, и при
 *                                 этом ПОДМЕНЯЕТСЯ прототип объекта-результата
 *                                 (Object.hasOwn __proto__ = false,
 *                                  getPrototypeOf !== Object.prototype)
 *   orgIds длиной 20 000        → принято, 40 000 обращений к БД в одном
 *                                 запросе, все одновременно через Promise.all
 *   orgIds: [{}, null, 42]      → ключи '[object Object]', 'null', '42'
 *
 * Первый — тот же класс, что уже закрывали в отчёте Росстата: накопитель был
 * объектным литералом, а ключ приходит из запроса. Здесь он опаснее, потому
 * что значение — объект, и присваивание в `__proto__` не теряется, а меняет
 * прототип ответа.
 *
 * `@IsArray()` здесь не украшение и не дублирование `@ArrayMaxSize`: измерено
 * в соседнем partner-api, что на не-массиве `{ each: true }` просто не
 * срабатывает, а требование «это массив» держит именно ограничение размера.
 * Оба оставлены сознательно.
 */
export class ReputationBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(REPUTATION_BATCH_MAX)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  orgIds!: string[];
}
