declare const process: { env: Record<string, string | undefined> };
declare const Buffer: { from(input: string, encoding?: string): { toString(encoding?: string): string } };
declare function fetch(input: string | URL, init?: any): Promise<any>;
declare const console: { log: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void };
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number): any;
declare function clearTimeout(handle?: any): void;
