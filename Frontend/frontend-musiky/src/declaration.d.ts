declare namespace YT {
  interface PlayerVars {
    [key: string]: string | number | boolean | undefined;
  }

  interface EventHandler {
    (event: { target: Player; data: number }): void;
  }

  interface PlayerOptions {
    width?: number | string;
    height?: number | string;
    videoId?: string;
    playerVars?: PlayerVars;
    events?: {
      onReady?: EventHandler;
      onStateChange?: EventHandler;
      onError?: (event: { data: number }) => void;
    };
  }

  class Player {
    constructor(element: HTMLElement | string, options?: PlayerOptions);

    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    getVolume(): number;
    setVolume(volume: number): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    getPlayerState(): number;
    getVideoData(): { video_id: string; title: string };
    loadVideoById(videoId: string): void;
    cueVideoById(videoId: string): void;
    stopVideo(): void;
    destroy(): void;
  }

  const PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };

  const PlayerVars: Record<string, string | number>;
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
