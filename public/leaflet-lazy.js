(() => {
  const JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  let loading = null;

  const load = () => {
    if (window.L) return Promise.resolve();
    if (loading) return loading;

    loading = Promise.all([
      new Promise((resolve, reject) => {
        if (document.querySelector('link[data-leaflet-lazy]')) return resolve();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CSS_URL;
        link.dataset.leafletLazy = 'true';
        link.onload = resolve;
        link.onerror = () => reject(new Error('Leaflet CSS failed to load'));
        document.head.appendChild(link);
      }),
      new Promise((resolve, reject) => {
        if (document.querySelector('script[data-leaflet-lazy]')) return resolve();
        const script = document.createElement('script');
        script.src = JS_URL;
        script.async = true;
        script.dataset.leafletLazy = 'true';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Leaflet JS failed to load'));
        document.head.appendChild(script);
      })
    ]).finally(() => { loading = null; });

    return loading;
  };

  const originalAddEventListener = window.addEventListener.bind(window);
  window.addEventListener = (type, listener, options) => {
    if (type !== 'hashchange' || typeof listener !== 'function') {
      return originalAddEventListener(type, listener, options);
    }

    return originalAddEventListener(type, async event => {
      const route = window.location.hash.replace(/^#\/?/, '');
      if (route === 'map') {
        try {
          await load();
        } catch (error) {
          console.warn('Leaflet lazy load failed:', error);
        }
      }
      listener.call(window, event);
    }, options);
  };

  if (window.location.hash.replace(/^#\/?/, '') === 'map') {
    void load();
  }
})();
