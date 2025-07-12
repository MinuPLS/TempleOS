export interface ParticleState {
  id: string;
  position: number; // 0-1 along path
  velocity: number;
  size: number;
  energy: number; // affects glow intensity
  noise: { x: number; y: number }; // position offsets
  color: { r: number; g: number; b: number };
  trail: Array<{ x: number; y: number; opacity: number }>;
}

export interface ParticleSystemConfig {
  particleCount: number;
  pathDuration: number;
  enableNoise: boolean;
  enableTrails: boolean;
  enableBreathing: boolean;
}

export interface PathPoint {
  x: number;
  y: number;
  tangentX: number;
  tangentY: number;
}

export type AnimationMode = 'compile' | 'restore';