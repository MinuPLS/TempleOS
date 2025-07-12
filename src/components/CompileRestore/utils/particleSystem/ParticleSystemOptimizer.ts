export class ParticleSystemOptimizer {
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 60;
  private targetFps = 60;
  
  // Performance metrics
  private metrics = {
    averageFrameTime: 0,
    particleUpdateTime: 0,
    renderTime: 0,
  };

  public shouldReduceParticles(): boolean {
    return this.currentFps < this.targetFps * 0.9; // Below 90% of target
  }

  public updateMetrics(frameTime: number): void {
    this.frameCount++;
    
    const now = performance.now();
    if (now - this.lastFpsUpdate > 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
    
    // Update rolling average
    this.metrics.averageFrameTime = (this.metrics.averageFrameTime * 0.9) + (frameTime * 0.1);
  }

  public getOptimalParticleCount(baseCount: number): number {
    if (this.currentFps >= this.targetFps * 0.95) {
      return baseCount;
    } else if (this.currentFps >= this.targetFps * 0.8) {
      return Math.floor(baseCount * 0.8);
    } else {
      return Math.floor(baseCount * 0.6);
    }
  }

  public shouldEnableTrails(): boolean {
    return this.currentFps >= this.targetFps * 0.9;
  }

  public shouldEnableAdvancedEffects(): boolean {
    return this.currentFps >= this.targetFps * 0.95;
  }

  public getPerformanceReport(): string {
    return `FPS: ${this.currentFps}, Frame Time: ${this.metrics.averageFrameTime.toFixed(2)}ms`;
  }
}