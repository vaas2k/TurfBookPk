import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../configs/env.js';
import * as schema from './schema.js';


// console.log('Database URL:', env.databaseUrl); // Log the database URL for debugging

export const sql = postgres(env.databaseUrl, {
  max: env.nodeEnv === 'production' ? 10 : 3,
  prepare: false,
});

export const db = drizzle(sql, { schema });

console.log('Database connection established successfully.'); // Log successful connection


