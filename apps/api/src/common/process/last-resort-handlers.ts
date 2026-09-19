/**
 * Last-resort process handlers for the API (ASVS 5.0 V16.5.4).
 *
 * The two processes were not held to the same standard. outbox-worker.ts and
 * marketing-outbox-worker.ts each install `uncaughtException` and
 * `unhandledRejection` handlers that log and shut down deliberately; main.ts
 * installed neither and registered no global exception filter.
 *
 * The framework default that covers a route handler is credited under V16.5.3
 * and is a different thing: it catches an exception thrown INSIDE a request.
 * A last-resort handler is for the one thrown outside any request - in a timer,
 * an event listener, a background promise - where nothing is watching.
 *
 * Measured on the Node this repository runs (v22), not assumed from the docs:
 * with a live setInterval keeping the loop busy, an uncaught exception and an
 * unhandled rejection each terminate the process immediately with exit code 1.
 * So the pre-existing behaviour was not "Node keeps going" - it was a hard
 * stop that skipped every shutdown path: Prisma pool never closed, the HTTP
 * server never drained, OpenTelemetry never flushed, and in-flight requests
 * dropped without a response.
 *
 * What this changes is therefore the SHAPE of the stop, not whether it stops.
 * Stated plainly because the distinction is the whole control:
 *
 *   - the cause is written to stderr with its stack, and the write is AWAITED.
 *     `console.error` to a pipe is asynchronous, so a process exiting in the
 *     same tick loses the very message that explains why it exited - which is
 *     the failure mode this requirement exists to prevent.
 *   - the application is closed so connections drain and shutdown hooks run.
 *   - the process still exits non-zero. A handler that logs and then keeps
 *     serving is worse than the crash it replaced: it leaves an application
 *     whose invariants have already failed accepting traffic. That direction
 *     is asserted by a test, not left to review.
 *   - close is bounded. If shutdown itself hangs, the timeout forces the exit,
 *     because a supervisor restarting a dead process is a better outcome than
 *     one waiting on a process that will never finish.
 *
 * Signals are deliberately NOT handled here. app.enableShutdownHooks() already
 * owns SIGTERM and SIGINT for the API; the workers install their own only
 * because they run an application CONTEXT with no HTTP server to own them.
 * Registering a second handler for the same signal would run two shutdowns.
 *
 * `once` rather than `on`: if a second fatal arrives while the first is being
 * handled, Node's default takes over and the process dies immediately, which
 * is the correct outcome. A handler looping on its own failure is not.
 */

/** The part of a Nest application this needs. Narrowed so tests need no framework. */
export interface ClosableApplication {
  close(): Promise<void>;
}

export interface LastResortOptions {
  app: ClosableApplication;
  /** Injectable for tests. Defaults to the real process. */
  processRef?: NodeJS.EventEmitter & { exitCode?: number | string | null };
  /** Injectable for tests. Awaited, unlike console.error. */
  writeStderr?: (message: string) => Promise<void>;
  /** Forced exit if close() hangs. Injectable for tests. */
  forceExit?: (code: number) => void;
  /** Milliseconds allowed for a graceful close before the exit is forced. */
  closeTimeoutMs?: number;
}

const DEFAULT_CLOSE_TIMEOUT_MS = 10_000;

/**
 * Named rather than inlined, and used at the ONE exit that follows a completed
 * shutdown. The timeout branch exits with a bare 1, so the two call sites read
 * differently on purpose: an ASVS condition matching the literal `forceExit(1)`
 * was satisfied by the timeout branch alone, and so survived the removal of
 * this line. Measured, not foreseen - the mutation was applied and the matrix
 * stayed PASS. A condition a mutation can walk past is not a condition.
 */
const FATAL_EXIT_CODE = 1;

function defaultWriteStderr(message: string): Promise<void> {
  return new Promise((resolve) => process.stderr.write(message, () => resolve()));
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * Installs the handlers. Returns a promise-returning function per event only so
 * tests can await the handler; production ignores the return value.
 */
export function installLastResortHandlers(options: LastResortOptions): void {
  const {
    app,
    processRef = process,
    writeStderr = defaultWriteStderr,
    forceExit = (code: number) => process.exit(code),
    closeTimeoutMs = DEFAULT_CLOSE_TIMEOUT_MS,
  } = options;

  let handling = false;

  const handle = async (event: string, error: unknown): Promise<void> => {
    // A second fatal arriving mid-shutdown must not start a second shutdown.
    if (handling) return;
    handling = true;

    await writeStderr(`API ${event}: ${describe(error)}\n`);

    // The exit code is set BEFORE close(), so a close() that throws or hangs
    // cannot turn a fatal error into a successful-looking exit.
    (processRef as { exitCode?: number | string | null }).exitCode = 1;

    let timer: NodeJS.Timeout | undefined;
    const bounded = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        void writeStderr(`API shutdown timed out after ${closeTimeoutMs}ms; forcing exit\n`)
          .finally(() => forceExit(1));
        resolve();
      }, closeTimeoutMs);
      // The timer must not itself keep a healthy process alive.
      timer.unref?.();
    });

    await Promise.race([
      app.close().catch(async (closeError: unknown) => {
        await writeStderr(`API shutdown failed: ${describe(closeError)}\n`);
      }),
      bounded,
    ]);

    if (timer) clearTimeout(timer);
    forceExit(FATAL_EXIT_CODE);
  };

  processRef.once('uncaughtException', (error: unknown) => void handle('uncaughtException', error));
  processRef.once('unhandledRejection', (error: unknown) => void handle('unhandledRejection', error));
}
