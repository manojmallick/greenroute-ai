'use strict';

const { GraphStore } = require('../../graph/GraphStore');

describe('GraphStore', () => {
  let g;

  beforeEach(() => {
    g = new GraphStore();
    g.addNode({ id: 'A', lat: 52.37, lon: 4.90, name: 'Alpha' });
    g.addNode({ id: 'B', lat: 52.38, lon: 4.91, name: 'Beta' });
    g.addNode({ id: 'C', lat: 52.36, lon: 4.89, name: 'Gamma' });
  });

  describe('addNode / getNode', () => {
    test('retrieves a node by id', () => {
      expect(g.getNode('A')).toMatchObject({ id: 'A', name: 'Alpha' });
    });

    test('returns undefined for missing node', () => {
      expect(g.getNode('Z')).toBeUndefined();
    });

    test('nodeCount reflects all added nodes', () => {
      expect(g.nodeCount).toBe(3);
    });

    test('re-adding same id updates node', () => {
      g.addNode({ id: 'A', lat: 99.0, lon: 99.0, name: 'Updated' });
      expect(g.getNode('A').name).toBe('Updated');
      expect(g.nodeCount).toBe(3); // still 3
    });
  });

  describe('addEdge / edgesFrom', () => {
    test('adds directed edge and retrieves it', () => {
      g.addEdge('A', { to: 'B', distanceKm: 1.5, freeFlowSpeedKmh: 50, currentSpeedKmh: 50 });
      const edges = g.edgesFrom('A');
      expect(edges).toHaveLength(1);
      expect(edges[0].to).toBe('B');
      expect(edges[0].distanceKm).toBe(1.5);
    });

    test('edge is only in one direction (directed)', () => {
      g.addEdge('A', { to: 'B', distanceKm: 1.5, freeFlowSpeedKmh: 50, currentSpeedKmh: 50 });
      expect(g.edgesFrom('B')).toHaveLength(0);
    });

    test('throws when source node does not exist', () => {
      expect(() =>
        g.addEdge('Z', { to: 'A', distanceKm: 1, freeFlowSpeedKmh: 30, currentSpeedKmh: 30 })
      ).toThrow('Source node "Z" not found');
    });

    test('throws when target node does not exist', () => {
      expect(() =>
        g.addEdge('A', { to: 'Z', distanceKm: 1, freeFlowSpeedKmh: 30, currentSpeedKmh: 30 })
      ).toThrow('Target node "Z" not found');
    });

    test('edgesFrom returns empty array for unknown node', () => {
      expect(g.edgesFrom('UNKNOWN')).toEqual([]);
    });

    test('edgeCount sums all directed edges', () => {
      g.addEdge('A', { to: 'B', distanceKm: 1, freeFlowSpeedKmh: 30, currentSpeedKmh: 30 });
      g.addEdge('B', { to: 'C', distanceKm: 1, freeFlowSpeedKmh: 30, currentSpeedKmh: 30 });
      expect(g.edgeCount).toBe(2);
    });
  });

  describe('addUndirectedEdge', () => {
    test('creates edges in both directions', () => {
      g.addUndirectedEdge('A', 'B', { distanceKm: 2, freeFlowSpeedKmh: 40, currentSpeedKmh: 40 });
      expect(g.edgesFrom('A').some((e) => e.to === 'B')).toBe(true);
      expect(g.edgesFrom('B').some((e) => e.to === 'A')).toBe(true);
    });
  });

  describe('updateEdgeSpeed', () => {
    test('updates currentSpeedKmh on existing edge', () => {
      g.addEdge('A', { to: 'B', distanceKm: 1, freeFlowSpeedKmh: 50, currentSpeedKmh: 50 });
      g.updateEdgeSpeed('A', 'B', 10);
      expect(g.edgesFrom('A')[0].currentSpeedKmh).toBe(10);
    });

    test('clamps speed to minimum 1 km/h', () => {
      g.addEdge('A', { to: 'B', distanceKm: 1, freeFlowSpeedKmh: 50, currentSpeedKmh: 50 });
      g.updateEdgeSpeed('A', 'B', 0);
      expect(g.edgesFrom('A')[0].currentSpeedKmh).toBe(1);
    });

    test('does nothing for unknown source', () => {
      expect(() => g.updateEdgeSpeed('Z', 'A', 30)).not.toThrow();
    });
  });

  describe('allNodes', () => {
    test('returns all nodes as array', () => {
      const nodes = g.allNodes();
      expect(nodes).toHaveLength(3);
      expect(nodes.map((n) => n.id).sort()).toEqual(['A', 'B', 'C']);
    });
  });

  describe('serialization (toJSON / fromJSON)', () => {
    beforeEach(() => {
      g.addEdge('A', { to: 'B', distanceKm: 1.5, freeFlowSpeedKmh: 50, currentSpeedKmh: 40 });
      g.addEdge('B', { to: 'C', distanceKm: 2.0, freeFlowSpeedKmh: 60, currentSpeedKmh: 60 });
    });

    test('toJSON produces nodes and edges arrays', () => {
      const json = g.toJSON();
      expect(json).toHaveProperty('nodes');
      expect(json).toHaveProperty('edges');
      expect(json.nodes).toHaveLength(3);
    });

    test('fromJSON reconstructs identical graph', () => {
      const json = g.toJSON();
      const restored = GraphStore.fromJSON(json);
      expect(restored.nodeCount).toBe(g.nodeCount);
      expect(restored.edgeCount).toBe(g.edgeCount);
      expect(restored.getNode('A')).toMatchObject({ id: 'A', name: 'Alpha' });
      expect(restored.edgesFrom('A')[0].to).toBe('B');
    });

    test('round-trip preserves edge properties', () => {
      const json = g.toJSON();
      const restored = GraphStore.fromJSON(json);
      const edge = restored.edgesFrom('A')[0];
      expect(edge.distanceKm).toBe(1.5);
      expect(edge.currentSpeedKmh).toBe(40);
    });
  });
});
