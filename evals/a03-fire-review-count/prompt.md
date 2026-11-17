---
name: a03-fire-review-count
description: "Endpoint needing a 404 for an unknown user."
tags: [skill, should-fire, not-found]
max_turns: 25
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write]
---

Add GET /api/users/:id/review-count that returns how many reviews that user has written. If the user doesn't exist, say so.
