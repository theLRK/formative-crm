interface FirebaseAuthResponse {
  idToken?: string;
  email?: string;
  refreshToken?: string;
  localId?: string;
  expiresIn?: string;
  error?: {
    message?: string;
  };
}

interface FirebasePasswordAuthResult {
  idToken: string;
  email: string;
  localId: string;
}

function readFirebaseApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Firebase API key is missing. Set NEXT_PUBLIC_FIREBASE_API_KEY.');
  }
  return apiKey.trim();
}

function firebaseUrl(path: string): string {
  return `https://identitytoolkit.googleapis.com/v1/${path}?key=${readFirebaseApiKey()}`;
}

function parseFirebaseError(payload: FirebaseAuthResponse): string {
  const code = payload.error?.message ?? 'UNKNOWN_ERROR';
  switch (code) {
    case 'EMAIL_EXISTS':
      return 'This email is already registered.';
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS':
      return 'Invalid email or password.';
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return 'Too many attempts. Please try again later.';
    case 'USER_DISABLED':
      return 'This account has been disabled.';
    case 'INVALID_ID_TOKEN':
      return 'Invalid authentication token.';
    default:
      return `Firebase auth failed: ${code}`;
  }
}

async function parseJsonSafe(response: Response): Promise<FirebaseAuthResponse> {
  return (await response.json().catch(() => ({}))) as FirebaseAuthResponse;
}

async function postFirebase(
  path: string,
  body: Record<string, unknown>,
): Promise<FirebaseAuthResponse> {
  const response = await fetch(firebaseUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(parseFirebaseError(payload));
  }
  return payload;
}

function assertPasswordAuthResponse(payload: FirebaseAuthResponse): FirebasePasswordAuthResult {
  if (!payload.idToken || !payload.email || !payload.localId) {
    throw new Error('Firebase auth response is missing required fields.');
  }
  return {
    idToken: payload.idToken,
    email: payload.email,
    localId: payload.localId,
  };
}

export function isFirebaseClientConfigured(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  return Boolean(apiKey && apiKey.trim());
}

export async function firebaseSignInWithEmailPassword(
  email: string,
  password: string,
): Promise<FirebasePasswordAuthResult> {
  const payload = await postFirebase('accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });
  return assertPasswordAuthResponse(payload);
}

export async function firebaseSignUpWithEmailPassword(
  email: string,
  password: string,
): Promise<FirebasePasswordAuthResult> {
  const payload = await postFirebase('accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });
  return assertPasswordAuthResponse(payload);
}

export async function firebaseSendPasswordReset(email: string): Promise<void> {
  await postFirebase('accounts:sendOobCode', {
    requestType: 'PASSWORD_RESET',
    email,
  });
}

export async function firebaseSendEmailVerification(idToken: string): Promise<void> {
  await postFirebase('accounts:sendOobCode', {
    requestType: 'VERIFY_EMAIL',
    idToken,
  });
}
