---
type: regex
pattern: "/users/:id/review-count'[\\s\\S]{0,600}status\\(404\\)"
target: { source: file, path: src/routes/api.ts }
---
