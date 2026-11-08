/** Estado del teclado (WASD y flechas). */
export class Input {
  private readonly keys = new Set<string>();

  constructor() {
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  /** -1 a 1: avance (W/↑) y retroceso (S/↓). */
  get throttle(): number {
    return (this.has('KeyW', 'ArrowUp') ? 1 : 0) - (this.has('KeyS', 'ArrowDown') ? 1 : 0);
  }

  /** -1 a 1: giro a la izquierda (A/←) positivo. */
  get steer(): number {
    return (this.has('KeyA', 'ArrowLeft') ? 1 : 0) - (this.has('KeyD', 'ArrowRight') ? 1 : 0);
  }

  private has(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }
}
