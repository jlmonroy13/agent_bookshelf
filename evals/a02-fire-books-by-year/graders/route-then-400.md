---
type: regex
pattern: "/books/year/:year'[\\s\\S]{0,500}status\\(400\\)"
target: { source: file, path: src/routes/api.ts }
---
