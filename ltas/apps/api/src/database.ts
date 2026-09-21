import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/prisma/client.js';

export function createDatabase(connection: string): PrismaClient {
  const url = new URL(connection);
  const tls = url.searchParams.get('ssl') === 'true';
  return new PrismaClient({ adapter: new PrismaMariaDb({
    host:url.hostname, port:Number(url.port || 3306), user:decodeURIComponent(url.username),
    password:decodeURIComponent(url.password), database:url.pathname.slice(1), connectionLimit:5,
    ...(tls ? {ssl:{rejectUnauthorized:true}} : {allowPublicKeyRetrieval:true}),
  }) });
}
export type Database = PrismaClient;
export type { Prisma } from './generated/prisma/client.js';
