import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import YouTubePlayer, { type PlayerHandle } from '../components/YouTubePlayer';
import { api, ApiError } from '../lib/api';
import { createRoomSocket } from '../lib/socket';
import {
  formatDuration,
  type ChatMessage,
  type Participant,
  type PlaybackState,
  type QueueEntry,
  type SearchItem,
  type Video,
} from '../types';

const NAME_STORAGE_KEY = 'musiky:name';
const DRIFT_TOLERANCE_SECONDS = 0.75;
const SYNC_INTERVAL_MS = 2000;
const MAX_CHAT_MESSAGES = 200;

const guestName = () => `Guest-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const clockTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function RoomPage() {
  const { roomCode = '' } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState<string>(() => sessionStorage.getItem(NAME_STORAGE_KEY) ?? '');
  const [nameDraft, setNameDraft] = useState('');
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [playback, setPlayback] = useState<PlaybackState>({
    state: 'paused',
    position: 0,
    volume: 100,
    muted: false,
    updated_at: Date.now(),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const [scrub, setScrub] = useState<number | null>(null);
  const [localPosition, setLocalPosition] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [blockedByAutoplay, setBlockedByAutoplay] = useState(false);

  const playerRef = useRef<PlayerHandle | null>(null);
  const socketRef = useRef<ReturnType<typeof createRoomSocket> | null>(null);
  const playRequestedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const isHostRef = useRef(false);
  isHostRef.current = isHost;

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message].slice(-MAX_CHAT_MESSAGES));
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const targetPosition = useCallback(
    (state: PlaybackState) =>
      state.state === 'playing'
        ? state.position + Math.max(0, Date.now() - state.updated_at) / 1000
        : state.position,
    [],
  );

  const applyPlayback = useCallback(
    (state: PlaybackState) => {
      setPlayback(state);
      const player = playerRef.current;
      if (!player) return;

      const target = targetPosition(state);
      if (Math.abs(player.getTime() - target) > DRIFT_TOLERANCE_SECONDS) {
        player.seek(target);
      }
      player.setVolume(state.volume);
      player.setMuted(state.muted);

      if (state.state === 'playing') {
        playRequestedRef.current = true;
        player.play();
      } else {
        playRequestedRef.current = false;
        player.pause();
        setLocalPosition(state.position);
      }
    },
    [targetPosition],
  );

  useEffect(() => {
    if (!roomCode) return;
    if (!name) {
      setNameDraft(guestName());
      return;
    }

    const socket = createRoomSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit('join', { room: roomCode, name });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('room_state', (state: {
      room_code: string;
      is_host: boolean;
      current_video: Video | null;
      video_queue: QueueEntry[];
      playback: PlaybackState;
      participants: Participant[];
    }) => {
      setIsHost(state.is_host);
      setParticipants(state.participants);
      setQueue(state.video_queue);
      setCurrentVideo(state.current_video);
      if (state.playback) applyPlayback(state.playback);
    });

    socket.on('participants', (list: Participant[]) => setParticipants(list));
    // join/leave notices arrive as system chat messages from the server, so the
    // participant events are only about keeping the roster current
    socket.on('now_playing', (payload: { video: Video | null }) => setCurrentVideo(payload.video));
    socket.on('queue_updated', (payload: { video_queue: QueueEntry[] }) =>
      setQueue(payload.video_queue ?? []),
    );
    socket.on('playback_state', (state: PlaybackState) => {
      playRequestedRef.current = state.state === 'playing';
      applyPlayback(state);
    });
    socket.on('new_message', (message: Omit<ChatMessage, 'ts'> & { ts?: number }) =>
      appendMessage({ ...message, ts: message.ts ?? Date.now() }),
    );
    socket.on('error', (payload: { message: string }) => {
      const text = payload?.message ?? 'Something went wrong.';
      if (/does not exist|expired/i.test(text)) {
        setFatalError(text);
        return;
      }
      showNotice(text);
    });

    return () => {
      socket.emit('leave');
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, name, appendMessage, applyPlayback, showNotice]);

  // periodic re-sync keeps everyone aligned despite buffering or tab throttling
  useEffect(() => {
    if (playback.state !== 'playing') return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const target = targetPosition(playback);
      if (Math.abs(player.getTime() - target) > DRIFT_TOLERANCE_SECONDS) {
        player.seek(target);
        setLocalPosition(target);
      }
      if (playRequestedRef.current) player.play();
    }, SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playback, targetPosition]);

  // local position ticker for the progress bar
  useEffect(() => {
    if (playback.state !== 'playing') {
      setLocalPosition(playback.position);
      return;
    }
    const timer = window.setInterval(() => setLocalPosition(playerRef.current?.getTime() ?? 0), 500);
    return () => window.clearInterval(timer);
  }, [playback]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // browsers block un-muted autoplay for people who did not start playback
  useEffect(() => {
    if (playback.state !== 'playing' || !currentVideo) {
      setBlockedByAutoplay(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const player = playerRef.current;
      if (!player) return;
      const state = player.getState();
      const stalled = state === YT.PlayerState.PAUSED || state === YT.PlayerState.CUED || state === YT.PlayerState.UNSTARTED;
      setBlockedByAutoplay(stalled);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [playback.state, currentVideo]);

  // once the player really is playing the gate has served its purpose
  const handlePlayerState = useCallback((state: number) => {
    if (state === YT.PlayerState.PLAYING) setBlockedByAutoplay(false);
  }, []);

  const emit = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    socketRef.current?.emit(event, { ...payload, room: roomCode, name });
  }, [roomCode, name]);

  const sendChat = () => {
    const text = draft.trim();
    if (!text) return;
    emit('chat_message', { text });
    setDraft('');
  };

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearchError(null);
    try {
      const response = await api.search(trimmed);
      setResults(response.items);
      setShowSearch(true);
      if (response.items.length === 0) setSearchError('No videos found for that search.');
    } catch (error) {
      setResults([]);
      setSearchError(error instanceof ApiError ? error.message : 'Could not reach the server.');
    } finally {
      setSearching(false);
    }
  };

  const playNow = (video: Video) => {
    emit('play_video', { video, autoplay: true });
  };

  const addToQueue = (video: Video) => {
    emit('queue_add', { video });
  };

  const togglePlayback = () => {
    const position = playerRef.current?.getTime() ?? playback.position;
    if (playback.state === 'playing') {
      emit('playback', { action: 'pause', position });
      playRequestedRef.current = false;
      setPlayback((prev) => ({ ...prev, state: 'paused', position, updated_at: Date.now() }));
    } else {
      emit('playback', { action: 'play', position });
      playRequestedRef.current = true;
      setPlayback((prev) => ({ ...prev, state: 'playing', position, updated_at: Date.now() }));
    }
    setBlockedByAutoplay(false);
  };

  const commitScrub = (value: number) => {
    playerRef.current?.seek(value);
    setLocalPosition(value);
    // the server does not echo back to the sender, so keep local state in step
    setPlayback((prev) => ({ ...prev, position: value, updated_at: Date.now() }));
    emit('playback', { action: 'seek', position: value });
  };

  const commitVolume = (value: number) => {
    playerRef.current?.setVolume(value);
    setPlayback((prev) => ({ ...prev, volume: value, updated_at: Date.now() }));
    emit('playback', { action: 'volume', volume: value });
  };

  const commitMute = () => {
    const muted = !playback.muted;
    playerRef.current?.setMuted(muted);
    setPlayback((prev) => ({ ...prev, muted, updated_at: Date.now() }));
    emit('playback', { action: 'mute', muted });
  };

  const handleEnded = () => {
    playRequestedRef.current = false;
    if (isHostRef.current) emit('advance', { autoplay: true });
  };

  const resumeAfterGesture = () => {
    setBlockedByAutoplay(false);
    playerRef.current?.play();
  };

  const leaveRoom = () => {
    emit('leave');
    navigate('/');
  };

  const shareLink = useMemo(
    () => `${window.location.origin}/room/${roomCode}`,
    [roomCode],
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      showNotice('Room link copied.');
    } catch {
      showNotice('Could not copy. Copy the address bar instead.');
    }
  };

  const submitName = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nameDraft.trim() || guestName();
    sessionStorage.setItem(NAME_STORAGE_KEY, trimmed);
    setName(trimmed);
  };

  if (!roomCode) {
    return (
      <div className="page-shell">
        <div className="panel text-center">
          <h1 className="h5 mb-3">No room selected</h1>
          <button className="btn btn-accent" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="page-shell">
        <div className="panel text-center">
          <h1 className="h5 mb-2">Room unavailable</h1>
          <p className="opacity-75 mb-3">{fatalError}</p>
          <button className="btn btn-accent" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!name) {
    return (
      <div className="page-shell">
        <form className="panel" onSubmit={submitName}>
          <h1 className="h4 mb-1">Join room {roomCode}</h1>
          <p className="opacity-75 mb-3">Pick a display name so friends recognise you.</p>
          <input
            className="form-control mb-3"
            value={nameDraft}
            maxLength={40}
            autoFocus
            onChange={(event) => setNameDraft(event.target.value)}
            placeholder="Your name"
          />
          <button className="btn btn-accent w-100" type="submit">
            Enter room
          </button>
        </form>
      </div>
    );
  }

  const position = scrub ?? localPosition;
  const duration = playerDuration || currentVideo?.duration || 0;
  const scrubMax = duration || Math.max(100, Math.ceil(position));

  return (
    <div className="page-shell room-layout">
      <header className="room-header">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="brand">Musiky</span>
          <span className="room-code" title="Share this code with friends">
            {roomCode}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={copyLink}>
            Copy invite link
          </button>
          {!isHost && <span className="badge-role">Listener</span>}
          {isHost && <span className="badge-role badge-role-host">Host</span>}
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className={`status-dot ${connected ? 'is-online' : 'is-offline'}`}>
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
          <span className="opacity-75 small">
            {participants.length} listening · {name}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <main className="room-main">
        <section className="player-column">
          <div className="player-wrap">
            <YouTubePlayer
              ref={playerRef}
              videoId={currentVideo?.video_id ?? null}
              onEnded={handleEnded}
              onError={() => showNotice('This video cannot be embedded by its owner.')}
              onStateChange={handlePlayerState}
              onDurationChange={setPlayerDuration}
            />

            {blockedByAutoplay && (
              <button className="autoplay-gate" onClick={resumeAfterGesture}>
                <span className="btn btn-accent">Tap to start playback</span>
                <span className="small opacity-75">
                  Playback is paused until the room is started here.
                </span>
              </button>
            )}
          </div>

          {currentVideo && (
            <>
              <div className="now-playing">
                <div className="flex-grow-1">
                  <div className="small opacity-75">Now playing</div>
                  <div className="fw-semibold text-truncate">{currentVideo.title}</div>
                  <div className="small opacity-75">{currentVideo.channel}</div>
                </div>
                {isHost && (
                  <button className="btn btn-accent btn-sm" onClick={() => emit('advance', { autoplay: true })}>
                    Next in queue
                  </button>
                )}
              </div>

              <div className="controls">
                <button
                  className="btn btn-accent"
                  onClick={togglePlayback}
                  aria-label={playback.state === 'playing' ? 'Pause for everyone' : 'Play for everyone'}
                >
                  {playback.state === 'playing' ? 'Pause' : 'Play'}
                </button>
                <span className="mono small">{formatDuration(position)}</span>
                <input
                  className="flex-grow-1"
                  type="range"
                  min={0}
                  max={scrubMax}
                  step={1}
                  value={Math.min(position, scrubMax)}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setScrub(value);
                    playerRef.current?.seek(value);
                  }}
                  onMouseUp={(event) => {
                    const value = Number((event.target as HTMLInputElement).value);
                    setScrub(null);
                    commitScrub(value);
                  }}
                  onTouchEnd={(event) => {
                    const value = Number((event.target as HTMLInputElement).value);
                    setScrub(null);
                    commitScrub(value);
                  }}
                  onKeyUp={(event) => {
                    const value = Number((event.target as HTMLInputElement).value);
                    setScrub(null);
                    commitScrub(value);
                  }}
                  onBlur={(event) => {
                    if (scrub === null) return;
                    const value = Number((event.target as HTMLInputElement).value);
                    setScrub(null);
                    commitScrub(value);
                  }}
                  aria-label="Seek"
                />
                <span className="mono small">{formatDuration(duration)}</span>
                <button className="btn btn-ghost btn-sm" onClick={commitMute}>
                  {playback.muted ? 'Unmute' : 'Mute'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={playback.volume}
                  onChange={(event) => commitVolume(Number(event.target.value))}
                  aria-label="Volume"
                />
              </div>
            </>
          )}

          <form className="search-bar" onSubmit={handleSearch}>
            <input
              className="form-control"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search YouTube for the next track…"
            />
            <button className="btn btn-accent" type="submit" disabled={searching || !query.trim()}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
          {searchError && <p className="small text-danger-soft mb-2">{searchError}</p>}

          {showSearch && results.length > 0 && (
            <ul className="result-list">
              {results.map((item) => (
                <li key={item.video_id} className="result-row">
                  <img src={item.thumbnail} alt="" className="result-thumb" loading="lazy" />
                  <div className="flex-grow-1">
                    <div className="small fw-semibold">{item.title}</div>
                    <div className="small opacity-75">
                      {item.channel} · {formatDuration(item.duration)}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => addToQueue(item)}>
                    Queue
                  </button>
                  {isHost && (
                    <button className="btn btn-accent btn-sm" onClick={() => playNow(item)}>
                      Play now
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!isHost && (
            <p className="small opacity-75 mt-2">
              The host controls what plays. You can queue requests and control playback.
            </p>
          )}
        </section>

        <aside className="side-column">
          <div className="panel p-0 overflow-hidden">
            <div className="panel-head">
              <span>Queue ({queue.length})</span>
              {isHost && queue.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => emit('queue_clear')}>
                  Clear
                </button>
              )}
            </div>
            {queue.length === 0 ? (
              <p className="px-3 py-3 mb-0 small opacity-75">Nothing queued yet.</p>
            ) : (
              <ul className="queue-list">
                {queue.map((entry, index) => (
                  <li key={entry.video_id} className="queue-row">
                    <span className="queue-index">{index + 1}</span>
                    <img src={entry.thumbnail} alt="" className="result-thumb" loading="lazy" />
                    <div className="flex-grow-1">
                      <div className="small fw-semibold text-truncate">{entry.title}</div>
                      <div className="small opacity-75 text-truncate">
                        {entry.added_by ? `added by ${entry.added_by}` : entry.channel}
                      </div>
                    </div>
                    {isHost && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => emit('queue_remove', { video_id: entry.video_id })}>
                          Remove
                        </button>
                        <button className="btn btn-accent btn-sm" onClick={() => playNow(entry)}>
                          Play
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel p-0 overflow-hidden d-flex flex-column chat-panel">
            <div className="panel-head">
              <span>Chat</span>
              <span className="small opacity-75">{messages.length}</span>
            </div>
            <div className="chat-log">
              {messages.length === 0 && <p className="small opacity-75 mb-0">Say hello 👋</p>}
              {messages.map((message, index) => (
                <div key={`${message.ts}-${index}`} className={`chat-msg ${message.system ? 'is-system' : ''}`}>
                  {!message.system && <span className="chat-author">{message.name}</span>}
                  <span className="chat-text">{message.text}</span>
                  <span className="chat-time">{clockTime(message.ts)}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input">
              <input
                className="form-control"
                value={draft}
                maxLength={500}
                placeholder="Message the room…"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    sendChat();
                  }
                }}
              />
              <button className="btn btn-accent" onClick={sendChat} disabled={!draft.trim()}>
                Send
              </button>
            </div>
          </div>

          <div className="panel p-0 overflow-hidden">
            <div className="panel-head">
              <span>Listeners ({participants.length})</span>
            </div>
            <ul className="participant-list">
              {participants.map((participant) => (
                <li key={participant.sid}>
                  <span className="avatar">{participant.name.slice(0, 1).toUpperCase()}</span>
                  <span className="small">{participant.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
