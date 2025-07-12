export class SpringPhysics {
  private stiffness: number;
  private damping: number;

  constructor(stiffness: number = 180, damping: number = 12) {
    this.stiffness = stiffness;
    this.damping = damping;
  }

  public calculateSpringForce(
    currentValue: number,
    targetValue: number,
    currentVelocity: number
  ): { value: number; velocity: number } {
    const displacement = targetValue - currentValue;
    const springForce = displacement * this.stiffness;
    const dampingForce = -currentVelocity * this.damping;
    
    const acceleration = (springForce + dampingForce) / 100; // Mass = 100 for stability
    const newVelocity = currentVelocity + acceleration * 0.016; // 60fps timestep
    const newValue = currentValue + newVelocity * 0.016;

    return {
      value: newValue,
      velocity: newVelocity
    };
  }

  public smoothTransition(
    from: number,
    to: number,
    progress: number,
    velocity: number = 0
  ): { value: number; velocity: number } {
    const targetValue = from + (to - from) * this.easeInOutCubic(progress);
    return this.calculateSpringForce(from, targetValue, velocity);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}