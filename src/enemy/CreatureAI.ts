import * as THREE from 'three';
import { AABB, CreatureClass, DifficultyLevel, EnemyFSMState } from '../types';
import { SoundManager } from '../audio/SoundManager';

export class CreatureAI {
  public creatureClass: CreatureClass = 'SIGNAL_STALKER';
  public state: EnemyFSMState = 'PATROL';
  public group: THREE.Group;
  public position = new THREE.Vector3(0, 0, -21);
  public active = false;

  // Survivability, Stun & Defeat State
  public hitsTaken = 0;
  public maxHits = 3;
  public defeated = false;
  public stunTimer = 0;
  public attackRecoveryTimer = 0;
  public graceTimer = 0;
  public isPausedByInstruction = false;

  // Dynamic Movement Profile based on Creature Class
  public patrolSpeed = 1.85;
  public investigateSpeed = 2.55;
  public lostTargetSpeed = 2.75;
  public chaseSpeed = 3.55;
  public attackRange = 1.05;

  private waypoints: THREE.Vector3[] = [];
  private currentWaypointIdx = 0;
  private targetPos = new THREE.Vector3();
  private lastKnownPlayerPos = new THREE.Vector3();
  private navTarget = new THREE.Vector3();

  private stateTimer = 0;
  private chaseDuration = 0;
  private stepTimer = 0;
  private animTime = 0;

  private torsoMesh!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private headCluster!: THREE.Group;
  private eyeLight!: THREE.PointLight;
  private carapaceMat!: THREE.MeshStandardMaterial;
  private sinewMat!: THREE.MeshStandardMaterial;
  private eyeMat!: THREE.MeshBasicMaterial;
  private overloadArcRing!: THREE.Mesh;

  // Scratch vectors to avoid render-loop allocations
  private readonly _forward = new THREE.Vector3();
  private readonly _toPlayer = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    waypoints: THREE.Vector3[],
    private sound: SoundManager,
    creatureClass: CreatureClass = 'SIGNAL_STALKER'
  ) {
    this.waypoints = waypoints;
    this.creatureClass = creatureClass;
    this.group = this.buildCreatureMesh();
    this.applyClassProfile(creatureClass);
    this.group.position.copy(this.position);
    this.group.visible = false;
    scene.add(this.group);
  }

  public setClass(creatureClass: CreatureClass, difficulty: DifficultyLevel = 'survivor'): void {
    this.creatureClass = creatureClass;
    this.applyClassProfile(creatureClass, difficulty);
  }

  private applyClassProfile(cls: CreatureClass, difficulty: DifficultyLevel = 'survivor'): void {
    const diffSpeedMul = difficulty === 'explorer' ? 0.88 : difficulty === 'nightmare' ? 1.15 : 1.0;
    const diffHitsMul = difficulty === 'explorer' ? -1 : difficulty === 'nightmare' ? 1 : 0;

    switch (cls) {
      case 'RUNNER':
        this.patrolSpeed = 2.4 * diffSpeedMul;
        this.investigateSpeed = 3.6 * diffSpeedMul;
        this.lostTargetSpeed = 3.8 * diffSpeedMul;
        this.chaseSpeed = 4.45 * diffSpeedMul; // High-velocity pursuit
        this.attackRange = 1.15;
        this.maxHits = Math.max(2, 2 + diffHitsMul);
        this.group.scale.set(0.82, 0.82, 0.82);
        this.sinewMat.color.setHex(0xa61c28);
        this.sinewMat.emissive.setHex(0xff3344);
        this.sinewMat.emissiveIntensity = 0.95;
        this.carapaceMat.color.setHex(0x1a2430);
        this.eyeMat.color.setHex(0xffaa22);
        this.eyeLight.color.setHex(0xffaa22);
        this.eyeLight.intensity = 3.2;
        break;

      case 'BRUTE':
        this.patrolSpeed = 1.35 * diffSpeedMul;
        this.investigateSpeed = 1.75 * diffSpeedMul;
        this.lostTargetSpeed = 1.85 * diffSpeedMul;
        this.chaseSpeed = 2.65 * diffSpeedMul; // Heavy, thunderous pursuit
        this.attackRange = 1.45;
        this.maxHits = Math.max(3, 4 + diffHitsMul);
        this.group.scale.set(1.42, 1.35, 1.42);
        this.sinewMat.color.setHex(0x38120c);
        this.sinewMat.emissive.setHex(0x8a2412);
        this.sinewMat.emissiveIntensity = 0.6;
        this.carapaceMat.color.setHex(0x0e141a);
        this.eyeMat.color.setHex(0xff2200);
        this.eyeLight.color.setHex(0xff2200);
        this.eyeLight.intensity = 4.0;
        break;

      case 'WATCHER':
        this.patrolSpeed = 1.6 * diffSpeedMul;
        this.investigateSpeed = 2.3 * diffSpeedMul;
        this.lostTargetSpeed = 2.4 * diffSpeedMul;
        this.chaseSpeed = 3.2 * diffSpeedMul;
        this.attackRange = 1.05;
        this.maxHits = Math.max(2, 3 + diffHitsMul);
        this.group.scale.set(0.95, 1.15, 0.95);
        this.sinewMat.color.setHex(0x1a2e38);
        this.sinewMat.emissive.setHex(0x1f5f7a);
        this.sinewMat.emissiveIntensity = 0.85;
        this.carapaceMat.color.setHex(0x0b1117);
        this.eyeMat.color.setHex(0x38d6ff);
        this.eyeLight.color.setHex(0x38d6ff);
        this.eyeLight.intensity = 3.5;
        break;

      case 'SIGNAL_STALKER':
      default:
        this.patrolSpeed = 1.85 * diffSpeedMul;
        this.investigateSpeed = 2.55 * diffSpeedMul;
        this.lostTargetSpeed = 2.75 * diffSpeedMul;
        this.chaseSpeed = 3.55 * diffSpeedMul;
        this.attackRange = 1.05;
        this.maxHits = Math.max(2, 3 + diffHitsMul);
        this.group.scale.set(1.0, 1.0, 1.0);
        this.sinewMat.color.setHex(0x6b141a);
        this.sinewMat.emissive.setHex(0xcc1822);
        this.sinewMat.emissiveIntensity = 0.75;
        this.carapaceMat.color.setHex(0x242e3a);
        this.eyeMat.color.setHex(0xff2211);
        this.eyeLight.color.setHex(0xff2211);
        this.eyeLight.intensity = 2.4;
        break;
    }
  }

  private buildCreatureMesh(): THREE.Group {
    const root = new THREE.Group();

    this.carapaceMat = new THREE.MeshStandardMaterial({
      color: 0x242e3a,
      emissive: 0x1c080a,
      emissiveIntensity: 0.35,
      roughness: 0.32,
      metalness: 0.55
    });

    this.sinewMat = new THREE.MeshStandardMaterial({
      color: 0x6b141a,
      emissive: 0xcc1822,
      emissiveIntensity: 0.75,
      roughness: 0.45
    });

    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2211 });

    const torsoGeo = new THREE.CylinderGeometry(0.38, 0.24, 1.65, 10);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.carapaceMat);
    this.torsoMesh.position.y = 1.5;
    this.torsoMesh.rotation.x = 0.22;
    root.add(this.torsoMesh);

    for (let i = 0; i < 4; i++) {
      const ribGeo = new THREE.TorusGeometry(0.36 - i * 0.035, 0.045, 8, 14);
      const rib = new THREE.Mesh(ribGeo, this.sinewMat);
      rib.position.set(0, 1.85 - i * 0.24, 0.05);
      rib.rotation.x = Math.PI / 2;
      root.add(rib);
    }

    // Electrical overload arc ring visible when hit by ARC PULSE
    const arcGeo = new THREE.TorusGeometry(0.68, 0.035, 8, 18);
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0x38d6ff,
      wireframe: true
    });
    this.overloadArcRing = new THREE.Mesh(arcGeo, arcMat);
    this.overloadArcRing.position.set(0, 1.5, 0);
    this.overloadArcRing.visible = false;
    root.add(this.overloadArcRing);

    this.headCluster = new THREE.Group();
    this.headCluster.position.set(0, 2.38, 0.26);

    const skullGeo = new THREE.ConeGeometry(0.32, 0.72, 8);
    skullGeo.rotateX(Math.PI / 2);
    const skull = new THREE.Mesh(skullGeo, this.carapaceMat);
    this.headCluster.add(skull);

    const eyeGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const eyePositions = [
      [0, 0.07, 0.32],
      [-0.12, -0.03, 0.28],
      [0.12, -0.03, 0.28]
    ];
    for (const [ex, ey, ez] of eyePositions) {
      const eye = new THREE.Mesh(eyeGeo, this.eyeMat);
      eye.position.set(ex, ey, ez);
      this.headCluster.add(eye);
    }

    this.eyeLight = new THREE.PointLight(0xff2211, 2.6, 9.5, 1.6);
    this.eyeLight.position.set(0, 0, 0.4);
    this.headCluster.add(this.eyeLight);

    root.add(this.headCluster);

    const armGeo = new THREE.CylinderGeometry(0.09, 0.045, 1.55, 8);
    this.leftArm = new THREE.Mesh(armGeo, this.carapaceMat);
    this.leftArm.position.set(-0.46, 1.4, 0.22);
    this.leftArm.rotation.z = 0.22;
    root.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, this.carapaceMat);
    this.rightArm.position.set(0.46, 1.4, 0.22);
    this.rightArm.rotation.z = -0.22;
    root.add(this.rightArm);

    const legGeo = new THREE.CylinderGeometry(0.12, 0.07, 1.15, 8);
    const leftLeg = new THREE.Mesh(legGeo, this.sinewMat);
    leftLeg.position.set(-0.22, 0.58, 0);
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, this.sinewMat);
    rightLeg.position.set(0.22, 0.58, 0);
    root.add(rightLeg);

    return root;
  }

  public reset(): void {
    this.active = false;
    this.defeated = false;
    this.hitsTaken = 0;
    this.stunTimer = 0;
    this.attackRecoveryTimer = 0;
    this.graceTimer = 0;
    this.chaseDuration = 0;
    this.isPausedByInstruction = false;
    this.group.visible = false;
    this.group.rotation.set(0, 0, 0);
    this.overloadArcRing.visible = false;
    this.state = 'PATROL';
    this.currentWaypointIdx = 0;
    this.position.set(0, 0, -21);
    this.group.position.copy(this.position);
    this.applyClassProfile(this.creatureClass);
  }

  public spawn(spawnPos?: THREE.Vector3, cls?: CreatureClass): void {
    if (this.defeated) return;
    if (cls) {
      this.setClass(cls);
    }
    this.active = true;
    this.group.visible = true;
    this.group.rotation.x = 0;
    this.group.rotation.z = 0;
    if (spawnPos) {
      this.position.copy(spawnPos);
    }
    this.group.position.copy(this.position);
    this.state = 'PATROL';

    // Select the next corridor waypoint heading toward the active mid/south corridor
    if (this.position.z < -10) {
      this.currentWaypointIdx = 1;
      this.group.rotation.y = 0;
    } else if (this.position.z < -3) {
      this.currentWaypointIdx = Math.min(9, this.waypoints.length - 1);
      this.group.rotation.y = 0;
    } else {
      this.currentWaypointIdx = Math.min(10, this.waypoints.length - 1);
      this.group.rotation.y = 0;
    }
    if (this.waypoints.length > 0) {
      this.targetPos.copy(this.waypoints[this.currentWaypointIdx]);
    }
  }

  public setGracePeriod(seconds: number): void {
    this.graceTimer = Math.max(this.graceTimer, seconds);
  }

  public ensureSafeDistanceFromPlayer(playerPos: THREE.Vector3, minSafeDist = 3.6): void {
    if (!this.active || this.defeated) return;
    const d = this.dist2D(this.position, playerPos);
    if (d < minSafeDist) {
      const targetZ =
        playerPos.z > -15
          ? Math.max(-21, playerPos.z - 7.8)
          : Math.min(5, playerPos.z + 7.8);
      this.position.set(0, 0, targetZ);
      this.group.position.copy(this.position);
      this.group.rotation.y = Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z);
      if (this.state === 'CHASE') {
        this.state = 'INVESTIGATE';
        this.targetPos.set(0, 0, Math.max(-21, Math.min(5, playerPos.z)));
        this.stateTimer = 6.0;
      }
      this.setGracePeriod(2.2);
    }
  }

  public applyArcPulseHit(amplifiedByReactor = false): {
    stunned: boolean;
    defeated: boolean;
    hitsTaken: number;
    hitsRemaining: number;
  } {
    if (this.defeated || !this.active) {
      return {
        stunned: false,
        defeated: this.defeated,
        hitsTaken: this.hitsTaken,
        hitsRemaining: Math.max(0, this.maxHits - this.hitsTaken)
      };
    }

    const damage = amplifiedByReactor ? 2 : 1;
    this.hitsTaken = Math.min(this.maxHits, this.hitsTaken + damage);

    if (this.hitsTaken >= this.maxHits) {
      this.markDefeated();
      this.sound.playCreatureDefeatedSound();
      return {
        stunned: true,
        defeated: true,
        hitsTaken: this.hitsTaken,
        hitsRemaining: 0
      };
    }

    this.state = 'STUNNED';
    // Stun duration: Runners recover slightly faster, Brutes take slightly longer to reboot
    const baseStun = this.creatureClass === 'RUNNER' ? 3.8 : this.creatureClass === 'BRUTE' ? 5.2 : 4.6;
    this.stunTimer = baseStun + this.hitsTaken * 0.4;
    this.attackRecoveryTimer = Math.max(this.attackRecoveryTimer, 1.8);
    this.overloadArcRing.visible = true;
    this.sinewMat.emissive.setHex(0x38d6ff);
    this.sinewMat.emissiveIntensity = 1.8;
    this.eyeMat.color.setHex(0x38d6ff);
    this.eyeLight.color.setHex(0x38d6ff);
    this.eyeLight.intensity = 4.5;

    return {
      stunned: true,
      defeated: false,
      hitsTaken: this.hitsTaken,
      hitsRemaining: Math.max(0, this.maxHits - this.hitsTaken)
    };
  }

  public markDefeated(): void {
    this.defeated = true;
    this.active = false;
    this.state = 'DEFEATED';
    this.stunTimer = 0;
    this.overloadArcRing.visible = false;
    this.group.visible = true;
    this.group.rotation.x = -Math.PI / 2;
    this.group.position.set(this.position.x, 0.28, this.position.z);
    this.sinewMat.emissive.setHex(0x121c24);
    this.sinewMat.emissiveIntensity = 0.1;
    this.eyeMat.color.setHex(0x22303a);
    this.eyeLight.intensity = 0;
  }

  public triggerAttackRecovery(duration = 2.8): void {
    this.attackRecoveryTimer = Math.max(this.attackRecoveryTimer, duration);
  }

  public notifyNoise(origin: THREE.Vector3): void {
    if (!this.active || this.defeated || this.state === 'STUNNED') return;
    if (this.state === 'CHASE') {
      this.lastKnownPlayerPos.copy(origin);
      return;
    }

    this.targetPos.copy(origin);
    if (this.state !== 'INVESTIGATE') {
      this.state = 'INVESTIGATE';
      this.stateTimer = 8.0;
      this.sound.playCreatureAlert(false);
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerNoiseRadius: number,
    playerHiding: boolean,
    playerFlashlightOn: boolean,
    colliders: AABB[],
    playerYaw = 0
  ): boolean {
    if (!this.active || this.defeated || this.isPausedByInstruction) return false;

    if (this.graceTimer > 0) {
      this.graceTimer = Math.max(0, this.graceTimer - dt);
    }

    if (this.attackRecoveryTimer > 0) {
      this.attackRecoveryTimer = Math.max(0, this.attackRecoveryTimer - dt);
    }

    // Handle STUNNED state (incapacitated by ARC PULSE)
    if (this.state === 'STUNNED') {
      this.stunTimer -= dt;
      this.animTime += dt * 18;
      this.overloadArcRing.visible = true;
      this.overloadArcRing.rotation.y += dt * 9;
      this.overloadArcRing.rotation.x = Math.sin(this.animTime) * 0.6;
      this.headCluster.rotation.z = Math.sin(this.animTime * 2.2) * 0.35;
      this.leftArm.rotation.x = Math.sin(this.animTime * 1.8) * 0.45;
      this.rightArm.rotation.x = -Math.sin(this.animTime * 1.8) * 0.45;
      this.group.position.y = Math.max(0, -0.18 + Math.sin(this.animTime * 3) * 0.04);

      if (this.stunTimer <= 0) {
        this.stunTimer = 0;
        this.group.position.y = 0;
        this.overloadArcRing.visible = false;
        this.applyClassProfile(this.creatureClass);
        this.state = 'SEARCH';
        this.stateTimer = 2.6;
      }
      return false;
    }

    const animSpeed = this.state === 'CHASE' ? (this.creatureClass === 'RUNNER' ? 13.0 : 9.5) : 5.0;
    this.animTime += dt * animSpeed;

    const distToPlayer = Math.hypot(playerPos.x - this.position.x, playerPos.z - this.position.z);

    // Compute stereo pan relative to player's look direction
    const rightX = Math.cos(playerYaw);
    const rightZ = -Math.sin(playerYaw);
    const toCreatureX = (this.position.x - playerPos.x) / Math.max(1, distToPlayer);
    const toCreatureZ = (this.position.z - playerPos.z) / Math.max(1, distToPlayer);
    const stereoPan = Math.max(-1, Math.min(1, toCreatureX * rightX + toCreatureZ * rightZ));

    // Only allow attack if not hiding, within attackRange, and not in recovery or doorway grace window
    if (
      !playerHiding &&
      distToPlayer < this.attackRange &&
      this.attackRecoveryTimer <= 0 &&
      this.graceTimer <= 0
    ) {
      return true;
    }

    // While in post-attack recovery, creature recoils in place without pursuing
    if (this.attackRecoveryTimer > 0) {
      this.headCluster.rotation.z = Math.sin(this.animTime * 2) * 0.22;
      return false;
    }

    const canSeePlayer = this.checkLineOfSight(playerPos, distToPlayer, playerHiding, playerFlashlightOn, colliders);
    const canHearPlayer = !playerHiding && distToPlayer <= playerNoiseRadius;

    switch (this.state) {
      case 'PATROL': {
        if (this.waypoints.length > 0) {
          for (let guard = 0; guard < this.waypoints.length; guard++) {
            if (this.isWaypointAccessible(this.waypoints[this.currentWaypointIdx], colliders)) break;
            this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.waypoints.length;
          }
          const wp = this.waypoints[this.currentWaypointIdx];
          this.targetPos.copy(wp);
          this.moveTowardsSmart(this.targetPos, this.patrolSpeed, dt, colliders);

          if (this.dist2D(this.position, wp) < 0.7) {
            for (let guard = 0; guard < this.waypoints.length; guard++) {
              this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.waypoints.length;
              if (this.isWaypointAccessible(this.waypoints[this.currentWaypointIdx], colliders)) break;
            }
          }
        }

        if (canSeePlayer) {
          this.enterChase(playerPos, stereoPan);
        } else if (canHearPlayer) {
          this.notifyNoise(playerPos);
        }
        break;
      }

      case 'INVESTIGATE': {
        this.moveTowardsSmart(this.targetPos, this.investigateSpeed, dt, colliders);
        this.stateTimer -= dt;

        if (canSeePlayer) {
          this.enterChase(playerPos, stereoPan);
        } else if (canHearPlayer) {
          this.targetPos.copy(playerPos);
          this.stateTimer = 6.5;
        } else if (this.dist2D(this.position, this.targetPos) < 0.85 || this.stateTimer <= 0) {
          this.state = 'SEARCH';
          this.stateTimer = 3.2;
        }
        break;
      }

      case 'SEARCH': {
        this.stateTimer -= dt;
        this.group.rotation.y += Math.sin(this.animTime * 0.5) * dt * 2.2;

        if (canSeePlayer) {
          this.enterChase(playerPos, stereoPan);
        } else if (canHearPlayer) {
          this.notifyNoise(playerPos);
        } else if (this.stateTimer <= 0) {
          this.state = 'RETURN_TO_PATROL';
        }
        break;
      }

      case 'CHASE': {
        this.chaseDuration += dt;
        const maxChaseTime = this.creatureClass === 'RUNNER' ? 14.0 : 11.0;
        if (canSeePlayer && (this.chaseDuration < maxChaseTime || distToPlayer < 8.5)) {
          this.lastKnownPlayerPos.copy(playerPos);
          this.moveTowardsSmart(playerPos, this.chaseSpeed, dt, colliders);
          this.stateTimer = 3.2;
        } else {
          this.state = 'LOST_TARGET';
          this.stateTimer = 3.2;
          this.chaseDuration = 0;
        }
        break;
      }

      case 'LOST_TARGET': {
        this.moveTowardsSmart(this.lastKnownPlayerPos, this.lostTargetSpeed, dt, colliders);
        this.stateTimer -= dt;

        if (canSeePlayer) {
          this.enterChase(playerPos, stereoPan);
        } else if (canHearPlayer) {
          this.lastKnownPlayerPos.copy(playerPos);
        } else if (this.dist2D(this.position, this.lastKnownPlayerPos) < 0.9 || this.stateTimer <= 0) {
          this.state = 'SEARCH';
          this.stateTimer = 2.8;
        }
        break;
      }

      case 'RETURN_TO_PATROL': {
        let bestIdx = 0;
        let bestScore = Infinity;
        for (let i = 0; i < this.waypoints.length; i++) {
          if (!this.isWaypointAccessible(this.waypoints[i], colliders)) continue;
          const d = this.dist2D(this.position, this.waypoints[i]);
          const score = d < 8.5 ? d + 100 : d;
          if (score < bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        this.currentWaypointIdx = bestIdx;
        this.state = 'PATROL';
        break;
      }
    }

    this.leftArm.rotation.x = Math.sin(this.animTime) * 0.55;
    this.rightArm.rotation.x = -Math.sin(this.animTime) * 0.55;
    this.headCluster.rotation.z = Math.sin(this.animTime * 1.7) * 0.14;
    this.eyeLight.intensity = this.state === 'CHASE' ? 3.8 : 2.2;

    this.stepTimer += dt;
    const stepInterval = this.state === 'CHASE' ? (this.creatureClass === 'RUNNER' ? 0.26 : 0.36) : 0.62;
    if (this.stepTimer >= stepInterval && this.state !== 'SEARCH') {
      this.stepTimer = 0;
      this.sound.playCreatureStep(distToPlayer, stereoPan);
    }

    return false;
  }

  private enterChase(playerPos: THREE.Vector3, pan = 0): void {
    if (this.state !== 'CHASE') {
      this.sound.playCreatureAlert(true, pan);
      this.chaseDuration = 0;
    }
    this.state = 'CHASE';
    this.lastKnownPlayerPos.copy(playerPos);
    this.stateTimer = 3.8;
  }

  private checkLineOfSight(
    playerPos: THREE.Vector3,
    dist: number,
    playerHiding: boolean,
    playerFlashlightOn: boolean,
    colliders: AABB[]
  ): boolean {
    if (playerHiding) return false;

    // Watchers detect from further in darkness; Stalkers rely on flashlight
    const maxSightDist = this.creatureClass === 'WATCHER'
      ? (playerFlashlightOn ? 16.0 : 12.0)
      : (playerFlashlightOn ? 13.0 : 8.5);

    if (dist > maxSightDist) return false;

    if (dist > 2.6) {
      this._forward.set(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
      this._toPlayer.set(playerPos.x - this.position.x, 0, playerPos.z - this.position.z).normalize();
      if (this._forward.dot(this._toPlayer) < 0.32) return false;
    }

    const steps = Math.ceil(dist * 2.5);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = this.position.x + (playerPos.x - this.position.x) * t;
      const sz = this.position.z + (playerPos.z - this.position.z) * t;

      for (const box of colliders) {
        if (!box.enabled) continue;
        if (sx >= box.minX && sx <= box.maxX && sz >= box.minZ && sz <= box.maxZ) {
          return false;
        }
      }
    }

    return true;
  }

  private getDoorwayZForSidePosition(x: number, z: number): number {
    if (x < -3.1) {
      if (z < -16.0) return -23.0; // Sublevel connector
      return z > -1.5 ? 5.0 : -9.0;
    }
    if (x > 3.1) {
      if (z < -16.0) return -21.0; // Maintenance tunnels
      return z > -4.0 ? 3.0 : -11.0;
    }
    return z;
  }

  private moveTowardsSmart(dest: THREE.Vector3, speed: number, dt: number, colliders: AABB[]): void {
    this.navTarget.copy(dest);

    const cx = this.position.x;
    const cz = this.position.z;
    const tx = dest.x;
    const tz = dest.z;

    if (cx < -3.2 && tx > -2.8) {
      const doorZ = this.getDoorwayZForSidePosition(cx, cz);
      if (Math.abs(cz - doorZ) > 0.7) {
        this.navTarget.set(-3.8, 0, doorZ);
      } else {
        this.navTarget.set(-1.5, 0, doorZ);
      }
    } else if (cx > 3.2 && tx < 2.8) {
      const doorZ = this.getDoorwayZForSidePosition(cx, cz);
      if (Math.abs(cz - doorZ) > 0.7) {
        this.navTarget.set(3.8, 0, doorZ);
      } else {
        this.navTarget.set(1.5, 0, doorZ);
      }
    } else if (Math.abs(cx) <= 3.2 && tx < -3.2) {
      const doorZ = this.getDoorwayZForSidePosition(tx, tz);
      if (Math.abs(cz - doorZ) > 0.85) {
        this.navTarget.set(-1.5, 0, doorZ);
      }
    } else if (Math.abs(cx) <= 3.2 && tx > 3.2) {
      const doorZ = this.getDoorwayZForSidePosition(tx, tz);
      if (Math.abs(cz - doorZ) > 0.85) {
        this.navTarget.set(1.5, 0, doorZ);
      }
    }

    const dx = this.navTarget.x - cx;
    const dz = this.navTarget.z - cz;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;

    const dirX = dx / len;
    const dirZ = dz / len;

    this.group.rotation.y = Math.atan2(dirX, dirZ);

    const stepX = dirX * speed * dt;
    const stepZ = dirZ * speed * dt;

    if (!this.isBlocked(cx + stepX, cz, colliders)) {
      this.position.x += stepX;
    }
    if (!this.isBlocked(this.position.x, cz + stepZ, colliders)) {
      this.position.z += stepZ;
    }

    this.group.position.copy(this.position);
  }

  private isWaypointAccessible(wp: THREE.Vector3, colliders: AABB[]): boolean {
    if (wp.x >= 2.5 && wp.z < -4) {
      return !colliders.some((c) => c.id === 'collider_door_lab' && c.enabled);
    }
    if (wp.x <= -2.5 && wp.z < -2) {
      return !colliders.some((c) => c.id === 'collider_door_generator' && c.enabled);
    }
    if (wp.x >= 2.5 && wp.z >= -4) {
      return !colliders.some((c) => c.id === 'collider_door_quarters' && c.enabled);
    }
    if (wp.x <= -2.5 && wp.z >= -2) {
      return !colliders.some((c) => c.id === 'collider_door_security' && c.enabled);
    }
    return true;
  }

  private isBlocked(x: number, z: number, colliders: AABB[]): boolean {
    const r = 0.34;
    for (const box of colliders) {
      if (!box.enabled) continue;
      // Let doors manage their own pathing logic
      if (box.id && box.id !== 'collider_door_comms' && box.id !== 'collider_door_airlock') continue;
      if (x + r > box.minX && x - r < box.maxX && z + r > box.minZ && z - r < box.maxZ) {
        return true;
      }
    }
    return false;
  }

  private dist2D(a: THREE.Vector3, b: THREE.Vector3): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
}
