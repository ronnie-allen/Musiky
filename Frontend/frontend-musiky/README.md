# frontend-musiky

The Musiky web client: React 18 + TypeScript + Vite 6.

Start at the [root README](../../README.md) for the full picture — setup,
environment variables, tests and deployment notes.

```bash
npm install
npm run dev      # http://localhost:5173, proxies /api + /socket.io to :5000
npm run lint     # eslint
npx tsc -b       # typecheck
npm run build    # production build into dist/
```

Copy `.env.example` to `.env` if the backend isn't on the dev proxy
(`VITE_API_URL=http://localhost:5000`).
