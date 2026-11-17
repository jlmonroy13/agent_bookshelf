---
type: regex
pattern: "select\\s"
target: { source: file, path: src/routes/api.ts }
flags: i
match: not_contains
---
