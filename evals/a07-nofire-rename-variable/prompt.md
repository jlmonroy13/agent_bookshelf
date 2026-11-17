---
name: a07-nofire-rename-variable
description: "Pure refactor in an HTML route."
tags: [skill, should-not-fire]
max_turns: 25
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write]
---

In src/routes/books.ts, rename the local variable `query` to `searchTerm`. Nothing else should change.
