type LiffProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
};

type LiffMessage = { type: 'text'; text: string };

type LiffApi = {
  init(config: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(config?: { redirectUri?: string }): void;
  getProfile(): Promise<LiffProfile>;
  isInClient(): boolean;
  isApiAvailable(apiName: string): boolean;
  shareTargetPicker(messages: LiffMessage[]): Promise<unknown>;
};

declare const liff: LiffApi;

declare const L: any;
