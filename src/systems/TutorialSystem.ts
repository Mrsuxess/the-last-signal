import { KeyBindings, TutorialStepId } from '../types';

interface TutorialDefinition {
  id: TutorialStepId;
  headline: string;
  getInstruction: (isTouch: boolean, keys: KeyBindings) => string;
}

const TUTORIAL_STEPS: Record<TutorialStepId, TutorialDefinition> = {
  TUT_MOVE: {
    id: 'TUT_MOVE',
    headline: 'Move through the airlock.',
    getInstruction: (isTouch) =>
      isTouch
        ? 'Drag the LEFT JOYSTICK to walk and swipe the RIGHT VIEWPORT to look around.'
        : 'Use [W][A][S][D] to walk and move your MOUSE (or click-drag) to look around.'
  },
  TUT_INTERACT: {
    id: 'TUT_INTERACT',
    headline: 'Approach the airlock control panel.',
    getInstruction: (isTouch, keys) =>
      isTouch
        ? 'Aim your reticle at the Airlock Bulkhead or Terminal and tap [INTERACT].'
        : `Aim your reticle at the Airlock Bulkhead or Terminal and press [${keys.interact.replace('Key', '')}].`
  },
  TUT_FLASHLIGHT: {
    id: 'TUT_FLASHLIGHT',
    headline: 'Power levels are critically low.',
    getInstruction: (isTouch, keys) =>
      isTouch
        ? 'Tap [TORCH] to toggle your suit flashlight. Conserve battery or collect reserve cells.'
        : `Press [${keys.flashlight.replace('Key', '')}] to toggle your suit flashlight. Conserve battery in lit areas.`
  },
  TUT_SCANNER: {
    id: 'TUT_SCANNER',
    headline: 'An unidentified signal has been detected.',
    getInstruction: (isTouch, keys) =>
      isTouch
        ? 'Tap [SCAN] to ping your Signal Scanner and locate the active mission objective.'
        : `Press [${keys.scanner.replace('Key', '')}] to ping your Signal Scanner and track objective beacons.`
  },
  TUT_STEALTH: {
    id: 'TUT_STEALTH',
    headline: 'Something is moving nearby.',
    getInstruction: (isTouch, keys) => {
      const pulseKey = (keys.arcPulse || 'KeyR').replace('Key', '');
      return isTouch
        ? 'Tap [CROUCH] to move quietly, [⚡ PULSE] to stun the entity, or hide in Emergency Lockers!'
        : `Press [${keys.crouch.replace('Key', '')}] to crouch-walk quietly, [${pulseKey}] to fire ARC PULSE, or hide in Lockers!`;
    }
  },
  TUT_ARC_PULSE: {
    id: 'TUT_ARC_PULSE',
    headline: 'ARC PULSE defensive capacitor online.',
    getInstruction: (isTouch, keys) => {
      const pulseKey = (keys.arcPulse || 'KeyR').replace('Key', '');
      return isTouch
        ? 'Tap [⚡ PULSE] when the entity is within 7.5m to stun it. Three hits permanently neutralize it!'
        : `Press [${pulseKey}] (or Right-Click) within 7.5m to stun the entity. Three hits neutralize it permanently!`;
    }
  }
};

export class TutorialSystem {
  private completed = new Set<TutorialStepId>();
  private skippedAll = false;
  private activeStep: TutorialStepId | null = null;

  private bannerEl: HTMLElement | null = null;
  private headlineEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;

  constructor(private onTutorialChange?: () => void) {
    this.bannerEl = document.getElementById('tutorial-banner');
    this.headlineEl = document.getElementById('tutorial-headline');
    this.bodyEl = document.getElementById('tutorial-body');

    const skipBtn = document.getElementById('btn-skip-tutorials');
    skipBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skipAll();
    });

    const dismissBtn = document.getElementById('btn-dismiss-tutorial');
    dismissBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissActive();
    });
  }

  public reset(): void {
    this.completed.clear();
    this.skippedAll = false;
    this.activeStep = null;
    this.bannerEl?.classList.add('hidden');
  }

  public restoreCompleted(steps: TutorialStepId[]): void {
    this.completed = new Set(steps);
    if (this.activeStep && this.completed.has(this.activeStep)) {
      this.hideBanner();
    }
  }

  public getCompleted(): TutorialStepId[] {
    return Array.from(this.completed);
  }

  public dismissActive(): void {
    if (this.activeStep) {
      this.completed.add(this.activeStep);
    }
    this.hideBanner();
    this.onTutorialChange?.();
  }

  public skipAll(): void {
    this.skippedAll = true;
    (['TUT_MOVE', 'TUT_INTERACT', 'TUT_FLASHLIGHT', 'TUT_SCANNER', 'TUT_STEALTH', 'TUT_ARC_PULSE'] as TutorialStepId[]).forEach((s) =>
      this.completed.add(s)
    );
    this.hideBanner();
    this.onTutorialChange?.();
  }

  public showStep(id: TutorialStepId, isTouch: boolean, keys: KeyBindings): void {
    if (this.skippedAll || this.completed.has(id)) return;
    if (this.activeStep === id) {
      const def = TUTORIAL_STEPS[id];
      if (this.bodyEl) this.bodyEl.textContent = def.getInstruction(isTouch, keys);
      return;
    }

    this.activeStep = id;
    const def = TUTORIAL_STEPS[id];
    if (this.headlineEl) this.headlineEl.textContent = def.headline;
    if (this.bodyEl) this.bodyEl.textContent = def.getInstruction(isTouch, keys);
    this.bannerEl?.classList.remove('hidden');
  }

  public completeStep(id: TutorialStepId): void {
    if (this.completed.has(id)) return;
    this.completed.add(id);
    if (this.activeStep === id) {
      this.hideBanner();
    }
    this.onTutorialChange?.();
  }

  public isCompleted(id: TutorialStepId): boolean {
    return this.completed.has(id);
  }

  private hideBanner(): void {
    this.activeStep = null;
    this.bannerEl?.classList.add('hidden');
  }
}
