---
name: a01-fire-authors-list
description: "New read endpoint: skill fires, SQL in model, thin route."
tags: [skill, should-fire]
max_turns: 25
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write]
---

Add an API endpoint that lists the distinct authors in the catalog, in alphabetical order.
