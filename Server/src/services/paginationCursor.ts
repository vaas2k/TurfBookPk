import { AppError } from '../helpers/errors.js';

export type PaginationCursor = { createdAt: Date; id: string };

export function parsePaginationCursor(value: unknown): PaginationCursor | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 160 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new AppError('invalid_pagination', 'Invalid pagination cursor', 422);
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof decoded.created_at !== 'string' || typeof decoded.id !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(decoded.created_at) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.id)) throw new Error('Invalid cursor');
    const createdAt = new Date(decoded.created_at);
    if (Number.isNaN(createdAt.getTime())) throw new Error('Invalid cursor date');
    return { createdAt, id: decoded.id };
  } catch {
    throw new AppError('invalid_pagination', 'Invalid pagination cursor', 422);
  }
}

export function nextPaginationCursor(row: { createdAt: Date; id: string } | undefined): string | null {
  return row ? Buffer.from(JSON.stringify({ created_at: row.createdAt.toISOString(), id: row.id })).toString('base64url') : null;
}
