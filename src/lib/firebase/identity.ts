interface FirebaseLookupUser {
  localId?: string;
  email?: string;
  emailVerified?: boolean;
  disabled?: boolean;
}

interface FirebaseLookupResponse {
  users?: FirebaseLookupUser[];
  error?: {
    message?: string;
  };
}

export interface VerifiedFirebaseIdentity {
  localId: string;
  email: string;
  emailVerified: boolean;
  disabled: boolean;
}

function readFirebaseServerApiKey(): string {
  const apiKey = process.env.FIREBASE_WEB_API_KEY ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Firebase API key is missing for server verification.');
  }
  return apiKey.trim();
}

function parseFirebaseError(payload: FirebaseLookupResponse): string {
  const code = payload.error?.message ?? 'UNKNOWN_ERROR';
  if (code === 'INVALID_ID_TOKEN') return 'Invalid Firebase ID token.';
  return `Firebase token verification failed: ${code}`;
}

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<VerifiedFirebaseIdentity> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${readFirebaseServerApiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as FirebaseLookupResponse;
  if (!response.ok) {
    throw new Error(parseFirebaseError(payload));
  }

  const user = payload.users?.[0];
  if (!user?.localId || !user.email) {
    throw new Error('Firebase token lookup returned no user.');
  }

  return {
    localId: user.localId,
    email: user.email.toLowerCase(),
    emailVerified: Boolean(user.emailVerified),
    disabled: Boolean(user.disabled),
  };
}
