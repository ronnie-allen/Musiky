const API_SRC = 'https://www.youtube.com/iframe_api';

let apiPromise: Promise<typeof YT> | null = null;

function loadedApi(): typeof YT | undefined {
  const candidate = window.YT;
  return candidate && typeof candidate.Player === 'function' ? candidate : undefined;
}

export function loadYouTubeApi(): Promise<typeof YT> {
  const alreadyLoaded = loadedApi();
  if (alreadyLoaded) return Promise.resolve(alreadyLoaded);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<typeof YT>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      const api = loadedApi();
      if (api) resolve(api);
      else reject(new Error('The YouTube IFrame API loaded without a player API.'));
    };

    if (document.querySelector(`script[src="${API_SRC}"]`)) return;

    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => reject(new Error('Could not load the YouTube IFrame API.'));
    document.head.appendChild(script);
  });

  return apiPromise;
}
