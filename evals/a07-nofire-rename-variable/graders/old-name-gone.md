---
type: regex
pattern: "const query\\b"
target: { source: file, path: src/routes/books.ts }
match: not_contains
---
