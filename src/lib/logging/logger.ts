export type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
  // This will be replaced by Airtable log persistence and Sentry integration in later phases.
  const payload = metadata ? { message, metadata } : { message };
  if (level === 'error') {
    console.error(payload);
    return;
  }
  if (level === 'warn') {
    console.warn(payload);
    return;
  }
  console.log(payload);
}

export function leadLogEvent(
  action:
    | 'lead_webhook_received'
    | 'lead_duplicate_rejected'
    | 'lead_created'
    | 'lead_scored'
    | 'lead_updated',
  metadata: Record<string, unknown>,
): { level: LogLevel; message: string; metadata: Record<string, unknown> } {
  return {
    level: 'info',
    message: action,
    metadata,
  };
}

export function emailLogEvent(
  action:
    | 'email_outbound_sent'
    | 'email_inbound_processed'
    | 'email_draft_created'
    | 'email_thread_conflict'
    | 'email_send_failed',
  metadata: Record<string, unknown>,
): { level: LogLevel; message: string; metadata: Record<string, unknown> } {
  return {
    level: action === 'email_send_failed' || action === 'email_thread_conflict' ? 'warn' : 'info',
    message: action,
    metadata,
  };
}

export function scoringLogEvent(
  action: 'form_score_computed' | 'interaction_score_computed' | 'total_score_computed',
  metadata: Record<string, unknown>,
): { level: LogLevel; message: string; metadata: Record<string, unknown> } {
  return {
    level: 'info',
    message: action,
    metadata,
  };
}
