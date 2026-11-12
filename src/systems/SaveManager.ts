import { DifficultyLevel, GameSettings, KeycardId, ObjectiveStage, PlayerUpgradeType, SavedGameData, TutorialStepId } from '../types';

const SAVE_STORAGE_KEY = 'the_last_signal_save_v1';
const SETTINGS_STORAGE_KEY = 'the_last_signal_settings_v1';

const VALID_STAGES: ObjectiveStage[] = [
  'EXIT_AIRLOCK',
  'FIND_SECURITY_CARD',
  'EXPLORE_QUARTERS_FOR_GEN_KEY',
  'RESTORE_AUX_POWER',
  'EXPLORE_SUBLEVELS',
  'RESTORE_SUBLEVEL_COOLING',
  'INVESTIGATE_LAB',
  'REACH_COMMS_ROOM',
  'FINAL_DECISION'
];

const VALID_KEYS: KeycardId[] = [
  'SEC_CARD_L1',
  'MAINT_KEY_L2',
  'SUBLEVEL_KEY_L2B',
  'COMMS_OVERRIDE_L3'
];

export class SaveManager {
  public static sanitizePlayerName(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/[<>&"'`\r\n\t]/g, '').trim().slice(0, 24);
  }

  public static hasValidSave(): boolean {
    return this.loadGame() !== null;
  }

  public static saveGame(data: SavedGameData): void {
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }

  public static loadGame(): SavedGameData | null {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SavedGameData>;

      if (
        !parsed ||
        (parsed.version !== 1 && parsed.version !== 2) ||
        typeof parsed.objectiveStage !== 'string' ||
        !VALID_STAGES.includes(parsed.objectiveStage as ObjectiveStage) ||
        !Array.isArray(parsed.inventory) ||
        typeof parsed.auxPowerRestored !== 'boolean' ||
        !Array.isArray(parsed.openedDoors) ||
        !Array.isArray(parsed.collectedItems) ||
        !Array.isArray(parsed.discoveredLogs) ||
        !Array.isArray(parsed.completedTutorials)
      ) {
        this.clearSave();
        return null;
      }

      const validInventory = parsed.inventory.filter((k): k is KeycardId => VALID_KEYS.includes(k as KeycardId));
      const oxygen =
        typeof parsed.oxygen === 'number' && Number.isFinite(parsed.oxygen)
          ? Math.max(10, Math.min(100, parsed.oxygen))
          : 100;
      const battery =
        typeof parsed.battery === 'number' && Number.isFinite(parsed.battery)
          ? Math.max(10, Math.min(100, parsed.battery))
          : 100;

      const sanitizedName = this.sanitizePlayerName(parsed.playerName);
      const playerName = sanitizedName.length > 0 ? sanitizedName : 'Hale';

      const arcCharges =
        typeof parsed.arcCharges === 'number' && Number.isFinite(parsed.arcCharges)
          ? Math.max(0, Math.min(4, Math.round(parsed.arcCharges)))
          : 2;

      const creatureDefeated = typeof parsed.creatureDefeated === 'boolean' ? parsed.creatureDefeated : false;
      const creatureHits =
        typeof parsed.creatureHits === 'number' && Number.isFinite(parsed.creatureHits)
          ? Math.max(0, Math.min(5, Math.round(parsed.creatureHits)))
          : 0;

      const upgrades = Array.isArray(parsed.upgrades)
        ? (parsed.upgrades.filter((u): u is PlayerUpgradeType => typeof u === 'string') as PlayerUpgradeType[])
        : [];

      const difficulty: DifficultyLevel =
        parsed.difficulty === 'explorer' || parsed.difficulty === 'nightmare'
          ? parsed.difficulty
          : 'survivor';

      const sublevelPowerRestored = Boolean(parsed.sublevelPowerRestored);

      return {
        version: 1,
        timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
        playerName,
        objectiveStage: parsed.objectiveStage as ObjectiveStage,
        inventory: validInventory,
        upgrades,
        difficulty,
        auxPowerRestored: parsed.auxPowerRestored,
        sublevelPowerRestored,
        openedDoors: parsed.openedDoors.filter((d): d is string => typeof d === 'string'),
        collectedItems: parsed.collectedItems.filter((c): c is string => typeof c === 'string'),
        discoveredLogs: parsed.discoveredLogs.filter(
          (l): l is { id: string; title: string; body: string } =>
            Boolean(l && typeof l.id === 'string' && typeof l.title === 'string' && typeof l.body === 'string')
        ),
        completedTutorials: parsed.completedTutorials as TutorialStepId[],
        oxygen,
        battery,
        arcCharges,
        creatureDefeated,
        creatureHits
      };
    } catch {
      this.clearSave();
      return null;
    }
  }

  public static clearSave(): void {
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  public static saveSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }

  public static loadSettings(defaults: GameSettings): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return {
        ...defaults,
        ...parsed,
        difficulty: parsed.difficulty || defaults.difficulty || 'survivor',
        keyBindings: {
          ...defaults.keyBindings,
          ...(parsed.keyBindings || {})
        }
      };
    } catch {
      return defaults;
    }
  }
}
