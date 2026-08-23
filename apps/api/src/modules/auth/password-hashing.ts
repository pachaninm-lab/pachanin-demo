import * as bcrypt from 'bcryptjs';

/**
 * Единственный источник стоимости bcrypt для паролей платформы.
 *
 * Константа объявлена здесь, а не в каждом сервисе, по конкретной причине.
 * Пока стоимость записывалась литералом в четырёх местах, а хеш-заглушка для
 * несуществующего аккаунта считалась в пятом, эти числа разошлись: заглушка
 * стоила 10, реальные пароли — 12. Ветка «аккаунт не найден» выполняла
 * примерно вчетверо меньше работы, чем ветка «аккаунт найден», и время ответа
 * снова сообщало, зарегистрирован ли email — ровно тот канал, ради закрытия
 * которого заглушка и вводилась.
 *
 * Расхождение здесь невозможно: и запись, и заглушка берут одно значение.
 */
export const PASSWORD_BCRYPT_COST = 12;

/**
 * Хеш-заглушка для сравнения, когда учётной записи нет.
 *
 * Считается один раз при загрузке модуля и с той же стоимостью, что и
 * настоящие пароли, поэтому обе ветки входа выполняют одинаковую работу.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'invalid-password-sentinel',
  PASSWORD_BCRYPT_COST,
);

/** Единственный способ получить хеш пароля для хранения. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_BCRYPT_COST);
}

/**
 * Проверка пароля, которая выполняется всегда — и когда учётная запись
 * найдена, и когда нет.
 *
 * Ветвление живёт здесь, а не у вызывающей стороны, чтобы новый путь входа
 * не мог случайно пропустить bcrypt для несуществующего пользователя или
 * подставить заглушку другой стоимости.
 */
export function accountExists(storedHash: string | null | undefined): boolean {
  return typeof storedHash === 'string' && storedHash.length > 0;
}

/**
 * Хеш, с которым будет выполнено сравнение.
 *
 * Вынесено в отдельную функцию, чтобы стоимость на ветке «аккаунта нет»
 * можно было проверить тестом напрямую, а не измерением времени: измерение
 * времени на общих CI-раннерах нестабильно и не объясняет причину падения.
 */
export function comparisonHashFor(storedHash: string | null | undefined): string {
  return accountExists(storedHash) ? (storedHash as string) : DUMMY_PASSWORD_HASH;
}

export async function verifyPassword(
  plain: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  const matches = await bcrypt.compare(plain, comparisonHashFor(storedHash));
  // Сравнение уже выполнено, поэтому этот возврат не меняет времени ответа.
  // Он лишь исключает вход по значению самой заглушки.
  return accountExists(storedHash) && matches;
}
