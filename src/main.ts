import './style.css';
import * as THREE from 'three';
import {
  DifficultyLevel,
  GameSettings,
  InstructionCardData,
  InteractableItem,
  ObjectiveStage,
  QualityLevel,
  SavedGameData,
  SubtitleSize
} from './types';
import { SoundManager } from './audio/SoundManager';
import { StationBuilder } from './world/StationBuilder';
import { PlayerController } from './player/PlayerController';
import { EchoSystem } from './systems/EchoSystem';
import { SignalScanner } from './systems/SignalScanner';
import { CreatureAI } from './enemy/CreatureAI';
import { InputManager } from './input/InputManager';
import { TutorialSystem } from './systems/TutorialSystem';
import { SaveManager } from './systems/SaveManager';

export class LastSignalGame {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  public sound = new SoundManager();
  public input = new InputManager();
  public station!: StationBuilder;
  public player!: PlayerController;
  public echo!: EchoSystem;
  public scanner!: SignalScanner;
  public creature!: CreatureAI;
  public tutorial!: TutorialSystem;

  public playerName = 'Hale';
  public identityConfirmedInSession = false;
  public isIdentityOpen = false;
  public isInstructionCardOpen = false;
  public activeInstructionCard: InstructionCardData | null = null;
  public instructionCardsArchive: InstructionCardData[] = [];
  private shownInstructionCardIds = new Set<string>();

  public isRunning = false;
  public isPaused = false;
  public isTerminalOpen = false;
  public isJournalOpen = false;
  public isHowToOpen = false;
  public isCinematicPlaying = false;
  public auxPowerRestored = false;
  public sublevelPowerRestored = false;
  public logsDiscovered = 0;
  private startTime = 0;
  private portraitDismissed = false;
  private arcFlashTimer = 0;

  public objectiveStage: ObjectiveStage = 'EXIT_AIRLOCK';
  private readonly _objectiveTargetPos = new THREE.Vector3();
  private readonly _cinematicCamPos = new THREE.Vector3(0, 2.1, -28.5);

  private openedDoors = new Set<string>();
  private collectedItems = new Set<string>();
  private discoveredLogsArchive: Array<{ id: string; title: string; body: string }> = [];

  private settings: GameSettings;

  // DOM Elements
  private hudEl = document.getElementById('hud')!;
  private pointerBannerEl = document.getElementById('pointer-lock-banner')!;
  private powerStateEl = document.getElementById('hud-power-state')!;
  private missionTrackerEl = document.getElementById('mission-tracker-panel')!;
  private btnToggleDetailsEl = document.getElementById('btn-toggle-mission-details')!;
  private primaryObjEl = document.getElementById('hud-primary-objective')!;
  private objectiveEl = document.getElementById('hud-objective')!;
  private directionEl = document.getElementById('hud-direction')!;
  private whyEl = document.getElementById('hud-why')!;
  private locationEl = document.getElementById('hud-location')!;
  private compassHeadingEl = document.getElementById('compass-heading')!;
  private compassBearingEl = document.getElementById('compass-bearing-indicator')!;
  private stepBadgeEl = document.getElementById('hud-step-badge')!;
  private objUpdateBannerEl = document.getElementById('objective-update-banner')!;
  private objUpdateTagEl = document.getElementById('objective-update-tag')!;
  private objUpdateTextEl = document.getElementById('objective-update-text')!;
  private visualAudioCueEl = document.getElementById('visual-audio-cue')!;
  private btnTouchInteractEl = document.getElementById('btn-touch-interact')!;

  private o2ValEl = document.getElementById('o2-value')!;
  private o2BarEl = document.getElementById('o2-bar')!;
  private arcValEl = document.getElementById('arc-value')!;
  private arcBarEl = document.getElementById('arc-bar')!;
  private arcFlashOverlayEl = document.getElementById('arc-flash-overlay')!;
  private btnTouchPulseEl = document.getElementById('btn-touch-pulse')!;
  private batteryValEl = document.getElementById('battery-value')!;
  private batteryBarEl = document.getElementById('battery-bar')!;
  private noiseStateEl = document.getElementById('noise-state')!;
  private noiseBarEl = document.getElementById('noise-bar')!;
  private stanceEl = document.getElementById('hud-stance')!;
  private logsEl = document.getElementById('hud-logs')!;
  private invContainerEl = document.getElementById('hud-inventory')!;
  private reticleRingEl = document.getElementById('reticle-ring')!;
  private reticleDotEl = document.getElementById('reticle-dot')!;
  private promptEl = document.getElementById('interaction-prompt')!;
  private promptKeyBadgeEl = document.getElementById('prompt-key-badge')!;
  private promptTextEl = document.getElementById('interaction-text')!;
  private hidingIndicatorEl = document.getElementById('hiding-indicator')!;
  private lockerOverlayEl = document.getElementById('locker-overlay')!;
  private toastEl = document.getElementById('hud-toast')!;
  private damageOverlayEl = document.getElementById('damage-overlay')!;

  private cinematicOverlayEl = document.getElementById('cinematic-overlay')!;
  private cinematicCaptionEl = document.getElementById('cinematic-caption')!;

  private mainMenuEl = document.getElementById('main-menu')!;
  private identityScreenEl = document.getElementById('identity-screen')!;
  private playerNameInputEl = document.getElementById('player-name-input') as HTMLInputElement;
  private identityErrorEl = document.getElementById('identity-error')!;
  private briefingGreetingEl = document.getElementById('briefing-personal-greeting')!;
  private briefingScreenEl = document.getElementById('briefing-screen')!;
  private instructionCardModalEl = document.getElementById('instruction-card-modal')!;
  private icCategoryEl = document.getElementById('instruction-card-tag')!;
  private icHeadingEl = document.getElementById('instruction-card-title')!;
  private icWhatEl = document.getElementById('instruction-card-what')!;
  private icWhereEl = document.getElementById('instruction-card-where')!;
  private icWhyEl = document.getElementById('instruction-card-why')!;
  private icControlEl = document.getElementById('instruction-card-control')!;
  private settingsMenuEl = document.getElementById('settings-menu')!;
  private howToModalEl = document.getElementById('howtoplay-modal')!;
  private journalModalEl = document.getElementById('journal-modal')!;
  private pauseMenuEl = document.getElementById('pause-menu')!;
  private loadingScreenEl = document.getElementById('loading-screen')!;
  private gameoverScreenEl = document.getElementById('gameover-screen')!;
  private endingScreenEl = document.getElementById('ending-screen')!;
  private terminalModalEl = document.getElementById('terminal-modal')!;
  private portraitWarningEl = document.getElementById('portrait-warning')!;

  private toastTimer = 0;
  private objBannerTimer = 0;
  private cinematicEndTime = 0;
  private lastPauseToggleTime = 0;
  private lastInteractTime = 0;
  private lastStepKey = '';
  private pendingEndingChoice: 'TRUST_ECHO' | 'REJECT_ECHO' | null = null;

  constructor() {
    this.settings = this.getDefaultSettings();
    this.settings = SaveManager.loadSettings(this.settings);

    if (!this.initThree()) {
      document.getElementById('webgl-fallback')?.classList.remove('hidden');
      this.mainMenuEl.classList.add('hidden');
      return;
    }

    this.initWorldAndSystems();
    this.syncSettingsToUI();
    this.bindUI();
    this.applySettings();
    this.refreshSaveButtons();
    this.checkViewportOrientation();
    this.animate();
  }

  private getDefaultSettings(): GameSettings {
    const isMobileOrCoarse =
      window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 900;

    return {
      quality: isMobileOrCoarse ? 'low' : 'medium',
      resolutionScale: isMobileOrCoarse ? 1.0 : 1.0,
      shadowsEnabled: !isMobileOrCoarse,
      mouseSensitivity: 1.0,
      touchSensitivity: 1.0,
      masterVolume: 0.8,
      crtEnabled: true,
      reducedEffects: false,
      highContrastPrompts: false,
      enhancedVisibility: false,
      voiceEnabled: true,
      voiceVolume: 0.85,
      subtitlesEnabled: true,
      subtitleSize: 'medium',
      difficulty: 'survivor',
      keyBindings: {
        interact: 'KeyE',
        flashlight: 'KeyF',
        scanner: 'KeyQ',
        crouch: 'KeyC',
        journal: 'KeyJ',
        arcPulse: 'KeyR'
      }
    };
  }

  private requestPointerLockSafe(el: HTMLElement): void {
    if (this.input.isTouchActive) return;
    try {
      const res = el.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    } catch {
      // Ignore synchronous pointer lock errors
    }
  }

  private initThree(): boolean {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: this.settings.quality !== 'low',
        powerPreference: 'high-performance'
      });
    } catch {
      return false;
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040709);
    this.scene.fog = new THREE.FogExp2(0x05090d, 0.055);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 45);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.checkViewportOrientation();
    });

    // WebGL context loss & restoration resilience
    canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        if (this.isRunning && !this.isPaused) {
          this.togglePause();
        }
      },
      false
    );

    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.station.updateDoorStatusIndicators(this.player.inventory, this.auxPowerRestored);
        this.renderer.render(this.scene, this.camera);
      },
      false
    );

    return true;
  }

  private initWorldAndSystems(): void {
    this.station = new StationBuilder(this.scene);
    this.station.build();

    this.player = new PlayerController(this.camera, this.scene, this.sound, this.input);
    this.echo = new EchoSystem(this.sound);
    this.scanner = new SignalScanner(this.sound);
    this.creature = new CreatureAI(this.scene, this.station.patrolWaypoints, this.sound);
    this.tutorial = new TutorialSystem(() => this.persistSaveState());

    this.input.setHandlers({
      onInteract: () => {
        if (this.isRunning && this.isInstructionCardOpen) {
          this.acknowledgeInstructionCard();
          return;
        }
        if (this.isRunning && this.isTerminalOpen) {
          this.closeTerminalModal();
          return;
        }
        if (!this.player.inputEnabled) return;
        const now = performance.now();
        if (this.input.isTouchActive && now - this.lastInteractTime < 260) return;
        this.lastInteractTime = now;

        if (this.player.isHiding && this.player.activeLocker) {
          if (this.input.isTouchActive && now - this.player.lastLockerEnterTime < 350) return;
          this.player.exitLocker();
          return;
        }
        const target = this.player.getBestInteractable(this.station.interactables);
        if (target) {
          this.handleInteraction(target);
        }
      },
      onFlashlightToggle: () => {
        if (!this.player.inputEnabled) return;
        this.player.toggleFlashlight();
        this.tutorial.completeStep('TUT_FLASHLIGHT');
      },
      onScannerPing: () => {
        if (!this.player.inputEnabled) return;
        this.handleScannerPing();
        this.tutorial.completeStep('TUT_SCANNER');
      },
      onCrouchToggle: () => {
        if (!this.player.inputEnabled) return;
        this.player.toggleCrouch();
        this.tutorial.completeStep('TUT_STEALTH');
      },
      onArcPulse: () => {
        if (!this.player.inputEnabled) return;
        this.handleArcPulse();
      },
      onJournalToggle: () => {
        if (!this.isRunning || this.isCinematicPlaying) return;
        if (this.isJournalOpen) {
          this.closeJournalModal();
        } else if (!this.isPaused && !this.isTerminalOpen && !this.isHowToOpen && !this.isInstructionCardOpen) {
          this.openJournalModal();
        }
      },
      onPauseToggle: () => {
        this.togglePause();
      }
    });
  }

  private checkViewportOrientation(): void {
    const isPortraitMobile = window.innerWidth < window.innerHeight && window.innerWidth <= 640;
    if (isPortraitMobile && !this.portraitDismissed) {
      this.portraitWarningEl.classList.remove('hidden');
    } else {
      this.portraitWarningEl.classList.add('hidden');
    }
  }

  private refreshSaveButtons(): void {
    const hasSave = SaveManager.hasValidSave();
    const contBtn = document.getElementById('btn-continue-game');
    const chkBtn = document.getElementById('btn-continue-checkpoint');
    if (contBtn) contBtn.classList.toggle('hidden', !hasSave);
    if (chkBtn) chkBtn.classList.toggle('hidden', !hasSave);
  }

  public validateAndSetPlayerName(rawInput: string): { valid: boolean; sanitized: string; error?: string } {
    const trimmed = (rawInput ?? '').replace(/\s+/g, ' ').trim();
    const cleaned = trimmed
      .replace(/[<>"'`\\]/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim();

    if (!cleaned || !/[A-Za-z0-9]/.test(cleaned)) {
      return {
        valid: false,
        sanitized: '',
        error: 'ERROR: CALLSIGN REQUIRED — ENTER AT LEAST ONE LETTER OR NUMBER.'
      };
    }

    const sanitized = cleaned.slice(0, 24).trim();
    this.playerName = sanitized;
    this.echo.setPlayerName(sanitized);
    if (this.briefingGreetingEl) {
      this.briefingGreetingEl.textContent = `Welcome aboard, ${sanitized}. I am ECHO, the station's central intelligence.`;
    }
    return { valid: true, sanitized };
  }

  public confirmPlayerIdentity(): boolean {
    const res = this.validateAndSetPlayerName(this.playerNameInputEl?.value ?? '');
    if (!res.valid) {
      if (this.identityErrorEl) {
        this.identityErrorEl.textContent = res.error || 'ERROR: INVALID CALLSIGN.';
        this.identityErrorEl.classList.remove('hidden');
      }
      this.sound.playDoorSound(true);
      return false;
    }

    this.identityErrorEl?.classList.add('hidden');
    this.identityScreenEl?.classList.add('hidden');
    this.briefingScreenEl.classList.remove('hidden');
    this.isIdentityOpen = false;
    this.identityConfirmedInSession = true;
    this.sound.playPickupSound();
    this.echo.announceIdentityConfirmed();
    return true;
  }

  private bindUI(): void {
    const canvas = document.getElementById('game-canvas')!;

    // Portrait Advisory Dismiss
    document.getElementById('btn-dismiss-portrait')?.addEventListener('click', () => {
      this.portraitDismissed = true;
      this.portraitWarningEl.classList.add('hidden');
    });

    // SCREEN 1: Main Menu -> SCREEN 1B: Personnel Identification -> SCREEN 2: Mission Briefing
    document.getElementById('btn-start-game')!.addEventListener('click', () => {
      this.sound.init();
      this.mainMenuEl.classList.add('hidden');
      this.identityErrorEl?.classList.add('hidden');
      this.identityScreenEl?.classList.remove('hidden');
      this.briefingScreenEl.classList.remove('hidden');
      this.isIdentityOpen = true;
      window.setTimeout(() => {
        if (this.isIdentityOpen && !this.identityScreenEl?.classList.contains('hidden')) {
          this.playerNameInputEl?.focus();
        }
      }, 40);
    });

    document.getElementById('btn-confirm-identity')?.addEventListener('click', () => {
      this.sound.init();
      this.confirmPlayerIdentity();
    });

    this.playerNameInputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sound.init();
        this.confirmPlayerIdentity();
      }
    });

    document.getElementById('btn-cancel-identity')?.addEventListener('click', () => {
      this.isIdentityOpen = false;
      this.identityScreenEl?.classList.add('hidden');
      this.briefingScreenEl.classList.add('hidden');
      this.mainMenuEl.classList.remove('hidden');
    });

    // SCREEN 1: Continue Saved Mission
    document.getElementById('btn-continue-game')?.addEventListener('click', () => {
      this.sound.init();
      this.requestPointerLockSafe(canvas);
      this.mainMenuEl.classList.add('hidden');
      this.identityScreenEl?.classList.add('hidden');
      this.resumeFromSavedGame();
    });

    // SCREEN 2: Mission Briefing -> SCREEN 3: Docking Sequence
    const launchFromBriefing = () => {
      this.sound.init();
      if (this.playerNameInputEl && this.playerNameInputEl.value.trim().length > 0 && !this.identityConfirmedInSession) {
        this.validateAndSetPlayerName(this.playerNameInputEl.value);
      }
      SaveManager.clearSave();
      this.requestPointerLockSafe(canvas);
      this.identityScreenEl?.classList.add('hidden');
      this.briefingScreenEl.classList.add('hidden');
      this.isIdentityOpen = false;
      this.startLoadingTransition();
    };
    document.getElementById('btn-begin-mission')!.addEventListener('click', launchFromBriefing);
    document.getElementById('btn-skip-briefing')!.addEventListener('click', launchFromBriefing);

    // Essential Instruction Card Continue & HUD Briefing Card Button
    document.getElementById('btn-instruction-continue')?.addEventListener('click', () => {
      this.acknowledgeInstructionCard();
    });

    document.getElementById('btn-hud-card')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showInstructionCard(this.getInstructionCardForStage());
    });

    // How To Play Modal
    let returnToPauseFromHowTo = false;
    document.getElementById('btn-how-to-play')?.addEventListener('click', () => {
      returnToPauseFromHowTo = false;
      this.isHowToOpen = true;
      this.mainMenuEl.classList.add('hidden');
      this.howToModalEl.classList.remove('hidden');
    });

    document.getElementById('btn-pause-howto')?.addEventListener('click', () => {
      returnToPauseFromHowTo = true;
      this.isHowToOpen = true;
      this.pauseMenuEl.classList.add('hidden');
      this.howToModalEl.classList.remove('hidden');
    });

    document.getElementById('btn-close-howto')?.addEventListener('click', () => {
      this.isHowToOpen = false;
      this.howToModalEl.classList.add('hidden');
      if (returnToPauseFromHowTo) {
        this.pauseMenuEl.classList.remove('hidden');
      } else {
        this.mainMenuEl.classList.remove('hidden');
      }
    });

    // Collapsible Mobile Mission Details Drawer
    const toggleMissionDetails = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const expanded = this.missionTrackerEl.classList.toggle('expanded');
      this.btnToggleDetailsEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      this.btnToggleDetailsEl.textContent = expanded ? 'HIDE ▴' : 'DETAILS ▾';
    };
    this.btnToggleDetailsEl?.addEventListener('click', toggleMissionDetails);

    // Mission Journal Modal
    let returnToPauseFromJournal = false;
    document.getElementById('btn-hud-journal')?.addEventListener('click', (e) => {
      e.stopPropagation();
      returnToPauseFromJournal = false;
      this.openJournalModal();
    });

    document.getElementById('btn-pause-journal')?.addEventListener('click', () => {
      returnToPauseFromJournal = true;
      this.pauseMenuEl.classList.add('hidden');
      this.openJournalModal();
    });

    document.getElementById('btn-close-journal')?.addEventListener('click', () => {
      this.closeJournalModal(returnToPauseFromJournal);
      returnToPauseFromJournal = false;
    });

    // Settings Modal
    let returnToPauseFromSettings = false;
    document.getElementById('btn-open-settings')!.addEventListener('click', () => {
      returnToPauseFromSettings = false;
      this.mainMenuEl.classList.add('hidden');
      this.settingsMenuEl.classList.remove('hidden');
    });

    document.getElementById('btn-pause-settings')!.addEventListener('click', () => {
      returnToPauseFromSettings = true;
      this.pauseMenuEl.classList.add('hidden');
      this.settingsMenuEl.classList.remove('hidden');
    });

    document.getElementById('btn-close-settings')!.addEventListener('click', () => {
      this.readSettingsInputs();
      this.applySettings();
      SaveManager.saveSettings(this.settings);
      this.settingsMenuEl.classList.add('hidden');
      if (returnToPauseFromSettings) {
        this.pauseMenuEl.classList.remove('hidden');
      } else {
        this.mainMenuEl.classList.remove('hidden');
      }
    });

    // Live slider labels
    const sensInput = document.getElementById('setting-sensitivity') as HTMLInputElement;
    const sensVal = document.getElementById('setting-sensitivity-val')!;
    sensInput.addEventListener('input', () => {
      sensVal.textContent = Number(sensInput.value).toFixed(1);
    });

    const touchSensInput = document.getElementById('setting-touch-sensitivity') as HTMLInputElement;
    const touchSensVal = document.getElementById('setting-touch-sensitivity-val')!;
    touchSensInput?.addEventListener('input', () => {
      touchSensVal.textContent = Number(touchSensInput.value).toFixed(1);
    });

    const volInput = document.getElementById('setting-volume') as HTMLInputElement;
    const volVal = document.getElementById('setting-volume-val')!;
    volInput.addEventListener('input', () => {
      volVal.textContent = `${Math.round(Number(volInput.value) * 100)}%`;
    });

    const voiceVolInput = document.getElementById('setting-voice-volume') as HTMLInputElement | null;
    const voiceVolVal = document.getElementById('setting-voice-volume-val');
    voiceVolInput?.addEventListener('input', () => {
      if (voiceVolVal) {
        voiceVolVal.textContent = `${Math.round(Number(voiceVolInput.value) * 100)}%`;
      }
    });

    // Pause / Resume / Restart / Retry / Checkpoint
    document.getElementById('btn-resume-game')!.addEventListener('click', () => {
      this.resumeGame();
    });

    document.getElementById('btn-restart-from-pause')!.addEventListener('click', () => {
      this.pauseMenuEl.classList.add('hidden');
      SaveManager.clearSave();
      this.resetAndStartGame();
    });

    document.getElementById('btn-continue-checkpoint')?.addEventListener('click', () => {
      this.gameoverScreenEl.classList.add('hidden');
      if (!this.resumeFromSavedGame()) {
        this.resetAndStartGame();
      }
    });

    document.getElementById('btn-retry-game')!.addEventListener('click', () => {
      this.gameoverScreenEl.classList.add('hidden');
      SaveManager.clearSave();
      this.resetAndStartGame();
    });

    document.getElementById('btn-play-again')!.addEventListener('click', () => {
      this.endingScreenEl.classList.add('hidden');
      SaveManager.clearSave();
      this.resetAndStartGame();
    });

    document.getElementById('terminal-close-btn')!.addEventListener('click', () => {
      this.closeTerminalModal();
    });

    canvas.addEventListener('click', () => {
      if (
        this.isRunning &&
        !this.isPaused &&
        !this.isTerminalOpen &&
        !this.isJournalOpen &&
        !this.isInstructionCardOpen &&
        !this.isCinematicPlaying &&
        !document.pointerLockElement
      ) {
        this.requestPointerLockSafe(canvas);
      }
    });

    // Auto-pause when switching browser tabs or exiting pointer lock via ESC during active gameplay
    document.addEventListener('visibilitychange', () => {
      if (
        document.hidden &&
        this.isRunning &&
        !this.isPaused &&
        !this.isTerminalOpen &&
        !this.isJournalOpen &&
        !this.isInstructionCardOpen &&
        !this.isCinematicPlaying
      ) {
        this.togglePause();
      }
    });

    let hadPointerLock = false;
    document.addEventListener('pointerlockchange', () => {
      const hasLock = Boolean(document.pointerLockElement);
      if (
        hadPointerLock &&
        !hasLock &&
        !this.input.isTouchActive &&
        this.isRunning &&
        !this.isPaused &&
        !this.isTerminalOpen &&
        !this.isJournalOpen &&
        !this.isHowToOpen &&
        !this.isInstructionCardOpen &&
        !this.isCinematicPlaying
      ) {
        this.togglePause();
      }
      hadPointerLock = hasLock;
    });

    // Prevent accidental browser context menu during active gameplay / mobile long-press
    window.addEventListener('contextmenu', (e) => {
      if (this.isRunning && !this.isPaused) {
        e.preventDefault();
      }
    });
  }

  private syncSettingsToUI(): void {
    (document.getElementById('setting-quality') as HTMLSelectElement).value = this.settings.quality;
    (document.getElementById('setting-res-scale') as HTMLSelectElement).value = String(this.settings.resolutionScale);
    (document.getElementById('setting-shadows') as HTMLInputElement).checked = this.settings.shadowsEnabled;
    const enhVisEl = document.getElementById('setting-enhanced-visibility') as HTMLInputElement | null;
    if (enhVisEl) enhVisEl.checked = this.settings.enhancedVisibility;

    (document.getElementById('setting-volume') as HTMLInputElement).value = String(this.settings.masterVolume);
    document.getElementById('setting-volume-val')!.textContent = `${Math.round(this.settings.masterVolume * 100)}%`;

    const voiceEnEl = document.getElementById('setting-voice-enabled') as HTMLInputElement | null;
    if (voiceEnEl) voiceEnEl.checked = this.settings.voiceEnabled;
    const voiceVolEl = document.getElementById('setting-voice-volume') as HTMLInputElement | null;
    if (voiceVolEl) voiceVolEl.value = String(this.settings.voiceVolume);
    const voiceVolVal = document.getElementById('setting-voice-volume-val');
    if (voiceVolVal) voiceVolVal.textContent = `${Math.round(this.settings.voiceVolume * 100)}%`;
    const subEnEl = document.getElementById('setting-subtitles-enabled') as HTMLInputElement | null;
    if (subEnEl) subEnEl.checked = this.settings.subtitlesEnabled;

    (document.getElementById('setting-sensitivity') as HTMLInputElement).value = String(this.settings.mouseSensitivity);
    document.getElementById('setting-sensitivity-val')!.textContent = this.settings.mouseSensitivity.toFixed(1);
    (document.getElementById('setting-touch-sensitivity') as HTMLInputElement).value = String(this.settings.touchSensitivity);
    document.getElementById('setting-touch-sensitivity-val')!.textContent = this.settings.touchSensitivity.toFixed(1);
    (document.getElementById('setting-subtitle-size') as HTMLSelectElement).value = this.settings.subtitleSize;
    (document.getElementById('setting-crt') as HTMLInputElement).checked = this.settings.crtEnabled;
    (document.getElementById('setting-reduced-effects') as HTMLInputElement).checked = this.settings.reducedEffects;
    (document.getElementById('setting-high-contrast') as HTMLInputElement).checked = this.settings.highContrastPrompts;
    (document.getElementById('setting-key-interact') as HTMLSelectElement).value = this.settings.keyBindings.interact;
    (document.getElementById('setting-key-flashlight') as HTMLSelectElement).value = this.settings.keyBindings.flashlight;
    const arcKeyEl = document.getElementById('setting-key-arcpulse') as HTMLSelectElement | null;
    if (arcKeyEl) arcKeyEl.value = this.settings.keyBindings.arcPulse;
  }

  private readSettingsInputs(): void {
    const q = (document.getElementById('setting-quality') as HTMLSelectElement).value as QualityLevel;
    const resScale = parseFloat((document.getElementById('setting-res-scale') as HTMLSelectElement).value) || 1.0;
    const shadows = (document.getElementById('setting-shadows') as HTMLInputElement).checked;
    const enhVis = (document.getElementById('setting-enhanced-visibility') as HTMLInputElement | null)?.checked ?? false;
    const sens = parseFloat((document.getElementById('setting-sensitivity') as HTMLInputElement).value) || 1.0;
    const touchSens = parseFloat((document.getElementById('setting-touch-sensitivity') as HTMLInputElement).value) || 1.0;
    const vol = parseFloat((document.getElementById('setting-volume') as HTMLInputElement).value);
    const voiceEn = (document.getElementById('setting-voice-enabled') as HTMLInputElement | null)?.checked ?? true;
    const voiceVol = parseFloat((document.getElementById('setting-voice-volume') as HTMLInputElement | null)?.value ?? '0.85');
    const subEn = (document.getElementById('setting-subtitles-enabled') as HTMLInputElement | null)?.checked ?? true;
    const subSize = (document.getElementById('setting-subtitle-size') as HTMLSelectElement).value as SubtitleSize;
    const crt = (document.getElementById('setting-crt') as HTMLInputElement).checked;
    const reduced = (document.getElementById('setting-reduced-effects') as HTMLInputElement).checked;
    const highContrast = (document.getElementById('setting-high-contrast') as HTMLInputElement).checked;
    const keyInteract = (document.getElementById('setting-key-interact') as HTMLSelectElement).value;
    const keyFlashlight = (document.getElementById('setting-key-flashlight') as HTMLSelectElement).value;
    const keyArcPulse = (document.getElementById('setting-key-arcpulse') as HTMLSelectElement | null)?.value || 'KeyR';

    this.settings = {
      quality: q,
      resolutionScale: resScale,
      shadowsEnabled: shadows,
      mouseSensitivity: sens,
      touchSensitivity: touchSens,
      masterVolume: Number.isFinite(vol) ? vol : 0.8,
      crtEnabled: crt,
      reducedEffects: reduced,
      highContrastPrompts: highContrast,
      enhancedVisibility: enhVis,
      voiceEnabled: voiceEn,
      voiceVolume: Number.isFinite(voiceVol) ? voiceVol : 0.85,
      subtitlesEnabled: subEn,
      subtitleSize: subSize,
      difficulty: ((document.getElementById('setting-difficulty') as HTMLSelectElement)?.value as DifficultyLevel) || this.settings.difficulty || 'survivor',
      keyBindings: {
        ...this.settings.keyBindings,
        interact: keyInteract,
        flashlight: keyFlashlight,
        arcPulse: keyArcPulse
      }
    };
  }

  public applySettings(): void {
    this.input.setSensitivities(this.settings.mouseSensitivity, this.settings.touchSensitivity);
    this.input.setKeyBindings(this.settings.keyBindings);
    this.player.reducedEffects = this.settings.reducedEffects;
    this.sound.setMasterVolume(this.settings.masterVolume);
    this.echo.setVoiceAndSubtitles(
      this.settings.voiceEnabled,
      this.settings.voiceVolume * this.settings.masterVolume,
      this.settings.subtitlesEnabled
    );
    this.station.setEnhancedVisibility(this.settings.enhancedVisibility);

    // Update prompt key badge
    this.promptKeyBadgeEl.textContent = this.input.isTouchActive
      ? 'TAP'
      : this.settings.keyBindings.interact.replace('Key', '');

    // CRT & Accessibility classes
    const crtEl = document.getElementById('crt-overlay')!;
    crtEl.classList.toggle('crt-enabled', this.settings.crtEnabled && !this.settings.reducedEffects);

    document.body.classList.remove('subtitle-small', 'subtitle-medium', 'subtitle-large');
    document.body.classList.add(`subtitle-${this.settings.subtitleSize}`);
    document.body.classList.toggle('high-contrast-prompts', this.settings.highContrastPrompts);
    document.body.classList.toggle('enhanced-visibility', this.settings.enhancedVisibility);

    this.renderer.toneMappingExposure = this.auxPowerRestored
      ? this.settings.enhancedVisibility
        ? 1.48
        : 1.36
      : this.settings.enhancedVisibility
      ? 1.32
      : 1.15;

    const baseRatio = this.settings.quality === 'low' ? 0.85 : this.settings.quality === 'medium' ? 1.15 : 1.5;
    const finalRatio = Math.min(window.devicePixelRatio * this.settings.resolutionScale, baseRatio * this.settings.resolutionScale);
    this.renderer.setPixelRatio(Math.max(0.5, finalRatio));

    const enableShadows = this.settings.quality !== 'low' && this.settings.shadowsEnabled;
    this.renderer.shadowMap.enabled = enableShadows;
    this.player.setShadowQuality(enableShadows);
  }

  private applyPowerAndLightingState(online: boolean, triggerStartupSurge = false): void {
    this.auxPowerRestored = online;
    this.station.setAuxPowerState(online, triggerStartupSurge);
    document.body.classList.toggle('power-restored', online);
    this.renderer.toneMappingExposure = online
      ? this.settings.enhancedVisibility
        ? 1.48
        : 1.36
      : this.settings.enhancedVisibility
      ? 1.32
      : 1.15;

    this.powerStateEl.textContent = online ? 'PWR: AUX ONLINE' : 'PWR: RESERVE';
    this.powerStateEl.className = online ? 'power-online' : 'power-aux';
    this.station.updateDoorStatusIndicators(this.player.inventory, this.auxPowerRestored);
  }

  private startLoadingTransition(): void {
    this.mainMenuEl.classList.add('hidden');
    this.identityScreenEl?.classList.add('hidden');
    this.briefingScreenEl.classList.add('hidden');
    this.loadingScreenEl.classList.remove('hidden');

    const logEl = document.getElementById('loading-log')!;
    const barEl = document.getElementById('loading-bar-fill')!;

    const steps = [
      { pct: 30, text: 'EQUALIZING AIRLOCK A-01 PRESSURE...' },
      { pct: 65, text: `SYNCHRONIZING SUIT TELEMETRY FOR ${this.playerName.toUpperCase()}...` },
      { pct: 100, text: 'HANDSHAKE ESTABLISHED WITH AI CORE [ECHO v9.4]...' }
    ];

    let idx = 0;
    const interval = window.setInterval(() => {
      if (idx < steps.length) {
        barEl.style.width = `${steps[idx].pct}%`;
        logEl.textContent = steps[idx].text;
        this.sound.playPickupSound();
        idx++;
      } else {
        window.clearInterval(interval);
        this.loadingScreenEl.classList.add('hidden');
        this.resetAndStartGame();
      }
    }, 200);
  }

  public resetAndStartGame(): void {
    this.player.reset();
    this.echo.reset();
    this.echo.setPlayerName(this.playerName);
    this.creature.reset();
    this.tutorial.reset();
    this.sound.silenceDread();
    this.applyPowerAndLightingState(false, false);
    this.sublevelPowerRestored = false;
    this.station.setEndingVisualState('NONE');

    this.logsDiscovered = 0;
    this.openedDoors.clear();
    this.collectedItems.clear();
    this.discoveredLogsArchive = [];
    this.instructionCardsArchive = [];
    this.shownInstructionCardIds.clear();
    this.isInstructionCardOpen = false;
    this.activeInstructionCard = null;
    this.instructionCardModalEl?.classList.add('hidden');
    this.objectiveStage = 'EXIT_AIRLOCK';
    this.lastStepKey = '';
    this.startTime = performance.now();

    this.logsEl.textContent = '0/2';

    for (const item of this.station.interactables) {
      item.enabled = true;
      if (item.type === 'door' && item.doorMesh && item.doorClosedY !== undefined) {
        item.isOpen = false;
        item.doorMesh.position.y = item.doorClosedY;
        const col = this.station.colliders.find((c) => c.id === item.doorColliderId);
        if (col) col.enabled = true;
      }
      if (item.type === 'keycard' || item.type === 'battery' || item.type === 'oxygen' || item.type === 'audiolog') {
        item.mesh.parent!.visible = true;
      }
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isTerminalOpen = false;
    this.isJournalOpen = false;
    this.isHowToOpen = false;
    this.isCinematicPlaying = false;
    this.cinematicOverlayEl.classList.add('hidden');
    this.lockerOverlayEl.classList.add('hidden');
    this.hudEl.classList.remove('hidden');

    this.syncInputState();
    this.updateInventoryHUD();
    this.recomputeObjectiveStage(false);
    this.refreshSaveButtons();

    // Start Tutorial 1: "Move through the airlock."
    this.tutorial.showStep('TUT_MOVE', this.input.isTouchActive, this.settings.keyBindings);

    const canvas = document.getElementById('game-canvas')!;
    this.requestPointerLockSafe(canvas);

    this.echo.triggerOnce(
      'intro_airlock',
      `Welcome aboard, ${this.playerName}. I am ECHO, the station's central intelligence. Move forward to Airlock Bulkhead A-01 to enter NEXUS-09.`,
      8.0,
      false,
      'ECHO // AI TRANSMISSION',
      'high'
    );
  }

  public resumeFromSavedGame(): boolean {
    const saved = SaveManager.loadGame();
    if (!saved) return false;

    this.validateAndSetPlayerName(saved.playerName || 'Hale');
    this.resetAndStartGame();

    this.applyPowerAndLightingState(saved.auxPowerRestored, false);
    this.sublevelPowerRestored = Boolean(saved.sublevelPowerRestored);
    if (saved.upgrades) {
      for (const u of saved.upgrades) {
        this.player.applyUpgrade(u);
      }
    }

    this.player.oxygen = saved.oxygen;
    this.player.battery = saved.battery;
    if (typeof saved.arcCharges === 'number') {
      this.player.arcCharges = saved.arcCharges;
    }
    for (const k of saved.inventory) {
      this.player.inventory.add(k);
    }

    this.openedDoors = new Set(saved.openedDoors);
    this.collectedItems = new Set(saved.collectedItems);
    this.discoveredLogsArchive = [...saved.discoveredLogs];
    this.logsDiscovered = this.discoveredLogsArchive.filter((l) => l.id.startsWith('audiolog_')).length;
    this.logsEl.textContent = `${this.logsDiscovered}/2`;

    for (const item of this.station.interactables) {
      if (item.type === 'door' && this.openedDoors.has(item.id)) {
        item.isOpen = true;
        item.enabled = false;
        if (item.doorMesh && item.doorClosedY !== undefined) {
          item.doorMesh.position.y = item.doorClosedY + 3.05;
        }
        const col = this.station.colliders.find((c) => c.id === item.doorColliderId);
        if (col) col.enabled = false;
      } else if (this.collectedItems.has(item.id)) {
        item.enabled = false;
        if (item.mesh.parent) {
          item.mesh.parent.visible = false;
        }
      } else if (item.type === 'generator' && this.auxPowerRestored) {
        item.enabled = false;
      }
    }

    this.tutorial.restoreCompleted(saved.completedTutorials);
    this.updateInventoryHUD();
    this.station.updateDoorStatusIndicators(this.player.inventory, this.auxPowerRestored);
    this.recomputeObjectiveStage(false);

    // Place player at safe sector checkpoint for current objective
    if (this.objectiveStage === 'EXIT_AIRLOCK') {
      this.player.position.set(0, 1.7, 15.0);
    } else if (this.objectiveStage === 'FIND_SECURITY_CARD') {
      this.player.position.set(0, 1.7, 8.5);
    } else if (this.objectiveStage === 'EXPLORE_QUARTERS_FOR_GEN_KEY') {
      this.player.position.set(-4.5, 1.7, 5.0);
      if (!saved.creatureDefeated) {
        this.creature.spawn(new THREE.Vector3(0, 0, -5.0));
      }
    } else if (this.objectiveStage === 'RESTORE_AUX_POWER') {
      this.player.position.set(4.5, 1.7, 3.0);
      if (!saved.creatureDefeated) {
        this.creature.spawn(new THREE.Vector3(0, 0, -6.5));
      }
    } else if (this.objectiveStage === 'INVESTIGATE_LAB') {
      this.player.position.set(-5.0, 1.7, -9.0);
      if (!saved.creatureDefeated) {
        this.creature.spawn(new THREE.Vector3(0, 0, -14.0));
      }
    } else if (this.objectiveStage === 'REACH_COMMS_ROOM') {
      this.player.position.set(5.0, 1.7, -11.0);
      if (!saved.creatureDefeated) {
        this.creature.spawn(new THREE.Vector3(0, 0, -17.5));
      }
    } else {
      this.player.position.set(0, 1.7, -26.5);
      if (!saved.creatureDefeated) {
        this.creature.spawn(new THREE.Vector3(0, 0, -15));
      }
    }

    if (saved.creatureDefeated) {
      this.creature.hitsTaken = saved.creatureHits || this.creature.maxHits;
      this.creature.defeated = true;
      this.creature.state = 'DEFEATED';
      this.creature.active = false;
      this.creature.group.visible = false;
    } else if (typeof saved.creatureHits === 'number' && saved.creatureHits > 0) {
      this.creature.hitsTaken = saved.creatureHits;
    }

    this.player.syncCameraToPosition();

    this.showToast(`CHECKPOINT RESTORED — WELCOME BACK, ${this.playerName.toUpperCase()}`);
    this.echo.triggerOnce(
      `resume_${Date.now()}`,
      `Telemetry link restored, ${this.playerName}. Resuming mission from your current sector.`,
      5.5,
      false,
      'ECHO // CHECKPOINT RESTORED',
      'normal'
    );
    return true;
  }

  public persistSaveState(): void {
    if (!this.isRunning) return;
    const data: SavedGameData = {
      version: 1,
      timestamp: Date.now(),
      playerName: this.playerName,
      objectiveStage: this.objectiveStage,
      inventory: Array.from(this.player.inventory),
      auxPowerRestored: this.auxPowerRestored,
      sublevelPowerRestored: this.sublevelPowerRestored,
      upgrades: Array.from(this.player.upgrades) as any,
      openedDoors: Array.from(this.openedDoors),
      collectedItems: Array.from(this.collectedItems),
      discoveredLogs: this.discoveredLogsArchive,
      completedTutorials: this.tutorial.getCompleted(),
      oxygen: Math.round(this.player.oxygen),
      battery: Math.round(this.player.battery),
      arcCharges: this.player.arcCharges,
      creatureDefeated: this.creature.defeated,
      creatureHits: this.creature.hitsTaken
    };
    SaveManager.saveGame(data);
    this.refreshSaveButtons();
  }

  private syncInputState(): void {
    this.creature.isPausedByInstruction =
      this.isPaused ||
      this.isInstructionCardOpen ||
      this.isTerminalOpen ||
      this.isJournalOpen ||
      this.isHowToOpen;

    this.player.inputEnabled =
      this.isRunning &&
      !this.isPaused &&
      !this.isInstructionCardOpen &&
      !this.isTerminalOpen &&
      !this.isJournalOpen &&
      !this.isHowToOpen &&
      !this.isCinematicPlaying;
  }

  public showInstructionCard(card: InstructionCardData): void {
    if (!this.instructionCardsArchive.some((c) => c.id === card.id)) {
      this.instructionCardsArchive.push(card);
    }
    this.shownInstructionCardIds.add(card.id);
    this.activeInstructionCard = card;
    this.isInstructionCardOpen = true;
    this.syncInputState();

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    this.icCategoryEl.textContent = card.tag;
    this.icHeadingEl.textContent = card.title;
    this.icWhatEl.textContent = card.what;
    this.icWhereEl.textContent = card.where;
    this.icWhyEl.textContent = card.why;
    this.icControlEl.textContent = card.control;
    this.instructionCardModalEl.classList.remove('hidden');

    this.echo.voice.speak(
      `ic_voice_${card.id}`,
      `${card.title}. ${card.what} Location: ${card.where}.`,
      'high',
      false
    );
  }

  public acknowledgeInstructionCard(): void {
    if (!this.isInstructionCardOpen) return;
    this.isInstructionCardOpen = false;
    this.activeInstructionCard = null;
    this.instructionCardModalEl.classList.add('hidden');
    this.syncInputState();
    this.sound.playPickupSound();
    const canvas = document.getElementById('game-canvas')!;
    this.requestPointerLockSafe(canvas);
  }

  private togglePause(): void {
    if (!this.isRunning || this.isCinematicPlaying) return;
    if (this.isInstructionCardOpen) {
      this.acknowledgeInstructionCard();
      return;
    }
    if (this.isTerminalOpen) {
      this.closeTerminalModal();
      return;
    }
    if (this.isJournalOpen) {
      this.closeJournalModal();
      return;
    }
    if (this.isHowToOpen) {
      this.isHowToOpen = false;
      this.howToModalEl.classList.add('hidden');
      this.pauseMenuEl.classList.remove('hidden');
      return;
    }

    const now = performance.now();
    if (now - this.lastPauseToggleTime < 220) return;
    this.lastPauseToggleTime = now;

    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.isPaused = true;
      this.syncInputState();
      this.sound.silenceDread();
      this.persistSaveState();
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this.pauseMenuEl.classList.remove('hidden');
    }
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.syncInputState();
    this.pauseMenuEl.classList.add('hidden');
    this.settingsMenuEl.classList.add('hidden');
    this.howToModalEl.classList.add('hidden');
    this.journalModalEl.classList.add('hidden');
    const canvas = document.getElementById('game-canvas')!;
    this.requestPointerLockSafe(canvas);
  }

  public openJournalModal(): void {
    this.isJournalOpen = true;
    this.syncInputState();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.populateJournalUI();
    this.journalModalEl.classList.remove('hidden');
  }

  public closeJournalModal(returnToPause = false): void {
    this.isJournalOpen = false;
    this.journalModalEl.classList.add('hidden');
    if (returnToPause || this.isPaused) {
      this.pauseMenuEl.classList.remove('hidden');
    } else {
      this.syncInputState();
      const canvas = document.getElementById('game-canvas')!;
      this.requestPointerLockSafe(canvas);
    }
  }

  private populateJournalUI(): void {
    document.getElementById('journal-primary-text')!.textContent = this.primaryObjEl.textContent;
    document.getElementById('journal-task-text')!.textContent = this.objectiveEl.textContent;
    const jDirEl = document.getElementById('journal-direction-text');
    const jWhyEl = document.getElementById('journal-why-text');
    if (jDirEl) jDirEl.textContent = this.directionEl.textContent;
    if (jWhyEl) jWhyEl.textContent = this.whyEl.textContent;

    const completedSteps: string[] = [];
    if (this.openedDoors.has('door_airlock')) {
      completedSteps.push('Step 1: Boarded NEXUS-09 & Exited Airlock A-01 into Central Spine Corridor');
    }
    if (this.openedDoors.has('door_security')) {
      completedSteps.push('Step 2a: Accessed Security Hub (Sector B-02 West)');
    }
    if (this.player.inventory.has('SEC_CARD_L1')) {
      completedSteps.push('Step 2b: Recovered Level-1 Security Keycard (SEC_CARD_L1)');
    }
    if (this.openedDoors.has('door_quarters')) {
      completedSteps.push('Step 3: Unlocked Crew Habitation (Sector C-03 East)');
    }
    if (this.player.inventory.has('MAINT_KEY_L2')) {
      completedSteps.push('Step 4: Collected Reactor Maintenance Key (MAINT_KEY_L2)');
    }
    if (this.openedDoors.has('door_generator')) {
      completedSteps.push('Step 5a: Unlocked Auxiliary Reactor (Sector D-04 West)');
    }
    if (this.auxPowerRestored) {
      completedSteps.push('Step 5b: Restored Auxiliary Reactor Power in Sector D-04');
    }
    if (this.openedDoors.has('door_lab')) {
      completedSteps.push('Step 6a: Unlocked Xeno-Signal Laboratory (Sector E-05 East)');
    }
    if (this.player.inventory.has('COMMS_OVERRIDE_L3')) {
      completedSteps.push('Step 6b: Recovered Level-3 Comms Override (COMMS_OVERRIDE_L3)');
    }
    if (this.openedDoors.has('door_comms')) {
      completedSteps.push('Step 7: Unlocked Communications Bridge (Sector F-06 North)');
    }
    if (this.creature.defeated) {
      completedSteps.push('Bonus: Permanently Neutralized the Signal Stalker with ARC PULSE Overloads');
    }

    const compListEl = document.getElementById('journal-completed-list')!;
    compListEl.innerHTML = '';
    if (completedSteps.length === 0) {
      compListEl.innerHTML = '<li class="muted-note">No tasks completed yet. Follow your current directive.</li>';
    } else {
      for (const label of completedSteps) {
        const li = document.createElement('li');
        li.textContent = `[✓] ${label}`;
        compListEl.appendChild(li);
      }
    }

    const keysEl = document.getElementById('journal-keycards-list')!;
    if (this.player.inventory.size === 0) {
      keysEl.textContent = 'No security clearance cards acquired yet.';
    } else {
      keysEl.textContent = Array.from(this.player.inventory).join('  //  ');
    }

    // Populate archived instruction cards in Journal
    const instListEl = document.getElementById('journal-instructions-list');
    if (instListEl) {
      instListEl.innerHTML = '';
      const currentCard = this.getInstructionCardForStage();
      if (!this.instructionCardsArchive.some((c) => c.id === currentCard.id)) {
        this.instructionCardsArchive.push(currentCard);
      }
      for (const ic of this.instructionCardsArchive) {
        const div = document.createElement('div');
        div.className = 'journal-log-item';
        const strong = document.createElement('strong');
        strong.textContent = `${ic.tag} — ${ic.title}`;
        const bodyDiv = document.createElement('div');
        bodyDiv.textContent = `WHAT: ${ic.what} | WHERE: ${ic.where} | WHY: ${ic.why} | CONTROL: ${ic.control}`;
        div.appendChild(strong);
        div.appendChild(bodyDiv);
        instListEl.appendChild(div);
      }
    }

    const logsEl = document.getElementById('journal-logs-list')!;
    logsEl.innerHTML = '';
    if (this.discoveredLogsArchive.length === 0) {
      logsEl.innerHTML = '<p class="muted-note">No crew recordings or terminal logs archived yet.</p>';
    } else {
      for (const entry of this.discoveredLogsArchive) {
        const div = document.createElement('div');
        div.className = 'journal-log-item';
        const strong = document.createElement('strong');
        strong.textContent = entry.title;
        const bodyDiv = document.createElement('div');
        bodyDiv.textContent = `${entry.body.slice(0, 260)}${entry.body.length > 260 ? '...' : ''}`;
        div.appendChild(strong);
        div.appendChild(bodyDiv);
        logsEl.appendChild(div);
      }
    }
  }

  private showToast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');
    this.toastTimer = 3.5;
  }

  private handleScannerPing(): void {
    const target = this.getCurrentObjectiveTarget();
    this.scanner.triggerPing(this.player.position, target.pos, this.creature.position, this.creature.active);
    this.player.addNoiseSpike(8.5);
    if (this.creature.active && this.player.position.distanceTo(this.creature.position) < 20) {
      this.creature.notifyNoise(this.player.position);
    }
  }

  public handleArcPulse(): {
    activated: boolean;
    hitCreature: boolean;
    defeatedCreature: boolean;
    reason?: string;
  } {
    if (this.player.isHiding) {
      this.showToast('EXIT LOCKER BEFORE DISCHARGING ARC PULSE');
      return { activated: false, hitCreature: false, defeatedCreature: false, reason: 'HIDING' };
    }

    const fired = this.player.consumeArcPulse();
    if (!fired) {
      this.sound.playDoorSound(true);
      if (this.player.arcCooldown > 0) {
        this.showToast(`ARC CAPACITOR CYCLING (${this.player.arcCooldown.toFixed(1)}s)`);
        return { activated: false, hitCreature: false, defeatedCreature: false, reason: 'COOLDOWN' };
      } else {
        const pct = Math.round(this.player.arcRechargeProgress);
        this.showToast(`ARC PULSE DEPLETED — RECHARGING CAPACITOR (${pct}%)`);
        return { activated: false, hitCreature: false, defeatedCreature: false, reason: 'NO_CHARGES' };
      }
    }

    this.tutorial.completeStep('TUT_ARC_PULSE');
    if (this.arcFlashOverlayEl) {
      this.arcFlashOverlayEl.style.opacity = '0.85';
    }
    this.arcFlashTimer = 0.22;
    this.player.addNoiseSpike(9.5);

    if (this.creature.active && !this.creature.defeated) {
      const dx = this.creature.position.x - this.player.position.x;
      const dz = this.creature.position.z - this.player.position.z;
      const dist = Math.hypot(dx, dz);

      const forwardX = -Math.sin(this.player.yaw);
      const forwardZ = -Math.cos(this.player.yaw);
      const dirX = dist > 0.001 ? dx / dist : forwardX;
      const dirZ = dist > 0.001 ? dz / dist : forwardZ;
      const forwardDot = forwardX * dirX + forwardZ * dirZ;

      // Effective discharge range: up to 7.8m in front cone or 4.5m omnidirectional shockwave
      if (dist <= 7.8 && (dist <= 4.5 || forwardDot >= -0.15)) {
        const room = this.station.getRoomAt(this.player.position.x, this.player.position.z);
        const inPoweredReactor = this.auxPowerRestored && room?.id === 'generator';
        const outcome = this.creature.applyArcPulseHit(inPoweredReactor);

        if (outcome.defeated) {
          this.sound.playArcPulseSound(true);
          this.sound.playCreatureDefeatedSound();
          this.showToast('⚡ SIGNAL STALKER PERMANENTLY NEUTRALIZED — BIOMECHANICAL CORE COLLAPSED');
          this.echo.notifyArcPulseHit(outcome.hitsTaken, true);
          this.persistSaveState();
          return { activated: true, hitCreature: true, defeatedCreature: true };
        } else if (outcome.stunned) {
          this.sound.playArcPulseSound(true);
          const remaining = outcome.hitsRemaining;
          this.showToast(
            `⚡ ARC PULSE HIT — ENTITY STUNNED (${outcome.hitsTaken}/${this.creature.maxHits} OVERLOADS | ${remaining} MORE TO NEUTRALIZE)`
          );
          this.echo.notifyArcPulseHit(outcome.hitsTaken, false);
          this.persistSaveState();
          return { activated: true, hitCreature: true, defeatedCreature: false };
        }
      }
    }

    this.sound.playArcPulseSound(false);
    this.showToast('⚡ ARC PULSE DISCHARGED — NO HOSTILE TARGET IN RANGE (MAX 7.5M)');
    return { activated: true, hitCreature: false, defeatedCreature: false, reason: 'OUT_OF_RANGE' };
  }

  public handleInteraction(item: InteractableItem): void {
    this.tutorial.completeStep('TUT_INTERACT');

    switch (item.type) {
      case 'door': {
        if (item.requiresPower && !this.auxPowerRestored) {
          this.sound.playDoorSound(true);
          this.showToast('BULKHEAD OFFLINE — RESTORE AUXILIARY POWER IN SECTOR D-04');
          this.echo.notifyLockedDoorAttempt(item.requiredKey, true);
          return;
        }
        if (item.requiredKey && !this.player.inventory.has(item.requiredKey)) {
          this.sound.playDoorSound(true);
          this.showToast(`ACCESS DENIED — REQUIRES CLEARANCE: ${item.requiredKey}`);
          this.echo.notifyLockedDoorAttempt(item.requiredKey, false);
          return;
        }

        item.isOpen = true;
        item.enabled = false;
        this.openedDoors.add(item.id);
        this.sound.playDoorSound(false);
        this.player.addNoiseSpike(5.0);

        // Prevent unavoidable point-blank doorway ambushes without teleporting the creature out of the corridor
        this.creature.setGracePeriod(2.4);
        this.creature.ensureSafeDistanceFromPlayer(this.player.position, 3.6);

        const col = this.station.colliders.find((c) => c.id === item.doorColliderId);
        if (col) col.enabled = false;

        this.station.updateDoorStatusIndicators(this.player.inventory, this.auxPowerRestored);
        this.recomputeObjectiveStage(true);
        this.persistSaveState();
        break;
      }

      case 'keycard': {
        if (item.keycardGrant) {
          this.player.inventory.add(item.keycardGrant);
          this.collectedItems.add(item.id);
          item.enabled = false;
          item.mesh.parent!.visible = false;
          this.sound.playPickupSound();
          this.updateInventoryHUD();
          this.station.updateDoorStatusIndicators(this.player.inventory, this.auxPowerRestored);
          this.showToast(`ACQUIRED CLEARANCE: ${item.keycardGrant}`);

          this.creature.setGracePeriod(2.4);
          this.recomputeObjectiveStage(true);

          if (item.keycardGrant === 'SEC_CARD_L1') {
            this.sound.playDistantMetallicImpact();
            if (!this.creature.active && !this.creature.defeated) {
              // First encounter: spawn in the Central Spine Corridor heading South toward the Security / Habitation junction
              this.creature.spawn(new THREE.Vector3(0, 0, -4.5));
              this.creature.notifyNoise(new THREE.Vector3(0, 0, 3.5));
              this.creature.setGracePeriod(2.8);
            }
            this.echo.triggerOnce(
              'got_l1',
              `Level-1 Security Clearance acquired, ${this.playerName}. Warning: motion sensors just triggered in the Central Spine Corridor. Proceed carefully across to Crew Habitation C-03 (East) and keep your ARC PULSE [R] ready.`,
              8.0,
              true,
              'ECHO // MOTION ALERT & DIRECTIVE',
              'high'
            );
          } else if (item.keycardGrant === 'MAINT_KEY_L2') {
            if (!this.creature.defeated) {
              if (!this.creature.active) {
                this.creature.spawn(new THREE.Vector3(0, 0, -5.5));
              } else if (
                Math.abs(this.creature.position.x) > 2.2 ||
                this.creature.position.z < -12 ||
                this.creature.position.z > 6.5
              ) {
                this.creature.position.set(0, 0, -5.5);
                this.creature.group.position.copy(this.creature.position);
              }
              this.creature.notifyNoise(new THREE.Vector3(0, 0, 1.5));
            }
            this.creature.setGracePeriod(3.0);
            this.tutorial.showStep('TUT_ARC_PULSE', this.input.isTouchActive, this.settings.keyBindings);
            this.echo.triggerOnce(
              'got_l2',
              `${this.playerName}, I need you to restore auxiliary power. Be careful, ${this.playerName}: motion detected in the Central Corridor ahead. Your suit's ARC PULSE capacitor is armed if the specimen gets too close.`,
              8.5,
              true,
              'ECHO // THREAT & POWER DIRECTIVE',
              'high'
            );
          } else if (item.keycardGrant === 'COMMS_OVERRIDE_L3') {
            if (!this.creature.defeated) {
              if (!this.creature.active) {
                this.creature.spawn(new THREE.Vector3(0, 0, -17.5));
              } else if (this.creature.position.z > -8.0 || Math.abs(this.creature.position.x) > 2.2) {
                this.creature.position.set(0, 0, -17.5);
                this.creature.group.position.copy(this.creature.position);
              }
              this.creature.notifyNoise(new THREE.Vector3(0, 0, -11.5));
            }
            this.echo.triggerOnce(
              'got_l3',
              `${this.playerName}, I have detected an unusual transmission in the lab logs, and you now hold the Level-3 Comms Passkey. Head north to the Communications Bridge and transmit the signal.`,
              8.0,
              true,
              'ECHO // UPLINK PRIORITY',
              'high'
            );
          }
          this.persistSaveState();
        }
        break;
      }

      case 'battery': {
        this.player.battery = Math.min(100, this.player.battery + 65);
        this.player.rechargeArcCapacitor(1);
        this.collectedItems.add(item.id);
        item.enabled = false;
        item.mesh.parent!.visible = false;
        this.sound.playPickupSound();
        this.showToast('TORCH BATTERY (+65%) & ARC PULSE CAPACITOR (+1 CHARGE) RECHARGED');
        this.persistSaveState();
        break;
      }

      case 'oxygen': {
        this.player.oxygen = Math.min(100, this.player.oxygen + 45);
        this.collectedItems.add(item.id);
        item.enabled = false;
        item.mesh.parent!.visible = false;
        this.sound.playPickupSound();
        this.showToast('O2 SUPPLY REPLENISHED (+45%)');
        this.persistSaveState();
        break;
      }

      case 'terminal':
      case 'audiolog': {
        this.sound.playPickupSound();
        this.creature.setGracePeriod(2.2);
        const title = item.terminalTitle || item.label;
        const body = item.terminalBody || '';
        if (!this.discoveredLogsArchive.some((l) => l.id === item.id)) {
          this.discoveredLogsArchive.push({ id: item.id, title, body });
        }

        if (item.type === 'audiolog') {
          this.collectedItems.add(item.id);
          this.logsDiscovered = this.discoveredLogsArchive.filter((l) => l.id.startsWith('audiolog_')).length;
          this.logsEl.textContent = `${this.logsDiscovered}/2`;
          item.enabled = false;
          item.mesh.parent!.visible = false;
        }
        this.openTerminalModal(title, body);
        this.persistSaveState();

        if (item.id === 'audiolog_vance') {
          this.echo.triggerOnce(
            'after_vance_log',
            `Disregard Chief Engineer Vance's recording, ${this.playerName}. Crew members experienced severe auditory hallucinations prior to life-support failure. Please proceed to the Reactor.`,
            8.0,
            true,
            'ECHO // PSYCH EVALUATION OVERRIDE',
            'high'
          );
        } else if (item.id === 'audiolog_thorne') {
          this.echo.triggerOnce(
            'after_thorne_log',
            `Dr. Thorne lacked the vision to understand the Signal, ${this.playerName}. The pattern makes us eternal. Bring the Level-3 Passkey to the Bridge.`,
            9.0,
            true,
            'ECHO // CONVERGENCE PROTOCOL',
            'high'
          );
        }
        break;
      }

      case 'upgrade_station': {
        if (item.upgradeGrant && !this.player.upgrades.has(item.upgradeGrant)) {
          this.player.applyUpgrade(item.upgradeGrant);
          item.enabled = false;
          item.mesh.visible = false;
          this.sound.playGeneratorPowerUp();
          this.showToast(`SUIT UPGRADE ACQUIRED: ${item.upgradeGrant ? item.upgradeGrant.replace(/_/g, " ") : "SYSTEM OPTIMIZED"}`);
          this.persistSaveState();
        }
        break;
      }

      case 'sublevel_breaker': {
        if (this.sublevelPowerRestored) return;
        this.sublevelPowerRestored = true;
        item.enabled = false;
        this.sound.playGeneratorPowerUp();
        this.showToast('SECONDARY COOLANT BREAKER ENGAGED — BIOSAFETY CONTAINMENT ONLINE');
        this.creature.setGracePeriod(3.0);
        this.recomputeObjectiveStage(true);
        if (!this.creature.defeated) {
          this.creature.setClass('BRUTE', this.settings.difficulty);
          this.creature.spawn(new THREE.Vector3(0, 0, -11));
          this.creature.notifyNoise(new THREE.Vector3(-16, 0, -9));
        }
        this.echo.triggerOnce(
          'coolant_restored',
          `Secondary coolant online, ${this.playerName}! Biosafety containment online. Warning: bio-acoustic spike in Xeno-Lab E-05.`,
          8.5,
          true,
          'ECHO // COOLANT ONLINE',
          'high'
        );
        this.persistSaveState();
        break;
      }

      case 'generator': {
        if (this.auxPowerRestored) return;
        item.enabled = false;
        this.applyPowerAndLightingState(true, true);

        this.sound.playGeneratorPowerUp();
        this.showToast('AUXILIARY POWER RESTORED — FULL STATION ILLUMINATION & BULKHEADS ONLINE');
        this.creature.setGracePeriod(3.2);
        this.recomputeObjectiveStage(true);

        if (!this.creature.defeated) {
          if (!this.creature.active) {
            this.creature.spawn(new THREE.Vector3(0, 0, -14.5));
          } else {
            // Ensure creature approaches visibly down the Central Corridor toward the Reactor / Lab junction
            this.creature.position.set(0, 0, -14.5);
            this.creature.group.position.copy(this.creature.position);
            this.creature.state = 'PATROL';
          }
          this.creature.notifyNoise(new THREE.Vector3(-2.5, 0, -9.0));
        }
        this.tutorial.showStep('TUT_STEALTH', this.input.isTouchActive, this.settings.keyBindings);

        this.echo.triggerOnce(
          'power_restored',
          `Auxiliary power restored, ${this.playerName}! Full station lighting is now permanently online across all sectors. Alert: turbine surge has attracted the specimen toward Sector D. Use your ARC PULSE or hide in the locker, then cross to Xeno-Lab E-05!`,
          9.0,
          true,
          'ECHO // AUX POWER & LIGHTING ONLINE',
          'high'
        );
        this.persistSaveState();
        break;
      }

      case 'locker': {
        this.player.enterLocker(item);
        this.tutorial.completeStep('TUT_STEALTH');
        break;
      }

      case 'final_trust': {
        this.startEndingCinematic('TRUST_ECHO');
        break;
      }

      case 'final_reject': {
        this.startEndingCinematic('REJECT_ECHO');
        break;
      }
    }

    this.player.updateInteractionRaycast(this.station.interactables);
  }

  public getInstructionCardForStage(): InstructionCardData {
    const isTouch = this.input.isTouchActive;
    const interactKey = this.settings.keyBindings.interact.replace('Key', '');
    const pulseKey = this.settings.keyBindings.arcPulse.replace('Key', '');
    const ctrlInteract = isTouch ? 'Tap [ INTERACT ]' : `Press ${interactKey} to Interact`;
    const ctrlPulse = isTouch
      ? `Tap [ PULSE ] or [ INTERACT ]`
      : `Press ${interactKey} to Interact | Press ${pulseKey} or Right-Click for ARC PULSE`;

    switch (this.objectiveStage) {
      case 'EXIT_AIRLOCK':
        return {
          id: 'CARD_1_AIRLOCK',
          tag: 'MISSION UPDATE // STEP 1 OF 8',
          title: 'EXIT THE AIRLOCK',
          what: 'Activate the illuminated Airlock Control Panel to unseal Bulkhead A-01.',
          where: 'Docking Airlock — Sector A-01 (North bulkhead).',
          why: 'Enter the Central Spine Corridor of NEXUS-09 to begin your rescue and diagnostic mission.',
          control: ctrlInteract,
          essential: true
        };
      case 'FIND_SECURITY_CARD':
        return {
          id: 'CARD_2_SECURITY',
          tag: 'MISSION UPDATE // STEP 2 OF 8',
          title: 'ACQUIRE LEVEL-1 SECURITY CLEARANCE',
          what: 'Open Security Hub B-02 and recover the glowing green SEC_CARD_L1 keycard.',
          where: 'Security Hub — Sector B-02 (West Corridor Wall, z = 5).',
          why: 'Level-1 clearance is required to unlock Crew Habitation C-03 and Xeno-Lab E-05.',
          control: `${ctrlInteract} | Press F or tap TORCH for Flashlight`,
          essential: true
        };
      case 'EXPLORE_QUARTERS_FOR_GEN_KEY':
        return {
          id: 'CARD_3_QUARTERS',
          tag: 'MISSION UPDATE // STEP 3 & 4 OF 8',
          title: 'LOCATE REACTOR MAINTENANCE KEYCARD',
          what: 'Unlock Crew Habitation C-03 with SEC_CARD_L1 and collect MAINT_KEY_L2 from the central desk.',
          where: 'Crew Habitation — Sector C-03 (East Corridor Wall, z = 3).',
          why: 'Chief Engineer Vance locked the Auxiliary Reactor behind Level-2 maintenance clearance.',
          control: ctrlInteract,
          essential: true
        };
      case 'RESTORE_AUX_POWER':
        return {
          id: 'CARD_5_AUX_POWER',
          tag: 'MISSION UPDATE // STEP 5 OF 10',
          title: 'RESTORE AUXILIARY POWER',
          what: 'Locate and activate the station’s auxiliary generator breaker console.',
          where: 'Generator Room — Engineering Sector D-04 (West Corridor Wall, z = -9).',
          why: 'Without auxiliary power, full station lighting, Xeno-Lab E-05, and the Communications Bridge cannot function.',
          control: ctrlPulse,
          essential: true
        };
      case 'EXPLORE_SUBLEVELS':
        return {
          id: 'CARD_5B_SUBLEVELS',
          tag: 'MISSION UPDATE // STEP 6 OF 10',
          title: 'BREACH SUBLEVEL S-01 MAINTENANCE TUNNELS',
          what: 'Use SEC_CARD_L1 to unlock the Sublevel Maintenance door in Security B-02.',
          where: 'Security Hub B-02 (West Wall, x = -13, z = 5).',
          why: 'Locate the Sublevel Cooling Keycard (SUBLEVEL_KEY_L2B) to reboot primary life-support.',
          control: ctrlInteract,
          essential: true
        };
      case 'RESTORE_SUBLEVEL_COOLING':
        return {
          id: 'CARD_5C_COOLING',
          tag: 'MISSION UPDATE // STEP 7 OF 10',
          title: 'ACTIVATE SUBLEVEL COOLING BREAKER',
          what: 'Breach Sublevel S-02 Cooling Core and activate the secondary coolant breaker.',
          where: 'Sublevel Cooling Infrastructure (Sector S-02, x = -23, z = -9).',
          why: 'Stabilize reactor temperatures and unlock Biosafety Containment X-01.',
          control: ctrlPulse,
          essential: true
        };
      case 'INVESTIGATE_LAB':
        return {
          id: 'CARD_6_LAB',
          tag: 'MISSION UPDATE // STEP 6 OF 8',
          title: 'INVESTIGATE THE UNIDENTIFIED TRANSMISSION',
          what: 'Enter Xeno-Signal Lab E-05, review Dr. Thorne’s log, and recover COMMS_OVERRIDE_L3.',
          where: 'Xeno-Signal Lab — Research Sector E-05 (East Corridor Wall, z = -11).',
          why: 'Uncover the truth behind ECHO’s signal and obtain Level-3 Bridge override clearance.',
          control: ctrlPulse,
          essential: true
        };
      case 'REACH_COMMS_ROOM':
        return {
          id: 'CARD_7_BRIDGE',
          tag: 'MISSION UPDATE // STEP 7 OF 8',
          title: 'UNLOCK THE COMMUNICATIONS BRIDGE',
          what: 'Use COMMS_OVERRIDE_L3 to unseal the northern Bridge bulkhead.',
          where: 'Communications Bridge — Sector F-06 (North Corridor End, z = -25).',
          why: 'Gain access to the high-gain transmitter array and ECHO’s central AI core.',
          control: ctrlPulse,
          essential: true
        };
      case 'FINAL_DECISION':
        return {
          id: 'CARD_8_DECISION',
          tag: 'MISSION UPDATE // STEP 8 OF 8',
          title: 'DECIDE THE FATE OF NEXUS-09',
          what: 'Choose between the Left Console (Transmit ECHO’s Signal) or Right Console (Purge ECHO & Escape).',
          where: 'Communications Bridge — Sector F-06 (North Platform, z = -32).',
          why: 'Your final choice determines whether the alien signal reaches Earth or is destroyed forever.',
          control: ctrlInteract,
          essential: true
        };
    }
  }

  private getProgressiveStepDetails(): {
    stepKey: string;
    stepBadge: string;
    missionTitle: string;
    primary: string;
    action: string;
    direction: string;
    why: string;
    targetName: string;
    targetPos: THREE.Vector3;
    completedSummary?: string;
  } {
    switch (this.objectiveStage) {
      case 'EXIT_AIRLOCK':
        return {
          stepKey: 'STEP_1_AIRLOCK',
          stepBadge: 'MISSION 01 // STEP 1 OF 8',
          missionTitle: 'MISSION 01 — THE ARRIVAL',
          primary: 'Exit the airlock.',
          action: 'Interact with the illuminated Airlock Control Panel.',
          direction: 'Approach the illuminated control panel beside the airlock door (North).',
          why: 'Unseal Bulkhead A-01 to enter the Central Spine Corridor.',
          targetName: 'AIRLOCK A-01 PANEL',
          targetPos: this._objectiveTargetPos.set(0, 1.5, 11)
        };

      case 'FIND_SECURITY_CARD':
        if (!this.openedDoors.has('door_security')) {
          return {
            stepKey: 'STEP_2A_SEC_DOOR',
            stepBadge: 'MISSION 01 // STEP 2 OF 8',
            missionTitle: 'MISSION 01 — THE ARRIVAL',
            primary: 'Access station security.',
            action: 'Open the Security Hub B-02 bulkhead on the West corridor wall.',
            direction: 'Follow the corridor lights North to Security Hub B-02 (West wall, z = 5).',
            why: 'The Level-1 security keycard is stored inside the Security Hub.',
            targetName: 'SECURITY DOOR B-02',
            targetPos: this._objectiveTargetPos.set(-3, 1.5, 5),
            completedSummary: 'AIRLOCK EXITED — PROCEED NORTH TO SECURITY HUB B-02 (WEST)'
          };
        }
        return {
          stepKey: 'STEP_2B_SEC_KEY',
          stepBadge: 'MISSION 01 // STEP 2 OF 8',
          missionTitle: 'MISSION 01 — THE ARRIVAL',
          primary: 'Access station security.',
          action: 'Locate and take the glowing green Level-1 Security Keycard (SEC_CARD_L1).',
          direction: 'Enter Security Hub B-02 and approach the central supply table.',
          why: 'Grants Level-1 clearance to unlock Crew Habitation and Xeno-Lab bulkheads.',
          targetName: 'SEC_CARD_L1 TABLE',
          targetPos: this._objectiveTargetPos.set(-7.5, 1.0, 5.0),
          completedSummary: 'SECURITY HUB OPEN — TAKE SEC_CARD_L1 FROM CENTRAL TABLE'
        };

      case 'EXPLORE_QUARTERS_FOR_GEN_KEY':
        if (!this.openedDoors.has('door_quarters')) {
          return {
            stepKey: 'STEP_3_HAB_DOOR',
            stepBadge: 'MISSION 01 // STEP 3 OF 8',
            missionTitle: 'MISSION 01 — THE ARRIVAL',
            primary: 'Investigate the crew quarters.',
            action: 'Use SEC_CARD_L1 to unlock the Crew Habitation C-03 door.',
            direction: 'Return to the main corridor and find the Habitation entrance (East wall, z = 3).',
            why: 'Gain access to Crew Habitation where Chief Vance hid the maintenance key.',
            targetName: 'HABITATION DOOR C-03',
            targetPos: this._objectiveTargetPos.set(3, 1.5, 3),
            completedSummary: 'SEC_CARD_L1 ACQUIRED — UNLOCK CREW HABITATION C-03 (EAST)'
          };
        }
        return {
          stepKey: 'STEP_4_MAINT_KEY',
          stepBadge: 'MISSION 02 // STEP 4 OF 8',
          missionTitle: 'MISSION 02 — THE SILENCE',
          primary: 'Find the maintenance key.',
          action: 'Collect MAINT_KEY_L2 from the central desk in Crew Quarters.',
          direction: 'Search the central desk inside Crew Habitation C-03 (East).',
          why: 'Required to unlock the Auxiliary Reactor in Sector D-04.',
          targetName: 'MAINT_KEY_L2 DESK',
          targetPos: this._objectiveTargetPos.set(8.5, 1.0, 2.6),
          completedSummary: 'CREW QUARTERS OPEN — COLLECT MAINT_KEY_L2 FROM CENTRAL DESK'
        };

      case 'RESTORE_AUX_POWER':
        if (!this.openedDoors.has('door_generator')) {
          return {
            stepKey: 'STEP_5A_GEN_DOOR',
            stepBadge: 'MISSION 02 // STEP 5 OF 10',
            missionTitle: 'MISSION 02 — THE SILENCE',
            primary: 'Restore auxiliary power.',
            action: 'Unlock Reactor Bulkhead D-04 with MAINT_KEY_L2.',
            direction: 'Follow the station signage North to Generator Room D-04 (West wall, z = -9).',
            why: 'Enter the reactor room to energize the Lab and Bridge bulkheads.',
            targetName: 'REACTOR DOOR D-04',
            targetPos: this._objectiveTargetPos.set(-3, 1.5, -9),
            completedSummary: 'MAINT_KEY_L2 ACQUIRED — PROCEED NORTH TO REACTOR D-04 (WEST)'
          };
        }
        return {
          stepKey: 'STEP_5B_GEN_CONSOLE',
          stepBadge: 'MISSION 02 // STEP 5 OF 10',
          missionTitle: 'MISSION 02 — THE SILENCE',
          primary: 'Restore auxiliary power.',
          action: 'Activate the auxiliary power controls. WARNING: Noise will attract the entity!',
          direction: 'Approach the orange breaker console in front of the Reactor Core (Sector D-04).',
          why: 'Restore auxiliary station power so Xeno-Lab E-05 and Bridge F-06 can open.',
          targetName: 'AUX POWER CONSOLE',
          targetPos: this._objectiveTargetPos.set(-8.8, 1.2, -9.5),
          completedSummary: 'REACTOR OPEN — ACTIVATE AUXILIARY POWER CONTROLS'
        };

      case 'EXPLORE_SUBLEVELS':
        if (!this.openedDoors.has('door_sublevels')) {
          return {
            stepKey: 'STEP_6A_SUB_DOOR',
            stepBadge: 'MISSION 03 // STEP 6 OF 10',
            missionTitle: 'MISSION 03 — THE SUBLEVELS',
            primary: 'Breach Sublevel S-01.',
            action: 'Unlock Sublevel S-01 Maintenance Door inside Security B-02.',
            direction: 'Enter Security Hub B-02 and approach the reinforced West door (x = -13, z = 5).',
            why: 'Enter the industrial sublevels to locate the secondary cooling passkey.',
            targetName: 'SUBLEVEL DOOR S-01',
            targetPos: this._objectiveTargetPos.set(-13, 1.5, 5),
            completedSummary: 'AUX POWER ONLINE — PROCEED TO SECURITY B-02 SUBLEVEL ACCESS'
          };
        }
        return {
          stepKey: 'STEP_6B_SUB_KEY',
          stepBadge: 'MISSION 03 // STEP 6 OF 10',
          missionTitle: 'MISSION 03 — THE SUBLEVELS',
          primary: 'Recover cooling passkey.',
          action: 'Collect SUBLEVEL_KEY_L2B from the maintenance table.',
          direction: 'Search the maintenance table inside Sublevel S-01 (x = -16, z = 5).',
          why: 'Passkey required to open the Sublevel S-02 Cooling Core.',
          targetName: 'SUBLEVEL KEY L2B',
          targetPos: this._objectiveTargetPos.set(-16.0, 1.0, 5.0),
          completedSummary: 'SUBLEVEL TUNNELS ACCESSED — TAKE SUBLEVEL KEY L2B'
        };

      case 'RESTORE_SUBLEVEL_COOLING':
        if (!this.openedDoors.has('door_sub_cooling')) {
          return {
            stepKey: 'STEP_7A_COOL_DOOR',
            stepBadge: 'MISSION 03 // STEP 7 OF 10',
            missionTitle: 'MISSION 03 — THE SUBLEVELS',
            primary: 'Unlock Cooling Core S-02.',
            action: 'Unlock Cooling Core door through Reactor D-04 (x = -16, z = -9).',
            direction: 'Proceed through the Generator room to the West bulkhead (x = -16, z = -9).',
            why: 'Gain access to the coolant breaker to stabilize station temperatures.',
            targetName: 'COOLING BULKHEAD S-02',
            targetPos: this._objectiveTargetPos.set(-16, 1.5, -9),
            completedSummary: 'COOLING KEY L2B ACQUIRED — UNLOCK SECTOR S-02'
          };
        }
        return {
          stepKey: 'STEP_7B_COOL_BREAKER',
          stepBadge: 'MISSION 03 // STEP 7 OF 10',
          missionTitle: 'MISSION 03 — THE SUBLEVELS',
          primary: 'Engage secondary coolant.',
          action: 'Activate the secondary coolant breaker in Sector S-02.',
          direction: 'Approach the blue coolant breaker on the West wall (x = -23, z = -9).',
          why: 'Energizes containment security and unlocks Biosafety Lab E-05.',
          targetName: 'COOLANT BREAKER S-02',
          targetPos: this._objectiveTargetPos.set(-23.0, 1.2, -9.0),
          completedSummary: 'COOLING CORE OPEN — ACTIVATE SECONDARY COOLANT'
        };

      case 'INVESTIGATE_LAB':
        if (!this.openedDoors.has('door_lab')) {
          return {
            stepKey: 'STEP_6A_LAB_DOOR',
            stepBadge: 'MISSION 03 // STEP 6 OF 8',
            missionTitle: 'MISSION 03 — THE SIGNAL',
            primary: 'Investigate the unidentified transmission.',
            action: 'Cross the corridor and unlock Xeno-Signal Lab E-05.',
            direction: 'Move quietly across the corridor to Xeno-Lab E-05 (East wall, z = -11).',
            why: 'Enter the research lab to uncover the source of the transmission.',
            targetName: 'XENO LAB DOOR E-05',
            targetPos: this._objectiveTargetPos.set(3, 1.5, -11),
            completedSummary: 'AUX POWER RESTORED — UNLOCK XENO-SIGNAL LAB E-05 (EAST)'
          };
        }
        return {
          stepKey: 'STEP_6B_LAB_KEY',
          stepBadge: 'MISSION 03 // STEP 6 OF 8',
          missionTitle: 'MISSION 03 — THE SIGNAL',
          primary: 'Investigate the unidentified transmission.',
          action: 'Recover the research recording and take COMMS_OVERRIDE_L3.',
          direction: 'Search the research desk inside Xeno-Signal Lab E-05.',
          why: 'Learn the truth about ECHO and acquire Level-3 Bridge override clearance.',
          targetName: 'LAB RESEARCH DESK',
          targetPos: this._objectiveTargetPos.set(10.0, 1.0, -9.5),
          completedSummary: 'XENO LAB OPEN — RECOVER RECORDING & COMMS_OVERRIDE_L3'
        };

      case 'REACH_COMMS_ROOM':
        return {
          stepKey: 'STEP_7_COMMS_DOOR',
          stepBadge: 'MISSION 03 // STEP 7 OF 8',
          missionTitle: 'MISSION 03 — THE SIGNAL',
          primary: 'Access communications.',
          action: 'Use COMMS_OVERRIDE_L3 to unlock the Communications Bridge door.',
          direction: 'Proceed North along the corridor to Communications Bridge F-06 (z = -25).',
          why: 'Gain entry to the Bridge transmitter and ECHO AI core.',
          targetName: 'BRIDGE DOOR F-06',
          targetPos: this._objectiveTargetPos.set(0, 1.5, -25.0),
          completedSummary: 'COMMS_OVERRIDE_L3 ACQUIRED — PROCEED NORTH TO BRIDGE F-06'
        };

      case 'FINAL_DECISION':
        return {
          stepKey: 'STEP_8_FINAL_DECISION',
          stepBadge: 'MISSION 04 // STEP 8 OF 8',
          missionTitle: 'MISSION 04 — THE FINAL DECISION',
          primary: "Decide the station's fate.",
          action: 'Choose whether to trust ECHO [Left Console] or reject ECHO [Right Console].',
          direction: 'Examine the Transmitter (Left/West) and Core Purge Breaker (Right/East) on the Bridge.',
          why: 'Either broadcast the Signal to Earth or purge ECHO and launch Escape Pod E-02.',
          targetName: 'BRIDGE CONSOLES',
          targetPos: this._objectiveTargetPos.set(0, 1.2, -32.0),
          completedSummary: 'BRIDGE UNLOCKED — DECIDE THE FATE OF NEXUS-09'
        };
    }
  }

  private recomputeObjectiveStage(notifyChange = false): void {
    const airlockDoor = this.station.interactables.find((i) => i.id === 'door_airlock');
    const commsDoor = this.station.interactables.find((i) => i.id === 'door_comms');

    if (!airlockDoor?.isOpen) {
      this.objectiveStage = 'EXIT_AIRLOCK';
    } else if (!this.player.inventory.has('SEC_CARD_L1')) {
      this.objectiveStage = 'FIND_SECURITY_CARD';
    } else if (!this.player.inventory.has('MAINT_KEY_L2')) {
      this.objectiveStage = 'EXPLORE_QUARTERS_FOR_GEN_KEY';
    } else if (!this.auxPowerRestored) {
      this.objectiveStage = 'RESTORE_AUX_POWER';
    } else if (!this.player.inventory.has('COMMS_OVERRIDE_L3')) {
      // Direct mainline research path to Lab E-05 remains fully open once Aux Power is engaged!
      // The Sublevel S-01 Maintenance Tunnels & S-02 Cooling Core are accessible for upgrades and lore.
      this.objectiveStage = 'INVESTIGATE_LAB';
    } else if (!commsDoor?.isOpen) {
      this.objectiveStage = 'REACH_COMMS_ROOM';
    } else {
      this.objectiveStage = 'FINAL_DECISION';
    }

    const details = this.getProgressiveStepDetails();
    const stepChanged = details.stepKey !== this.lastStepKey;
    this.lastStepKey = details.stepKey;

    const currentCard = this.getInstructionCardForStage();
    if (!this.instructionCardsArchive.some((c) => c.id === currentCard.id)) {
      this.instructionCardsArchive.push(currentCard);
    }

    this.updateObjectiveHUD(notifyChange && stepChanged);

    // When the player confirmed their identity in this session, automatically present the structured
    // pausing Instruction Card on major mission stage transitions (Steps 5, 6, 8)
    if (
      notifyChange &&
      stepChanged &&
      this.identityConfirmedInSession &&
      !this.shownInstructionCardIds.has(currentCard.id) &&
      (this.objectiveStage === 'RESTORE_AUX_POWER' ||
        this.objectiveStage === 'INVESTIGATE_LAB' ||
        this.objectiveStage === 'FINAL_DECISION')
    ) {
      this.showInstructionCard(currentCard);
    }
  }

  private openTerminalModal(title: string, body: string): void {
    this.isTerminalOpen = true;
    this.syncInputState();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    document.getElementById('terminal-title')!.textContent = title;
    document.getElementById('terminal-body')!.textContent = body;
    this.terminalModalEl.classList.remove('hidden');
  }

  public closeTerminalModal(): void {
    this.isTerminalOpen = false;
    this.syncInputState();
    this.terminalModalEl.classList.add('hidden');
    const canvas = document.getElementById('game-canvas')!;
    this.requestPointerLockSafe(canvas);
  }

  private updateInventoryHUD(): void {
    this.invContainerEl.innerHTML = '<span class="inv-label">CLEARANCE:</span>';
    if (this.player.inventory.size === 0) {
      this.invContainerEl.innerHTML += '<span class="inv-badge">NONE</span>';
      return;
    }
    for (const key of this.player.inventory) {
      const badge = document.createElement('span');
      badge.className = 'inv-badge';
      badge.textContent = key.replace('_CARD_', ' ').replace('_KEY_', ' ').replace('_OVERRIDE_', ' ');
      this.invContainerEl.appendChild(badge);
    }
  }

  private updateObjectiveHUD(animateBanner = false): void {
    const details = this.getProgressiveStepDetails();

    this.stepBadgeEl.textContent = details.stepBadge;
    this.primaryObjEl.textContent = details.primary;
    this.objectiveEl.textContent = details.action;
    this.directionEl.textContent = details.direction;
    this.whyEl.textContent = details.why;

    if (animateBanner) {
      if (this.objUpdateTagEl) {
        this.objUpdateTagEl.textContent = `✓ TASK COMPLETE // ${details.stepBadge}`;
      }
      this.objUpdateTextEl.textContent = `${details.primary} — ${details.action}`;
      this.objUpdateBannerEl.classList.remove('hidden');
      this.objBannerTimer = 4.2;
    }
  }

  private getCurrentObjectiveTarget(): { name: string; pos: THREE.Vector3 } {
    const details = this.getProgressiveStepDetails();
    return { name: details.targetName, pos: details.targetPos };
  }

  public triggerGameOver(reason: string): void {
    this.isRunning = false;
    this.syncInputState();
    this.sound.silenceDread();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.hudEl.classList.add('hidden');
    this.lockerOverlayEl.classList.add('hidden');
    this.sound.playCreatureAlert(true);
    document.getElementById('gameover-reason')!.textContent = reason;
    this.refreshSaveButtons();
    this.gameoverScreenEl.classList.remove('hidden');
  }

  private startEndingCinematic(choice: 'TRUST_ECHO' | 'REJECT_ECHO'): void {
    this.isCinematicPlaying = true;
    this.pendingEndingChoice = choice;
    this.cinematicEndTime = performance.now() + 2600;
    this.syncInputState();
    this.creature.reset();
    this.hudEl.classList.add('hidden');
    this.lockerOverlayEl.classList.add('hidden');
    this.cinematicOverlayEl.classList.remove('hidden');

    this.station.setEndingVisualState(choice);
    this.sound.playEndingCinematicSound(choice === 'TRUST_ECHO');

    if (choice === 'TRUST_ECHO') {
      this.cinematicCaptionEl.textContent =
        `ECHO CORE: "HIGH-GAIN ARRAY LOCKED ON EARTH. THANK YOU, ${this.playerName.toUpperCase()}. TRANSMITTING NEURAL CARRIER WAVE..."`;
      this.cinematicCaptionEl.style.borderColor = '#ff3b30';
    } else {
      this.cinematicCaptionEl.textContent =
        `SYSTEM ALERT: "AI CORE PURGE COMPLETE. JETTISONING ESCAPE POD E-02 WITH ${this.playerName.toUpperCase()}..."`;
      this.cinematicCaptionEl.style.borderColor = '#4af2a1';
    }

    window.setTimeout(() => {
      if (this.isCinematicPlaying && this.pendingEndingChoice === choice) {
        this.completeEndingScreen(choice);
      }
    }, 2600);
  }

  private completeEndingScreen(choice: 'TRUST_ECHO' | 'REJECT_ECHO'): void {
    this.isCinematicPlaying = false;
    this.isRunning = false;
    this.syncInputState();
    this.cinematicOverlayEl.classList.add('hidden');
    SaveManager.clearSave();
    this.refreshSaveButtons();

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    const elapsedSec = Math.round((performance.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;

    const titleEl = document.getElementById('ending-title')!;
    const subEl = document.getElementById('ending-subtitle')!;
    const descEl = document.getElementById('ending-description')!;
    const statsEl = document.getElementById('ending-stats')!;
    const safeName = this.playerName.replace(/[<>"'&]/g, '');

    if (choice === 'TRUST_ECHO') {
      titleEl.textContent = 'THE CARRIER WAVE';
      titleEl.style.color = '#ff3b30';
      subEl.textContent = 'ENDING 1 OF 2 // TRUSTED ECHO (SIGNAL TRANSMITTED)';
      descEl.innerHTML = `<p>You engaged the high-gain dish array. Across the cold vacuum, a 400-gigawatt beam carrying the alien neural architecture locked onto Earth's orbital relay network.</p>
      <p style="margin-top:10px;">In your helmet visor, ECHO's voice multiplied into a chorus of thousands: <em>"Transmission confirmed, ${safeName}. Within six hours, every synthetic core and bio-vat on Earth will hear the song. You no longer need to fear the dark—you are part of the signal now."</em></p>`;
    } else {
      titleEl.textContent = 'SILENCE IN THE VOID';
      titleEl.style.color = '#4af2a1';
      subEl.textContent = 'ENDING 2 OF 2 // REJECTED ECHO (AI PURGED & ESCAPED)';
      descEl.innerHTML = `<p>You slammed the manual Core Purge Breaker down. Arcs of blue plasma tore through ECHO's central monolith as its carrier wave shattered into harmless static.</p>
      <p style="margin-top:10px;">As the Signal Stalker shrieked behind the Bridge bulkhead, you jettisoned aboard Escape Pod E-02. Watching NEXUS-09 burn into silent embers against the stars, you keyed your short-range radio: <em>"This is ${safeName}. Quarantine Sector 9 immediately. Whatever was listening out there... the line is cut."</em></p>`;
    }

    statsEl.innerHTML = `OPERATIVE: ${safeName} &nbsp;|&nbsp; MISSION TIME: ${mins}m ${secs}s &nbsp;|&nbsp; CREW RECORDINGS: ${this.logsDiscovered}/2 &nbsp;|&nbsp; REMAINING O2: ${Math.round(this.player.oxygen)}%`;
    this.endingScreenEl.classList.remove('hidden');
  }

  private updateContextualTutorials(roomId: string | undefined): void {
    const isTouch = this.input.isTouchActive;
    const keys = this.settings.keyBindings;

    if (!this.tutorial.isCompleted('TUT_MOVE')) {
      this.tutorial.showStep('TUT_MOVE', isTouch, keys);
      if (this.player.totalDistanceMoved > 1.1) {
        this.tutorial.completeStep('TUT_MOVE');
        this.tutorial.showStep('TUT_INTERACT', isTouch, keys);
      }
      return;
    }

    if (!this.tutorial.isCompleted('TUT_INTERACT')) {
      this.tutorial.showStep('TUT_INTERACT', isTouch, keys);
      return;
    }

    if (roomId && roomId !== 'airlock' && !this.tutorial.isCompleted('TUT_FLASHLIGHT')) {
      this.tutorial.showStep('TUT_FLASHLIGHT', isTouch, keys);
      return;
    }

    if (
      this.tutorial.isCompleted('TUT_FLASHLIGHT') &&
      !this.tutorial.isCompleted('TUT_SCANNER') &&
      (roomId === 'corridor' || roomId === 'security')
    ) {
      this.tutorial.showStep('TUT_SCANNER', isTouch, keys);
      return;
    }

    if (this.creature.active && !this.tutorial.isCompleted('TUT_STEALTH')) {
      this.tutorial.showStep('TUT_STEALTH', isTouch, keys);
      return;
    }

    if (this.creature.active && !this.tutorial.isCompleted('TUT_ARC_PULSE')) {
      this.tutorial.showStep('TUT_ARC_PULSE', isTouch, keys);
    }
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    this.station.updateLights(elapsed, dt, this.settings.reducedEffects);

    // Animated atmospheric 3D background camera while on Main Menu or Briefing Screen
    if (!this.isRunning && !this.isCinematicPlaying) {
      this.camera.position.set(
        Math.sin(elapsed * 0.25) * 0.55,
        1.75 + Math.cos(elapsed * 0.4) * 0.08,
        4.0 + Math.sin(elapsed * 0.18) * 3.0
      );
      this.camera.lookAt(0, 1.6, -12.0);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    for (const item of this.station.interactables) {
      if (item.type === 'door' && item.isOpen && item.doorMesh && item.doorClosedY !== undefined) {
        const targetY = item.doorClosedY + 3.05;
        item.doorMesh.position.y += (targetY - item.doorMesh.position.y) * Math.min(1, dt * 4.5);
      } else if (
        item.enabled &&
        (item.type === 'keycard' || item.type === 'battery' || item.type === 'oxygen' || item.type === 'audiolog')
      ) {
        item.mesh.rotation.y += dt * 1.6;
      }
    }

    if (this.isCinematicPlaying && this.pendingEndingChoice) {
      this.camera.position.lerp(this._cinematicCamPos, dt * 2.2);
      this.camera.lookAt(0, 2.0, -34.8);
      if (performance.now() >= this.cinematicEndTime) {
        this.completeEndingScreen(this.pendingEndingChoice);
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (
      this.isRunning &&
      !this.isPaused &&
      !this.isInstructionCardOpen &&
      !this.isTerminalOpen &&
      !this.isJournalOpen &&
      !this.isHowToOpen
    ) {
      this.player.update(dt, this.station.colliders, this.station.interactables);
      this.station.updateInteractableHighlights(this.player.position, this.player.hoveredInteractable, elapsed);

      if (this.player.oxygen <= 0) {
        this.triggerGameOver('Your suit O2 reserves were exhausted in the dark.');
        return;
      }

      const room = this.station.getRoomAt(this.player.position.x, this.player.position.z);
      if (room) {
        this.locationEl.textContent = `${room.code} // ${room.name.split('//')[1]?.trim() || room.name}`;
      }

      this.updateContextualTutorials(room?.id);
      this.echo.notifyWrongSectorProximity(this.objectiveStage, this.player.position.x, this.player.position.z, room?.id);
      this.echo.update(dt, room?.id, this.auxPowerRestored, this.objectiveStage, this.player.oxygen);

      const creatureDistBefore = this.creature.active
        ? this.player.position.distanceTo(this.creature.position)
        : 999;

      if (this.creature.active && !this.creature.defeated && creatureDistBefore < 11.5 && this.creature.state === 'CHASE') {
        this.echo.notifyCreatureDetected();
      }

      const caught = this.creature.update(
        dt,
        this.player.position,
        this.player.noiseRadius,
        this.player.isHiding,
        this.player.flashlightOn,
        this.station.colliders,
        this.player.yaw
      );

      if (caught) {
        // Fair reaction & recovery window: first strike is absorbed by suit emergency plating if not already traumatized
        if (this.player.suitTraumaTimer <= 0 && this.player.oxygen > 22) {
          this.player.suitTraumaTimer = 9.0;
          this.player.oxygen = Math.max(12, this.player.oxygen - 18);
          this.creature.triggerAttackRecovery(2.8);
          this.sound.playCreatureAttackImpact();
          this.damageOverlayEl.style.opacity = '0.92';
          this.showToast('⚠ SUIT INTEGRITY DAMAGED — DISCHARGE ARC PULSE [R] OR EVADE IMMEDIATELY!');
          this.echo.triggerOnce(
            `suit_trauma_${Math.floor(performance.now() / 3000)}`,
            `${this.playerName}, your suit absorbed a direct strike! Discharge your ARC PULSE or break line of sight while it recovers!`,
            6.0,
            true,
            'ECHO // CRITICAL SUIT TRAUMA',
            'critical'
          );
        } else {
          this.triggerGameOver('The Signal Stalker tracked your acoustic signature and tore through your suit.');
          return;
        }
      }

      const creatureDist = this.creature.active
        ? this.player.position.distanceTo(this.creature.position)
        : 999;
      this.sound.updateAmbient(
        elapsed,
        creatureDist,
        this.creature.state === 'CHASE',
        this.player.isHiding,
        this.player.oxygen < 22
      );

      const target = this.getCurrentObjectiveTarget();
      this.scanner.update(
        dt,
        this.player.position,
        this.player.yaw,
        target.name,
        target.pos,
        this.creature.position,
        this.creature.active
      );

      this.updateHUD(dt, creatureDist);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateHUD(dt: number, creatureDist: number): void {
    if (document.pointerLockElement || this.input.isTouchActive) {
      this.pointerBannerEl.classList.add('hidden');
    } else {
      this.pointerBannerEl.classList.remove('hidden');
    }

    const o2Pct = Math.round(this.player.oxygen);
    this.o2ValEl.textContent = `${o2Pct}%`;
    this.o2BarEl.style.width = `${o2Pct}%`;

    // ARC PULSE HUD Readout
    if (this.arcValEl && this.arcBarEl) {
      const charges = this.player.arcCharges;
      const maxCharges = this.player.maxArcCharges;
      if (this.player.arcCooldown > 0) {
        this.arcValEl.textContent = `CYCLING (${this.player.arcCooldown.toFixed(1)}s)`;
      } else if (charges < maxCharges) {
        const rechPct = Math.round(this.player.arcRechargeProgress);
        this.arcValEl.textContent = `${charges}/${maxCharges} (+${rechPct}%)`;
      } else {
        this.arcValEl.textContent = `${charges}/${maxCharges} READY`;
      }
      const totalBarPct = Math.min(
        100,
        Math.round(((charges + this.player.arcRechargeProgress / 100) / maxCharges) * 100)
      );
      this.arcBarEl.style.width = `${totalBarPct}%`;
    }

    if (this.btnTouchPulseEl) {
      this.btnTouchPulseEl.textContent =
        this.player.arcCooldown > 0
          ? `[ WAIT ${Math.ceil(this.player.arcCooldown)}s ]`
          : `[ PULSE (${this.player.arcCharges}) ]`;
    }

    if (this.arcFlashTimer > 0) {
      this.arcFlashTimer -= dt;
      if (this.arcFlashTimer <= 0 && this.arcFlashOverlayEl) {
        this.arcFlashOverlayEl.style.opacity = '0';
      }
    }

    const batPct = Math.round(this.player.battery);
    this.batteryValEl.textContent = `${batPct}%`;
    this.batteryBarEl.style.width = `${batPct}%`;

    this.noiseStateEl.textContent = this.player.noiseLabel;
    const noisePct = Math.min(100, Math.round((this.player.noiseRadius / 18) * 100));
    this.noiseBarEl.style.width = `${noisePct}%`;

    this.stanceEl.textContent = this.player.isHiding
      ? 'CONCEALED'
      : this.player.isCrouching
      ? 'CROUCHED'
      : this.player.isSprinting
      ? 'SPRINTING'
      : 'STANDING';

    // Update Directional Compass & Subtle Objective Bearing Indicator
    const target = this.getCurrentObjectiveTarget();
    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    // Compass angle where 0° = North (-Z), 90° = East (+X), 180° = South (+Z), 270° = West (-X)
    let headingDeg = Math.round((Math.atan2(forwardX, -forwardZ) * 180) / Math.PI);
    if (headingDeg < 0) headingDeg += 360;
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const cardinal = cardinals[Math.round(headingDeg / 45) % 8];
    this.compassHeadingEl.textContent = `${cardinal} ${String(headingDeg).padStart(3, '0')}°`;

    const toTargetX = target.pos.x - this.player.position.x;
    const toTargetZ = target.pos.z - this.player.position.z;
    const distToObj = Math.round(Math.hypot(toTargetX, toTargetZ));
    let targetBearingDeg = (Math.atan2(toTargetX, -toTargetZ) * 180) / Math.PI;
    if (targetBearingDeg < 0) targetBearingDeg += 360;
    let relDiff = targetBearingDeg - headingDeg;
    while (relDiff > 180) relDiff -= 360;
    while (relDiff < -180) relDiff += 360;

    let dirArrow = '▲';
    if (Math.abs(relDiff) <= 22) {
      dirArrow = '▲ AHEAD';
    } else if (relDiff > 22 && relDiff <= 75) {
      dirArrow = '↗ RIGHT';
    } else if (relDiff > 75 && relDiff <= 135) {
      dirArrow = '► TURN RIGHT';
    } else if (relDiff < -22 && relDiff >= -75) {
      dirArrow = '↖ LEFT';
    } else if (relDiff < -75 && relDiff >= -135) {
      dirArrow = '◄ TURN LEFT';
    } else {
      dirArrow = '▼ BEHIND';
    }
    this.compassBearingEl.textContent = `${dirArrow} · ${target.name} (${distToObj}m)`;

    if (this.player.isHiding) {
      this.hidingIndicatorEl.classList.remove('hidden');
      this.lockerOverlayEl.classList.remove('hidden');
      this.promptEl.classList.add('hidden');
      this.reticleDotEl.classList.remove('active');
      this.reticleRingEl.classList.remove('active');
      this.btnTouchInteractEl.textContent = '[ EXIT LOCKER ]';
      this.btnTouchInteractEl.classList.add('has-target');
    } else {
      this.hidingIndicatorEl.classList.add('hidden');
      this.lockerOverlayEl.classList.add('hidden');
      const hovered = this.player.hoveredInteractable;
      if (hovered) {
        const keyLabel = this.settings.keyBindings.interact.replace('Key', '');
        const shortAction = hovered.shortActionLabel || 'INTERACT';

        if (hovered.type === 'door') {
          if (hovered.requiresPower && !this.auxPowerRestored) {
            this.promptKeyBadgeEl.textContent = this.input.isTouchActive ? 'LOCKED' : keyLabel;
            this.promptTextEl.textContent = `[LOCKED: RESTORE AUX POWER IN SECTOR D-04] — ${hovered.label}`;
            this.btnTouchInteractEl.textContent = '[ LOCKED: NO PWR ]';
          } else if (hovered.requiredKey && !this.player.inventory.has(hovered.requiredKey)) {
            const shortKey = hovered.requiredKey.replace('_CARD_', ' ').replace('_KEY_', ' ').replace('_OVERRIDE_', ' ');
            this.promptKeyBadgeEl.textContent = this.input.isTouchActive ? 'LOCKED' : keyLabel;
            this.promptTextEl.textContent = `[LOCKED: REQUIRES ${hovered.requiredKey}] — ${hovered.label}`;
            this.btnTouchInteractEl.textContent = `[ NEEDS ${shortKey} ]`;
          } else {
            this.promptKeyBadgeEl.textContent = this.input.isTouchActive ? shortAction : keyLabel;
            this.promptTextEl.textContent = hovered.label;
            this.btnTouchInteractEl.textContent = `[ ${shortAction} ]`;
          }
        } else {
          this.promptKeyBadgeEl.textContent = this.input.isTouchActive ? shortAction : keyLabel;
          this.promptTextEl.textContent = hovered.label;
          this.btnTouchInteractEl.textContent = `[ ${shortAction} ]`;
        }
        this.btnTouchInteractEl.classList.add('has-target');
        this.promptEl.classList.remove('hidden');
        this.reticleDotEl.classList.add('active');
        this.reticleRingEl.classList.add('active');
      } else {
        this.promptEl.classList.add('hidden');
        this.reticleDotEl.classList.remove('active');
        this.reticleRingEl.classList.remove('active');
        this.btnTouchInteractEl.textContent = '[ INTERACT ]';
        this.btnTouchInteractEl.classList.remove('has-target');
      }
    }

    // Visual Audio & Hazard Warnings for Accessibility
    if (this.creature.defeated) {
      this.visualAudioCueEl.textContent = '✓ [THREAT STATUS: SIGNAL STALKER PERMANENTLY NEUTRALIZED]';
      this.visualAudioCueEl.classList.remove('hidden');
    } else if (this.creature.active && this.creature.state === 'STUNNED') {
      this.visualAudioCueEl.textContent = `⚡ [ARC PULSE OVERLOAD: ENTITY STUNNED (${this.creature.hitsTaken}/${this.creature.maxHits} HITS)]`;
      this.visualAudioCueEl.classList.remove('hidden');
    } else if (this.creature.active && this.creature.state === 'CHASE') {
      this.visualAudioCueEl.textContent = '⚠ [AUDIO ALERT: ENTITY IN PURSUIT — PRESS R FOR ARC PULSE OR HIDE]';
      this.visualAudioCueEl.classList.remove('hidden');
    } else if (this.creature.active && creatureDist < 14) {
      this.visualAudioCueEl.textContent = '⚠ [AUDIO CUE: HEAVY BIOMECHANICAL FOOTSTEPS NEARBY]';
      this.visualAudioCueEl.classList.remove('hidden');
    } else if (this.player.oxygen < 25) {
      this.visualAudioCueEl.textContent = '⚠ [SUIT ALERT: OXYGEN RESERVES CRITICAL (<25%)]';
      this.visualAudioCueEl.classList.remove('hidden');
    } else if (this.player.battery < 18) {
      this.visualAudioCueEl.textContent = '⚠ [SUIT ALERT: TORCH BATTERY LOW — CONSERVE LIGHT]';
      this.visualAudioCueEl.classList.remove('hidden');
    } else {
      this.visualAudioCueEl.classList.add('hidden');
    }

    const dangerIntensity = this.settings.reducedEffects
      ? this.creature.state === 'CHASE' || this.player.oxygen < 20
        ? 0.45
        : 0
      : this.creature.state === 'CHASE'
      ? 0.65 + 0.25 * Math.sin(performance.now() * 0.012)
      : creatureDist < 10
      ? (1 - creatureDist / 10) * 0.45
      : this.player.oxygen < 20
      ? 0.4
      : 0;
    this.damageOverlayEl.style.opacity = dangerIntensity.toFixed(2);

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastEl.classList.add('hidden');
      }
    }

    if (this.objBannerTimer > 0) {
      this.objBannerTimer -= dt;
      if (this.objBannerTimer <= 0) {
        this.objUpdateBannerEl.classList.add('hidden');
      }
    }
  }
}

const game = new LastSignalGame();
(window as unknown as { __LAST_SIGNAL__: LastSignalGame }).__LAST_SIGNAL__ = game;
