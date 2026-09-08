import { env } from '../config';
import type { UserProfile } from '../types';
import { loadScript } from './assetLoader';

const LIFF_SDK = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

const demoProfile: UserProfile = {
  userId: 'demo-user',
  displayName: 'ผู้ใช้งาน',
  statusMessage: 'ผู้ใช้งานโหมดทดลอง',
  isDemo: true
};

let initialization: Promise<UserProfile> | null = null;

function hasLiff(): boolean {
  return typeof liff !== 'undefined';
}

async function initializeLine(): Promise<UserProfile> {
  if (env.forceDemo || !env.liffId) return demoProfile;

  try {
    await loadScript(LIFF_SDK, hasLiff);
    await liff.init({ liffId: env.liffId });

    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
      return demoProfile;
    }

    // displayName and pictureUrl below always come from the signed-in LINE profile.
    const profile = await liff.getProfile();
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

export function initLine(): Promise<UserProfile> {
  initialization ??= initializeLine();
  return initialization;
}

export function isInLineClient(): boolean {
  try {
    return Boolean(env.liffId) && hasLiff() && liff.isInClient();
  } catch {
    return false;
  }
}

export async function shareApp(): Promise<boolean> {
  await initLine();
  if (!env.liffId || !hasLiff() || !liff.isApiAvailable('shareTargetPicker')) return false;
  await liff.shareTargetPicker([
    {
      type: 'text',
      text: `บริการออนไลน์ ${document.title}\n${window.location.href}`
    }
  ]);
  return true;
}
