'use strict';

const { MinHeap } = require('../minHeap');

describe('MinHeap', () => {
  describe('basic operations', () => {
    test('starts empty', () => {
      const h = new MinHeap((a, b) => a - b);
      expect(h.isEmpty()).toBe(true);
      expect(h.size).toBe(0);
    });

    test('push increases size', () => {
      const h = new MinHeap((a, b) => a - b);
      h.push(5);
      h.push(3);
      expect(h.size).toBe(2);
    });

    test('pop removes minimum element', () => {
      const h = new MinHeap((a, b) => a - b);
      h.push(10);
      h.push(3);
      h.push(7);
      h.push(1);
      expect(h.pop()).toBe(1);
      expect(h.pop()).toBe(3);
      expect(h.pop()).toBe(7);
      expect(h.pop()).toBe(10);
    });

    test('peek does not remove element', () => {
      const h = new MinHeap((a, b) => a - b);
      h.push(5);
      h.push(2);
      expect(h.peek()).toBe(2);
      expect(h.size).toBe(2);
    });

    test('pop from empty heap throws', () => {
      const h = new MinHeap((a, b) => a - b);
      expect(() => h.pop()).toThrow('MinHeap is empty');
    });

    test('peek from empty heap throws', () => {
      const h = new MinHeap((a, b) => a - b);
      expect(() => h.peek()).toThrow('MinHeap is empty');
    });
  });

  describe('object comparator (A* use case)', () => {
    const cmp = (a, b) => a.f - b.f;

    test('returns node with smallest f-score first', () => {
      const h = new MinHeap(cmp);
      h.push({ node: 'C', f: 10 });
      h.push({ node: 'A', f: 2 });
      h.push({ node: 'B', f: 5 });
      expect(h.pop().node).toBe('A');
      expect(h.pop().node).toBe('B');
      expect(h.pop().node).toBe('C');
    });

    test('handles duplicate f-scores', () => {
      const h = new MinHeap(cmp);
      h.push({ node: 'X', f: 3 });
      h.push({ node: 'Y', f: 3 });
      // Both pop without error
      expect(h.pop().f).toBe(3);
      expect(h.pop().f).toBe(3);
    });
  });

  describe('large data set', () => {
    test('correctly orders 1000 random numbers', () => {
      const h = new MinHeap((a, b) => a - b);
      const nums = Array.from({ length: 1000 }, () => Math.floor(Math.random() * 10000));
      nums.forEach((n) => h.push(n));
      const sorted = nums.slice().sort((a, b) => a - b);
      const result = [];
      while (!h.isEmpty()) result.push(h.pop());
      expect(result).toEqual(sorted);
    });
  });

  describe('single element', () => {
    test('push then pop single element', () => {
      const h = new MinHeap((a, b) => a - b);
      h.push(42);
      expect(h.pop()).toBe(42);
      expect(h.isEmpty()).toBe(true);
    });
  });
});
