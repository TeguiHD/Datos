export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret !== 'dev-jwt-secret-change-me') return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET not set or using insecure default in production');
  }

  return 'dev-jwt-secret-change-me';
}
