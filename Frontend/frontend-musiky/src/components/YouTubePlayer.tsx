import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { loadYouTubeApi } from '../lib/youtube';

export interface PlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  getTime: () => number;
  getState: () => number;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
}

const canCall = (player: YT.Player | null, method: string): boolean => {
  if (!player) return false;
  return typeof (player as unknown as Record<string, unknown>)[method] === 'function';
};

/**
 * A blocked or half-initialised embed can hand back a player object whose
 * methods never materialise. Calling one throws inside a React effect and
 * unmounts the whole room, so every player call goes through this guard.
 */
function callPlayer<T>(
  player: YT.Player | null,
  method: string,
  ...args: Array<string | number | boolean>
): T | undefined {
  if (!canCall(player, method)) return undefined;
  try {
    const fn = (player as unknown as Record<string, (...callArgs: Array<string | number | boolean>) => T>)[
      method
    ];
    return fn.apply(player, args);
  } catch {
    return undefined;
  }
}

interface YouTubePlayerProps {
  videoId: string | null;
  onEnded?: () => void;
  onError?: (code: number) => void;
  onStateChange?: (state: number) => void;
  onDurationChange?: (seconds: number) => void;
}

const YouTubePlayer = forwardRef<PlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, onEnded, onError, onStateChange, onDurationChange },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const loadedVideoRef = useRef<string | null>(null);
  const videoIdRef = useRef<string | null>(videoId);
  videoIdRef.current = videoId;
  // the embed reports errors of its own before any track is loaded, so the failure
  // is remembered per video instead of as a bare flag
  const [failedVideo, setFailedVideo] = useState<string | null>(null);

  const endedRef = useRef(onEnded);
  const errorRef = useRef(onError);
  const stateRef = useRef(onStateChange);
  const durationRef = useRef(onDurationChange);
  endedRef.current = onEnded;
  errorRef.current = onError;
  stateRef.current = onStateChange;
  durationRef.current = onDurationChange;

  const cue = useCallback((next: string | null) => {
    const player = playerRef.current;
    if (!player) return;
    if (!next) {
      loadedVideoRef.current = null;
      callPlayer(player, 'stopVideo');
      return;
    }
    if (loadedVideoRef.current === next) return;
    loadedVideoRef.current = next;
    // a husk player (blocked embed, half-loaded API) has no cue method;
    // surface the embed failure instead of throwing and unmounting the room
    if (!canCall(player, 'cueVideoById')) {
      setFailedVideo(next);
      errorRef.current?.(-1);
      return;
    }
    setFailedVideo(null);
    callPlayer(player, 'cueVideoById', next);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        callPlayer(playerRef.current, 'playVideo');
      },
      pause: () => {
        callPlayer(playerRef.current, 'pauseVideo');
      },
      seek: (seconds: number) => {
        callPlayer(playerRef.current, 'seekTo', Math.max(0, seconds), true);
      },
      getTime: () => callPlayer<number>(playerRef.current, 'getCurrentTime') ?? 0,
      getState: () => callPlayer<number>(playerRef.current, 'getPlayerState') ?? -1,
      setVolume: (volume: number) => {
        callPlayer(playerRef.current, 'setVolume', volume);
      },
      setMuted: (muted: boolean) => {
        const player = playerRef.current;
        if (!player) return;
        if (muted) callPlayer(player, 'mute');
        else callPlayer(player, 'unMute');
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let created: YT.Player | null = null;

    // The IFrame API replaces the element it is given with the player iframe and
    // leaves the original node behind as an empty sibling. Mounting into a child
    // node we own keeps the iframe inside .player-frame, where the layout styles
    // and the overlay can reach it.
    const mount = document.createElement('div');
    mount.className = 'player-mount';
    hostRef.current?.appendChild(mount);

    loadYouTubeApi()
      .then((YTApi) => {
        if (cancelled) return;
        created = new YTApi.Player(mount, {
          width: '100%',
          height: '100%',
          playerVars: {
            enablejsapi: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            controls: 1,
            disablekb: 1,
          },
          events: {
            onReady: (event) => durationRef.current?.(callPlayer<number>(event.target, 'getDuration') ?? 0),
            onStateChange: (event) => {
              if (event.data === YTApi.PlayerState.ENDED) endedRef.current?.();
              stateRef.current?.(event.data);
              durationRef.current?.(callPlayer<number>(event.target, 'getDuration') ?? 0);
            },
            onError: (event) => {
              setFailedVideo(loadedVideoRef.current);
              errorRef.current?.(event.data);
            },
          },
        });
        playerRef.current = created;
        // the room may already have a track loaded before the API finished loading
        cue(videoIdRef.current);
      })
      .catch(() => setFailedVideo(videoIdRef.current));

    return () => {
      cancelled = true;
      playerRef.current = null;
      created?.destroy();
      mount.remove();
    };
  }, [cue]);

  useEffect(() => {
    cue(videoId);
  }, [videoId, cue]);

  const unplayable = videoId !== null && failedVideo === videoId;

  return (
    <div className="player-shell">
      <div ref={hostRef} className="player-frame" />
      {(unplayable || !videoId) && (
        <div className="player-overlay">
          {unplayable ? (
            <>
              <p className="mb-1 fw-semibold">This video cannot be played here.</p>
              <p className="mb-0 small opacity-75">
                The owner may have disabled embedding for it. Try another track.
              </p>
            </>
          ) : (
            <>
              <p className="mb-1 fw-semibold">Nothing playing yet</p>
              <p className="mb-0 small opacity-75">Search for a track to start the room.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default YouTubePlayer;
