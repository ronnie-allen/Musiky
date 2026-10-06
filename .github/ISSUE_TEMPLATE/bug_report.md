name: Bug report
description: Something in a room is broken
labels: [bug]
body:
  - type: textarea
    id: what
    attributes:
      label: What did you do?
      description: Steps to reproduce, including the room code if you can share it.
      placeholder: Created a room, queued a track, pressed play…
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: What did you expect?
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: What happened instead?
      description: Paste any browser console errors (F12 → Console).
    validations:
      required: true
  - type: input
    id: env
    attributes:
      label: Environment
      placeholder: e.g. Chrome 140 on Windows 11, backend on :5000 with MONGO_MOCK=1
