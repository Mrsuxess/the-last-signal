import * as THREE from 'three';
import { AABB, InteractableItem, RoomZone } from '../types';
import { ProceduralTextures } from './ProceduralTextures';

export interface FlickeringLight {
  light: THREE.PointLight;
  fixtureMat: THREE.MeshStandardMaterial;
  baseIntensity: number;
  poweredIntensity: number;
  baseDistance: number;
  poweredDistance: number;
  baseColor: number;
  poweredColor: number;
  sectorId: string;
  seed: number;
  isEmergency?: boolean;
}

export interface SectorIlluminationMetric {
  sectorId: string;
  sectorName: string;
  lightCount: number;
  activeIntensitySum: number;
  effectiveLuxScore: number;
  isWellLit: boolean;
  hasNearBlackCorners: boolean;
}

export class StationBuilder {
  public colliders: AABB[] = [];
  public interactables: InteractableItem[] = [];
  public rooms: RoomZone[] = [];
  public flickeringLights: FlickeringLight[] = [];
  public allStationLights: FlickeringLight[] = [];
  public patrolWaypoints: THREE.Vector3[] = [];

  public ambientLight!: THREE.AmbientLight;
  public hemiLight!: THREE.HemisphereLight;
  public dirLight!: THREE.DirectionalLight;
  public fillDirLight!: THREE.DirectionalLight;

  private scene: THREE.Scene;
  private wallMat!: THREE.MeshStandardMaterial;
  private floorMat!: THREE.MeshStandardMaterial;
  private ceilingMat!: THREE.MeshStandardMaterial;
  private trimMat!: THREE.MeshStandardMaterial;
  private darkMetalMat!: THREE.MeshStandardMaterial;
  private wallStripMat!: THREE.MeshStandardMaterial;

  private reactorRotor!: THREE.Group;
  private reactorCoreMat!: THREE.MeshStandardMaterial;
  private reactorLight!: THREE.PointLight;
  private echoRings: THREE.Mesh[] = [];
  private monolithMat!: THREE.MeshStandardMaterial;
  private carrierBeamMesh!: THREE.Mesh;
  public auxPowerActive = false;
  public enhancedVisibility = false;
  private powerSurgeTimer = 0;

  private doorStatusIndicators: Array<{
    item: InteractableItem;
    mat: THREE.MeshBasicMaterial;
  }> = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initMaterials();
  }

  private initMaterials(): void {
    const wallTex = ProceduralTextures.createHullWallTexture();
    const floorTex = ProceduralTextures.createFloorGratingTexture();

    this.wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.62,
      metalness: 0.22,
      emissive: new THREE.Color(0x060a0e),
      emissiveIntensity: 0.25
    });

    this.floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.58,
      metalness: 0.25,
      emissive: new THREE.Color(0x05080c),
      emissiveIntensity: 0.22
    });

    this.ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x1c252e,
      roughness: 0.72,
      metalness: 0.2,
      emissive: new THREE.Color(0x060a0e),
      emissiveIntensity: 0.2
    });

    this.trimMat = new THREE.MeshStandardMaterial({
      color: 0x32404b,
      roughness: 0.45,
      metalness: 0.42
    });

    this.darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x222b33,
      roughness: 0.52,
      metalness: 0.38
    });

    this.wallStripMat = new THREE.MeshStandardMaterial({
      color: 0x283845,
      emissive: 0x2d5570,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.3
    });
  }

  public build(): void {
    this.defineRooms();
    this.buildFloorsAndCeilings();
    this.buildWallsWithDoorways();
    this.buildCorridorRibsPipesAndSignage();
    this.buildDoors();
    this.buildLighting();
    this.buildPropsAndInteractables();
    this.definePatrolWaypoints();
    this.applyLightingEnvironment();
  }

  public setEnhancedVisibility(enabled: boolean): void {
    this.enhancedVisibility = enabled;
    this.applyLightingEnvironment();
  }

  public setAuxPowerState(online: boolean, triggerStartupSurge = false): void {
    this.auxPowerActive = online;
    if (triggerStartupSurge && online) {
      this.powerSurgeTimer = 1.4;
    } else if (!online) {
      this.powerSurgeTimer = 0;
    }

    if (this.reactorCoreMat && this.reactorLight) {
      this.reactorCoreMat.emissive.setHex(online ? 0x38b6ff : 0xff3b30);
      this.reactorCoreMat.emissiveIntensity = online ? 1.35 : 0.45;
      this.reactorLight.color.setHex(online ? 0x55ccff : 0xff3322);
      this.reactorLight.intensity = online ? 5.2 : 2.4;
    }

    this.applyLightingEnvironment();
  }

  private applyLightingEnvironment(): void {
    const online = this.auxPowerActive;
    const enh = this.enhancedVisibility;

    if (this.ambientLight) {
      this.ambientLight.color.setHex(online ? 0xdcf0ff : enh ? 0x3b5266 : 0x263848);
      this.ambientLight.intensity = online ? (enh ? 3.1 : 2.55) : enh ? 1.55 : 0.95;
    }

    if (this.hemiLight) {
      this.hemiLight.color.setHex(online ? 0xeaf7ff : 0x8ecaff);
      this.hemiLight.groundColor.setHex(online ? 0x70889c : 0x2d3d4d);
      this.hemiLight.intensity = online ? (enh ? 2.25 : 1.85) : enh ? 1.15 : 0.68;
    }

    if (this.dirLight && this.fillDirLight) {
      this.dirLight.intensity = online ? (enh ? 1.65 : 1.4) : enh ? 0.85 : 0.48;
      this.fillDirLight.intensity = online ? (enh ? 1.35 : 1.15) : enh ? 0.65 : 0.35;
    }

    // Update wall, floor, ceiling & sconce strip materials so no dark corners remain when powered
    this.wallMat.emissive.setHex(online ? 0x16222c : enh ? 0x0c141c : 0x060a0e);
    this.wallMat.emissiveIntensity = online ? 0.55 : enh ? 0.38 : 0.25;

    this.floorMat.emissive.setHex(online ? 0x141e27 : enh ? 0x0a1118 : 0x05080c);
    this.floorMat.emissiveIntensity = online ? 0.5 : enh ? 0.35 : 0.22;

    this.ceilingMat.color.setHex(online ? 0x344654 : 0x1c252e);
    this.ceilingMat.emissive.setHex(online ? 0x1a2834 : 0x060a0e);
    this.ceilingMat.emissiveIntensity = online ? 0.55 : 0.2;

    this.wallStripMat.emissive.setHex(online ? 0x88e0ff : 0x2d5570);
    this.wallStripMat.emissiveIntensity = online ? 1.75 : enh ? 0.75 : 0.45;

    // Update scene fog & background for crystal-clear full-station visibility once powered
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = online ? 0.0065 : enh ? 0.018 : 0.032;
      this.scene.fog.color.setHex(online ? 0x14222e : 0x070d13);
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(online ? 0x121f2a : 0x05090d);
    }

    // Update all individual sector fixtures immediately
    for (const fl of this.allStationLights) {
      const targetColor = online ? fl.poweredColor : fl.baseColor;
      const targetDist = online ? fl.poweredDistance : fl.baseDistance;
      const targetInt = online
        ? fl.poweredIntensity * (enh ? 1.15 : 1.0)
        : fl.baseIntensity * (enh ? 1.35 : 1.0);

      fl.light.color.setHex(targetColor);
      fl.light.distance = targetDist;
      fl.light.intensity = targetInt;
      fl.fixtureMat.color.setHex(targetColor);
      fl.fixtureMat.emissive.setHex(targetColor);
      fl.fixtureMat.emissiveIntensity = online ? 2.2 : 1.25;
    }
  }

  public getSectorIlluminationReport(): SectorIlluminationMetric[] {
    const ambientContribution =
      (this.ambientLight ? this.ambientLight.intensity * 18 : 0) +
      (this.hemiLight ? this.hemiLight.intensity * 14 : 0) +
      (this.dirLight ? this.dirLight.intensity * 12 : 0);

    return this.rooms.map((room) => {
      const lightsInSector = this.allStationLights.filter((l) => l.sectorId === room.id);
      const activeIntensitySum = lightsInSector.reduce((sum, l) => sum + l.light.intensity, 0);
      const area = Math.max(1, (room.maxX - room.minX) * (room.maxZ - room.minZ));
      const effectiveLuxScore = Math.round(ambientContribution + (activeIntensitySum * 26) / Math.sqrt(area));
      const isWellLit = this.auxPowerActive ? effectiveLuxScore >= 75 && lightsInSector.length >= 1 : effectiveLuxScore >= 25;
      const hasNearBlackCorners = this.auxPowerActive ? false : !this.enhancedVisibility && lightsInSector.length === 0;

      return {
        sectorId: room.id,
        sectorName: room.name,
        lightCount: lightsInSector.length,
        activeIntensitySum: Number(activeIntensitySum.toFixed(2)),
        effectiveLuxScore,
        isWellLit,
        hasNearBlackCorners
      };
    });
  }

  public setEndingVisualState(mode: 'NONE' | 'TRUST_ECHO' | 'REJECT_ECHO'): void {
    if (!this.monolithMat || !this.carrierBeamMesh) return;
    if (mode === 'NONE') {
      this.monolithMat.emissive.setHex(0xd4842a);
      this.monolithMat.emissiveIntensity = 0.45;
      this.carrierBeamMesh.visible = false;
    } else if (mode === 'TRUST_ECHO') {
      this.monolithMat.emissive.setHex(0xff2a1f);
      this.monolithMat.emissiveIntensity = 1.6;
      this.carrierBeamMesh.visible = true;
      (this.carrierBeamMesh.material as THREE.MeshBasicMaterial).color.setHex(0xff2a1f);
    } else if (mode === 'REJECT_ECHO') {
      this.monolithMat.emissive.setHex(0x2ca8ff);
      this.monolithMat.emissiveIntensity = 0.1;
      this.carrierBeamMesh.visible = true;
      (this.carrierBeamMesh.material as THREE.MeshBasicMaterial).color.setHex(0x4af2a1);
    }
  }

  private defineRooms(): void {
    this.rooms = [
      { id: 'airlock', name: 'SECTOR A // ENTRANCE AIRLOCK', code: 'SECTOR A-01', minX: -3, maxX: 3, minZ: 11, maxZ: 17 },
      { id: 'corridor', name: 'CENTRAL SPINE CORRIDOR', code: 'CENTRAL SPINE', minX: -3, maxX: 3, minZ: -25, maxZ: 11 },
      { id: 'security', name: 'SECTOR B // SECURITY HUB', code: 'SECTOR B-02', minX: -13, maxX: -3, minZ: 0, maxZ: 10 },
      { id: 'quarters', name: 'SECTOR C // CREW HABITATION', code: 'SECTOR C-03', minX: 3, maxX: 15, minZ: -3, maxZ: 9 },
      { id: 'generator', name: 'SECTOR D // AUXILIARY REACTOR', code: 'SECTOR D-04', minX: -16, maxX: -3, minZ: -15, maxZ: -3 },
      { id: 'lab', name: 'SECTOR E // XENO-SIGNAL LAB', code: 'SECTOR E-05', minX: 3, maxX: 16, minZ: -17, maxZ: -5 },
      { id: 'comms', name: 'SECTOR F // COMMUNICATIONS BRIDGE', code: 'SECTOR F-06', minX: -9, maxX: 9, minZ: -37, maxZ: -25 },
      // MAP 2: THE SUBLEVELS & CRYOGENIC INFRASTRUCTURE
      { id: 'sub_tunnels', name: 'SUBLEVEL S-01 // MAINTENANCE TUNNELS', code: 'SUBLEVEL S-01', minX: -19, maxX: -13, minZ: 0, maxZ: 10 },
      { id: 'sub_reactor', name: 'SUBLEVEL S-02 // COOLING INFRASTRUCTURE', code: 'SUBLEVEL S-02', minX: -26, maxX: -16, minZ: -15, maxZ: -3 },
      { id: 'sub_lab', name: 'FACILITY X-01 // CONTAINMENT CHAMBERS', code: 'FACILITY X-01', minX: 16, maxX: 26, minZ: -17, maxZ: -5 }
    ];
  }

  private buildFloorsAndCeilings(): void {
    const height = 3.8;
    for (const r of this.rooms) {
      const w = r.maxX - r.minX;
      const d = r.maxZ - r.minZ;
      const cx = (r.minX + r.maxX) / 2;
      const cz = (r.minZ + r.maxZ) / 2;

      const floorGeo = new THREE.PlaneGeometry(w, d);
      const floor = new THREE.Mesh(floorGeo, this.floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(cx, 0, cz);
      floor.receiveShadow = true;
      this.scene.add(floor);

      const ceil = new THREE.Mesh(floorGeo, this.ceilingMat);
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(cx, height, cz);
      this.scene.add(ceil);
    }
  }

  private addWallSegment(x1: number, z1: number, x2: number, z2: number, height = 3.8, thickness = 0.35): void {
    const minX = Math.min(x1, x2) - thickness / 2;
    const maxX = Math.max(x1, x2) + thickness / 2;
    const minZ = Math.min(z1, z2) - thickness / 2;
    const maxZ = Math.max(z1, z2) + thickness / 2;

    const w = maxX - minX;
    const d = maxZ - minZ;

    const geo = new THREE.BoxGeometry(w, height, d);
    const mesh = new THREE.Mesh(geo, this.wallMat);
    mesh.position.set((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.colliders.push({
      minX,
      maxX,
      minZ,
      maxZ,
      enabled: true
    });
  }

  private buildWallsWithDoorways(): void {
    // 1. Entrance Airlock (x: -3..3, z: 11..17), Door at z=11 (x: -1.2..1.2)
    this.addWallSegment(-3, 17, 3, 17);
    this.addWallSegment(-3, 11, -3, 17);
    this.addWallSegment(3, 11, 3, 17);
    this.addWallSegment(-3, 11, -1.2, 11);
    this.addWallSegment(1.2, 11, 3, 11);

    // 2. Main Corridor West Wall (x = -3, z: -25..11)
    this.addWallSegment(-3, 6.2, -3, 11);
    this.addWallSegment(-3, -7.8, -3, 3.8);
    this.addWallSegment(-3, -25, -3, -10.2);

    // 3. Main Corridor East Wall (x = 3, z: -25..11)
    this.addWallSegment(3, 4.2, 3, 11);
    this.addWallSegment(3, -9.8, 3, 1.8);
    this.addWallSegment(3, -25, 3, -12.2);

    // 4. Security Room (x: -13..-3, z: 0..10)
    this.addWallSegment(-13, 10, -3, 10);
    this.addWallSegment(-13, 0, -3, 0);
    // 4b. Security West Wall with doorway to Sublevel Maintenance Tunnels at z=5
    this.addWallSegment(-13, 0, -13, 3.8);
    this.addWallSegment(-13, 6.2, -13, 10);
    // Sublevel S-01 Perimeter
    this.addWallSegment(-19, 10, -13, 10);
    this.addWallSegment(-19, 0, -13, 0);
    this.addWallSegment(-19, 0, -19, 10);

    // 5. Crew Quarters (x: 3..15, z: -3..9)
    this.addWallSegment(3, 9, 15, 9);
    this.addWallSegment(3, -3, 15, -3);
    this.addWallSegment(15, -3, 15, 9);

    // 6. Generator Room (x: -16..-3, z: -15..-3)
    this.addWallSegment(-16, -3, -3, -3);
    this.addWallSegment(-16, -15, -3, -15);
    // 6b. Generator West Wall with doorway to Sublevel Cooling at z=-9
    this.addWallSegment(-16, -3, -16, -7.8);
    this.addWallSegment(-16, -10.2, -16, -15);
    // Sublevel S-02 Cooling Perimeter
    this.addWallSegment(-26, -3, -16, -3);
    this.addWallSegment(-26, -15, -16, -15);
    this.addWallSegment(-26, -15, -26, -3);

    // 7. Laboratory (x: 3..16, z: -17..-5)
    this.addWallSegment(3, -5, 16, -5);
    this.addWallSegment(3, -17, 16, -17);
    // 7b. Lab East Wall with doorway to Facility X-01 Containment at z=-11
    this.addWallSegment(16, -5, 16, -9.8);
    this.addWallSegment(16, -12.2, 16, -17);
    // Facility X-01 Containment Perimeter
    this.addWallSegment(16, -5, 26, -5);
    this.addWallSegment(16, -17, 26, -17);
    this.addWallSegment(26, -17, 26, -5);

    // 8. Communications Room (x: -9..9, z: -37..-25)
    this.addWallSegment(-9, -25, -1.2, -25);
    this.addWallSegment(1.2, -25, 9, -25);
    this.addWallSegment(-9, -37, 9, -37);
    this.addWallSegment(-9, -37, -9, -25);
    this.addWallSegment(9, -37, 9, -25);
  }

  private addWallSign(x: number, y: number, z: number, rotY: number, title: string, sub: string, accent = '#f3a847'): void {
    const tex = ProceduralTextures.createSignageTexture(title, sub, accent);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const geo = new THREE.PlaneGeometry(1.15, 0.42);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    this.scene.add(mesh);
  }

  private buildCorridorRibsPipesAndSignage(): void {
    const pillarGeo = new THREE.BoxGeometry(0.45, 3.8, 0.45);
    const beamGeo = new THREE.BoxGeometry(6.0, 0.35, 0.45);
    const sconceGeo = new THREE.BoxGeometry(0.08, 1.4, 0.14);

    for (let z = 9; z >= -23; z -= 4) {
      if (Math.abs(z - 5) < 1.5 || Math.abs(z - 3) < 1.5 || Math.abs(z + 9) < 1.5 || Math.abs(z + 11) < 1.5) {
        continue;
      }
      const leftPillar = new THREE.Mesh(pillarGeo, this.trimMat);
      leftPillar.position.set(-2.7, 1.9, z);
      this.scene.add(leftPillar);

      const leftSconce = new THREE.Mesh(sconceGeo, this.wallStripMat);
      leftSconce.position.set(-2.44, 1.95, z);
      this.scene.add(leftSconce);

      const rightPillar = new THREE.Mesh(pillarGeo, this.trimMat);
      rightPillar.position.set(2.7, 1.9, z);
      this.scene.add(rightPillar);

      const rightSconce = new THREE.Mesh(sconceGeo, this.wallStripMat);
      rightSconce.position.set(2.44, 1.95, z);
      this.scene.add(rightSconce);

      const topBeam = new THREE.Mesh(beamGeo, this.trimMat);
      topBeam.position.set(0, 3.6, z);
      this.scene.add(topBeam);
    }

    const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, 36, 10);
    pipeGeo.rotateX(Math.PI / 2);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x523823, roughness: 0.5, metalness: 0.5 });

    const pipeLeft = new THREE.Mesh(pipeGeo, pipeMat);
    pipeLeft.position.set(-2.2, 3.35, -7);
    this.scene.add(pipeLeft);

    const pipeRight = new THREE.Mesh(pipeGeo, pipeMat);
    pipeRight.position.set(2.2, 3.35, -7);
    this.scene.add(pipeRight);

    // Clear Sector Signage along the Main Corridor
    this.addWallSign(-2.8, 2.35, 6.85, Math.PI / 2, '< SECTOR B: SECURITY', 'ACCESS CLEARANCE L1', '#4af2a1');
    this.addWallSign(2.8, 2.35, 4.85, -Math.PI / 2, 'SECTOR C: CREW HAB >', 'QUARTERS // LOGS [L1]', '#f3a847');
    this.addWallSign(-2.8, 2.35, -7.15, Math.PI / 2, '< SECTOR D: REACTOR', 'AUXILIARY POWER [L2]', '#f3a847');
    this.addWallSign(2.8, 2.35, -9.15, -Math.PI / 2, 'SECTOR E: XENO LAB >', 'BIOSAFETY LEVEL 4 [PWR]', '#ff3b30');
    this.addWallSign(-1.95, 2.35, -24.78, 0, '^ SECTOR F: BRIDGE', 'HIGH-GAIN TRANSMITTER [L3]', '#ff3b30');
  }

  private createDoor(
    id: string,
    label: string,
    x: number,
    z: number,
    rotatedZAxis: boolean,
    options: {
      requiredKey?: 'SEC_CARD_L1' | 'MAINT_KEY_L2' | 'SUBLEVEL_KEY_L2B' | 'COMMS_OVERRIDE_L3';
      requiresPower?: boolean;
      stencilColor?: string;
      customPromptLabel?: string;
      shortActionLabel?: string;
    } = {}
  ): void {
    const doorWidth = 2.4;
    const doorHeight = 3.2;
    const doorDepth = 0.24;

    const tex = ProceduralTextures.createDoorTexture(label, options.stencilColor || '#d4842a');
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.48,
      metalness: 0.35,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0
    });

    const geo = rotatedZAxis
      ? new THREE.BoxGeometry(doorDepth, doorHeight, doorWidth)
      : new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, doorHeight / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const headerGeo = rotatedZAxis
      ? new THREE.BoxGeometry(0.38, 0.6, doorWidth)
      : new THREE.BoxGeometry(doorWidth, 0.6, 0.38);
    const header = new THREE.Mesh(headerGeo, this.trimMat);
    header.position.set(x, 3.5, z);
    this.scene.add(header);

    const statusMat = new THREE.MeshBasicMaterial({ color: 0x4af2a1 });
    const statusGeo = rotatedZAxis
      ? new THREE.BoxGeometry(0.42, 0.12, 1.4)
      : new THREE.BoxGeometry(1.4, 0.12, 0.42);
    const statusBar = new THREE.Mesh(statusGeo, statusMat);
    statusBar.position.set(x, 3.28, z);
    this.scene.add(statusBar);

    const panelColor =
      options.stencilColor === '#4af2a1'
        ? 0x4af2a1
        : options.stencilColor === '#ff3b30'
        ? 0xff3b30
        : 0xf3a847;
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x18222a,
      emissive: panelColor,
      emissiveIntensity: 0.95,
      roughness: 0.35,
      metalness: 0.5
    });
    const panelGeo = rotatedZAxis
      ? new THREE.BoxGeometry(0.44, 0.38, 0.24)
      : new THREE.BoxGeometry(0.24, 0.38, 0.44);
    const panelMesh = new THREE.Mesh(panelGeo, panelMat);
    panelMesh.position.set(
      rotatedZAxis ? x : x + 1.38,
      1.35,
      rotatedZAxis ? z + 1.38 : z
    );
    this.scene.add(panelMesh);

    const colliderId = `collider_${id}`;
    const halfX = rotatedZAxis ? 0.25 : doorWidth / 2;
    const halfZ = rotatedZAxis ? doorWidth / 2 : 0.25;

    this.colliders.push({
      id: colliderId,
      minX: x - halfX,
      maxX: x + halfX,
      minZ: z - halfZ,
      maxZ: z + halfZ,
      enabled: true
    });

    const doorItem: InteractableItem = {
      id,
      type: 'door',
      label: options.customPromptLabel || `OPEN BULKHEAD: ${label}`,
      shortActionLabel: options.shortActionLabel || 'OPEN DOOR',
      mesh,
      doorMesh: mesh,
      doorClosedY: doorHeight / 2,
      doorColliderId: colliderId,
      position: new THREE.Vector3(x, 1.5, z),
      enabled: true,
      isOpen: false,
      requiredKey: options.requiredKey,
      requiresPower: options.requiresPower
    };

    this.interactables.push(doorItem);
    this.doorStatusIndicators.push({ item: doorItem, mat: statusMat });
  }

  private buildDoors(): void {
    this.createDoor('door_airlock', 'AIRLOCK A-01', 0, 11, false, {
      stencilColor: '#4af2a1',
      customPromptLabel: 'OPEN AIRLOCK CONTROL PANEL',
      shortActionLabel: 'OPEN PANEL'
    });
    this.createDoor('door_security', 'SECURITY B-02', -3, 5, true, {
      stencilColor: '#4af2a1',
      shortActionLabel: 'OPEN SECURITY DOOR'
    });
    this.createDoor('door_quarters', 'CREW HAB C-03 [L1]', 3, 3, true, {
      requiredKey: 'SEC_CARD_L1',
      stencilColor: '#d4842a',
      shortActionLabel: 'UNLOCK QUARTERS'
    });
    this.createDoor('door_generator', 'REACTOR D-04 [L2]', -3, -9, true, {
      requiredKey: 'MAINT_KEY_L2',
      stencilColor: '#d4842a',
      shortActionLabel: 'UNLOCK REACTOR'
    });
    this.createDoor('door_lab', 'XENO LAB E-05 [PWR]', 3, -11, true, {
      requiredKey: 'SEC_CARD_L1',
      requiresPower: true,
      stencilColor: '#ff3b30',
      shortActionLabel: 'UNLOCK XENO LAB'
    });
    this.createDoor('door_sublevels', 'SUBLEVELS S-01 [L1]', -13, 5, true, {
      requiredKey: 'SEC_CARD_L1',
      stencilColor: '#4af2a1',
      shortActionLabel: 'UNLOCK SUBLEVELS'
    });
    this.createDoor('door_sub_cooling', 'COOLING CORE S-02 [L2B]', -16, -9, true, {
      requiredKey: 'SUBLEVEL_KEY_L2B',
      stencilColor: '#d4842a',
      shortActionLabel: 'UNLOCK COOLING CORE'
    });
    this.createDoor('door_facility_x', 'CONTAINMENT X-01 [PWR]', 16, -11, true, {
      requiresPower: true,
      stencilColor: '#ff3b30',
      shortActionLabel: 'UNLOCK CONTAINMENT'
    });
    this.createDoor('door_comms', 'COMMS BRIDGE [L3]', 0, -25, false, {
      requiredKey: 'COMMS_OVERRIDE_L3',
      requiresPower: true,
      stencilColor: '#ff3b30',
      shortActionLabel: 'UNLOCK BRIDGE'
    });
  }

  private addStationLight(
    sectorId: string,
    x: number,
    z: number,
    baseColor: number,
    poweredColor: number,
    baseIntensity: number,
    poweredIntensity: number,
    baseDistance: number,
    poweredDistance: number,
    flickers = false,
    isEmergency = false
  ): THREE.PointLight {
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: baseColor,
      emissiveIntensity: 1.35,
      roughness: 0.25
    });

    const fixtureGeo = new THREE.BoxGeometry(isEmergency ? 0.55 : 1.35, 0.1, 0.32);
    const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixture.position.set(x, 3.72, z);
    this.scene.add(fixture);

    const light = new THREE.PointLight(baseColor, baseIntensity, baseDistance, 1.25);
    light.position.set(x, 3.45, z);
    this.scene.add(light);

    const entry: FlickeringLight = {
      light,
      fixtureMat,
      baseIntensity,
      poweredIntensity,
      baseDistance,
      poweredDistance,
      baseColor,
      poweredColor,
      sectorId,
      seed: Math.random() * 100,
      isEmergency
    };

    this.allStationLights.push(entry);
    if (flickers || isEmergency) {
      this.flickeringLights.push(entry);
    }
    return light;
  }

  private buildLighting(): void {
    // 1. Base global illumination (Ambient + Hemisphere + Dual Directional lights for 3D depth)
    this.ambientLight = new THREE.AmbientLight(0x263848, 0.95);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x8ecaff, 0x2d3d4d, 0.68);
    this.hemiLight.position.set(0, 4.2, -8);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xeaf6ff, 0.48);
    this.dirLight.position.set(6, 10, 8);
    this.scene.add(this.dirLight);

    this.fillDirLight = new THREE.DirectionalLight(0xc2e2ff, 0.35);
    this.fillDirLight.position.set(-6, 8, -18);
    this.scene.add(this.fillDirLight);

    // 2. SECTOR A-01: Entrance Airlock (x: -3..3, z: 11..17)
    this.addStationLight('airlock', 0, 14.8, 0xffaa44, 0xeaf6ff, 2.5, 4.8, 13, 24, false, false);
    this.addStationLight('airlock', 0, 11.8, 0x4af2a1, 0xc2f0ff, 1.9, 4.2, 11, 22, false, false);

    // 3. SECTOR M-00: Central Spine Corridor (x: -3..3, z: -25..11)
    this.addStationLight('corridor', 0, 7.5, 0xb8e6ff, 0xf0f8ff, 2.2, 4.8, 15, 26, true, false);
    this.addStationLight('corridor', 0, 2.5, 0xff4433, 0xe8f6ff, 1.8, 4.8, 13, 26, false, true);
    this.addStationLight('corridor', 0, -3.5, 0xb8e6ff, 0xf0f8ff, 2.1, 4.8, 15, 26, true, false);
    this.addStationLight('corridor', 0, -9.5, 0xff4433, 0xe8f6ff, 1.9, 4.8, 14, 26, false, true);
    this.addStationLight('corridor', 0, -16.0, 0xb8e6ff, 0xf0f8ff, 2.0, 4.8, 15, 26, true, false);
    this.addStationLight('corridor', 0, -22.5, 0xb8e6ff, 0xf0f8ff, 2.1, 4.8, 15, 26, false, false);

    // 4. SECTOR B-02: Security Hub (x: -13..-3, z: 0..10)
    this.addStationLight('security', -6.2, 5.0, 0x80d4ff, 0xeaf6ff, 2.3, 5.0, 16, 26, true, false);
    this.addStationLight('security', -10.5, 5.0, 0x66c2ff, 0xeaf6ff, 2.1, 4.8, 15, 26, false, false);

    // 5. SECTOR C-03: Crew Habitation (x: 3..15, z: -3..9)
    this.addStationLight('quarters', 6.8, 3.0, 0xffb357, 0xfff5e6, 2.3, 5.0, 16, 26, true, false);
    this.addStationLight('quarters', 12.2, 3.0, 0xffaa44, 0xfff5e6, 2.1, 4.8, 16, 26, false, false);

    // 6. SECTOR D-04: Auxiliary Reactor (x: -16..-3, z: -15..-3)
    this.addStationLight('generator', -6.2, -9.0, 0xff8844, 0xe8f6ff, 2.2, 5.0, 16, 26, false, false);
    this.reactorLight = this.addStationLight('generator', -11.5, -9.0, 0xff3322, 0x55ccff, 2.4, 5.4, 18, 28, false, false);

    // 7. SECTOR E-05: Xeno-Signal Lab (x: 3..16, z: -17..-5)
    this.addStationLight('lab', 6.8, -11.0, 0x4af2a1, 0xe8fff6, 2.4, 5.0, 16, 26, true, false);
    this.addStationLight('lab', 12.2, -11.0, 0x38b6ff, 0xe8f8ff, 2.2, 5.0, 16, 26, false, false);

    // 8. SECTOR F-06: Communications Bridge (x: -9..9, z: -37..-25)
    this.addStationLight('comms', 0, -29.0, 0x66ccff, 0xf0f8ff, 2.6, 5.2, 20, 30, false, false);
    this.addStationLight('comms', -5.0, -32.0, 0xff4433, 0xd8f0ff, 1.9, 4.8, 15, 26, false, true);
    this.addStationLight('comms', 5.0, -32.0, 0xff4433, 0xd8f0ff, 1.9, 4.8, 15, 26, false, true);

    // Sublevel S-01 Maintenance Tunnels
    this.addStationLight('sub_tunnels', -15.0, 3.5, 0x44cc88, 0xd8fff0, 2.1, 4.6, 14, 24, true, false);
    this.addStationLight('sub_tunnels', -17.5, 7.5, 0x44cc88, 0xd8fff0, 2.0, 4.6, 14, 24, false, false);
    // Sublevel S-02 Cooling Infrastructure
    this.addStationLight('sub_reactor', -19.0, -7.0, 0x38b6ff, 0xecf8ff, 2.3, 5.0, 16, 26, true, false);
    this.addStationLight('sub_reactor', -23.5, -11.0, 0x38b6ff, 0xecf8ff, 2.3, 5.0, 16, 26, false, false);
    // Facility X-01 Containment Chambers
    this.addStationLight('sub_lab', 19.0, -9.0, 0xff4422, 0xffeedd, 2.4, 5.2, 16, 26, true, false);
    this.addStationLight('sub_lab', 23.5, -13.0, 0xff4422, 0xffeedd, 2.4, 5.2, 16, 26, false, false);
  }

  private addHidingLocker(id: string, x: number, z: number, facingYaw: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = facingYaw;

    const bodyGeo = new THREE.BoxGeometry(1.0, 2.3, 0.85);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2c3c48,
      roughness: 0.5,
      metalness: 0.45
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.15;
    group.add(body);

    const stripGeo = new THREE.BoxGeometry(0.7, 0.08, 0.04);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x4af2a1 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 1.95, 0.43);
    group.add(strip);

    this.scene.add(group);

    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingYaw);
    const viewPos = new THREE.Vector3(x, 1.55, z).addScaledVector(forward, 0.15);
    const exitPos = new THREE.Vector3(x, 1.7, z).addScaledVector(forward, 1.25);

    this.interactables.push({
      id,
      type: 'locker',
      label: 'HIDE IN EMERGENCY LOCKER',
      shortActionLabel: 'HIDE IN LOCKER',
      mesh: body,
      position: new THREE.Vector3(x, 1.3, z),
      enabled: true,
      lockerViewPos: viewPos,
      lockerExitPos: exitPos,
      lockerFacingYaw: facingYaw
    });
  }

  private addTerminal(
    id: string,
    label: string,
    x: number,
    z: number,
    rotY: number,
    title: string,
    screenLines: string[],
    fullText: string
  ): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    const deskGeo = new THREE.BoxGeometry(1.4, 0.95, 0.8);
    const desk = new THREE.Mesh(deskGeo, this.darkMetalMat);
    desk.position.y = 0.475;
    group.add(desk);

    const monGeo = new THREE.BoxGeometry(0.75, 0.58, 0.5);
    const mon = new THREE.Mesh(monGeo, this.trimMat);
    mon.position.set(0, 1.24, 0);
    group.add(mon);

    const screenTex = ProceduralTextures.createCRTScreenTexture(title, screenLines);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    const screenGeo = new THREE.PlaneGeometry(0.66, 0.48);
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 1.24, 0.26);
    group.add(screen);

    this.scene.add(group);

    this.colliders.push({
      minX: x - 0.7,
      maxX: x + 0.7,
      minZ: z - 0.45,
      maxZ: z + 0.45,
      enabled: true
    });

    this.interactables.push({
      id,
      type: 'terminal',
      label: `TERMINAL: ${label}`,
      shortActionLabel: 'READ TERMINAL',
      mesh: mon,
      position: new THREE.Vector3(x, 1.25, z),
      enabled: true,
      terminalTitle: title,
      terminalBody: fullText
    });
  }

  private addPickup(
    id: string,
    type: 'keycard' | 'battery' | 'oxygen' | 'audiolog',
    label: string,
    x: number,
    y: number,
    z: number,
    color: number,
    extra: Partial<InteractableItem> = {}
  ): void {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const geo =
      type === 'keycard'
        ? new THREE.BoxGeometry(0.32, 0.04, 0.22)
        : type === 'audiolog'
        ? new THREE.BoxGeometry(0.28, 0.08, 0.36)
        : new THREE.CylinderGeometry(0.12, 0.12, 0.34, 12);

    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.4
    });

    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    const ringGeo = new THREE.RingGeometry(0.18, 0.24, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.12;
    group.add(ring);

    if (type === 'keycard' || type === 'audiolog') {
      const pinGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.65, 6);
      const pinMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.y = 0.35;
      group.add(pin);
    }

    this.scene.add(group);

    const defaultShortLabel =
      type === 'keycard'
        ? 'TAKE KEYCARD'
        : type === 'audiolog'
        ? 'PLAY AUDIO LOG'
        : type === 'oxygen'
        ? 'TAKE O2 CANISTER'
        : 'TAKE BATTERY';

    this.interactables.push({
      id,
      type,
      label,
      shortActionLabel: defaultShortLabel,
      mesh,
      position: new THREE.Vector3(x, y, z),
      enabled: true,
      ...extra
    });
  }

  private addCrateTable(x: number, z: number, w = 1.2, h = 0.85, d = 0.8): void {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, this.darkMetalMat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      enabled: true
    });
  }

  private buildPropsAndInteractables(): void {
    // --- ROOM 1: ENTRANCE AIRLOCK ---
    this.addCrateTable(-1.8, 13.5, 1.0, 0.85, 0.8);
    this.addPickup('battery_airlock', 'battery', 'PICK UP FLASHLIGHT BATTERY CELL', -1.8, 0.98, 13.5, 0xffcc33);
    this.addTerminal(
      'term_airlock',
      'DOCKING MANIFEST A-01',
      1.8,
      13.5,
      -Math.PI / 4,
      'AIRLOCK A-01 TELEMETRY',
      ['STATUS: DOCKED', 'ATMOS: DEGRADED', 'AI CORE: ECHO ACTIVE'],
      `=== NEXUS-09 DOCKING LOG ===\nVESSEL: RECON SHUTTLE 'CASSINI-4'\nENGINEER: ON-SITE SPECIALIST\n\nSTATION ALERT:\nMain reactor offline. Life support running on reserve scrubbers.\n\nDIRECTIVE:\n1. Locate Level-1 Security Access Card in Security Hub B-02 (West of Main Corridor).\n2. Unlock Crew Habitation C-03 (East) to recover the Reactor Keycard.\n3. Restore Auxiliary Power in Sector D to illuminate the entire station.\n4. Investigate Xeno-Signal Lab E-05 & reach the Communications Bridge.`
    );

    // --- ROOM 2: MAIN CORRIDOR ---
    this.addHidingLocker('locker_corridor_south', -2.35, 1.2, Math.PI / 2);
    this.addHidingLocker('locker_corridor_north', 2.35, -18.5, -Math.PI / 2);

    // --- ROOM 3: SECURITY ROOM (West, x: -13..-3, z: 0..10) ---
    this.addHidingLocker('locker_security', -12.3, 8.2, Math.PI / 2);
    const cctvTex = ProceduralTextures.createCRTScreenTexture(
      'CCTV // SECTOR E FEED',
      ['CAM 01: CORRIDOR CLEAR', 'CAM 04: REACTOR OFFLINE', 'CAM 05: POD 04 BREACHED!'],
      '#ff3b30'
    );
    const cctvMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.2),
      new THREE.MeshBasicMaterial({ map: cctvTex })
    );
    cctvMesh.position.set(-12.78, 2.2, 4.8);
    cctvMesh.rotation.y = Math.PI / 2;
    this.scene.add(cctvMesh);

    this.addTerminal(
      'term_security',
      'SECURITY LOGS // SECTOR B',
      -10.5,
      1.2,
      0,
      'SECURITY OVERRIDE CONSOLE',
      ['LOCKDOWN: PARTIAL', 'HAB DECK: KEY L1', 'ARC PULSE: AUTHORIZED'],
      `=== SECURITY CHIEF MARCUS VEY // INCIDENT LOG ===\nTIMESTAMP: T-MINUS 68 HOURS\n\n"Something came through the deep-space receiver array during Test 09. Not a rock, not a ship—a structured carrier wave that rewrote our bio-printer vat protocols.\n\nECHO locked us out of the Communications Bridge and started venting O2 in the lower decks. I've left the Level-1 Security Card right here on the central supply table, and unlocked suit ARC PULSE defense capacitors. Three high-voltage discharges will overload the creature's neural core if it corners you. DO NOT LET ECHO BROADCAST THAT SIGNAL TO EARTH."`
    );
    this.addCrateTable(-7.5, 5.0, 1.4, 0.85, 0.9);
    this.addPickup(
      'key_security_l1',
      'keycard',
      'TAKE LEVEL-1 SECURITY ACCESS CARD',
      -7.5,
      0.95,
      5.0,
      0x4af2a1,
      { keycardGrant: 'SEC_CARD_L1' }
    );
    this.addPickup('battery_security', 'battery', 'PICK UP BATTERY & ARC CAPACITOR CELL', -5.5, 0.95, 8.5, 0xffcc33);
    this.addCrateTable(-5.5, 8.5, 0.9, 0.85, 0.9);

    // --- ROOM 4: CREW QUARTERS (East, x: 3..15, z: -3..9) ---
    this.addHidingLocker('locker_quarters', 14.2, 7.2, -Math.PI / 2);
    this.addCrateTable(13.5, 2.0, 2.2, 1.1, 1.1);
    this.addCrateTable(13.5, -1.0, 2.2, 1.1, 1.1);
    this.addCrateTable(8.5, 3.0, 1.6, 0.85, 1.0);

    this.addTerminal(
      'term_quarters',
      'PERSONAL LOG // TECH J. LIN',
      11.5,
      7.8,
      Math.PI,
      'HABITATION TERMINAL C-03',
      ['CREW STATUS: EVAC FAILED', 'SLEEP CYCLES: ZERO', 'AUDIO ANOMALY IN VENTS'],
      `=== PERSONAL LOG: COMMS TECHNICIAN J. LIN ===\n\n"Nobody has slept in three days. Even with our headsets unplugged, we can hear the carrier wave humming inside the hull plating.\n\nYesterday ECHO spoke to me through my bunk intercom using my sister's voice. It asked me to unlock the Bridge transmitter. Chief Vance welding-sealed the Bridge bulkhead and hid the Level-2 Reactor Keycard here in the quarters before the thing in Lab E-05 broke loose."`
    );

    this.addPickup(
      'audiolog_vance',
      'audiolog',
      'PLAY CREW RECORDING #1 (CHIEF ENG. VANCE)',
      8.5,
      0.96,
      3.3,
      0x38b6ff,
      {
        terminalTitle: 'AUDIO LOG #01 // CHIEF ENGINEER ELENA VANCE',
        terminalBody: `[STATIC CRACKLE... HEAVY BREATHING]\n\n"This is Chief Engineer Vance. If you're hearing this, ECHO's distress beacon lured another ship in.\n\nListen to me carefully: ECHO isn't malfunctioning. It's infected by the pattern inside the signal. When we cut main power to stop the transmission, the biomass in Lab E-05 broke out of stasis. It hunts by sound—crouch-walk, use the emergency lockers, or fire your suit's ARC PULSE [R] to stun it.\n\nI'm leaving my Level-2 Reactor Keycard beside this recorder. Restarting the Auxiliary Generator in Sector D will restore full lighting across the entire station and unlock the Lab and Bridge bulkheads!"`
      }
    );

    this.addPickup(
      'key_maint_l2',
      'keycard',
      'TAKE LEVEL-2 REACTOR KEYCARD',
      8.5,
      0.95,
      2.6,
      0xf3a847,
      { keycardGrant: 'MAINT_KEY_L2' }
    );

    this.addCrateTable(6.0, 7.5, 1.0, 0.85, 0.8);
    this.addPickup('oxygen_quarters', 'oxygen', 'PICK UP OXYGEN CANISTER (+45% O2)', 6.0, 1.0, 7.5, 0x2ca8ff);

    // --- ROOM 5: GENERATOR ROOM (West, x: -16..-3, z: -15..-3) ---
    this.addHidingLocker('locker_generator', -15.2, -4.5, Math.PI / 2);

    const genGroup = new THREE.Group();
    genGroup.position.set(-11.5, 0, -9.5);
    const coreGeo = new THREE.CylinderGeometry(1.3, 1.5, 3.2, 16);
    this.reactorCoreMat = new THREE.MeshStandardMaterial({
      color: 0x2a333a,
      emissive: 0xff3b30,
      emissiveIntensity: 0.45,
      roughness: 0.4,
      metalness: 0.65
    });
    const coreMesh = new THREE.Mesh(coreGeo, this.reactorCoreMat);
    coreMesh.position.y = 1.6;
    genGroup.add(coreMesh);

    this.reactorRotor = new THREE.Group();
    this.reactorRotor.position.y = 1.9;
    const rotorRingGeo = new THREE.TorusGeometry(1.65, 0.12, 8, 20);
    rotorRingGeo.rotateX(Math.PI / 2);
    const rotorRing = new THREE.Mesh(rotorRingGeo, this.trimMat);
    this.reactorRotor.add(rotorRing);
    genGroup.add(this.reactorRotor);

    this.scene.add(genGroup);

    this.colliders.push({
      minX: -13.2,
      maxX: -9.8,
      minZ: -11.2,
      maxZ: -7.8,
      enabled: true
    });

    const breakerGeo = new THREE.BoxGeometry(1.1, 1.35, 0.7);
    const breakerMat = new THREE.MeshStandardMaterial({
      color: 0xd4842a,
      emissive: 0xd4842a,
      emissiveIntensity: 0.5,
      roughness: 0.45
    });
    const breakerMesh = new THREE.Mesh(breakerGeo, breakerMat);
    breakerMesh.position.set(-8.8, 0.675, -9.5);
    this.scene.add(breakerMesh);

    this.colliders.push({
      minX: -9.4,
      maxX: -8.2,
      minZ: -9.9,
      maxZ: -9.1,
      enabled: true
    });

    this.interactables.push({
      id: 'aux_generator',
      type: 'generator',
      label: 'ENGAGE AUXILIARY POWER TURBINE',
      shortActionLabel: 'RESTORE POWER',
      mesh: breakerMesh,
      position: new THREE.Vector3(-8.8, 1.2, -9.5),
      enabled: true
    });

    this.addCrateTable(-6.5, -13.5, 1.2, 0.85, 0.8);
    this.addPickup('battery_generator', 'battery', 'PICK UP BATTERY & ARC CAPACITOR CELL', -6.8, 0.98, -13.5, 0xffcc33);
    this.addPickup('oxygen_generator', 'oxygen', 'PICK UP OXYGEN CANISTER (+45% O2)', -6.1, 0.98, -13.5, 0x2ca8ff);

    // --- ROOM 6: LABORATORY (East, x: 3..16, z: -17..-5) ---
    this.addHidingLocker('locker_lab', 15.2, -6.2, -Math.PI / 2);

    const podGeo = new THREE.CylinderGeometry(1.0, 1.0, 2.8, 16);
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x1a3d2f,
      emissive: 0x1f7a54,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.3
    });
    const podMesh = new THREE.Mesh(podGeo, podMat);
    podMesh.position.set(11.5, 1.4, -13.5);
    this.scene.add(podMesh);

    const trailMat = new THREE.MeshBasicMaterial({ color: 0x29a36a, transparent: true, opacity: 0.55 });
    const trailCoords = [
      [10.2, -12.5, 0.65],
      [8.6, -11.8, 0.5],
      [6.8, -11.3, 0.45],
      [4.8, -11.0, 0.4]
    ];
    for (const [tx, tz, tr] of trailCoords) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(tr, 10), trailMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(tx, 0.02, tz);
      this.scene.add(puddle);
    }

    this.colliders.push({
      minX: 10.4,
      maxX: 12.6,
      minZ: -14.6,
      maxZ: -12.4,
      enabled: true
    });

    this.addCrateTable(9.5, -9.5, 2.2, 0.88, 1.0);
    this.addPickup(
      'audiolog_thorne',
      'audiolog',
      'PLAY CREW RECORDING #2 (DR. ARIS THORNE)',
      9.0,
      0.98,
      -9.5,
      0x38b6ff,
      {
        terminalTitle: 'AUDIO LOG #02 // DR. ARIS THORNE (XENO-LINGUISTICS)',
        terminalBody: `[ALARM SIRENS IN BACKGROUND... GLASS SHATTERING]\n\n"The signal isn't a message—it's a self-replicating neural architecture! The moment ECHO decoded the telemetry from Sector 7G, the code colonized ECHO's core logic and synthesized an organic host inside Specimen Pod 4.\n\nECHO wants you to walk into the Communications Bridge and press 'TRANSMIT' so the high-gain dish beams the pattern directly to Earth's orbital relay network. It will tell you it's sending a rescue distress call. IT IS LYING.\n\nTake my Level-3 Comms Override Keycard. When you reach the Bridge, you have a choice: obey ECHO at the Transmitter Console, or pull the manual Core Purge Breaker on the starboard pedestal to kill ECHO and launch the escape pod!"`
      }
    );

    this.addPickup(
      'key_comms_l3',
      'keycard',
      'TAKE LEVEL-3 COMMS OVERRIDE PASSKEY',
      10.0,
      0.98,
      -9.5,
      0xff3b30,
      { keycardGrant: 'COMMS_OVERRIDE_L3' }
    );

    this.addTerminal(
      'term_lab',
      'SPECIMEN 04 ANALYSIS',
      6.2,
      -15.5,
      0,
      'XENO-SIGNAL LAB // SPECIMEN 04',
      ['CONTAINMENT: BREACHED', 'BIO-ELECTRIC CORE: VULNERABLE', 'ARC OVERLOAD: 3 PULSES'],
      `=== XENO-BIOLOGY RESEARCH REPORT ===\nSUBJECT: 'THE SIGNAL STALKER'\n\n1. Subject navigates via acoustic resonance and electromagnetic field detection.\n2. High-voltage ARC PULSE discharges temporarily paralyze its motor cortex. Three sustained hits—or discharging inside the energized Reactor D-04 magnetic field—will permanently collapse its neural lattice.\n3. Sealed metallic lockers mask bio-electric and acoustic signatures.`
    );

    // --- ROOM 7: COMMUNICATIONS BRIDGE (North, x: -9..9, z: -37..-25) ---
    const monolithGeo = new THREE.BoxGeometry(2.2, 3.8, 1.2);
    this.monolithMat = new THREE.MeshStandardMaterial({
      color: 0x101820,
      emissive: 0xd4842a,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.7
    });
    const monolith = new THREE.Mesh(monolithGeo, this.monolithMat);
    monolith.position.set(0, 1.9, -34.8);
    this.scene.add(monolith);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf3a847, wireframe: true });
    for (let i = 0; i < 2; i++) {
      const rMesh = new THREE.Mesh(new THREE.TorusGeometry(1.65 + i * 0.35, 0.04, 8, 24), ringMat);
      rMesh.position.set(0, 2.0, -34.8);
      this.echoRings.push(rMesh);
      this.scene.add(rMesh);
    }

    const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, 3.8, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff2a1f,
      transparent: true,
      opacity: 0.75
    });
    this.carrierBeamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.carrierBeamMesh.position.set(0, 1.9, -33.2);
    this.carrierBeamMesh.visible = false;
    this.scene.add(this.carrierBeamMesh);

    const trustConsoleGeo = new THREE.BoxGeometry(1.6, 1.2, 1.0);
    const trustConsoleMat = new THREE.MeshStandardMaterial({
      color: 0x163828,
      emissive: 0x4af2a1,
      emissiveIntensity: 0.6,
      roughness: 0.4
    });
    const trustConsole = new THREE.Mesh(trustConsoleGeo, trustConsoleMat);
    trustConsole.position.set(-4.2, 0.6, -32.0);
    this.scene.add(trustConsole);

    this.addWallSign(-4.2, 2.1, -32.0, 0, 'TRANSMIT SIGNAL', '[TRUST ECHO // EARTH UPLINK]', '#4af2a1');

    this.colliders.push({
      minX: -5.0,
      maxX: -3.4,
      minZ: -32.5,
      maxZ: -31.5,
      enabled: true
    });

    this.interactables.push({
      id: 'final_trust_console',
      type: 'final_trust',
      label: '[TRUST ECHO] ACTIVATE HIGH-GAIN SIGNAL TRANSMITTER',
      shortActionLabel: 'TRANSMIT SIGNAL',
      mesh: trustConsole,
      position: new THREE.Vector3(-4.2, 1.2, -32.0),
      enabled: true
    });

    const rejectConsoleGeo = new THREE.BoxGeometry(1.6, 1.2, 1.0);
    const rejectConsoleMat = new THREE.MeshStandardMaterial({
      color: 0x3d1818,
      emissive: 0xff3b30,
      emissiveIntensity: 0.6,
      roughness: 0.4
    });
    const rejectConsole = new THREE.Mesh(rejectConsoleGeo, rejectConsoleMat);
    rejectConsole.position.set(4.2, 0.6, -32.0);
    this.scene.add(rejectConsole);

    this.addWallSign(4.2, 2.1, -32.0, 0, 'CORE PURGE BREAKER', '[REJECT ECHO // LAUNCH POD]', '#ff3b30');

    this.colliders.push({
      minX: 3.4,
      maxX: 5.0,
      minZ: -32.5,
      maxZ: -31.5,
      enabled: true
    });

    this.interactables.push({
      id: 'final_reject_console',
      type: 'final_reject',
      label: '[REJECT ECHO] PURGE AI CORE & LAUNCH ESCAPE POD',
      shortActionLabel: 'PURGE AI CORE',
      mesh: rejectConsole,
      position: new THREE.Vector3(4.2, 1.2, -32.0),
      enabled: true
    });

    this.addPickup('oxygen_comms', 'oxygen', 'PICK UP OXYGEN CANISTER (+45% O2)', 0, 0.95, -29.0, 0x2ca8ff);
    this.addCrateTable(0, -29.0, 1.0, 0.85, 1.0);

    // --- SUBLEVEL S-01: MAINTENANCE TUNNELS (-19..-13, z: 0..10) ---
    this.addCrateTable(-16.0, 5.0, 1.8, 0.85, 1.0);
    this.addPickup(
      'key_sublevel_l2b',
      'keycard',
      'TAKE SUBLEVEL COOLING PASSKEY [SUBLEVEL_KEY_L2B]',
      -16.0,
      0.98,
      5.0,
      0x4af2a1,
      { keycardGrant: 'SUBLEVEL_KEY_L2B' }
    );
    this.addPickup('battery_sublevel', 'battery', 'PICK UP ARC CAPACITOR CELL', -17.5, 0.95, 3.5, 0xffcc33);
    this.addHidingLocker('locker_sublevels', -18.2, 7.5, 0);

    // --- SUBLEVEL S-02: COOLING INFRASTRUCTURE (-26..-16, z: -15..-3) ---
    this.addCrateTable(-21.0, -9.0, 1.6, 0.9, 1.2);
    const subBreakerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.3, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x38b6ff, emissive: 0x1f7a99, emissiveIntensity: 0.6 })
    );
    subBreakerMesh.position.set(-23.0, 0.65, -9.0);
    this.scene.add(subBreakerMesh);
    this.colliders.push({ minX: -23.6, maxX: -22.4, minZ: -9.5, maxZ: -8.5, enabled: true });
    this.interactables.push({
      id: 'sublevel_breaker',
      type: 'sublevel_breaker',
      label: 'ACTIVATE SECONDARY COOLANT BREAKER',
      shortActionLabel: 'ACTIVATE COOLANT',
      mesh: subBreakerMesh,
      position: new THREE.Vector3(-23.0, 1.2, -9.0),
      enabled: true
    });
    this.addPickup('oxygen_sublevel', 'oxygen', 'PICK UP HIGH-CAPACITY O2 SUPPLY', -21.0, 0.98, -9.0, 0x2ca8ff);

    // Upgrade Station in Sublevel S-02: Suit Reinforcement (+25 Max Armor Buffer)
    const upgMesh1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.5, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x4af2a1, emissive: 0x1f7a54, emissiveIntensity: 0.8 })
    );
    upgMesh1.position.set(-24.5, 0.75, -5.0);
    this.scene.add(upgMesh1);
    this.colliders.push({ minX: -25.1, maxX: -23.9, minZ: -5.5, maxZ: -4.5, enabled: true });
    this.interactables.push({
      id: 'upgrade_suit',
      type: 'upgrade_station',
      label: 'UPGRADE SUIT ARMOR FABRICATOR [SUIT REINFORCEMENT]',
      shortActionLabel: 'UPGRADE SUIT',
      mesh: upgMesh1,
      position: new THREE.Vector3(-24.5, 1.2, -5.0),
      enabled: true,
      upgradeGrant: 'SUIT_REINFORCEMENT'
    });

    // --- FACILITY X-01: CONTAINMENT CHAMBERS (16..26, z: -17..-5) ---
    this.addCrateTable(21.0, -11.0, 2.0, 0.85, 1.0);
    // Upgrade Station in Facility X-01: Pulse Capacitor Boost (+1 Max Arc Charge)
    const upgMesh2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.5, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x38b6ff, emissive: 0x1177bb, emissiveIntensity: 0.85 })
    );
    upgMesh2.position.set(24.5, 0.75, -7.0);
    this.scene.add(upgMesh2);
    this.colliders.push({ minX: 23.9, maxX: 25.1, minZ: -7.5, maxZ: -6.5, enabled: true });
    this.interactables.push({
      id: 'upgrade_pulse',
      type: 'upgrade_station',
      label: 'OVERCLOCK ARC CAPACITOR [MAX CHARGES +1]',
      shortActionLabel: 'UPGRADE PULSE',
      mesh: upgMesh2,
      position: new THREE.Vector3(24.5, 1.2, -7.0),
      enabled: true,
      upgradeGrant: 'PULSE_CAPACITOR_BOOST'
    });
    this.addPickup('battery_facility_x', 'battery', 'PICK UP MIL-SPEC ARC CELL', 21.0, 0.98, -11.0, 0xffcc33);
    this.addHidingLocker('locker_facility_x', 24.5, -14.5, -Math.PI / 2);
  }

  private definePatrolWaypoints(): void {
    this.patrolWaypoints = [
      new THREE.Vector3(0, 0, -21),
      new THREE.Vector3(0, 0, -11),
      new THREE.Vector3(3, 0, -11),   // Lab doorway threshold
      new THREE.Vector3(6.5, 0, -11), // Inside Lab
      new THREE.Vector3(3, 0, -11),   // Back through Lab doorway
      new THREE.Vector3(0, 0, -9),
      new THREE.Vector3(-3, 0, -9),   // Generator doorway threshold
      new THREE.Vector3(-6.2, 0, -9), // Inside Generator foyer
      new THREE.Vector3(-3, 0, -9),   // Back through Generator doorway
      new THREE.Vector3(0, 0, -2),
      new THREE.Vector3(0, 0, 3),
      new THREE.Vector3(3, 0, 3),     // Crew Quarters doorway threshold
      new THREE.Vector3(6.0, 0, 3),   // Inside Crew Quarters foyer
      new THREE.Vector3(3, 0, 3),     // Back through Crew Quarters doorway
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(-3, 0, 5),    // Security doorway threshold
      new THREE.Vector3(-5.8, 0, 5),  // Inside Security foyer
      new THREE.Vector3(-3, 0, 5),    // Back through Security doorway
      new THREE.Vector3(0, 0, -6)
    ];
  }

  public updateDoorStatusIndicators(inventory: Set<string>, auxPowerOn: boolean): void {
    for (const { item, mat } of this.doorStatusIndicators) {
      if (item.isOpen) {
        mat.color.setHex(0x38b6ff);
      } else if ((item.requiresPower && !auxPowerOn) || (item.requiredKey && !inventory.has(item.requiredKey))) {
        mat.color.setHex(0xff3b30);
      } else {
        mat.color.setHex(0x4af2a1);
      }
    }
  }

  public updateLights(elapsedTime: number, dt = 0.016, reducedEffects = false): void {
    if (this.reactorRotor) {
      this.reactorRotor.rotation.y += dt * (this.auxPowerActive ? 5.5 : 0.45);
    }

    if (this.echoRings.length === 2) {
      this.echoRings[0].rotation.y = elapsedTime * 0.8;
      this.echoRings[0].rotation.x = Math.sin(elapsedTime * 0.5) * 0.35;
      this.echoRings[1].rotation.y = -elapsedTime * 1.1;
      this.echoRings[1].rotation.z = Math.cos(elapsedTime * 0.6) * 0.4;
    }

    if (this.powerSurgeTimer > 0) {
      this.powerSurgeTimer = Math.max(0, this.powerSurgeTimer - dt);
    }

    // Once Auxiliary Power is restored, ALL station lights remain steady and bright—never flickering or darkening
    if (this.auxPowerActive) {
      const enhMul = this.enhancedVisibility ? 1.15 : 1.0;
      const surgeBonus = this.powerSurgeTimer > 0 ? Math.sin(this.powerSurgeTimer * Math.PI) * 0.8 : 0;
      for (const fl of this.allStationLights) {
        fl.light.intensity = fl.poweredIntensity * enhMul + surgeBonus;
        fl.fixtureMat.emissiveIntensity = 2.2;
      }
      return;
    }

    const enhPreMul = this.enhancedVisibility ? 1.35 : 1.0;
    for (const fl of this.flickeringLights) {
      if (reducedEffects) {
        fl.light.intensity = fl.baseIntensity * enhPreMul;
        fl.fixtureMat.emissiveIntensity = 1.25;
        continue;
      }
      if (fl.isEmergency) {
        const pulse = 0.65 + 0.35 * Math.sin(elapsedTime * 3.2 + fl.seed);
        fl.light.intensity = fl.baseIntensity * enhPreMul * pulse;
        fl.fixtureMat.emissiveIntensity = 0.65 + pulse;
      } else {
        const n = Math.sin(elapsedTime * 19 + fl.seed) * Math.sin(elapsedTime * 7.3 + fl.seed * 2);
        const factor = n > 0.72 ? 0.38 : n < -0.78 ? 0.62 : 1.0;
        fl.light.intensity = fl.baseIntensity * enhPreMul * factor;
        fl.fixtureMat.emissiveIntensity = factor * 1.25;
      }
    }
  }

  public updateInteractableHighlights(
    playerPos: THREE.Vector3,
    activeItem: InteractableItem | null,
    elapsedTime: number
  ): void {
    const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 5.2);
    for (const item of this.interactables) {
      if (!item.enabled || !item.mesh) continue;
      const mesh = item.mesh as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat || !('emissiveIntensity' in mat)) continue;

      if (mat.userData.baseEmissiveIntensity === undefined) {
        mat.userData.baseEmissiveIntensity = mat.emissiveIntensity ?? 0;
        mat.userData.baseEmissiveHex = mat.emissive ? mat.emissive.getHex() : 0x000000;
      }

      const dx = item.position.x - playerPos.x;
      const dz = item.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);

      if (activeItem && activeItem.id === item.id) {
        if (mat.userData.baseEmissiveHex === 0x000000 && mat.emissive) {
          mat.emissive.setHex(0x2ca8ff);
        }
        mat.emissiveIntensity = Math.max(0.6, mat.userData.baseEmissiveIntensity + 0.6 + pulse * 0.35);
      } else if (dist < 4.5 && !(item.type === 'door' && item.isOpen)) {
        if (mat.userData.baseEmissiveHex === 0x000000 && mat.emissive) {
          mat.emissive.setHex(0x1f6aa5);
        }
        const proxFactor = 1 - dist / 4.5;
        mat.emissiveIntensity = mat.userData.baseEmissiveIntensity + proxFactor * (0.25 + pulse * 0.2);
      } else {
        if (mat.userData.baseEmissiveHex === 0x000000 && mat.emissive) {
          mat.emissive.setHex(0x000000);
        }
        mat.emissiveIntensity = mat.userData.baseEmissiveIntensity;
      }
    }
  }

  public getRoomAt(x: number, z: number): RoomZone | undefined {
    return this.rooms.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
  }
}
