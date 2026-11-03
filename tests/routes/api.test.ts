import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { initDb, closeDb } from '../../src/db/index.js';

beforeEach(async () => {
  await initDb('/tmp/test-api.db');
});

afterEach(() => {
  closeDb();
  const fs = require('fs');
  try {
    fs.unlinkSync('/tmp/test-api.db');
  } catch (e) {
    // ignore
  }
});

describe('API Routes', () => {
  describe('GET /api/books', () => {
    it('returns all books', async () => {
      const res = await request(app).get('/api/books');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(50);
      expect(res.body[0]).toHaveProperty('title');
      expect(res.body[0]).toHaveProperty('author');
    });
  });

  describe('GET /api/books/:id', () => {
    it('returns a book by id', async () => {
      const res = await request(app).get('/api/books/1');
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('The Pragmatic Programmer');
    });

    it('returns 404 for non-existent book', async () => {
      const res = await request(app).get('/api/books/999');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/reviews', () => {
    it('creates a new review', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .send({
          userId: 1,
          bookId: 5,
          rating: 5,
          reviewText: 'Amazing book!'
        });

      expect(res.status).toBe(201);
      expect(res.body.rating).toBe(5);
      expect(res.body.review_text).toBe('Amazing book!');
    });

    it('prevents duplicate reviews', async () => {
      // Alice already reviewed book 1 in seed data
      const res = await request(app)
        .post('/api/reviews')
        .send({
          userId: 1,
          bookId: 1,
          rating: 4,
          reviewText: 'Trying to review again'
        });

      expect(res.status).toBe(409);
    });

    it('validates rating range', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .send({
          userId: 1,
          bookId: 5,
          rating: 6,
          reviewText: 'Invalid rating'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/books/:id/read', () => {
    it('marks a book as read on the user read shelf', async () => {
      const res = await request(app)
        .post('/api/books/31/read')
        .send({ userId: 1 });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Book marked as read');
      expect(res.body.shelfId).toBe(3);
      expect(res.body.bookId).toBe(31);

      const shelf = await request(app).get('/api/shelves/3');
      expect(shelf.body.books.some((b: { book_id: number }) => b.book_id === 31)).toBe(true);
    });

    it('is idempotent when the book is already on the read shelf', async () => {
      const res = await request(app)
        .post('/api/books/1/read')
        .send({ userId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Book already marked as read');
    });

    it('requires userId', async () => {
      const res = await request(app).post('/api/books/5/read').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('userId is required');
    });

    it('returns 404 for missing book', async () => {
      const res = await request(app)
        .post('/api/books/999/read')
        .send({ userId: 1 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Book not found');
    });

    it('returns 404 for missing user', async () => {
      const res = await request(app)
        .post('/api/books/5/read')
        .send({ userId: 999 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });
  });

  // TODO: Add tests for other API endpoints
  // TODO: Add tests for error handling
  // TODO: Add tests for edge cases
});
