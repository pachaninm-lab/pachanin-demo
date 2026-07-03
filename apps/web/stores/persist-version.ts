// Единая версия схемы persisted-сторов. Поднимать при несовместимом изменении
// формы состояния. Стор из другой версии тихо сбрасывается на дефолты —
// сломанная гидрация не должна ронять страницу в error-boundary
// («Страница временно обновляется» у вернувшихся пользователей).
export const PERSIST_VERSION = 1;

export function migrateOrReset<S>(persisted: unknown, version: number): S {
  // undefined заставляет zustand merge() взять свежие дефолты стора.
  return (version === PERSIST_VERSION ? persisted : undefined) as S;
}
