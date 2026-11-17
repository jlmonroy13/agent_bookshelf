---
name: a04-fire-rename-shelf
description: "Update endpoint where the unique constraint implies a 409."
tags: [skill, should-fire, conflict]
max_turns: 25
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write]
---

Add PUT /api/shelves/:id so a shelf can be renamed. A user can't have two shelves with the same name, so report that case properly.
