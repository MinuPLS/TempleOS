export class PerlinNoise {
  private permutation: number[] = [];
  private p: number[] = [];

  constructor(seed: number = Math.random() * 1000) {
    this.initializePermutation(seed);
  }

  private initializePermutation(seed: number): void {
    // Create permutation table
    const perm = [];
    for (let i = 0; i < 256; i++) {
      perm[i] = i;
    }

    // Shuffle using seed
    let n = perm.length;
    while (n > 1) {
      n--;
      const k = Math.floor(this.seededRandom(seed + n) * (n + 1));
      const temp = perm[n];
      perm[n] = perm[k];
      perm[k] = temp;
    }

    // Duplicate permutation table
    this.permutation = perm;
    this.p = [];
    for (let i = 0; i < 512; i++) {
      this.p[i] = this.permutation[i % 256];
    }
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public noise2D(x: number, y: number): number {
    // Find unit square containing point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Find relative x,y of point in square
    x -= Math.floor(x);
    y -= Math.floor(y);

    // Compute fade curves
    const u = this.fade(x);
    const v = this.fade(y);

    // Hash coordinates of square corners
    const a = this.p[X] + Y;
    const aa = this.p[a];
    const ab = this.p[a + 1];
    const b = this.p[X + 1] + Y;
    const ba = this.p[b];
    const bb = this.p[b + 1];

    // Blend results from corners
    const res = this.lerp(v, 
      this.lerp(u, this.grad(this.p[aa], x, y), this.grad(this.p[ba], x - 1, y)),
      this.lerp(u, this.grad(this.p[ab], x, y - 1), this.grad(this.p[bb], x - 1, y - 1))
    );

    return res;
  }

  public turbulence(x: number, y: number, octaves: number = 4): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * Math.abs(this.noise2D(x * frequency, y * frequency));
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  }
}