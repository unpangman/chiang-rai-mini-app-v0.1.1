import { env } from '../config';
import type { UserProfile } from '../types';

const demoProfile: UserProfile = {
  userId: 'demo-user',
  displayName: 'ผู้ใช้งาน',
  statusMessage: 'ผู้ใช้งานโหมดทดลอง',
  isDemo: true
};

const LIFF_INIT_TIMEOUT_MS = 2500;

function hasLiff(): boolean {
  return typeof liff !== 'undefined';
}

function shouldSkipWebLiff(): boolean {
  try {
    if (liff.isInClient()) return false;
    const configured = new URL(env.liffRedirectUri);
    const current = new URL(window.location.href);
    return configured.origin !== current.origin;
  } catch {
    return true;
  }
}

async function initWithTimeout(): Promise<void> {
  await Promise.race([
    liff.init({ liffId: env.liffId }),
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('LIFF init timeout')), LIFF_INIT_TIMEOUT_MS))
  ]);
}

export async function initLine(): Promise<UserProfile> {
  if (env.forceDemo || !env.liffId || !hasLiff() || shouldSkipWebLiff()) return demoProfile;

  try {
    await initWithTimeout();

    if (!liff.isLoggedIn()) {
      // LINE OAuth must return to a URL registered for the LIFF channel.
      liff.login({ redirectUri: env.liffRedirectUri });
      return demoProfile;
    }

    const profile = await liff.getProfile();
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage,
      isDemo: false
    };
  } catch (error) {
    console.warn('LIFF initialization skipped:', error);
    return demoProfile;
  }
}

export function isInLineClient(): boolean {
  try {
    return Boolean(env.liffId) && hasLiff() && liff.isInClient();
  } catch {
    return false;
  }
}

export async function shareApp(): Promise<boolean> {
  if (!env.liffId || !hasLiff() || !liff.isApiAvailable('shareTargetPicker')) return false;
  await liff.shareTargetPicker([
    {
      type: 'text',
      text: `บริการออนไลน์ ${document.title}\n${window.location.href}`
    }
  ]);
  return true;
}
