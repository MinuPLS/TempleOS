import { PathPoint } from './types';

export class PathSystem {
  private _controlPoints: PathPoint[] = []
  private _pathLength = 0
  
  constructor() {
    this.initializePath();
  }

  private initializePath(): void {
    // Define bezier curve control points from HolyC to JIT token
    this._controlPoints = [
      { x: -175, y: 0, tangentX: -50, tangentY: 0 },     // Start point (HolyC position)
      { x: -87.5, y: 0, tangentX: 0, tangentY: -30 },    // Control point 1
      { x: 0, y: 0, tangentX: 0, tangentY: 0 },          // Center transformation zone
      { x: 87.5, y: 0, tangentX: 0, tangentY: 30 },      // Control point 2
      { x: 175, y: 0, tangentX: 50, tangentY: 0 }        // End point (JIT position)
    ];
    
    this.calculatePathLength();
  }

  private calculatePathLength(): void {
    // Approximate path length using line segments
    let length = 0;
    const segments = 100;
    let prevPoint = this.getPointOnPath(0);
    
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const point = this.getPointOnPath(t);
      const dx = point.x - prevPoint.x;
      const dy = point.y - prevPoint.y;
      length += Math.sqrt(dx * dx + dy * dy);
      prevPoint = point;
    }
    
    this._pathLength = length;
  }

  public getPointOnPath(t: number): { x: number; y: number } {
    // Clamp t between 0 and 1
    t = Math.max(0, Math.min(1, t));
    
    const [start, control1, center, control2, end] = this._controlPoints
    const x = this.cubicBezier(t, start.x, control1.x, control2.x, end.x)
    const y = this.cubicBezier(t, start.y, center.y, control2.y, end.y)
    
    return { x, y };
  }

  private cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
    const oneMinusT = 1 - t;
    return (
      Math.pow(oneMinusT, 3) * p0 +
      3 * Math.pow(oneMinusT, 2) * t * p1 +
      3 * oneMinusT * Math.pow(t, 2) * p2 +
      Math.pow(t, 3) * p3
    );
  }

  public getPathVariation(t: number, particleId: string): { x: number; y: number } {
    // Add sinusoidal variations to make paths unique per particle
    const seed = parseInt(particleId.split('-')[1]) || 0;
    const frequency1 = 2 + (seed % 3);
    const frequency2 = 3 + (seed % 2);
    
    const xVariation = Math.sin(t * Math.PI * frequency1 + seed) * 10;
    const yVariation = Math.cos(t * Math.PI * frequency2 + seed * 0.5) * 15;
    
    return { x: xVariation, y: yVariation };
  }

  public getColorAtPosition(t: number, isCompileMode: boolean): { r: number; g: number; b: number } {
    // Color interpolation based on position
    if (t < 0.4) {
      // Source color zone
      return isCompileMode 
        ? { r: 59, g: 130, b: 246 }  // Blue (HolyC)
        : { r: 245, g: 158, b: 11 }; // Orange (JIT)
    } else if (t > 0.6) {
      // Target color zone
      return isCompileMode 
        ? { r: 245, g: 158, b: 11 }  // Orange (JIT)
        : { r: 59, g: 130, b: 246 }; // Blue (HolyC)
    } else {
      // Transformation zone - purple gradient
      const transformProgress = (t - 0.4) / 0.2;
      if (isCompileMode) {
        // Blue to purple to orange
        const r = 59 + (186 * transformProgress);
        const g = 130 - (130 * transformProgress * 0.5) + (158 * transformProgress * 0.5);
        const b = 246 - (235 * transformProgress);
        return { r, g, b };
      } else {
        // Orange to purple to blue
        const r = 245 - (186 * transformProgress);
        const g = 158 - (158 * transformProgress * 0.5) + (130 * transformProgress * 0.5);
        const b = 11 + (235 * transformProgress);
        return { r, g, b };
      }
    }
  }

  public getTangentAtPosition(t: number): { x: number; y: number } {
    // Calculate tangent for particle rotation
    const delta = 0.001;
    const p1 = this.getPointOnPath(t - delta);
    const p2 = this.getPointOnPath(t + delta);
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    return {
      x: dx / length,
      y: dy / length
    };
  }

  public getPathLength(): number {
    return this._pathLength
  }
}
