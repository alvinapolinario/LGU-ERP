import type { Database } from './database.js';
import type { Config } from './config.js';
export const CONTEXT = Symbol('CONTEXT');
export interface AppContext {db:Database;redis:{ping:()=>Promise<string>};config:Config;}
