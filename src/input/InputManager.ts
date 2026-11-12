import { KeyBindings } from '../types';

export interface InputActionHandlers {
  onInteract: () => void;
  onFlashlightToggle: () => void;
  onScannerPing: () => void;
  onCrouchToggle: () => void;
  onJournalToggle: () => void;
  onPauseToggle: () => void;
  onArcPulse: () => void;
}

export class InputManager {
  public enabled = false;
  public isTouchActive = false;

  // Continuous axes (-1..1)
  public moveX = 0; // -1 left, +1 right
  public moveZ = 0; // +1 forward, -1 backward
  public sprintHeld = false;

  // Accumulated look deltas consumed each frame
  private lookDeltaX = 0;
  private lookDeltaY = 0;

  private keys: Record<string, boolean> = {};
  private mouseSensitivity = 1.0;
  private touchSensitivity = 1.0;
  private isMouseDragging = false;
  private touchSprintToggled = false;

  // Multi-touch state
  private joystickTouchId: number | null = null;
  private joystickOriginX = 0;
  private joystickOriginY = 0;
  private joystickVecX = 0;
  private joystickVecY = 0;

  private lookTouchId: number | null = null;
  private lastLookTouchX = 0;
  private lastLookTouchY = 0;

  // Gamepad edge detection
  private prevGamepadButtons: boolean[] = [];

  private bindings: KeyBindings = {
    interact: 'KeyE',
    flashlight: 'KeyF',
    scanner: 'KeyQ',
    crouch: 'KeyC',
    journal: 'KeyJ',
    arcPulse: 'KeyR'
  };

  private handlers?: InputActionHandlers;
  private touchControlsEl: HTMLElement | null = null;
  private joystickBaseEl: HTMLElement | null = null;
  private joystickKnobEl: HTMLElement | null = null;
  private sprintBtnEl: HTMLElement | null = null;
  private crouchBtnEl: HTMLElement | null = null;

  constructor() {
    this.detectTouchCapability();
    this.bindKeyboardAndMouse();
    this.bindTouchControls();
    this.bindLifecycleCleanup();
  }

  public setHandlers(handlers: InputActionHandlers): void {
    this.handlers = handlers;
  }

  public setSensitivities(mouseSens: number, touchSens: number): void {
    this.mouseSensitivity = mouseSens;
    this.touchSensitivity = touchSens;
  }

  public setKeyBindings(bindings: KeyBindings): void {
    this.bindings = { ...this.bindings, ...bindings };
  }

  public getKeyBindings(): KeyBindings {
    return { ...this.bindings };
  }

  private detectTouchCapability(): void {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (coarse && window.innerWidth <= 1180) {
      this.setTouchMode(true);
    }
  }

  public setTouchMode(active: boolean): void {
    this.isTouchActive = active;
    document.body.classList.toggle('mobile-hud', active);
    if (!this.touchControlsEl) {
      this.touchControlsEl = document.getElementById('touch-controls');
    }
    if (this.touchControlsEl) {
      if (active && this.enabled) {
        this.touchControlsEl.classList.remove('hidden');
      } else {
        this.touchControlsEl.classList.add('hidden');
      }
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearAllInputs();
    }
    if (!this.touchControlsEl) {
      this.touchControlsEl = document.getElementById('touch-controls');
    }
    if (this.touchControlsEl) {
      if (enabled && this.isTouchActive) {
        this.touchControlsEl.classList.remove('hidden');
      } else {
        this.touchControlsEl.classList.add('hidden');
      }
    }
  }

  public clearAllInputs(): void {
    this.keys = {};
    this.moveX = 0;
    this.moveZ = 0;
    this.sprintHeld = false;
    this.touchSprintToggled = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.isMouseDragging = false;
    this.resetJoystick();
    this.lookTouchId = null;
    this.sprintBtnEl?.classList.remove('active-toggle');
  }

  private bindKeyboardAndMouse(): void {
    window.addEventListener('keydown', (e) => {
      // Do not intercept typing when a visible input element (such as player name input) is focused
      const activeEl = document.activeElement as HTMLElement | null;
      const activeTag = activeEl?.tagName;
      if (
        (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') &&
        !activeEl?.closest('.hidden')
      ) {
        return;
      }

      // Allow Escape / P & Journal toggle even when paused/modal open so user can close them
      if (e.code === 'Escape' || (e.code === 'KeyP' && !e.repeat)) {
        this.handlers?.onPauseToggle();
        return;
      }

      if ((e.code === this.bindings.journal || e.code === 'Tab') && !e.repeat) {
        if (e.code === 'Tab') e.preventDefault();
        this.handlers?.onJournalToggle();
        return;
      }

      if (e.code === this.bindings.interact && !e.repeat) {
        this.handlers?.onInteract();
        return;
      }

      if (!this.enabled) return;

      this.keys[e.code] = true;
      if (e.repeat) return;

      if (e.code === this.bindings.flashlight) {
        this.handlers?.onFlashlightToggle();
      } else if (e.code === this.bindings.scanner) {
        this.handlers?.onScannerPing();
      } else if (e.code === this.bindings.crouch || e.code === 'ControlLeft') {
        this.handlers?.onCrouchToggle();
      } else if (e.code === (this.bindings.arcPulse || 'KeyR') || e.code === 'KeyX') {
        this.handlers?.onArcPulse();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      const target = e.target as HTMLElement | null;
      const onGameArea = Boolean(target && (target.id === 'game-canvas' || target.closest('#hud')));
      if (e.button === 0 && onGameArea) {
        this.isMouseDragging = true;
      } else if (e.button === 2 && onGameArea) {
        e.preventDefault();
        this.handlers?.onArcPulse();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (!document.pointerLockElement && !this.isMouseDragging) return;

      const sens = 0.0021 * this.mouseSensitivity;
      this.lookDeltaX += e.movementX * sens;
      this.lookDeltaY += e.movementY * sens;
    });
  }

  private bindTouchControls(): void {
    window.addEventListener(
      'touchstart',
      () => {
        if (!this.isTouchActive) {
          this.setTouchMode(true);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'pointerdown',
      (e) => {
        if ((e.pointerType === 'touch' || e.pointerType === 'pen') && !this.isTouchActive) {
          this.setTouchMode(true);
        }
      },
      { passive: true }
    );

    const joyZone = document.getElementById('touch-joystick-zone');
    this.joystickBaseEl = document.getElementById('touch-joystick-base');
    this.joystickKnobEl = document.getElementById('touch-joystick-knob');
    const lookZone = document.getElementById('touch-look-zone');

    const startJoystickAt = (id: number, clientX: number, clientY: number) => {
      if (!joyZone) return;
      this.joystickTouchId = id;
      const rect = joyZone.getBoundingClientRect();
      this.joystickOriginX = clientX;
      this.joystickOriginY = clientY;

      if (this.joystickBaseEl) {
        this.joystickBaseEl.style.left = `${clientX - rect.left}px`;
        this.joystickBaseEl.style.top = `${clientY - rect.top}px`;
        this.joystickBaseEl.classList.add('active');
      }
      if (this.joystickKnobEl) {
        this.joystickKnobEl.style.transform = `translate(-50%, -50%)`;
      }
    };

    const moveJoystickAt = (clientX: number, clientY: number) => {
      const maxRadius = 46;
      const dx = clientX - this.joystickOriginX;
      const dy = clientY - this.joystickOriginY;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * clamped;
      const ky = Math.sin(angle) * clamped;

      this.joystickVecX = kx / maxRadius;
      this.joystickVecY = -ky / maxRadius; // Up on screen = +forward

      if (this.joystickKnobEl) {
        this.joystickKnobEl.style.transform = `translate(calc(-50% + ${kx.toFixed(1)}px), calc(-50% + ${ky.toFixed(1)}px))`;
      }
    };

    if (joyZone) {
      joyZone.addEventListener(
        'touchstart',
        (e) => {
          if (!this.enabled || this.joystickTouchId !== null) return;
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier !== this.lookTouchId) {
              startJoystickAt(touch.identifier, touch.clientX, touch.clientY);
              break;
            }
          }
        },
        { passive: false }
      );

      joyZone.addEventListener(
        'touchmove',
        (e) => {
          if (!this.enabled || this.joystickTouchId === null) return;
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === this.joystickTouchId) {
              moveJoystickAt(t.clientX, t.clientY);
              break;
            }
          }
        },
        { passive: false }
      );

      const endJoystick = (e: TouchEvent) => {
        if (this.joystickTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joystickTouchId) {
            this.resetJoystick();
            break;
          }
        }
      };

      joyZone.addEventListener('touchend', endJoystick, { passive: true });
      joyZone.addEventListener('touchcancel', endJoystick, { passive: true });

      joyZone.addEventListener('pointerdown', (e) => {
        if (!this.enabled || this.joystickTouchId !== null || e.pointerType === 'mouse') return;
        e.preventDefault();
        try {
          joyZone.setPointerCapture(e.pointerId);
        } catch {}
        startJoystickAt(e.pointerId, e.clientX, e.clientY);
      });

      joyZone.addEventListener('pointermove', (e) => {
        if (!this.enabled || this.joystickTouchId !== e.pointerId) return;
        moveJoystickAt(e.clientX, e.clientY);
      });

      const endJoystickPointer = (e: PointerEvent) => {
        if (this.joystickTouchId === e.pointerId) {
          this.resetJoystick();
        }
      };
      joyZone.addEventListener('pointerup', endJoystickPointer);
      joyZone.addEventListener('pointercancel', endJoystickPointer);
    }

    if (lookZone) {
      lookZone.addEventListener(
        'touchstart',
        (e) => {
          if (!this.enabled || this.lookTouchId !== null) return;
          const target = e.target as HTMLElement | null;
          if (target && target.closest('.touch-btn, #interaction-prompt, #mission-tracker-panel')) return;
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier !== this.joystickTouchId) {
              this.lookTouchId = touch.identifier;
              this.lastLookTouchX = touch.clientX;
              this.lastLookTouchY = touch.clientY;
              break;
            }
          }
        },
        { passive: false }
      );

      lookZone.addEventListener(
        'touchmove',
        (e) => {
          if (!this.enabled || this.lookTouchId === null) return;
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === this.lookTouchId) {
              const dx = t.clientX - this.lastLookTouchX;
              const dy = t.clientY - this.lastLookTouchY;
              this.lastLookTouchX = t.clientX;
              this.lastLookTouchY = t.clientY;

              const sens = 0.0042 * this.touchSensitivity;
              this.lookDeltaX += dx * sens;
              this.lookDeltaY += dy * sens;
              break;
            }
          }
        },
        { passive: false }
      );

      const endLook = (e: TouchEvent) => {
        if (this.lookTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.lookTouchId) {
            this.lookTouchId = null;
            break;
          }
        }
      };

      lookZone.addEventListener('touchend', endLook, { passive: true });
      lookZone.addEventListener('touchcancel', endLook, { passive: true });

      lookZone.addEventListener('pointerdown', (e) => {
        if (!this.enabled || this.lookTouchId !== null || e.pointerType === 'mouse') return;
        const target = e.target as HTMLElement | null;
        if (target && target.closest('.touch-btn, #interaction-prompt, #mission-tracker-panel')) return;
        e.preventDefault();
        try {
          lookZone.setPointerCapture(e.pointerId);
        } catch {}
        this.lookTouchId = e.pointerId;
        this.lastLookTouchX = e.clientX;
        this.lastLookTouchY = e.clientY;
      });

      lookZone.addEventListener('pointermove', (e) => {
        if (!this.enabled || this.lookTouchId !== e.pointerId) return;
        const dx = e.clientX - this.lastLookTouchX;
        const dy = e.clientY - this.lastLookTouchY;
        this.lastLookTouchX = e.clientX;
        this.lastLookTouchY = e.clientY;

        const sens = 0.0042 * this.touchSensitivity;
        this.lookDeltaX += dx * sens;
        this.lookDeltaY += dy * sens;
      });

      const endLookPointer = (e: PointerEvent) => {
        if (this.lookTouchId === e.pointerId) {
          this.lookTouchId = null;
        }
      };
      lookZone.addEventListener('pointerup', endLookPointer);
      lookZone.addEventListener('pointercancel', endLookPointer);
    }

    const bindBtn = (id: string, fn: () => void) => {
      const el = document.getElementById(id);
      if (!el) return;
      let lastTriggerTime = -1000;
      const triggerOnce = (e: Event) => {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        const now = performance.now();
        if (now - lastTriggerTime < 220) return;
        lastTriggerTime = now;
        el.classList.add('tap-flash');
        window.setTimeout(() => el.classList.remove('tap-flash'), 140);
        fn();
      };

      el.addEventListener(
        'pointerdown',
        (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          triggerOnce(e);
        },
        { passive: false }
      );
      el.addEventListener('touchstart', triggerOnce, { passive: false });
      el.addEventListener('click', triggerOnce);
    };

    bindBtn('btn-touch-interact', () => this.handlers?.onInteract());
    bindBtn('interaction-prompt', () => this.handlers?.onInteract());
    bindBtn('hiding-indicator', () => this.handlers?.onInteract());
    bindBtn('btn-touch-pulse', () => this.handlers?.onArcPulse());
    bindBtn('btn-touch-flashlight', () => this.handlers?.onFlashlightToggle());
    bindBtn('btn-touch-scan', () => this.handlers?.onScannerPing());
    bindBtn('btn-touch-crouch', () => this.handlers?.onCrouchToggle());
    bindBtn('btn-touch-journal', () => this.handlers?.onJournalToggle());
    bindBtn('btn-touch-pause', () => this.handlers?.onPauseToggle());

    this.sprintBtnEl = document.getElementById('btn-touch-sprint');
    this.crouchBtnEl = document.getElementById('btn-touch-crouch');
    if (this.sprintBtnEl) {
      bindBtn('btn-touch-sprint', () => {
        this.touchSprintToggled = !this.touchSprintToggled;
        this.sprintBtnEl?.classList.toggle('active-toggle', this.touchSprintToggled);
      });
    }
  }

  private resetJoystick(): void {
    this.joystickTouchId = null;
    this.joystickVecX = 0;
    this.joystickVecY = 0;
    this.moveX = 0;
    this.moveZ = 0;
    if (this.joystickBaseEl) {
      this.joystickBaseEl.classList.remove('active');
      this.joystickBaseEl.style.left = '50%';
      this.joystickBaseEl.style.top = '50%';
    }
    if (this.joystickKnobEl) {
      this.joystickKnobEl.style.transform = 'translate(-50%, -50%)';
    }
  }

  private bindLifecycleCleanup(): void {
    window.addEventListener('blur', () => {
      this.clearAllInputs();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearAllInputs();
      }
    });
  }

  public update(dt: number): { lookYawDelta: number; lookPitchDelta: number } {
    if (!this.enabled) {
      return { lookYawDelta: 0, lookPitchDelta: 0 };
    }

    // 1. Keyboard axes
    const kbForward = (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) - (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const kbStrafe = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    const kbTurn = (this.keys['ArrowLeft'] ? 1 : 0) - (this.keys['ArrowRight'] ? 1 : 0);
    if (kbTurn !== 0) {
      this.lookDeltaX -= kbTurn * 1.8 * dt * this.mouseSensitivity;
    }

    // 2. Gamepad polling
    let gpForward = 0;
    let gpStrafe = 0;
    let gpSprint = false;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads?.[0];
    if (pad) {
      const deadzone = 0.16;
      const lx = Math.abs(pad.axes[0] || 0) > deadzone ? pad.axes[0] : 0;
      const ly = Math.abs(pad.axes[1] || 0) > deadzone ? pad.axes[1] : 0;
      const rx = Math.abs(pad.axes[2] || 0) > deadzone ? pad.axes[2] : 0;
      const ry = Math.abs(pad.axes[3] || 0) > deadzone ? pad.axes[3] : 0;

      gpStrafe = lx;
      gpForward = -ly;

      if (rx !== 0 || ry !== 0) {
        this.lookDeltaX += rx * 2.2 * dt * this.mouseSensitivity;
        this.lookDeltaY += ry * 1.8 * dt * this.mouseSensitivity;
      }

      const isPressed = (idx: number) => Boolean(pad.buttons[idx]?.pressed);
      const justPressed = (idx: number) => isPressed(idx) && !this.prevGamepadButtons[idx];

      if (justPressed(0)) this.handlers?.onInteract(); // A / Cross
      if (justPressed(2)) this.handlers?.onFlashlightToggle(); // X / Square
      if (justPressed(3)) this.handlers?.onScannerPing(); // Y / Triangle
      if (justPressed(1)) this.handlers?.onCrouchToggle(); // B / Circle
      if (justPressed(5) || justPressed(7)) this.handlers?.onArcPulse(); // RB / RT -> ARC PULSE
      if (justPressed(8)) this.handlers?.onJournalToggle(); // Select / Back
      if (justPressed(9)) this.handlers?.onPauseToggle(); // Start

      gpSprint = isPressed(4) || isPressed(10); // LB or L3

      this.prevGamepadButtons = pad.buttons.map((b) => Boolean(b?.pressed));
    }

    // Combine Keyboard + Touch Joystick + Gamepad
    this.moveX = Math.max(-1, Math.min(1, kbStrafe + this.joystickVecX + gpStrafe));
    this.moveZ = Math.max(-1, Math.min(1, kbForward + this.joystickVecY + gpForward));

    const isMoving = Math.hypot(this.moveX, this.moveZ) > 0.1;
    if (!isMoving) {
      this.touchSprintToggled = false;
      this.sprintBtnEl?.classList.remove('active-toggle');
    }

    this.sprintHeld =
      isMoving &&
      (Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']) || this.touchSprintToggled || gpSprint);

    const outYaw = -this.lookDeltaX;
    const outPitch = -this.lookDeltaY;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;

    return { lookYawDelta: outYaw, lookPitchDelta: outPitch };
  }

  public syncCrouchVisual(isCrouching: boolean): void {
    this.crouchBtnEl?.classList.toggle('active-toggle', isCrouching);
  }

  public getMovementVector(): { forward: number; right: number } {
    return {
      forward: this.joystickVecY !== 0 ? this.joystickVecY : this.moveZ,
      right: this.joystickVecX !== 0 ? this.joystickVecX : this.moveX
    };
  }
}
