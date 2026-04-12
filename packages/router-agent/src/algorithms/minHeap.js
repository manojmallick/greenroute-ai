/**
 * MinHeap — binary min-heap backed priority queue.
 *
 * Used by A* and Dijkstra as the open set.
 *
 * @template T
 * Time complexity: push O(log n), pop O(log n), peek O(1)
 * Space complexity: O(n)
 */
class MinHeap {
  /**
   * @param {(a: T, b: T) => number} comparator
   *   Returns negative if a has higher priority than b (should come first).
   */
  constructor(comparator) {
    /** @type {T[]} */
    this._heap = [];
    this._cmp = comparator;
  }

  /** @returns {number} */
  get size() {
    return this._heap.length;
  }

  /** @returns {boolean} */
  isEmpty() {
    return this._heap.length === 0;
  }

  /**
   * Insert an element.
   * @param {T} value
   */
  push(value) {
    this._heap.push(value);
    this._bubbleUp(this._heap.length - 1);
  }

  /**
   * Remove and return the element with the highest priority (lowest comparator value).
   * @returns {T}
   */
  pop() {
    if (this.isEmpty()) throw new Error('MinHeap is empty');
    const top = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  /**
   * Return the top element without removing it.
   * @returns {T}
   */
  peek() {
    if (this.isEmpty()) throw new Error('MinHeap is empty');
    return this._heap[0];
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._cmp(this._heap[i], this._heap[parent]) < 0) {
        this._swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  _sinkDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this._cmp(this._heap[left], this._heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < n && this._cmp(this._heap[right], this._heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest !== i) {
        this._swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  _swap(i, j) {
    const tmp = this._heap[i];
    this._heap[i] = this._heap[j];
    this._heap[j] = tmp;
  }
}

module.exports = { MinHeap };
