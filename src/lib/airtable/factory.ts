import {
  AirtableClient,
  EmailsRepository,
  LeadsRepository,
  LogsRepository,
  SessionsRepository,
  UsersRepository,
} from '.';

function requireAirtableEnv(name: 'AIRTABLE_API_KEY' | 'AIRTABLE_BASE_ID'): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function createRepositories() {
  const client = new AirtableClient({
    apiKey: requireAirtableEnv('AIRTABLE_API_KEY'),
    baseId: requireAirtableEnv('AIRTABLE_BASE_ID'),
  });

  return {
    users: new UsersRepository(client),
    sessions: new SessionsRepository(client),
    leads: new LeadsRepository(client),
    emails: new EmailsRepository(client),
    logs: new LogsRepository(client),
  };
}
