export interface Video {
  video_id: string;
  title: string;
  thumbnail: string;
  channel: string;
  duration?: number | null;
  published_at?: string;
}

export interface QueueEntry extends Video {
  added_by?: string;
  added_at?: string | null;
}

export type PlaybackStatus = 'playing' | 'paused';

export interface PlaybackState {
  state: PlaybackStatus;
  position: number;
  volume: number;
  muted: boolean;
  /** Server clock (epoch ms) at which this state was produced. */
  updated_at: number;
}

export interface Participant {
  sid: string;
  name: string;
}

export interface RoomState {
  room_code: string;
  host_sid: string | null;
  is_host: boolean;
  current_video: Video | null;
  video_queue: QueueEntry[];
  playback: PlaybackState;
  participants: Participant[];
  expires_at?: string;
}

export interface SearchItem extends Video {
  duration: number | null;
}

export interface SearchResponse {
  query: string;
  count: number;
  items: SearchItem[];
}

export interface ChatMessage {
  name: string;
  text: string;
  /** Client clock (epoch ms) assigned when the message is rendered. */
  ts: number;
  system: boolean;
}

export interface HealthResponse {
  status: string;
  database: string;
  youtube_configured: boolean;
}

export function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '--:--';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}
