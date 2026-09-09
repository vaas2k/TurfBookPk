export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected server error';
}

export function databaseConstraintError(error: unknown): AppError | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: string; constraint_name?: string };
  const constraint = candidate.constraint_name || '';
  if (candidate.code === '23P01' || constraint === 'slots_no_overlapping_times') {
    return new AppError('slot_conflict', 'This slot overlaps an existing slot', 409);
  }
  if (candidate.code === '23505' && (constraint === 'bookings_one_active_booking_per_slot' || constraint === 'bookings_idempotency_key_unique')) {
    return new AppError('booking_conflict', 'This booking request conflicts with an existing booking', 409);
  }
  if (candidate.code === '23514' && constraint.startsWith('slots_')) {
    return new AppError('invalid_slot_state', 'The requested slot state is invalid', 409);
  }
  return null;
}

export function requestParsingError(error: unknown): AppError | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { status?: number; type?: string };
  if (candidate.status === 413 || candidate.type === 'entity.too.large') {
    return new AppError('request_too_large', 'Request body exceeds the 32 KB limit', 413);
  }
  if (candidate.status === 400 || candidate.type === 'entity.parse.failed') {
    return new AppError('invalid_json', 'Request body contains invalid JSON', 400);
  }
  return null;
}
