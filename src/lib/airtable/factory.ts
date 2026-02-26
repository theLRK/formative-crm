import { getEnv } from '@/lib/env';
import {
  AirtableClient,
  EmailsRepository,
  LeadsRepository,
  LogsRepository,
  SessionsRepository,
  UsersRepository,
} from '.';

export function createRepositories() {
  const env = getEnv();
  const client = new AirtableClient({
    apiKey: env.AIRTABLE_API_KEY,
    baseId: env.AIRTABLE_BASE_ID,
  });

  return {
    users: new UsersRepository(client),
    sessions: new SessionsRepository(client),
    leads: new LeadsRepository(client),
    emails: new EmailsRepository(client),
    logs: new LogsRepository(client),
  };
}

