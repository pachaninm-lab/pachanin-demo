import { AsyncLocalStorage } from 'node:async_hooks';

export type CommandExecutionContext = Readonly<{
  commandId: string;
}>;

const storage = new AsyncLocalStorage<CommandExecutionContext>();

export function runWithCommandExecutionContext<T>(
  context: CommandExecutionContext,
  work: () => T,
): T {
  return storage.run(Object.freeze(context), work);
}

export function currentCommandExecutionId(): string | undefined {
  return storage.getStore()?.commandId;
}
