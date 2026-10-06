name: Feature request
description: An idea for the rooms
labels: [enhancement]
body:
  - type: textarea
    id: idea
    attributes:
      label: What should Musiky do?
    validations:
      required: true
  - type: textarea
    id: why
    attributes:
      label: Why would a room want this?
      description: The listening scenario it improves.
    validations:
      required: true
  - type: textarea
    id: notes
    attributes:
      label: Anything else?
      description: Mockups, similar features elsewhere, scope thoughts.
