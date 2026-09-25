/* The handful of host APIs the TypeScript pad provides beyond ES2022.
 * Both a browser Web Worker and Node 20+ have all of these. */

interface Console {
  log(...data: unknown[]): void;
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
  debug(...data: unknown[]): void;
  table(data: unknown): void;
}
declare var console: Console;

declare function setTimeout(handler: (...args: any[]) => void, timeout?: number): number;
declare function clearTimeout(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;
declare function structuredClone<T>(value: T): T;

declare function atob(data: string): string;
declare function btoa(data: string): string;

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  decode(input?: Uint8Array | ArrayBuffer): string;
}

declare class URLSearchParams {
  constructor(init?: string | Record<string, string>);
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  keys(): IterableIterator<string>;
  entries(): IterableIterator<[string, string]>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
  toString(): string;
}

interface CryptoKey {
  readonly type: string;
}
interface SubtleCrypto {
  importKey(
    format: "raw",
    keyData: Uint8Array | ArrayBuffer,
    algorithm: { name: "HMAC"; hash: "SHA-256" | "SHA-1" | "SHA-512" },
    extractable: boolean,
    keyUsages: ("sign" | "verify")[]
  ): Promise<CryptoKey>;
  sign(algorithm: "HMAC", key: CryptoKey, data: Uint8Array | ArrayBuffer): Promise<ArrayBuffer>;
  digest(algorithm: "SHA-256" | "SHA-1" | "SHA-512", data: Uint8Array | ArrayBuffer): Promise<ArrayBuffer>;
}
declare var crypto: {
  readonly subtle: SubtleCrypto;
  randomUUID(): string;
  getRandomValues<T extends Uint8Array>(array: T): T;
};
