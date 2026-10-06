# Contributing to Musiky

Thanks for stopping by the counter. This guide keeps contributions smooth and
the rooms playing.

## Setup

1. Fork the repo and clone your fork.
2. Backend:
   ```bash
   cd Backend
   python -m venv venv && source venv/bin/activate
   pip install -r requirements.txt -r requirements-dev.txt
   cp .env.example .env
   ```
   Set `MONGO_MOCK=1` in `.env` if you don't run MongoDB locally. Add a
   `YOUTUBE_API_KEY` only if you need to exercise search.
3. Frontend:
   ```bash
   cd Frontend/frontend-musiky
   npm install
   npm run dev
   ```

## Before you push

Every pull request must keep these green (they also run in CI):

```bash
cd Backend && PYTHONPATH=. MONGO_MOCK=1 python tests/test_api.py
cd Frontend/frontend-musiky && npm run lint && npx tsc -b && npm run build
```

## Frontend changes need a manual room QA pass

There is no automated browser suite, so UI pull requests must be exercised by
hand in two browser windows (or a normal + incognito window):

- [ ] Create a room, copy the invite link, join from the second window
- [ ] Both windows show the same six-digit code and listener count
- [ ] Host plays a track — guest sees now-playing and transport controls
- [ ] Guest pause/resume reaches the host; seek follows on both sides
- [ ] Queue a track from each side; duplicate queue is refused with a notice
- [ ] Host plays from the queue; the entry is removed
- [ ] Chat flows both ways with sender names and timestamps
- [ ] Host leaves — guest is promoted, announcement appears in chat
- [ ] `/room/000000` shows the room-unavailable panel with a way home
- [ ] No unexpected console errors in either window
- [ ] Layout checked at a phone width (~390 px) and desktop (~1280 px)

## Pull request rules

- Branch from `main`, keep the PR focused on one change.
- Match the existing commit style: `feat|fix|test|style|chore|docs(scope): short summary`.
- UI changes must include before/after screenshots (or a short clip) in the PR body.
- Don't commit secrets, `.env` files, `venv/`, `node_modules/`, `dist/` or
  editor files — they are all git-ignored. Double-check with `git status`.
- Never commit API keys or tokens. If one slips in, rotate it immediately and
  say so in the PR.

## Reporting bugs

Use the bug-report template: what you did, what you expected, what happened,
room code if shareable, and the browser console output. For anything involving
credentials or a live key, follow [SECURITY.md](SECURITY.md) instead.
