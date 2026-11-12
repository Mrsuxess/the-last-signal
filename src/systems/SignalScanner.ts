import * as THREE from 'three';
import { SoundManager } from '../audio/SoundManager';

export class SignalScanner {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private targetEl: HTMLElement;
  private distEl: HTMLElement;
  private emiEl: HTMLElement;
  private staticOverlay: HTMLElement;

  private pulsePhase = 0;
  private pingFlash = 0;

  constructor(private sound: SoundManager) {
    this.canvas = document.getElementById('scanner-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.targetEl = document.getElementById('scanner-target')!;
    this.distEl = document.getElementById('scanner-dist')!;
    this.emiEl = document.getElementById('scanner-emi')!;
    this.staticOverlay = document.getElementById('static-overlay')!;
  }

  public triggerPing(
    playerPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    creaturePos: THREE.Vector3,
    creatureActive: boolean
  ): void {
    this.pingFlash = 1.0;
    const dist = playerPos.distanceTo(targetPos);
    const creatureDist = creatureActive ? playerPos.distanceTo(creaturePos) : 999;
    this.sound.playScannerPing(dist, creatureDist < 16);
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
    targetName: string,
    targetPos: THREE.Vector3,
    creaturePos: THREE.Vector3,
    creatureActive: boolean
  ): void {
    this.pulsePhase += dt * 3.5;
    this.pingFlash = Math.max(0, this.pingFlash - dt * 1.8);

    const dx = targetPos.x - playerPos.x;
    const dz = targetPos.z - playerPos.z;
    const dist = Math.hypot(dx, dz);

    // Angle to target relative to player's forward look direction (-Z at yaw=0)
    const worldAngle = Math.atan2(-dx, -dz);
    let relAngle = worldAngle - playerYaw;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    const creatureDist = creatureActive ? playerPos.distanceTo(creaturePos) : 999;
    const distortion = creatureActive ? Math.max(0, 1 - creatureDist / 18) : 0;

    // Update text readouts
    this.targetEl.textContent = targetName;
    this.distEl.textContent = `${dist.toFixed(1)} m`;

    if (distortion > 0.55) {
      this.emiEl.textContent = 'CRITICAL ANOMALY!';
      this.emiEl.style.color = '#ff3b30';
    } else if (distortion > 0.15) {
      this.emiEl.textContent = 'INTERFERENCE';
      this.emiEl.style.color = '#f3a847';
    } else {
      this.emiEl.textContent = 'NOMINAL';
      this.emiEl.style.color = '#4af2a1';
    }

    // Full-screen subtle static when creature is very close
    this.staticOverlay.style.opacity = (distortion * 0.42).toFixed(2);

    this.drawRadarAndWaveform(relAngle, dist, creaturePos, playerPos, playerYaw, creatureActive, distortion);
  }

  private drawRadarAndWaveform(
    relAngle: number,
    dist: number,
    creaturePos: THREE.Vector3,
    playerPos: THREE.Vector3,
    playerYaw: number,
    creatureActive: boolean,
    distortion: number
  ): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(3, 10, 8, 0.85)';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.34;
    const cy = h * 0.52;
    const radius = 38;

    // Radar rings
    ctx.strokeStyle = 'rgba(74, 242, 161, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Forward FOV cone lines
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - 22, cy - 31);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 22, cy - 31);
    ctx.stroke();

    // Ping expanding ring
    if (this.pingFlash > 0.01) {
      ctx.strokeStyle = `rgba(74, 242, 161, ${this.pingFlash.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, (1 - this.pingFlash) * radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Objective target blip on radar
    const clampedDist = Math.min(radius - 4, (dist / 28) * radius);
    const blipX = cx - Math.sin(relAngle) * clampedDist;
    const blipY = cy - Math.cos(relAngle) * clampedDist;

    ctx.fillStyle = '#4af2a1';
    ctx.beginPath();
    ctx.arc(blipX, blipY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Creature red glitch blip if active & within 22m
    if (creatureActive && distortion > 0.05) {
      const cdx = creaturePos.x - playerPos.x;
      const cdz = creaturePos.z - playerPos.z;
      const cDist = Math.hypot(cdx, cdz);
      const cWorldAngle = Math.atan2(-cdx, -cdz);
      const cRelAngle = cWorldAngle - playerYaw;
      const cClamped = Math.min(radius - 4, (cDist / 24) * radius);
      const cX = cx - Math.sin(cRelAngle) * cClamped + (Math.random() - 0.5) * distortion * 8;
      const cY = cy - Math.cos(cRelAngle) * cClamped + (Math.random() - 0.5) * distortion * 8;

      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(cX, cY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Right-side directional carrier waveform
    const waveLeft = w * 0.68;
    const waveWidth = w * 0.28;
    const alignment = Math.max(0.15, Math.cos(relAngle));

    ctx.strokeStyle = distortion > 0.4 ? '#ff3b30' : '#4af2a1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = waveLeft + (i / 24) * waveWidth;
      const env = Math.sin((i / 24) * Math.PI);
      const amp = env * alignment * 22 + (Math.random() - 0.5) * distortion * 28;
      const y = cy + Math.sin(this.pulsePhase * 2 + i * 0.7) * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
