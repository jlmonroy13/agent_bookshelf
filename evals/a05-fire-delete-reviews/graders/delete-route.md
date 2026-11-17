---
type: regex
pattern: "router\\.delete\\('/[^']*review[^']*'"
target: { source: file, path: src/routes/api.ts }
flags: i
---
