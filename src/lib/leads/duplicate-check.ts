import type { LeadsRepository } from '@/lib/airtable';

export class DuplicateLeadError extends Error {
  readonly statusCode = 409;

  constructor(email: string) {
    super(`Duplicate lead for email: ${email}`);
    this.name = 'DuplicateLeadError';
  }
}

export async function assertNoDuplicateLeadByEmail(
  repository: LeadsRepository,
  email: string,
): Promise<void> {
  const existing = await repository.findByEmail(email);
  if (existing) throw new DuplicateLeadError(email);
}

