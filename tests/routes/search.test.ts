import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import app from '../../src/server.js';
import { initDb, closeDb } from '../../src/db/index.js';

beforeEach(async () => {
  await initDb('/tmp/test-search.db');
});

afterEach(() => {
  closeDb();
  try {
    fs.unlinkSync('/tmp/test-search.db');
  } catch (e) {
    // ignore
  }
});

const search = (qs: string) => request(app).get(`/api/books/search${qs}`);
const titles = (body: any[]) => body.map((b) => b.title);

describe('GET /api/books/search (BOOK-101)', () => {
  it('AC1: partial match on title (q=code includes "Clean Code")', async () => {
    const res = await search('?q=code');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(titles(res.body)).toContain('Clean Code');
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        title: expect.any(String),
        author: expect.any(String),
        isbn: expect.any(String),
        description: expect.any(String),
        published_year: expect.any(Number),
      })
    );
    expect(res.body[0]).toHaveProperty('cover_url');
    expect(res.body[0]).toHaveProperty('created_at');
  });

  it('AC2: partial match on author (q=fowler includes "Refactoring")', async () => {
    const res = await search('?q=fowler');
    expect(res.status).toBe(200);
    expect(titles(res.body)).toContain('Refactoring');
  });

  it('AC3: case-insensitive (CLEAN, clean, cLeAn return the same list)', async () => {
    const upper = await search('?q=CLEAN');
    const lower = await search('?q=clean');
    const mixed = await search('?q=cLeAn');
    expect(upper.status).toBe(200);
    expect(titles(lower.body)).toContain('Clean Code');
    expect(upper.body).toEqual(lower.body);
    expect(mixed.body).toEqual(lower.body);
  });

  it('AC4: empty, whitespace-only and missing q return all books', async () => {
    const all = await request(app).get('/api/books');
    expect(all.body).toHaveLength(50);
    for (const qs of ['?q=', '?q=%20%20', '']) {
      const res = await search(qs);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(all.body);
    }
  });

  it('AC5: input is trimmed (q=%20%20fowler%20 behaves like q=fowler)', async () => {
    const plain = await search('?q=fowler');
    const padded = await search('?q=%20%20fowler%20');
    expect(padded.status).toBe(200);
    expect(titles(plain.body)).toContain('Refactoring');
    expect(padded.body).toEqual(plain.body);
  });

  it('AC6: length limit, 100 chars after trim is 200, 101 is 400', async () => {
    const ok = await search(`?q=${'a'.repeat(100)}`);
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body)).toBe(true);

    const paddedOk = await search(`?q=%20%20${'a'.repeat(100)}%20%20`);
    expect(paddedOk.status).toBe(200);

    const tooLong = await search(`?q=${'a'.repeat(101)}`);
    expect(tooLong.status).toBe(400);
    expect(tooLong.body).toEqual({ error: 'Query must be 100 characters or fewer' });
  });

  it('AC6: validation, q sent more than once or not a string is 400', async () => {
    const twice = await search('?q=a&q=b');
    expect(twice.status).toBe(400);
    expect(twice.body).toEqual({ error: 'Query must be a single string' });

    const obj = await search('?q%5Ba%5D=b');
    expect(obj.status).toBe(400);
    expect(obj.body).toEqual({ error: 'Query must be a single string' });
  });

  it("AC7: parameterised SQL (q=' OR 1=1 -- returns [])", async () => {
    const res = await search(`?q=${encodeURIComponent("' OR 1=1 --")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('AC8: LIKE wildcards are literal (q=% and q=_ return [])', async () => {
    const pct = await search('?q=%25');
    expect(pct.status).toBe(200);
    expect(pct.body).toEqual([]);
    const underscore = await search('?q=_');
    expect(underscore.status).toBe(200);
    expect(underscore.body).toEqual([]);
  });

  it('AC9: route does not collide with /api/books/:id', async () => {
    const res = await search('?q=dune');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(titles(res.body)).toContain('Dune');

    const book = await request(app).get('/api/books/1');
    expect(book.status).toBe(200);
    expect(book.body.title).toBe('The Pragmatic Programmer');
  });

  it('ordering: no match returns [] and results are ordered by title', async () => {
    const none = await search('?q=zzzzqqqq');
    expect(none.status).toBe(200);
    expect(none.body).toEqual([]);

    const res = await search('?q=ursula');
    expect(titles(res.body)).toEqual(['The Dispossessed', 'The Left Hand of Darkness']);

    const broad = await search('?q=the');
    expect(broad.body.length).toBeGreaterThan(5);
    const lowered = titles(broad.body).map((t) => t.toLowerCase());
    expect(lowered).toEqual([...lowered].sort());
  });
});
