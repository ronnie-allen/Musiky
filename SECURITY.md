# Security policy

## Supported versions

Musiky is pre-1.0. Only the latest commit on `main` receives security fixes.
If you run a fork or a pinned commit, rebase onto `main` before reporting.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's
[private vulnerability reporting](../../security/advisories/new) on this
repository so details stay hidden until a fix is ready. Include:

- What is affected (backend, frontend, config) and how to reproduce it
- The impact as you understand it (data exposure, takeover, spoofing, …)
- Anything you have already tried

You will get an acknowledgement, and we will coordinate disclosure of the fix.

## Secrets hygiene

- API keys, tokens and connection strings must never be committed. `.env` is
  git-ignored; `.env.example` files carry placeholders only.
- If a secret is committed by accident: **rotate it first**, then remove it
  from the code and tell the maintainers so history can be dealt with.
- The default `SECRET_KEY` in `.env.example` is a development placeholder —
  production deployments must set their own.
