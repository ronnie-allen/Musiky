## What changed

## Checklist

- [ ] Backend suite green (`PYTHONPATH=. MONGO_MOCK=1 python tests/test_api.py` from `Backend/`)
- [ ] Frontend gates green (`npm run lint`, `npx tsc -b`, `npm run build`)
- [ ] UI change covered by the manual room QA pass in CONTRIBUTING.md
- [ ] UI change includes before/after screenshots
- [ ] No secrets, `.env` files or build artifacts committed (`git status` clean of them)
