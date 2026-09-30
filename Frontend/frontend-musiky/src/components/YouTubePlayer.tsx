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

interface YouTubePlayerProps {
  videoId: string | null;
  onEnded?: () => void;
  onError?: (code: number) => void;
  onDurationChange?: (seconds: number) => void;
}

const YouTubePlayer = forwardRef<PlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, onEnded, onError, onDurationChange },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const loadedVideoRef = useRef<string | null>(null);
  const videoIdRef = useRef<string | null>(videoId);
  videoIdRef.current = videoId;
  const [failed, setFailed] = useState(false);

  const endedRef = useRef(onEnded);
  const errorRef = useRef(onError);
  const durationRef = useRef(onDurationChange);
  endedRef.current = onEnded;
  errorRef.current = onError;
  durationRef.current = onDurationChange;

  const cue = useCallback((next: string | null) => {
    const player = playerRef.current;
    if (!player) return;
    if (!next) {
      loadedVideoRef.current = null;
      player.stopVideo();
      return;
    }
    if (loadedVideoRef.current === next) return;
    loadedVideoRef.current = next;
    setFailed(false);
    player.cueVideoById(next);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      seek: (seconds: number) => playerRef.current?.seekTo(Math.max(0, seconds), true),
      getTime: () => playerRef.current?.getCurrentTime() ?? 0,
      getState: () => playerRef.current?.getPlayerState() ?? -1,
      setVolume: (volume: number) => playerRef.current?.setVolume(volume),
      setMuted: (muted: boolean) => {
        const player = playerRef.current;
        if (!player) return;
        if (muted) player.mute();
        else player.unMute();
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let created: YT.Player | null = null;

    loadYouTubeApi()
      .then((YTApi) => {
        if (cancelled || !hostRef.current) return;
        created = new YTApi.Player(hostRef.current, {
          width: '100%',
          height: '100%',
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            controls: 1,
            disablekb: 1,
          },
          events: {
            onReady: (event) => durationRef.current?.(event.target.getDuration()),
            onStateChange: (event) => {
              if (event.data === YTApi.PlayerState.ENDED) endedRef.current?.();
              durationRef.current?.(event.target.getDuration());
            },
            onError: (event) => {
              setFailed(true);
              errorRef.current?.(event.data);
            },
          },
        });
        playerRef.current = created;
        // the room may already have a track loaded before the API finished loading
        cue(videoIdRef.current);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      playerRef.current = null;
      created?.destroy();
    };
  }, [cue]);

  useEffect(() => {
    cue(videoId);
  }, [videoId, cue]);

  return (
    <div className="player-shell">
      <div ref={hostRef} className="player-frame" />
      {(failed || !videoId) && (
        <div className="player-overlay">
          {failed ? (
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
