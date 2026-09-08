export type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

export async function requireLineProfile(request: Request): Promise<LineProfile> {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match?.[1] || match[1].length > 4096) throw new Error('UNAUTHORIZED');
  const expectedChannelId = Deno.env.get('LINE_CHANNEL_ID');
  if (!expectedChannelId) throw new Error('SERVER_CONFIG');

  const verifyUrl = new URL('https://api.line.me/oauth2/v2.1/verify');
  verifyUrl.searchParams.set('access_token', match[1]);
  const verification = await fetch(verifyUrl);
  if (!verification.ok) throw new Error('UNAUTHORIZED');
  const tokenInfo = await verification.json() as { client_id?: string; expires_in?: number; scope?: string };
  if (tokenInfo.client_id !== expectedChannelId || !tokenInfo.expires_in || tokenInfo.expires_in <= 0) {
    throw new Error('UNAUTHORIZED');
  }

  const response = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${match[1]}` }
  });
  if (!response.ok) throw new Error('UNAUTHORIZED');
  const profile = await response.json() as Partial<LineProfile>;
  if (!profile.userId || !profile.displayName) throw new Error('UNAUTHORIZED');
  return { userId: profile.userId, displayName: profile.displayName, pictureUrl: profile.pictureUrl };
}
