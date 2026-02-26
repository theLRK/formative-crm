export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ApiErrorPayload {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export function buildApiError(code: ApiErrorCode, message: string): ApiErrorPayload {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

