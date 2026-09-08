const scriptLoads = new Map<string, Promise<void>>();
const stylesheetLoads = new Map<string, Promise<void>>();

export function loadScript(src: string, isReady: () => boolean): Promise<void> {
  if (isReady()) return Promise.resolve();
  const pending = scriptLoads.get(src);
  if (pending) return pending;

  const load = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const script = existing ?? document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error(`Timed out loading ${src}`)), 12000);
    const finish = () => {
      window.clearTimeout(timeout);
      if (isReady()) resolve();
      else reject(new Error(`Loaded ${src}, but its API is unavailable`));
    };
    const fail = () => {
      window.clearTimeout(timeout);
      reject(new Error(`Could not load ${src}`));
    };

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });
    if (!existing) {
      script.src = src;
      script.async = true;
      document.head.append(script);
    }
  });
  scriptLoads.set(src, load);
  void load.catch(() => scriptLoads.delete(src));
  return load;
}

export function loadStylesheet(href: string): Promise<void> {
  const pending = stylesheetLoads.get(href);
  if (pending) return pending;

  const load = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLLinkElement>(`link[href="${href}"]`);
    if (existing?.sheet) return resolve();
    const link = existing ?? document.createElement('link');
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => reject(new Error(`Could not load ${href}`)), { once: true });
    if (!existing) {
      link.rel = 'stylesheet';
      link.href = href;
      link.crossOrigin = 'anonymous';
      document.head.append(link);
    }
  });
  stylesheetLoads.set(href, load);
  void load.catch(() => stylesheetLoads.delete(href));
  return load;
}
