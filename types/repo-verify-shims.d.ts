declare namespace React { type ReactNode = any; type CSSProperties = Record<string, any>; interface FC<P = any> { (props: P): any } }
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }
declare type BufferLike = { toString(encoding?: string): string };
declare const process: { env: Record<string, string | undefined> };
declare const Buffer: { from(input: string, encoding?: string): BufferLike };
declare function fetch(input: string | URL, init?: any): Promise<any>;
declare const console: { log: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void };
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number): any;
declare function clearTimeout(handle?: any): void;
declare function describe(name: string, fn: () => any): void;
declare function it(name: string, fn: () => any): void;
declare function test(name: string, fn: () => any): void;
declare function expect(value: any): any;
declare function beforeEach(fn: () => any): void;
declare function afterEach(fn: () => any): void;
declare function beforeAll(fn: () => any): void;
declare function afterAll(fn: () => any): void;

declare module 'react' { const React: any; export default React; export type ReactNode = any; export function useMemo(...args:any[]): any; export function useState(...args:any[]): any; export function useEffect(...args:any[]): any; export function useRef(...args:any[]): any; export function useCallback(...args:any[]): any; export function memo(...args:any[]): any; export function Fragment(...args:any[]): any; export function createContext(...args:any[]): any; export function useContext(...args:any[]): any; }
declare module 'next/link' { const Link: any; export default Link; }
declare module 'next/image' { const Image: any; export default Image; }
declare module 'next/navigation' { export function useRouter(): any; export function usePathname(): string; export function useSearchParams(): any; export function redirect(url: string): never; export function notFound(): never; }
declare module 'next/headers' { export function cookies(): any; export function headers(): any; }
declare module 'next/server' {
  export class NextResponse {
    static json(...args:any[]): any;
    static redirect(...args:any[]): any;
  }
  export class NextRequest {
    nextUrl: { pathname: string; clone(): any; searchParams: any };
    headers: any;
    cookies: any;
  }
}

declare module '@nestjs/common' {
  export const Injectable: (...args:any[]) => any;
  export const Module: (...args:any[]) => any;
  export const Controller: (...args:any[]) => any;
  export const Get: (...args:any[]) => any;
  export const Post: (...args:any[]) => any;
  export const Patch: (...args:any[]) => any;
  export const Put: (...args:any[]) => any;
  export const Delete: (...args:any[]) => any;
  export const Body: (...args:any[]) => any;
  export const Param: (...args:any[]) => any;
  export const Query: (...args:any[]) => any;
  export const Req: (...args:any[]) => any;
  export const Res: (...args:any[]) => any;
  export const UseGuards: (...args:any[]) => any;
  export const UseInterceptors: (...args:any[]) => any;
  export const UploadedFile: (...args:any[]) => any;
  export const UploadedFiles: (...args:any[]) => any;
  export const SetMetadata: (...args:any[]) => any;
  export const Headers: (...args:any[]) => any;
  export const HttpCode: (...args:any[]) => any;
  export const Logger: any;
  export class UnauthorizedException { constructor(...args:any[]) }
  export class ForbiddenException { constructor(...args:any[]) }
  export class BadRequestException { constructor(...args:any[]) }
  export class NotFoundException { constructor(...args:any[]) }
  export class ConflictException { constructor(...args:any[]) }
  export class HttpException { constructor(...args:any[]) }
  export class ExecutionContext { switchToHttp(...args:any[]): any; getHandler(...args:any[]): any; getClass(...args:any[]): any }
  export interface CanActivate { canActivate(...args: any[]): any }
  export interface OnModuleInit { onModuleInit(): any }
  export interface NestMiddleware { use(...args: any[]): any }
  export interface INestApplication { close(): any; use(...args:any[]): any; enableCors(...args:any[]): any; setGlobalPrefix(...args:any[]): any; init(...args:any[]): any; getHttpServer(...args:any[]): any; }
}

declare module '@nestjs/core' {
  export const APP_GUARD: any;
  export const APP_INTERCEPTOR: any;
  export class Reflector { get<T = any>(...args:any[]): T; getAllAndOverride<T = any>(...args:any[]): T }
  export const NestFactory: { create: (...args:any[]) => Promise<any> };
}

declare module '@nestjs/config' { export const ConfigModule: any; export const ConfigService: any; }
declare module '@nestjs/platform-express' { export const MulterModule: any; export const FileInterceptor: (...args:any[]) => any; }
declare module '@nestjs/testing' { export const Test: any; export type TestingModule = any; }
declare module '@nestjs/websockets' {
  export const WebSocketGateway: (...args:any[]) => any;
  export const WebSocketServer: (...args:any[]) => any;
  export const SubscribeMessage: (...args:any[]) => any;
  export const MessageBody: (...args:any[]) => any;
  export const ConnectedSocket: (...args:any[]) => any;
  export type OnGatewayConnection = any;
  export type OnGatewayDisconnect = any;
}

declare module 'rxjs' {
  export class Observable<T = any> { pipe(...args: any[]): Observable<any>; }
  export function of<T = any>(value: T): Observable<T>;
  export function from<T = any>(value: any): Observable<T>;
  export function tap(...args:any[]): any;
}

declare module 'bcryptjs' { export function hash(...args:any[]): Promise<string>; export function compare(...args:any[]): Promise<boolean>; export function genSalt(...args:any[]): Promise<string>; export function hashSync(...args:any[]): string; export function compareSync(...args:any[]): boolean; }
declare module 'jsonwebtoken' { export function sign(...args:any[]): string; export function verify(...args:any[]): any; export function decode(...args:any[]): any; }
declare module 'prom-client' { export class Counter<T = string> { constructor(config?: any); inc(...args:any[]): void } export class Histogram<T = string> { constructor(config?: any); startTimer(...args:any[]): any; observe(...args:any[]): void } export class Registry { constructor(...args:any[]); metrics(): Promise<string>; registerMetric(...args:any[]): void } export function collectDefaultMetrics(...args:any[]): void; const client: any; export = client; }
declare module 'reflect-metadata';
declare module 'class-transformer' { export function plainToInstance(...args:any[]): any; export function Type(...args:any[]): any; }
declare module 'class-validator' {
  export function IsString(...args:any[]): any; export function IsOptional(...args:any[]): any; export function IsEnum(...args:any[]): any; export function IsUUID(...args:any[]): any; export function IsArray(...args:any[]): any; export function IsNumber(...args:any[]): any; export function IsBoolean(...args:any[]): any; export function ValidateNested(...args:any[]): any; export function Min(...args:any[]): any; export function Max(...args:any[]): any; export function IsDateString(...args:any[]): any; export function IsObject(...args:any[]): any; export function IsIn(...args:any[]): any; export function IsInt(...args:any[]): any; export function IsEmail(...args:any[]): any; export function MinLength(...args:any[]): any;
}
declare module 'socket.io' { export type Server = any; export type Socket = any; }
declare module 'socket.io-client' { const io: any; export default io; export type Socket = any; }
declare module 'supertest' { const request: any; export = request; }

declare module '@prisma/client' {
  export class PrismaClient { [key: string]: any }
  export const PrismaClientKnownRequestError: any;
  export const Role: any;
  export const AuthProvider: any;
  export const DealStatus: any;
  export const KycStatus: any;
  export const LotStatus: any;
  export const OrgType: any;
  export const OrganizationOnboardingStatus: any;
  export const RegistrationDecision: any;
  export const RestrictionStatus: any;
  export const RiskLevel: any;
  export const ShipmentStatus: any;
  export const DocumentType: any;
  export const LedgerEntryDirection: any;
  export const LedgerEntryStatus: any;
  export const LedgerEntryType: any;
  export const DisputeStatus: any;
  export const LabSampleStatus: any;
  export const LabTestStatus: any;
  export const ExternalSystem: any;
  export const SyncJobStatus: any;
  export const BidStatus: any;
  export const EvidenceStatus: any;
  export const SupportTicketPriority: any;
  export const SupportTicketStatus: any;
  export const NotificationChannel: any;
  export const OutboxStatus: any;
  export const DocumentStorageProvider: any;
  export type Role = any;
  export type AuthProvider = any;
  export type DealStatus = any;
  export type KycStatus = any;
  export type LotStatus = any;
  export type OrgType = any;
  export type OrganizationOnboardingStatus = any;
  export type RegistrationDecision = any;
  export type RestrictionStatus = any;
  export type RiskLevel = any;
  export type ShipmentStatus = any;
  export type DocumentType = any;
  export type LedgerEntryDirection = any;
  export type LedgerEntryStatus = any;
  export type LedgerEntryType = any;
  export type DisputeStatus = any;
  export type LabSampleStatus = any;
  export type LabTestStatus = any;
  export type ExternalSystem = any;
  export type SyncJobStatus = any;
  export type BidStatus = any;
  export type EvidenceStatus = any;
  export type SupportTicketPriority = any;
  export type SupportTicketStatus = any;
  export type NotificationChannel = any;
  export type OutboxStatus = any;
  export type DocumentStorageProvider = any;
  export type ExternalSyncJob = any;
  export namespace Prisma {
    export type LotWhereInput = any;
    export type DealWhereInput = any;
    export type ShipmentWhereInput = any;
    export type DocumentWhereInput = any;
    export type DisputeWhereInput = any;
    export type EvidenceRecordWhereInput = any;
    export type AntiFraudCaseWhereInput = any;
    export type AuditEntryWhereInput = any;
    export type ChatRoomWhereInput = any;
    export type SupportTicketWhereInput = any;
    export type ExternalSyncJobWhereInput = any;
  }
}

interface URL { clone(): URL; protocol: string; searchParams: any; hostname: string }
declare const URL: { new(input: string, base?: string | URL): URL };
declare const URLSearchParams: { new(init?: any): any };
declare const AbortController: { new(): { signal: any; abort(reason?: any): void } };

declare module 'fs' { export const promises: any; export function existsSync(...args:any[]): any; export function readFileSync(...args:any[]): any; export function createReadStream(...args:any[]): any; export function mkdirSync(...args:any[]): any; export function writeFileSync(...args:any[]): any; export function readdirSync(...args:any[]): any; export function statSync(...args:any[]): any; const fs: any; export = fs; }
declare module 'path' { export function resolve(...args:any[]): string; export function basename(...args:any[]): string; export function extname(...args:any[]): string; export function join(...args:any[]): string; const path: any; export = path; }
declare module 'crypto' { export function createHash(...args:any[]): any; export function createHmac(...args:any[]): any; export function randomUUID(...args:any[]): string; export function randomBytes(...args:any[]): BufferLike; export function timingSafeEqual(...args:any[]): boolean; const crypto: any; export = crypto; }
declare module 'node:fs' { export const promises: any; export function existsSync(...args:any[]): any; export function readFileSync(...args:any[]): any; const fs: any; export = fs; }
declare module 'node:path' { export function resolve(...args:any[]): string; export function basename(...args:any[]): string; export function extname(...args:any[]): string; export function join(...args:any[]): string; const path: any; export = path; }
declare module 'node:crypto' { export function createHash(...args:any[]): any; export function createHmac(...args:any[]): any; export function randomUUID(...args:any[]): string; export function randomBytes(...args:any[]): BufferLike; export function timingSafeEqual(...args:any[]): boolean; const crypto: any; export = crypto; }
declare module 'node:sqlite' { export class DatabaseSync { constructor(...args:any[]); [key:string]: any } const sqlite: any; export = sqlite; }
declare module 'react-dom' { const ReactDOM: any; export default ReactDOM; }

declare module 'buffer' { export const Buffer: typeof globalThis.Buffer; }
declare module 'express' { export type Request = any; export type Response = any; const exp: any; export = exp; }
declare namespace Express { namespace Multer { type File = any } }

declare module 'events' { export class EventEmitter { on(...args:any[]): any; emit(...args:any[]): any; off(...args:any[]): any } }

declare function beforeEach(fn: () => any): void;
declare function afterEach(fn: () => any): void;
declare function beforeAll(fn: () => any): void;
declare function afterAll(fn: () => any): void;
declare const jest: any;