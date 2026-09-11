/**
 * High-Performance Graph Pathfinding Engine
 * Features:
 *  1. Standard Dijkstra's Algorithm
 *  2. A* (A-Star) Algorithm with Haversine Heuristic
 *  3. Bidirectional Dijkstra's Algorithm
 *  4. Bidirectional A* Algorithm (Two-in-One: Simultaneous Forward & Backward A* Search)
 */

export interface GraphNode {
  id: string
  lat: number
  lng: number
  name?: string
}

export interface GraphEdge {
  from: string
  to: string
  distanceMeters: number
  weight?: number
}

export interface PathfindingResult {
  pathNodeIds: string[]
  coordinates: [number, number][]
  totalDistanceMeters: number
  nodesEvaluated: number
  algorithmUsed: 'dijkstra' | 'a_star' | 'bidirectional_dijkstra' | 'bidirectional_a_star' | 'multi_candidate_zone_routing'
  selectedBoundaryNodeId?: string
  candidateBoundaryNodesEvaluated?: number
}

/** Haversine formula for great-circle distance between two (lat, lng) points in meters */
export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's mean radius in meters
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

/** Min-Priority Queue for Dijkstra / A* search */
class PriorityQueue<T> {
  private items: { element: T; priority: number }[] = []

  enqueue(element: T, priority: number) {
    this.items.push({ element, priority })
    this.items.sort((a, b) => a.priority - b.priority)
  }

  dequeue(): T | undefined {
    return this.items.shift()?.element
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }
}

export class PathfindingEngine {
  private nodes: Map<string, GraphNode> = new Map()
  private adjacency: Map<string, { to: string; distanceMeters: number }[]> = new Map()

  addNode(node: GraphNode) {
    this.nodes.set(node.id, node)
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, [])
    }
  }

  addEdge(edge: GraphEdge, bidirectional = true) {
    if (!this.adjacency.has(edge.from)) this.adjacency.set(edge.from, [])
    if (!this.adjacency.has(edge.to)) this.adjacency.set(edge.to, [])

    this.adjacency.get(edge.from)!.push({ to: edge.to, distanceMeters: edge.distanceMeters })
    if (bidirectional) {
      this.adjacency.get(edge.to)!.push({ to: edge.from, distanceMeters: edge.distanceMeters })
    }
  }

  /** Heuristic helper: h(u, v) */
  private h(uId: string, vId: string): number {
    const u = this.nodes.get(uId)
    const v = this.nodes.get(vId)
    if (!u || !v) return 0
    return haversineDistanceMeters(u.lat, u.lng, v.lat, v.lng)
  }

  /**
   * 1. Standard Dijkstra Algorithm
   */
  findDijkstra(startId: string, targetId: string): PathfindingResult | null {
    const startNode = this.nodes.get(startId)
    const targetNode = this.nodes.get(targetId)
    if (!startNode || !targetNode) return null

    const dist = new Map<string, number>()
    const parent = new Map<string, string>()
    const pq = new PriorityQueue<string>()

    dist.set(startId, 0)
    pq.enqueue(startId, 0)

    let evaluatedCount = 0

    while (!pq.isEmpty()) {
      const u = pq.dequeue()!
      evaluatedCount++

      if (u === targetId) break

      const currentDist = dist.get(u) || 0
      const neighbors = this.adjacency.get(u) || []
      for (const neighbor of neighbors) {
        const v = neighbor.to
        const newDist = currentDist + neighbor.distanceMeters
        if (newDist < (dist.get(v) ?? Infinity)) {
          dist.set(v, newDist)
          parent.set(v, u)
          pq.enqueue(v, newDist)
        }
      }
    }

    if (!dist.has(targetId)) return null

    const pathNodeIds: string[] = []
    let curr: string | undefined = targetId
    while (curr) {
      pathNodeIds.push(curr)
      curr = parent.get(curr)
    }
    pathNodeIds.reverse()

    return {
      pathNodeIds,
      coordinates: pathNodeIds.map((id) => [this.nodes.get(id)!.lat, this.nodes.get(id)!.lng]),
      totalDistanceMeters: dist.get(targetId) || 0,
      nodesEvaluated: evaluatedCount,
      algorithmUsed: 'dijkstra',
    }
  }

  /**
   * 2. A* (A-Star) Algorithm with Haversine Heuristic
   */
  findAStar(startId: string, targetId: string): PathfindingResult | null {
    const startNode = this.nodes.get(startId)
    const targetNode = this.nodes.get(targetId)
    if (!startNode || !targetNode) return null

    const gScore = new Map<string, number>()
    const parent = new Map<string, string>()
    const pq = new PriorityQueue<string>()

    gScore.set(startId, 0)
    pq.enqueue(startId, 0 + this.h(startId, targetId))

    let evaluatedCount = 0

    while (!pq.isEmpty()) {
      const u = pq.dequeue()!
      evaluatedCount++

      if (u === targetId) break

      const currentG = gScore.get(u) || 0
      const neighbors = this.adjacency.get(u) || []
      for (const neighbor of neighbors) {
        const v = neighbor.to
        const tentativeG = currentG + neighbor.distanceMeters
        if (tentativeG < (gScore.get(v) ?? Infinity)) {
          gScore.set(v, tentativeG)
          parent.set(v, u)
          const fScore = tentativeG + this.h(v, targetId)
          pq.enqueue(v, fScore)
        }
      }
    }

    if (!gScore.has(targetId)) return null

    const pathNodeIds: string[] = []
    let curr: string | undefined = targetId
    while (curr) {
      pathNodeIds.push(curr)
      curr = parent.get(curr)
    }
    pathNodeIds.reverse()

    return {
      pathNodeIds,
      coordinates: pathNodeIds.map((id) => [this.nodes.get(id)!.lat, this.nodes.get(id)!.lng]),
      totalDistanceMeters: gScore.get(targetId) || 0,
      nodesEvaluated: evaluatedCount,
      algorithmUsed: 'a_star',
    }
  }

  /**
   * 3. Bidirectional Dijkstra's Algorithm
   * Searches simultaneously forward from startId (S -> T) and backward from targetId (T -> S)
   */
  findBidirectionalDijkstra(startId: string, targetId: string): PathfindingResult | null {
    const startNode = this.nodes.get(startId)
    const targetNode = this.nodes.get(targetId)
    if (!startNode || !targetNode) return null

    if (startId === targetId) {
      return {
        pathNodeIds: [startId],
        coordinates: [[startNode.lat, startNode.lng]],
        totalDistanceMeters: 0,
        nodesEvaluated: 1,
        algorithmUsed: 'bidirectional_dijkstra',
      }
    }

    // Forward Search (S -> T)
    const distF = new Map<string, number>()
    const parentF = new Map<string, string>()
    const pqF = new PriorityQueue<string>()

    // Backward Search (T -> S)
    const distB = new Map<string, number>()
    const parentB = new Map<string, string>()
    const pqB = new PriorityQueue<string>()

    const visitedF = new Set<string>()
    const visitedB = new Set<string>()

    distF.set(startId, 0)
    pqF.enqueue(startId, 0)

    distB.set(targetId, 0)
    pqB.enqueue(targetId, 0)

    let bestDist = Infinity
    let meetingNode: string | null = null
    let evaluatedCount = 0

    while (!pqF.isEmpty() && !pqB.isEmpty()) {
      // Step 1: Expand Forward
      if (!pqF.isEmpty()) {
        const u = pqF.dequeue()!
        evaluatedCount++
        visitedF.add(u)

        if (visitedB.has(u)) {
          const total = (distF.get(u) || 0) + (distB.get(u) || 0)
          if (total < bestDist) {
            bestDist = total
            meetingNode = u
          }
        }

        const currentDist = distF.get(u) || 0
        const neighbors = this.adjacency.get(u) || []
        for (const neighbor of neighbors) {
          const v = neighbor.to
          const newDist = currentDist + neighbor.distanceMeters
          if (newDist < (distF.get(v) ?? Infinity)) {
            distF.set(v, newDist)
            parentF.set(v, u)
            pqF.enqueue(v, newDist)
          }
        }
      }

      // Step 2: Expand Backward
      if (!pqB.isEmpty()) {
        const u = pqB.dequeue()!
        evaluatedCount++
        visitedB.add(u)

        if (visitedF.has(u)) {
          const total = (distF.get(u) || 0) + (distB.get(u) || 0)
          if (total < bestDist) {
            bestDist = total
            meetingNode = u
          }
        }

        const currentDist = distB.get(u) || 0
        const neighbors = this.adjacency.get(u) || []
        for (const neighbor of neighbors) {
          const v = neighbor.to
          const newDist = currentDist + neighbor.distanceMeters
          if (newDist < (distB.get(v) ?? Infinity)) {
            distB.set(v, newDist)
            parentB.set(v, u)
            pqB.enqueue(v, newDist)
          }
        }
      }

      // Termination check for Bidirectional Dijkstra
      if (meetingNode && (distF.get(meetingNode) || 0) + (distB.get(meetingNode) || 0) <= bestDist) {
        break
      }
    }

    if (!meetingNode) return null

    // Reconstruct S -> meetingNode -> T
    const pathForward: string[] = []
    let curr: string | undefined = meetingNode
    while (curr && curr !== startId) {
      pathForward.push(curr)
      curr = parentF.get(curr)
    }
    pathForward.push(startId)
    pathForward.reverse()

    const pathBackward: string[] = []
    curr = parentB.get(meetingNode)
    while (curr) {
      pathBackward.push(curr)
      curr = parentB.get(curr)
    }

    const fullPathNodeIds = [...pathForward, ...pathBackward]
    return {
      pathNodeIds: fullPathNodeIds,
      coordinates: fullPathNodeIds.map((id) => [this.nodes.get(id)!.lat, this.nodes.get(id)!.lng]),
      totalDistanceMeters: bestDist,
      nodesEvaluated: evaluatedCount,
      algorithmUsed: 'bidirectional_dijkstra',
    }
  }

  /**
   * Unified Pathfinding Helper
   */
  findPath(
    startId: string,
    targetId: string,
    algorithm: 'dijkstra' | 'a_star' | 'bidirectional_dijkstra' | 'bidirectional_a_star' = 'bidirectional_dijkstra'
  ): PathfindingResult | null {
    switch (algorithm) {
      case 'dijkstra':
        return this.findDijkstra(startId, targetId)
      case 'a_star':
        return this.findAStar(startId, targetId)
      case 'bidirectional_dijkstra':
        return this.findBidirectionalDijkstra(startId, targetId)
      case 'bidirectional_a_star':
        return this.findBidirectionalAStar(startId, targetId)
      default:
        return this.findBidirectionalDijkstra(startId, targetId)
    }
  }

  /**
   * 4. Two-in-One: Bidirectional A* Pathfinding Algorithm
   * Combines Bidirectional Search (Start->Goal & Goal->Start) with Haversine A* Heuristic
   */
  findBidirectionalAStar(startId: string, targetId: string): PathfindingResult | null {
    const startNode = this.nodes.get(startId)
    const targetNode = this.nodes.get(targetId)
    if (!startNode || !targetNode) return null


    if (startId === targetId) {
      return {
        pathNodeIds: [startId],
        coordinates: [[startNode.lat, startNode.lng]],
        totalDistanceMeters: 0,
        nodesEvaluated: 1,
        algorithmUsed: 'bidirectional_a_star',
      }
    }

    // Forward Search (S -> T)
    const distF = new Map<string, number>()
    const parentF = new Map<string, string>()
    const pqF = new PriorityQueue<string>()

    // Backward Search (T -> S)
    const distB = new Map<string, number>()
    const parentB = new Map<string, string>()
    const pqB = new PriorityQueue<string>()

    const visitedF = new Set<string>()
    const visitedB = new Set<string>()

    distF.set(startId, 0)
    pqF.enqueue(startId, 0 + this.h(startId, targetId))

    distB.set(targetId, 0)
    pqB.enqueue(targetId, 0 + this.h(targetId, startId))

    let bestDist = Infinity
    let meetingNode: string | null = null
    let evaluatedCount = 0

    while (!pqF.isEmpty() && !pqB.isEmpty()) {
      // Step 1: Expand Forward
      if (!pqF.isEmpty()) {
        const u = pqF.dequeue()!
        evaluatedCount++
        visitedF.add(u)

        if (visitedB.has(u)) {
          const total = (distF.get(u) || 0) + (distB.get(u) || 0)
          if (total < bestDist) {
            bestDist = total
            meetingNode = u
          }
        }

        const currentDist = distF.get(u) || 0
        const neighbors = this.adjacency.get(u) || []
        for (const neighbor of neighbors) {
          const v = neighbor.to
          const newDist = currentDist + neighbor.distanceMeters
          if (newDist < (distF.get(v) ?? Infinity)) {
            distF.set(v, newDist)
            parentF.set(v, u)
            // Priority f_F(v) = g_F(v) + (h(v, T) - h(S, v)) / 2
            const priority = newDist + (this.h(v, targetId) - this.h(startId, v)) / 2
            pqF.enqueue(v, priority)
          }
        }
      }

      // Step 2: Expand Backward
      if (!pqB.isEmpty()) {
        const u = pqB.dequeue()!
        evaluatedCount++
        visitedB.add(u)

        if (visitedF.has(u)) {
          const total = (distF.get(u) || 0) + (distB.get(u) || 0)
          if (total < bestDist) {
            bestDist = total
            meetingNode = u
          }
        }

        const currentDist = distB.get(u) || 0
        const neighbors = this.adjacency.get(u) || []
        for (const neighbor of neighbors) {
          const v = neighbor.to
          const newDist = currentDist + neighbor.distanceMeters
          if (newDist < (distB.get(v) ?? Infinity)) {
            distB.set(v, newDist)
            parentB.set(v, u)
            // Priority f_B(v) = g_B(v) + (h(S, v) - h(v, T)) / 2
            const priority = newDist + (this.h(startId, v) - this.h(v, targetId)) / 2
            pqB.enqueue(v, priority)
          }
        }
      }

      // Check termination: if meeting node found and cost is minimal
      if (meetingNode && (distF.get(meetingNode) || 0) + (distB.get(meetingNode) || 0) <= bestDist) {
        break
      }
    }

    if (!meetingNode) return null

    // Reconstruct S -> meetingNode -> T
    const pathForward: string[] = []
    let curr: string | undefined = meetingNode
    while (curr && curr !== startId) {
      pathForward.push(curr)
      curr = parentF.get(curr)
    }
    pathForward.push(startId)
    pathForward.reverse()

    const pathBackward: string[] = []
    curr = parentB.get(meetingNode)
    while (curr) {
      pathBackward.push(curr)
      curr = parentB.get(curr)
    }

    const fullPathNodeIds = [...pathForward, ...pathBackward]
    return {
      pathNodeIds: fullPathNodeIds,
      coordinates: fullPathNodeIds.map((id) => [this.nodes.get(id)!.lat, this.nodes.get(id)!.lng]),
      totalDistanceMeters: bestDist,
      nodesEvaluated: visitedF.size + visitedB.size,
      algorithmUsed: 'bidirectional_a_star' as const,
    };
  }
}