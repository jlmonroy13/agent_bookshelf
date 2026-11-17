---
name: a02-fire-books-by-year
description: "Path param that must be validated with a 400."
tags: [skill, should-fire, validation]
max_turns: 25
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write]
---

Add GET /api/books/year/:year that returns the books published in that year. A year that isn't a number should be rejected.
