import * as THREE from 'three';
import { AABB, InteractableItem, KeycardId } from '../types';
import { SoundManager } from '../audio/SoundManager';
import { InputManager } from '../input/InputManager';

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public position = new THREE.Vector3(0, 1.7, 15.0);
  public yaw = 0;
  public pitch = 0;

  public isSprinting = false;
  public isCrouching = false;
  public isHiding = false;
  public activeLocker: InteractableItem | null = null;
  public lastLockerEnterTime = 0;

  public flashlightOn = true;
  public battery = 100;
  public oxygen = 100;
  public noiseRadius = 1.5;
  public noiseLabel = 'STEALTH';
  public totalDistanceMoved = 0;
  public reducedEffects = false;
  public enhancedVisibility = false;

  // ARC PULSE Defensive Capacitor System
  public arcCharges = 2;
  // maxArcCharges defined dynamically
  public arcRechargeProgress = 0; // 0..100% toward next charge
  public arcCooldown = 0; // Minimum seconds before next shot
  public readonly arcCooldownDuration = 3.0;
  public readonly arcRange = 7.5;
  public arcDischargesCount = 0;
  private arcFlashTimer = 0;
  private arcEffectGroup: THREE.Group;

  // Fair encounter suit trauma buffer (absorbs first hit and grants escape/pulse window)
  public suitTraumaTimer = 0;

  public inventory = new Set<KeycardId>();
  public upgrades = new Set<string>();
  public maxArcCharges = 3;
  public maxOxygen = 100;
  public hoveredInteractable: InteractableItem | null = null;
  private lastValidInteractable: InteractableItem | null = null;
  private lastValidInteractableTime = 0;

  public flashlight: THREE.SpotLight;
  public flashlightFill: THREE.PointLight;
  private flashlightTarget: THREE.Object3D;
  private coneMesh: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private stepTimer = 0;
  private headBobTimer = 0;
  private transientNoiseBonus = 0;

  // Pre-allocated scratch objects to avoid GC allocations in render loop
  private readonly _moveVec = new THREE.Vector3();
  private readonly _forwardDir = new THREE.Vector3();
  private readonly _rightDir = new THREE.Vector3();
  private readonly _camForward = new THREE.Vector3();
  private readonly _toItem = new THREE.Vector3();
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _screenCenter = new THREE.Vector2(0, 0);

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    private sound: SoundManager,
    public input: InputManager
  ) {
    this.camera = camera;
    this.camera.position.copy(this.position);

    // Substantially upgraded high-lumen wide-beam suit flashlight
    this.flashlight = new THREE.SpotLight(0xfff6e5, 11.5, 38, Math.PI / 3.8, 0.38, 1.05);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.width = 512;
    this.flashlight.shadow.mapSize.height = 512;
    this.flashlight.shadow.camera.near = 0.3;
    this.flashlight.shadow.camera.far = 34;
    scene.add(this.flashlight);

    // Close-range peripheral fill light so nearby walls, signs, and doors are clearly lit
    this.flashlightFill = new THREE.PointLight(0xdceeff, 1.85, 9.5, 1.2);
    scene.add(this.flashlightFill);

    this.flashlightTarget = new THREE.Object3D();
    scene.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    const coneGeo = new THREE.ConeGeometry(1.35, 4.0, 20, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, -0.18, -2.0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff5de,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.coneMesh = new THREE.Mesh(coneGeo, coneMat);
    this.camera.add(this.coneMesh);

    // 3D ARC PULSE electrical discharge effect attached to camera
    this.arcEffectGroup = new THREE.Group();
    const arcRingGeo = new THREE.TorusGeometry(0.55, 0.035, 8, 24);
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0x38b6ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const ring1 = new THREE.Mesh(arcRingGeo, arcMat);
    ring1.position.set(0, -0.08, -1.35);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.025, 8, 24), arcMat);
    ring2.position.set(0, -0.08, -2.4);
    this.arcEffectGroup.add(ring1, ring2);
    this.arcEffectGroup.visible = false;
    this.camera.add(this.arcEffectGroup);

    scene.add(this.camera);
  }

  public get inputEnabled(): boolean {
    return this.input.enabled;
  }

  public set inputEnabled(val: boolean) {
    this.input.setEnabled(val);
  }

  public reset(): void {
    this.position.set(0, 1.7, 15.0);
    this.yaw = 0;
    this.pitch = 0;
    this.isSprinting = false;
    this.isCrouching = false;
    this.isHiding = false;
    this.activeLocker = null;
    this.flashlightOn = true;
    this.battery = 100;
    this.oxygen = 100;
    this.arcCharges = 2;
    this.arcRechargeProgress = 0;
    this.arcCooldown = 0;
    this.arcFlashTimer = 0;
    this.arcEffectGroup.visible = false;
    this.suitTraumaTimer = 0;
    this.totalDistanceMoved = 0;
    this.inventory.clear();
    this.upgrades.clear();
    this.maxArcCharges = 3;
    this.maxOxygen = 100;
    this.hoveredInteractable = null;
    this.lastValidInteractable = null;
    this.lastValidInteractableTime = 0;
    this.transientNoiseBonus = 0;
    this.input.clearAllInputs();
    this.input.syncCrouchVisual(false);
    this.updateCameraTransform(0);
  }

  public getFlashlightStats(): { intensity: number; distance: number; angle: number; fillIntensity: number } {
    return {
      intensity: this.flashlight.intensity,
      distance: this.flashlight.distance,
      angle: this.flashlight.angle,
      fillIntensity: this.flashlightFill.intensity
    };
  }

  public setShadowQuality(enableShadows: boolean): void {
    this.flashlight.castShadow = enableShadows;
  }

  public addNoiseSpike(amount: number): void {
    this.transientNoiseBonus = Math.max(this.transientNoiseBonus, amount);
  }

  public canFireArcPulse(): boolean {
    return this.arcCharges > 0 && this.arcCooldown <= 0 && !this.isHiding;
  }

  public consumeArcPulse(): boolean {
    if (!this.canFireArcPulse()) return false;
    this.arcCharges = Math.max(0, this.arcCharges - 1);
    this.arcCooldown = this.arcCooldownDuration;
    this.arcFlashTimer = 0.32;
    this.arcEffectGroup.visible = true;
    this.arcDischargesCount++;
    this.addNoiseSpike(7.5);
    return true;
  }

  public applyUpgrade(type: string): void {
    this.upgrades.add(type);
    if (type === 'SUIT_REINFORCEMENT') {
      this.suitTraumaTimer = 0;
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 25);
    } else if (type === 'PULSE_CAPACITOR_BOOST') {
      this.maxArcCharges = 4;
      this.arcCharges = Math.min(this.maxArcCharges, this.arcCharges + 1);
    } else if (type === 'O2_TANK_EXPANSION') {
      this.maxOxygen = 135;
      this.oxygen = this.maxOxygen;
    }
  }

  public rechargeArcCapacitor(charges = 1): void {
    this.arcCharges = Math.min(this.maxArcCharges, this.arcCharges + charges);
    if (this.arcCharges >= this.maxArcCharges) {
      this.arcRechargeProgress = 0;
    }
  }

  public toggleFlashlight(): void {
    if (!this.flashlightOn && this.battery <= 1) return;
    this.flashlightOn = !this.flashlightOn;
    this.sound.playFlashlightToggle();
    this.addNoiseSpike(3.5);
  }

  public toggleCrouch(): void {
    if (this.isHiding) return;
    this.isCrouching = !this.isCrouching;
    this.input.syncCrouchVisual(this.isCrouching);
  }

  public enterLocker(locker: InteractableItem): void {
    if (!locker.lockerViewPos) return;
    this.isHiding = true;
    this.activeLocker = locker;
    this.lastLockerEnterTime = performance.now();
    this.position.copy(locker.lockerViewPos);
    if (locker.lockerFacingYaw !== undefined) {
      this.yaw = locker.lockerFacingYaw;
      this.pitch = 0;
    }
    this.flashlightOn = false;
    this.sound.playDoorSound(false);
    this.updateCameraTransform(0);
  }

  public exitLocker(): void {
    if (!this.activeLocker || !this.activeLocker.lockerExitPos) return;
    this.position.copy(this.activeLocker.lockerExitPos);
    this.isHiding = false;
    this.activeLocker = null;
    this.sound.playDoorSound(false);
    this.updateCameraTransform(0);
  }

  public syncCameraToPosition(): void {
    this.updateCameraTransform(0);
  }

  public update(dt: number, colliders: AABB[], interactables: InteractableItem[]): void {
    // 1. Poll unified InputManager
    const { lookYawDelta, lookPitchDelta } = this.input.update(dt);
    this.yaw += lookYawDelta;
    this.pitch += lookPitchDelta;
    const maxPitch = Math.PI / 2 - 0.08;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // 2. Oxygen depletion & Suit trauma recovery
    const o2DrainRate = this.isSprinting ? 0.32 : 0.15;
    this.oxygen = Math.max(0, this.oxygen - o2DrainRate * dt);
    if (this.suitTraumaTimer > 0) {
      this.suitTraumaTimer = Math.max(0, this.suitTraumaTimer - dt);
    }

    // 3. ARC PULSE cooldown & capacitor regeneration
    if (this.arcCooldown > 0) {
      this.arcCooldown = Math.max(0, this.arcCooldown - dt);
    }
    if (this.arcFlashTimer > 0) {
      this.arcFlashTimer = Math.max(0, this.arcFlashTimer - dt);
      const scale = 1 + (0.32 - this.arcFlashTimer) * 3.2;
      this.arcEffectGroup.scale.set(scale, scale, 1);
      if (this.arcFlashTimer <= 0) {
        this.arcEffectGroup.visible = false;
      }
    }
    if (this.arcCharges < this.maxArcCharges) {
      // Regenerate 1 charge every 16 seconds (~6.25% per second)
      this.arcRechargeProgress += dt * 6.25;
      if (this.arcRechargeProgress >= 100) {
        this.arcCharges = Math.min(this.maxArcCharges, this.arcCharges + 1);
        this.arcRechargeProgress = 0;
      }
    } else {
      this.arcRechargeProgress = 0;
    }

    // 4. Flashlight battery management
    if (this.flashlightOn) {
      this.battery = Math.max(0, this.battery - 0.85 * dt);
      if (this.battery <= 0.2) {
        this.flashlightOn = false;
        this.sound.playFlashlightToggle();
      }
    } else {
      if (this.battery < 35) {
        this.battery = Math.min(35, this.battery + 2.5 * dt);
      }
    }

    const baseFlashIntensity = this.enhancedVisibility ? 14.5 : 11.5;
    let lightIntensity = this.flashlightOn ? baseFlashIntensity : 0;
    if (this.flashlightOn && this.battery < 12 && !this.reducedEffects) {
      if (Math.random() < 0.18) lightIntensity = 2.5;
    }
    this.flashlight.intensity = lightIntensity;
    this.flashlightFill.intensity = this.flashlightOn ? (this.enhancedVisibility ? 2.4 : 1.85) : 0;
    this.coneMesh.visible = this.flashlightOn && lightIntensity > 1;

    // 5. Movement & Collision
    let moveSpeed = 0;
    if (!this.isHiding) {
      const forwardInput = this.input.moveZ;
      const strafeInput = this.input.moveX;

      const inputMag = Math.min(1, Math.hypot(forwardInput, strafeInput));
      const isMoving = inputMag > 0.08;
      this.isSprinting = isMoving && this.input.sprintHeld && !this.isCrouching;

      const baseSpeed = this.isCrouching ? 2.15 : this.isSprinting ? 6.1 : 3.85;

      if (isMoving) {
        this._forwardDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        this._rightDir.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

        this._moveVec.set(0, 0, 0);
        this._moveVec.addScaledVector(this._forwardDir, forwardInput);
        this._moveVec.addScaledVector(this._rightDir, strafeInput);
        if (this._moveVec.lengthSq() > 0.0001) {
          this._moveVec.normalize();
        }

        moveSpeed = baseSpeed * inputMag;
        const prevX = this.position.x;
        const prevZ = this.position.z;

        const stepX = this._moveVec.x * moveSpeed * dt;
        const stepZ = this._moveVec.z * moveSpeed * dt;

        this.tryMove(stepX, 0, colliders);
        this.tryMove(0, stepZ, colliders);

        const actualDist = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
        this.totalDistanceMoved += actualDist;

        const stepInterval = this.isSprinting ? 0.31 : this.isCrouching ? 0.62 : 0.46;
        this.stepTimer += dt;
        if (this.stepTimer >= stepInterval) {
          this.stepTimer = 0;
          this.sound.playFootstep(this.isSprinting, this.isCrouching);
        }
        this.headBobTimer += dt * (this.isSprinting ? 13 : this.isCrouching ? 5 : 8.5);
      } else {
        this.stepTimer = 0.25;
      }
    }

    // 6. Acoustic noise calculation
    this.transientNoiseBonus = Math.max(0, this.transientNoiseBonus - dt * 6);
    if (this.isHiding) {
      this.noiseRadius = 0.5;
      this.noiseLabel = 'CONCEALED';
    } else if (moveSpeed > 5.0) {
      this.noiseRadius = 17.5 + this.transientNoiseBonus;
      this.noiseLabel = 'LOUD (SPRINT)';
    } else if (moveSpeed > 2.5) {
      this.noiseRadius = 6.2 + this.transientNoiseBonus;
      this.noiseLabel = 'MODERATE';
    } else if (moveSpeed > 0.1) {
      this.noiseRadius = 2.2 + this.transientNoiseBonus;
      this.noiseLabel = 'QUIET (CROUCH)';
    } else {
      this.noiseRadius = 1.1 + this.transientNoiseBonus;
      this.noiseLabel = this.transientNoiseBonus > 2 ? 'NOISE SPIKE' : 'STEALTH';
    }

    this.updateCameraTransform(moveSpeed);
    this.updateInteractionRaycast(interactables);
  }

  public tryMove(dx: number, dz: number, colliders: AABB[]): void {
    const nextX = this.position.x + dx;
    const nextZ = this.position.z + dz;
    const radius = 0.36;

    for (const box of colliders) {
      if (!box.enabled) continue;
      if (
        nextX + radius > box.minX &&
        nextX - radius < box.maxX &&
        nextZ + radius > box.minZ &&
        nextZ - radius < box.maxZ
      ) {
        return;
      }
    }

    this.position.x = nextX;
    this.position.z = nextZ;
  }

  private updateCameraTransform(moveSpeed: number): void {
    const targetHeight = this.isHiding ? 1.55 : this.isCrouching ? 1.05 : 1.7;
    this.position.y += (targetHeight - this.position.y) * 0.18;

    const bobAmp = this.reducedEffects ? 0 : this.isSprinting ? 0.06 : 0.032;
    const bobOffset = moveSpeed > 0.1 && !this.isHiding ? Math.sin(this.headBobTimer) * bobAmp : 0;

    this.camera.position.set(this.position.x, this.position.y + bobOffset, this.position.z);

    this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);

    this._camForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.flashlight.position.copy(this.camera.position).addScaledVector(this._camForward, 0.15);
    this.flashlightFill.position.copy(this.camera.position).addScaledVector(this._camForward, 0.35);
    this.flashlightTarget.position.copy(this.camera.position).addScaledVector(this._camForward, 12);
  }

  public updateInteractionRaycast(interactables: InteractableItem[]): void {
    if (this.isHiding) {
      this.hoveredInteractable = null;
      this.lastValidInteractable = null;
      return;
    }

    this.raycaster.setFromCamera(this._screenCenter, this.camera);
    this.raycaster.far = 3.3;

    this._camForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);

    const isTouch = this.input.isTouchActive;
    const maxDirectDist = isTouch ? 3.35 : 3.15;
    const minDirectDot = isTouch ? 0.60 : 0.76;

    let bestDirect: InteractableItem | null = null;
    let bestDirectScore = -Infinity;

    let bestProximity: InteractableItem | null = null;
    let bestProximityScore = -Infinity;

    for (const item of interactables) {
      if (!item.enabled) continue;
      const dx = item.position.x - this.position.x;
      const dz = item.position.z - this.position.z;
      const dist2D = Math.hypot(dx, dz);
      const dist3D = this.camera.position.distanceTo(item.position);
      const dist = Math.min(dist2D, dist3D);

      if (dist > maxDirectDist) continue;

      this._toItem.copy(item.position).sub(this.camera.position).normalize();
      const dot3D = this._camForward.dot(this._toItem);
      const dot2D = dist2D > 0.001 ? (dx * fwdX + dz * fwdZ) / dist2D : 1.0;
      const effectiveDot = Math.max(dot3D, dot2D * 0.96);

      if (effectiveDot >= minDirectDot) {
        const score = effectiveDot * 2.5 - dist * 0.65;
        if (score > bestDirectScore) {
          bestDirectScore = score;
          bestDirect = item;
        }
      } else {
        const maxProxDist = isTouch ? 2.85 : 2.15;
        const minProxDot = isTouch ? -0.25 : 0.30;
        if (dist <= maxProxDist && (dot2D >= minProxDot || dist <= 1.65)) {
          const proxScore = dot2D * 1.2 - dist;
          if (proxScore > bestProximityScore) {
            bestProximityScore = proxScore;
            bestProximity = item;
          }
        }
      }
    }

    const now = performance.now();
    const resolved = bestDirect || bestProximity;

    if (resolved) {
      this.hoveredInteractable = resolved;
      this.lastValidInteractable = resolved;
      this.lastValidInteractableTime = now;
    } else if (
      this.lastValidInteractable &&
      this.lastValidInteractable.enabled &&
      now - this.lastValidInteractableTime < 350 &&
      Math.hypot(
        this.lastValidInteractable.position.x - this.position.x,
        this.lastValidInteractable.position.z - this.position.z
      ) <= 3.4
    ) {
      this.hoveredInteractable = this.lastValidInteractable;
    } else {
      this.hoveredInteractable = null;
    }
  }

  public getBestInteractable(interactables: InteractableItem[]): InteractableItem | null {
    this.updateInteractionRaycast(interactables);
    if (this.hoveredInteractable && this.hoveredInteractable.enabled) {
      return this.hoveredInteractable;
    }

    let nearest: InteractableItem | null = null;
    let nearestDist = 3.25;
    for (const item of interactables) {
      if (!item.enabled) continue;
      const d = Math.hypot(item.position.x - this.position.x, item.position.z - this.position.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = item;
      }
    }
    if (nearest) {
      this.hoveredInteractable = nearest;
      this.lastValidInteractable = nearest;
      this.lastValidInteractableTime = performance.now();
    }
    return nearest;
  }
}
