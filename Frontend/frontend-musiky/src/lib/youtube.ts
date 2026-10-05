const API_SRC = 'https://www.youtube.com/iframe_api';
const READY_TIMEOUT_MS = 15000;

let apiPromise: Promise<typeof YT> | null = null;

/**
 * The IFrame API publishes `window.YT` with a `Player` property while it is still
 * loading, so the only reliable readiness signal is the `onYouTubeIframeAPIReady`
 * callback. Building a player against the half-initialised object silently
 * produces no iframe.
 */
export function loadYouTubeApi(): Promise<typeof YT> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<typeof YT>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;

    const finish = () => {
      window.clearTimeout(guard);
      previous?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error('The YouTube IFrame API signalled ready without a player API.'));
    };

    // never leave the UI spinning if the callback never arrives
    const guard = window.setTimeout(() => {
      if (window.YT) resolve(window.YT);
      else reject(new Error('Timed out waiting for the YouTube IFrame API.'));
    }, READY_TIMEOUT_MS);

    window.onYouTubeIframeAPIReady = finish;

    if (document.querySelector(`script[src="${API_SRC}"]`)) return;

    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => reject(new Error('Could not load the YouTube IFrame API.'));
    document.head.appendChild(script);
  });

  return apiPromise;
}
