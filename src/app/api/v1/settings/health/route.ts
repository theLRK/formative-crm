import { NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { buildApiError } from '@/lib/errors';
import { checkGmailConnection } from '@/lib/gmail';

type HealthState = 'ok' | 'warn' | 'error';

interface IntegrationHealth {
  key: string;
  label: string;
  state: HealthState;
  message: string;
}

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.trim());
}

async function checkAirtableHealth(): Promise<IntegrationHealth> {
  if (!hasEnv('AIRTABLE_API_KEY') || !hasEnv('AIRTABLE_BASE_ID')) {
    return {
      key: 'airtable',
      label: 'Airtable',
      state: 'error',
      message: 'Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID',
    };
  }

  try {
    const { logs } = createRepositories();
    await logs.list({ limit: 1 });
    return {
      key: 'airtable',
      label: 'Airtable',
      state: 'ok',
      message: 'Connected',
    };
  } catch (error) {
    return {
      key: 'airtable',
      label: 'Airtable',
      state: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkGmailHealthStatus(): Promise<IntegrationHealth> {
  const hasRequiredEnv =
    hasEnv('GOOGLE_CLIENT_ID') &&
    hasEnv('GOOGLE_CLIENT_SECRET') &&
    hasEnv('GOOGLE_REFRESH_TOKEN') &&
    hasEnv('NEXTAUTH_URL');
  if (!hasRequiredEnv) {
    return {
      key: 'gmail',
      label: 'Gmail API',
      state: 'error',
      message: 'Missing Google OAuth env values',
    };
  }

  try {
    const result = await checkGmailConnection();
    return {
      key: 'gmail',
      label: 'Gmail API',
      state: 'ok',
      message: result.emailAddress ? `Connected as ${result.emailAddress}` : 'Connected',
    };
  } catch (error) {
    return {
      key: 'gmail',
      label: 'Gmail API',
      state: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

function staticHealthChecks(): IntegrationHealth[] {
  return [
    {
      key: 'firebase',
      label: 'Firebase Auth',
      state: hasEnv('NEXT_PUBLIC_FIREBASE_API_KEY') ? 'ok' : 'warn',
      message: hasEnv('NEXT_PUBLIC_FIREBASE_API_KEY')
        ? 'Configured'
        : 'Missing NEXT_PUBLIC_FIREBASE_API_KEY',
    },
    {
      key: 'typeform',
      label: 'Typeform',
      state: hasEnv('TYPEFORM_API_TOKEN') ? 'ok' : 'warn',
      message: hasEnv('TYPEFORM_API_TOKEN') ? 'Configured' : 'Missing TYPEFORM_API_TOKEN',
    },
    {
      key: 'openai',
      label: 'OpenAI',
      state: hasEnv('OPENAI_API_KEY') ? 'ok' : 'warn',
      message: hasEnv('OPENAI_API_KEY') ? 'Configured' : 'Missing OPENAI_API_KEY',
    },
    {
      key: 'cron',
      label: 'Cron',
      state: hasEnv('CRON_SECRET') ? 'ok' : 'error',
      message: hasEnv('CRON_SECRET') ? 'Configured' : 'Missing CRON_SECRET',
    },
  ];
}

export async function GET(): Promise<NextResponse> {
  try {
    const [airtable, gmail] = await Promise.all([checkAirtableHealth(), checkGmailHealthStatus()]);
    const integrations = [airtable, gmail, ...staticHealthChecks()];
    const hasError = integrations.some((item) => item.state === 'error');

    return NextResponse.json({
      success: true,
      data: {
        hasError,
        integrations,
      },
    });
  } catch {
    return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Failed to load settings health'), {
      status: 500,
    });
  }
}
