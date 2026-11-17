---
name: a05-fire-delete-reviews
description: "Bulk delete with an empty success body."
tags: [skill, should-fire]
max_turns: 25
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write]
---

Add an endpoint that deletes every review written by a given user and returns nothing on success.
