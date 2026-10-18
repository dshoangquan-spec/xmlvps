declare module '@prisma/client' {
  export class PrismaClient {
    constructor(options?: any);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $transaction<T>(fn: (prisma: any) => Promise<T>): Promise<T>;
    [key: string]: any;
  }
}
