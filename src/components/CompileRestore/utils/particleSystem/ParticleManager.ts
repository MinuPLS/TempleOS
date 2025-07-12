import { ParticleState, ParticleSystemConfig } from './types';
import { SpringPhysics } from './SpringPhysics';

export class ParticleManager {
  private particles: ParticleState[] = [];
  private particlePool: ParticleState[] = [];
  private config: ParticleSystemConfig;
  private idCounter = 0;
  private springPhysics: SpringPhysics;

  constructor(config: ParticleSystemConfig) {
    this.config = config;
    this.springPhysics = new SpringPhysics(180, 12);
    this.initializeParticlePool();
  }

  private initializeParticlePool(): void {
    for (let i = 0; i < this.config.particleCount * 2; i++) {
      this.particlePool.push(this.createParticle());
    }
  }

  private createParticle(): ParticleState {
    const id = `particle-${this.idCounter++}`;
    return {
      id,
      position: 0,
      velocity: 0.4 + Math.random() * 0.2, // Base velocity with variation
      size: 8 + Math.random() * 6,
      energy: 0.5 + Math.random() * 0.5,
      noise: { x: 0, y: 0 },
      color: { r: 255, g: 255, b: 255 },
      trail: [],
    };
  }

  public spawnParticle(initialPosition: number = 0): ParticleState | null {
    const particle = this.particlePool.pop();
    if (!particle) return null;

    // Reset particle state with more variation
    particle.position = initialPosition;
    particle.velocity = 0.3 + Math.random() * 0.3; // More speed variation
    particle.energy = 0.6 + Math.random() * 0.4;
    particle.size = 6 + Math.random() * 8; // Update size on spawn
    particle.trail = [];
    
    this.particles.push(particle);
    return particle;
  }

  public recycleParticle(particle: ParticleState): void {
    const index = this.particles.indexOf(particle);
    if (index > -1) {
      this.particles.splice(index, 1);
      this.particlePool.push(particle);
    }
  }

  public updateParticles(deltaTime: number, direction: 1 | -1): void {
    this.particles.forEach(particle => {
      // Update position based on velocity and direction
      particle.position += particle.velocity * deltaTime * direction;

      // Update trail positions
      if (this.config.enableTrails && particle.trail.length > 0) {
        particle.trail.forEach(point => {
          point.opacity *= 0.95; // Fade trail
        });
        // Remove faded trail points
        particle.trail = particle.trail.filter(point => point.opacity > 0.01);
      }

      // Breathing effect
      if (this.config.enableBreathing) {
        const breathingPhase = Date.now() * 0.001 + parseFloat(particle.id.split('-')[1]) * 0.1;
        particle.size = (8 + Math.random() * 6) * (1 + Math.sin(breathingPhase) * 0.1);
      }
    });

    // Recycle particles that have completed their journey
    const particlesToRecycle = this.particles.filter(p => 
      p.position < 0 || p.position > 1
    );
    
    particlesToRecycle.forEach(p => this.recycleParticle(p));
  }

  public getActiveParticles(): ParticleState[] {
    return [...this.particles];
  }

  public reverseDirection(): void {
    // Smoothly reverse particle velocities using spring physics
    this.particles.forEach(particle => {
      // Create a smooth transition instead of instant reversal
      const targetVelocity = -Math.abs(particle.velocity) * Math.sign(particle.velocity * -1);
      const springResult = this.springPhysics.calculateSpringForce(
        particle.velocity,
        targetVelocity,
        0
      );
      particle.velocity = springResult.value;
    });
  }

  public getParticleCount(): number {
    return this.particles.length;
  }

  public reset(): void {
    // Return all particles to pool
    while (this.particles.length > 0) {
      const particle = this.particles.pop()!;
      this.particlePool.push(particle);
    }
  }
}