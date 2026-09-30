import type { HealthResponse, QueueEntry, RoomState, SearchResponse, Video } from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  createRoom: () => request<{ room_code: string }>('/rooms', { method: 'POST', body: '{}' }),

  getRoom: (roomCode: string) => request<RoomState>(`/rooms/${encodeURIComponent(roomCode)}`),

  search: (query: string) =>
    request<SearchResponse>(`/search?q=${encodeURIComponent(query)}&maxResults=10`),

  addToQueue: (roomCode: string, video: Video, addedBy?: string) =>
    request<{ video_queue: QueueEntry[] }>(`/rooms/${encodeURIComponent(roomCode)}/queue`, {
      method: 'POST',
      body: JSON.stringify({ ...video, added_by: addedBy }),
    }),

  removeFromQueue: (roomCode: string, videoId: string) =>
    request<{ video_queue: QueueEntry[] }>(
      `/rooms/${encodeURIComponent(roomCode)}/queue/${encodeURIComponent(videoId)}`,
      { method: 'DELETE' },
    ),

  clearQueue: (roomCode: string) =>
    request<{ video_queue: QueueEntry[] }>(`/rooms/${encodeURIComponent(roomCode)}/queue`, {
      method: 'DELETE',
    }),
};
