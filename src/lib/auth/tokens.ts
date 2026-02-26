import jwt from 'jsonwebtoken';

export interface AccessTokenPayload {
  sub: string;
  role: 'admin';
}

export function signAccessToken(payload: AccessTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: '24h',
  });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
  });

  if (typeof decoded === 'string' || !decoded.sub || decoded.role !== 'admin') {
    throw new Error('Invalid access token payload');
  }

  return {
    sub: String(decoded.sub),
    role: 'admin',
  };
}
