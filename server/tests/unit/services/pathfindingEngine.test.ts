import { describe, it, expect } from 'vitest'
import PathfindingEngine from '../../../src/services/pathfindingEngine'

describe('PathfindingEngine — Multi-Candidate Boundary Zone Routing', () => {
  it('should pick the minimum cost path across multiple boundary candidate nodes between Zone A and Zone B', () => {
    const engine = new PathfindingEngine()

    // Zone A nodes
    engine.addNode({ id: 'A_start', lat: 40.0, lng: 10.0, name: 'Start in Zone A' })
    engine.addNode({ id: 'A_near_highway', lat: 40.1, lng: 10.1 })
    engine.addNode({ id: 'A_near_local', lat: 40.0, lng: 10.2 })

    // Boundary Crossing Candidate Nodes (where major roads cross Zone A -> Zone B)
    // Candidate 1: Highway crossing (fast/short)
    engine.addNode({ id: 'BND_Highway', lat: 40.1, lng: 10.5, name: 'Highway Boundary Crossing' })
    // Candidate 2: Secondary road crossing (longer detour)
    engine.addNode({ id: 'BND_Local', lat: 39.8, lng: 10.5, name: 'Local Road Boundary Crossing' })

    // Zone B nodes
    engine.addNode({ id: 'B_near_highway', lat: 40.1, lng: 10.9 })
    engine.addNode({ id: 'B_near_local', lat: 39.8, lng: 10.9 })
    engine.addNode({ id: 'B_target', lat: 40.1, lng: 11.0, name: 'Target in Zone B' })

    // Internal Edges in Zone A
    engine.addEdge({ from: 'A_start', to: 'A_near_highway', distanceMeters: 500 })
    engine.addEdge({ from: 'A_start', to: 'A_near_local', distanceMeters: 2500 })

    // Boundary Crossing Edges (Zone A -> Boundary Candidates)
    engine.addEdge({ from: 'A_near_highway', to: 'BND_Highway', distanceMeters: 1000 })
    engine.addEdge({ from: 'A_near_local', to: 'BND_Local', distanceMeters: 3000 })

    // Boundary Crossing Edges (Boundary Candidates -> Zone B)
    engine.addEdge({ from: 'BND_Highway', to: 'B_near_highway', distanceMeters: 1000 })
    engine.addEdge({ from: 'BND_Local', to: 'B_near_local', distanceMeters: 2000 })

    // Internal Edges in Zone B
    engine.addEdge({ from: 'B_near_highway', to: 'B_target', distanceMeters: 500 })
    engine.addEdge({ from: 'B_near_local', to: 'B_target', distanceMeters: 3000 })

    // Define Zone mappings
    const zoneMap = new Map<string, string>([
      ['A_start', 'ZONE_A'],
      ['A_near_highway', 'ZONE_A'],
      ['A_near_local', 'ZONE_A'],
      ['BND_Highway', 'ZONE_A'], // Highway candidate
      ['BND_Local', 'ZONE_A'],   // Local candidate
      ['B_near_highway', 'ZONE_B'],
      ['B_near_local', 'ZONE_B'],
      ['B_target', 'ZONE_B'],
    ])

    // Candidates: BND_Highway and BND_Local
    const candidates = ['BND_Highway', 'BND_Local']

