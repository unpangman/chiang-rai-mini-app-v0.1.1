import { env } from '../config';
import type { UserProfile } from '../types';

const demoProfile: UserProfile = {
  userId: 'demo-user',
  displayName: 'ผู้ใช้งาน',
  statusMessage: 'ผู้ใช้งานโหมดทดลอง',
  isDemo: true
};

const LIFF_INIT_TIMEOUT_MS = 5000;

function hasLiff(): boolean {
  return typeof liff !== 'undefined';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

export async function initLine(): Promise<UserProfile> {
  if (env.forceDemo || !env.liffId || !hasLiff()) return demoProfile;

  try {
    // Keep startup responsive on mobile/WebView. A stalled LIFF init should not
    // leave the app on the loading screen forever.
    await withTimeout(liff.init({ liffId: env.liffId }), LIFF_INIT_TIMEOUT_MS, 'LIFF init');

    if (!liff.isLoggedIn()) {
      // LINE OAuth must return to a URL registered for the LIFF channel.
      // Do not use window.location.href here because local development would
      // otherwise send http://localhost:5173/ to LINE and cause error 400.
      liff.login({ redirectUri: env.liffRedirectUri });
      return demoProfile;
    }

    // displayName and pictureUrl below always come from the signed-in LINE profile.
    const profile = await withTimeout(liff.getProfile(), LIFF_INIT_TIMEOUT_MS, 'LIFF profile');
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage,
      isDemo: false
    };
  } catch (error) {
    console.error('LIFF initialization failed:', error);
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
