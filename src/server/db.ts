import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { seedDatabase, resetDemoDatabase } from './seed.ts';

const dbFilePath = path.resolve(process.cwd(), 'setuone.db');

const db = new DatabaseSync(dbFilePath);
resetDemoDatabase(db);

export function getDb(): DatabaseSync {
  return db;
}

export function resetDb(): void {
  resetDemoDatabase(db);
}

export function getDatabaseFilePath(): string {
  return dbFilePath;
}
