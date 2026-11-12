import * as THREE from 'three';

export type QualityLevel = 'low' | 'medium' | 'high';
export type SubtitleSize = 'small' | 'medium' | 'large';
export type DifficultyLevel = 'explorer' | 'survivor' | 'nightmare';

export interface KeyBindings {
  interact: string;
  flashlight: string;
  scanner: string;
  crouch: string;
  journal: string;
  arcPulse: string;
}

export interface GameSettings {
  quality: QualityLevel;
  resolutionScale: number;
  shadowsEnabled: boolean;
  mouseSensitivity: number;
  touchSensitivity: number;
  masterVolume: number;
  crtEnabled: boolean;
  reducedEffects: boolean;
  highContrastPrompts: boolean;
  enhancedVisibility: boolean;
  voiceEnabled: boolean;
  voiceVolume: number;
  subtitlesEnabled: boolean;
  subtitleSize: SubtitleSize;
  difficulty: DifficultyLevel;
  keyBindings: KeyBindings;
}

export type ObjectiveStage =
  | 'EXIT_AIRLOCK'
  | 'FIND_SECURITY_CARD'
  | 'EXPLORE_QUARTERS_FOR_GEN_KEY'
  | 'RESTORE_AUX_POWER'
  | 'EXPLORE_SUBLEVELS'
  | 'RESTORE_SUBLEVEL_COOLING'
  | 'INVESTIGATE_LAB'
  | 'REACH_COMMS_ROOM'
  | 'FINAL_DECISION';

export type KeycardId =
  | 'SEC_CARD_L1'
  | 'MAINT_KEY_L2'
  | 'SUBLEVEL_KEY_L2B'
  | 'COMMS_OVERRIDE_L3';

export type InteractableType =
  | 'door'
  | 'terminal'
  | 'keycard'
  | 'battery'
  | 'oxygen'
  | 'audiolog'
  | 'generator'
  | 'sublevel_breaker'
  | 'upgrade_station'
  | 'locker'
  | 'final_trust'
  | 'final_reject';

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  id?: string;
  enabled: boolean;
}

export type PlayerUpgradeType =
  | 'SUIT_REINFORCEMENT'
  | 'O2_TANK_EXPANSION'
  | 'PULSE_CAPACITOR_BOOST'
  | 'TORCH_BATTERY_EFFICIENCY';

export interface InteractableItem {
  id: string;
  type: InteractableType;
  label: string;
  shortActionLabel?: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  enabled: boolean;
  requiredKey?: KeycardId;
  requiresPower?: boolean;
  isOpen?: boolean;
  doorColliderId?: string;
  doorMesh?: THREE.Object3D;
  doorClosedY?: number;
  terminalTitle?: string;
  terminalBody?: string;
  audioLogId?: string;
  keycardGrant?: KeycardId;
  upgradeGrant?: PlayerUpgradeType;
  lockerViewPos?: THREE.Vector3;
  lockerExitPos?: THREE.Vector3;
  lockerFacingYaw?: number;
}

export interface RoomZone {
  id: string;
  name: string;
  code: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type EnemyFSMState =
  | 'PATROL'
  | 'INVESTIGATE'
  | 'SEARCH'
  | 'CHASE'
  | 'LOST_TARGET'
  | 'RETURN_TO_PATROL'
  | 'STUNNED'
  | 'DEFEATED';

export type CreatureClass =
  | 'SIGNAL_STALKER'
  | 'RUNNER'
  | 'BRUTE'
  | 'WATCHER';

export type TutorialStepId =
  | 'TUT_MOVE'
  | 'TUT_INTERACT'
  | 'TUT_FLASHLIGHT'
  | 'TUT_SCANNER'
  | 'TUT_STEALTH'
  | 'TUT_ARC_PULSE';

export interface InstructionCardData {
  id: string;
  tag: string;
  title: string;
  what: string;
  where: string;
  why: string;
  control: string;
  essential: boolean;
}

export interface SavedGameData {
  version: number;
  timestamp: number;
  playerName?: string;
  objectiveStage: ObjectiveStage;
  inventory: KeycardId[];
  upgrades?: PlayerUpgradeType[];
  difficulty?: DifficultyLevel;
  auxPowerRestored: boolean;
  sublevelPowerRestored?: boolean;
  openedDoors: string[];
  collectedItems: string[];
  discoveredLogs: Array<{ id: string; title: string; body: string }>;
  completedTutorials: TutorialStepId[];
  oxygen: number;
  battery: number;
  arcCharges?: number;
  creatureDefeated?: boolean;
  creatureHits?: number;
}
