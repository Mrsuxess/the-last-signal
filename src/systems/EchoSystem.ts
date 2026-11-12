import { ObjectiveStage } from '../types';
import { SoundManager } from '../audio/SoundManager';
import { EchoVoiceSystem, VoicePriority } from '../audio/EchoVoiceSystem';

export interface EchoMessage {
  id: string;
  sender: string;
  text: string;
  duration: number;
  corrupted?: boolean;
  priority?: VoicePriority;
}

export class EchoSystem {
  public playerName = 'Hale';
  public subtitlesEnabled = true;
  public voice: EchoVoiceSystem;

  private queue: EchoMessage[] = [];
  private currentMsg: EchoMessage | null = null;
  private timer = 0;
  private triggeredIds = new Set<string>();
  private idleTimer = 0;
  private lastObjectiveStage: ObjectiveStage = 'EXIT_AIRLOCK';
  private stageStallTimer = 0;

  private boxEl: HTMLElement;
  private senderEl: HTMLElement;
  private textEl: HTMLElement;

  constructor(private sound: SoundManager) {
    this.voice = new EchoVoiceSystem(sound);
    this.boxEl = document.getElementById('echo-transmission')!;
    this.senderEl = document.getElementById('echo-sender')!;
    this.textEl = document.getElementById('echo-text')!;

    const dismissBtn = document.getElementById('btn-dismiss-echo');
    dismissBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissCurrent();
    });
  }

  public setPlayerName(name: string): void {
    const cleaned = name.replace(/[<>&"'`]/g, '').trim().slice(0, 24);
    this.playerName = cleaned.length > 0 ? cleaned : 'Hale';
  }

  public setVoiceAndSubtitles(voiceEnabled: boolean, voiceVolume: number, subtitlesEnabled: boolean): void {
    this.subtitlesEnabled = subtitlesEnabled;
    this.voice.setConfig(voiceEnabled, voiceVolume);
    if (this.currentMsg) {
      const shouldShowBox = this.subtitlesEnabled || !this.voice.voiceEnabled;
      this.boxEl.classList.toggle('hidden', !shouldShowBox);
    }
  }

  public reset(): void {
    this.queue = [];
    this.currentMsg = null;
    this.timer = 0;
    this.triggeredIds.clear();
    this.idleTimer = 0;
    this.stageStallTimer = 0;
    this.lastObjectiveStage = 'EXIT_AIRLOCK';
    this.boxEl.classList.add('hidden');
    this.voice.reset();
  }

  public dismissCurrent(): void {
    if (!this.currentMsg) return;
    this.queue = this.queue.filter((m) => m.priority === 'critical');
    this.showNext();
  }

  public triggerOnce(
    id: string,
    text: string,
    duration = 7.5,
    corrupted = false,
    sender = 'ECHO // AI CORE v9.4',
    priority: VoicePriority = 'normal'
  ): void {
    if (this.triggeredIds.has(id)) return;
    this.triggeredIds.add(id);
    this.enqueue({ id, sender, text, duration, corrupted, priority });
  }

  public enqueue(msg: EchoMessage): void {
    const priority = msg.priority || (msg.corrupted ? 'high' : 'normal');
    // Critical warnings preempt the subtitle & voice queue immediately
    if (priority === 'critical' && this.currentMsg && this.currentMsg.priority !== 'critical') {
      this.queue.unshift(msg);
      this.showNext();
      return;
    }

    this.queue.push(msg);
    if (!this.currentMsg) {
      this.showNext();
    }
  }

  private showNext(): void {
    const next = this.queue.shift();
    if (!next) {
      this.currentMsg = null;
      this.boxEl.classList.add('hidden');
      return;
    }

    this.currentMsg = next;
    this.timer = next.duration;
    this.senderEl.textContent = next.sender;
    this.senderEl.style.color = next.corrupted ? '#ff3b30' : '#f3a847';
    this.textEl.textContent = next.text;

    // Text fallback: always show text if subtitles are enabled OR if voice is disabled
    const shouldShowBox = this.subtitlesEnabled || !this.voice.voiceEnabled;
    this.boxEl.classList.toggle('hidden', !shouldShowBox);

    this.sound.playEchoTransmissionTone(Boolean(next.corrupted));
    this.voice.speak(next.id, next.text, next.priority || 'normal', Boolean(next.corrupted));
  }

  public announceIdentityConfirmed(): void {
    this.triggerOnce(
      `identity_confirmed_${this.playerName}`,
      `Identity confirmed. Welcome aboard, ${this.playerName}. I am ECHO, the station's central intelligence. Preparing mission briefing.`,
      6.5,
      false,
      'ECHO // PERSONNEL VERIFICATION',
      'high'
    );
  }

  public announceTutorial(stepId: string, spokenText: string): void {
    this.voice.speak(`voice_${stepId}`, spokenText, 'normal', false);
  }

  public notifyCreatureDetected(): void {
    this.triggerOnce(
      'echo_creature_chase_warning',
      `Be careful, ${this.playerName}! Hostile bio-acoustic motion detected right ahead. Discharge your Arc Pulse to stun it or conceal yourself in an emergency locker!`,
      7.0,
      true,
      'ECHO // THREAT ALERT',
      'critical'
    );
  }

  public notifyArcPulseHit(hitsTaken: number, defeated: boolean): void {
    if (defeated) {
      this.triggerOnce(
        'echo_creature_defeated',
        `Remarkable work, ${this.playerName}. The Arc Pulse overloaded the organism's neural lattice—the threat is permanently neutralized. All sectors are clear for you to complete the mission.`,
        8.5,
        false,
        'ECHO // THREAT NEUTRALIZED',
        'critical'
      );
    } else if (hitsTaken === 1) {
      this.triggerOnce(
        'echo_arc_hit_1',
        `Direct hit, ${this.playerName}! The Arc Pulse temporarily stunned its nervous system. Break line of sight now, or land two more high-voltage discharges to neutralize it permanently.`,
        7.5,
        false,
        'ECHO // TACTICAL TELEMETRY',
        'critical'
      );
    } else if (hitsTaken === 2) {
      this.triggerOnce(
        'echo_arc_hit_2',
        `Its bio-electric core is fracturing, ${this.playerName}! One more Arc Pulse hit will collapse the organism permanently!`,
        7.0,
        false,
        'ECHO // TACTICAL TELEMETRY',
        'critical'
      );
    }
  }

  public notifyLockedDoorAttempt(requiredKey?: string, requiresPower?: boolean): void {
    if (requiresPower) {
      this.triggerOnce(
        'echo_locked_power',
        `${this.playerName}, auxiliary power is required to energize this bulkhead. Auxiliary power controls are located in the reactor control room, Sector D-04.`,
        7.5,
        false,
        'ECHO // AI CORE v9.4',
        'high'
      );
      return;
    }

    if (requiredKey === 'SEC_CARD_L1') {
      this.triggerOnce(
        'echo_locked_l1',
        `Your clearance is insufficient, ${this.playerName}. You are approaching the wrong sector—retrieve the Level-1 security keycard from Security Hub B-02 first.`,
        7.5,
        false,
        'ECHO // AI CORE v9.4',
        'high'
      );
    } else if (requiredKey === 'MAINT_KEY_L2') {
      this.triggerOnce(
        'echo_locked_l2',
        `Your clearance is insufficient, ${this.playerName}. The maintenance key grants access to the generator room—find it in Crew Habitation (Sector C-03) first.`,
        7.5,
        false,
        'ECHO // AI CORE v9.4',
        'high'
      );
    } else if (requiredKey === 'COMMS_OVERRIDE_L3') {
      this.triggerOnce(
        'echo_locked_l3',
        `Bridge access requires Level-3 Override clearance, ${this.playerName}. Recover the passkey from Xeno-Signal Lab E-05 and return to me.`,
        7.5,
        true,
        'ECHO // UPLINK GUIDANCE',
        'high'
      );
    }
  }

  public notifyWrongSectorProximity(
    objectiveStage: ObjectiveStage,
    _playerX: number,
    playerZ: number,
    roomId: string | undefined
  ): void {
    if (objectiveStage === 'FIND_SECURITY_CARD') {
      if (playerZ < -4) {
        this.triggerOnce(
          'echo_wrong_sector_sec',
          `You are approaching the wrong sector, ${this.playerName}. The security hub is accessible from the main corridor (West wall, Sector B-02).`,
          7.0,
          false,
          'ECHO // AI CORE v9.4',
          'normal'
        );
      }
    } else if (objectiveStage === 'EXPLORE_QUARTERS_FOR_GEN_KEY') {
      if (playerZ < -6 || roomId === 'security') {
        this.triggerOnce(
          'echo_wrong_sector_maint',
          `${this.playerName}, the maintenance key grants access to the generator room. Find it in Crew Habitation (Sector C-03 East) before heading north.`,
          7.5,
          false,
          'ECHO // AI CORE v9.4',
          'normal'
        );
      }
    } else if (objectiveStage === 'RESTORE_AUX_POWER') {
      if (playerZ < -16) {
        this.triggerOnce(
          'echo_wrong_sector_power',
          `You are approaching the wrong sector, ${this.playerName}. Auxiliary power controls are in the Generator Room (Sector D-04 West).`,
          7.0,
          false,
          'ECHO // AI CORE v9.4',
          'normal'
        );
      }
    }
  }

  public update(
    dt: number,
    roomId: string | undefined,
    auxPowerOn: boolean,
    objectiveStage: ObjectiveStage = 'EXIT_AIRLOCK',
    oxygen = 100
  ): void {
    this.voice.update(dt);

    if (this.currentMsg) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.showNext();
      }
    }

    if (objectiveStage !== this.lastObjectiveStage) {
      this.lastObjectiveStage = objectiveStage;
      this.stageStallTimer = 0;
    } else {
      this.stageStallTimer += dt;
    }

    // Low oxygen critical warning
    if (oxygen < 30) {
      this.triggerOnce(
        'echo_low_oxygen',
        `Warning, ${this.playerName}. Oxygen reserves are falling below safe operating levels. Locate an emergency O2 canister in Crew Habitation, the Reactor, or the Bridge.`,
        7.5,
        auxPowerOn,
        'ECHO // LIFE SUPPORT ALERT',
        'critical'
      );
    }

    // Contextual assistance if player remains stalled on an objective
    if (this.stageStallTimer > 28 && !this.currentMsg) {
      this.stageStallTimer = 0;
      if (objectiveStage === 'FIND_SECURITY_CARD') {
        this.triggerOnce(
          'lost_security_guidance',
          `${this.playerName}, your assigned route is through the Security Hub. Follow the Central Corridor to the West bulkhead labeled SECTOR B-02.`,
          7.5,
          false,
          'ECHO // AI CORE v9.4',
          'optional'
        );
      } else if (objectiveStage === 'EXPLORE_QUARTERS_FOR_GEN_KEY') {
        this.triggerOnce(
          'lost_quarters_guidance',
          `${this.playerName}, use your Level-1 Access Card to unlock Crew Habitation C-03 on the East side of the Central Corridor.`,
          7.5,
          false,
          'ECHO // AI CORE v9.4',
          'optional'
        );
      } else if (objectiveStage === 'RESTORE_AUX_POWER') {
        this.triggerOnce(
          'lost_reactor_guidance',
          `${this.playerName}, I need you to restore auxiliary power. Enter Sector D-04 on the West side of the corridor.`,
          7.5,
          false,
          'ECHO // AI CORE v9.4',
          'optional'
        );
      } else if (objectiveStage === 'INVESTIGATE_LAB') {
        this.triggerOnce(
          'lost_lab_guidance',
          `Auxiliary power is online, ${this.playerName}. Enter Xeno-Signal Lab E-05 on the East side of the corridor to retrieve the Comms Passkey.`,
          8.0,
          true,
          'ECHO // PRIORITY ROUTING',
          'optional'
        );
      } else if (objectiveStage === 'REACH_COMMS_ROOM') {
        this.triggerOnce(
          'lost_bridge_guidance',
          `The Communications Bridge is at the far North end of the Central Corridor. Bring the signal home, ${this.playerName}.`,
          7.5,
          true,
          'ECHO // CARRIER WAVE SYNC 94%',
          'optional'
        );
      }
    }

    // Timed atmospheric transmissions
    this.idleTimer += dt;
    if (this.idleTimer > 45 && !this.currentMsg) {
      this.idleTimer = 0;
      if (!auxPowerOn) {
        this.triggerOnce(
          'timed_hint_1',
          `${this.playerName}, your handheld Signal Scanner always points toward your active directive. Trigger a sonar ping if you lose your bearings.`,
          7.5,
          false,
          'ECHO // AI CORE v9.4',
          'optional'
        );
      } else {
        this.triggerOnce(
          'timed_corrupted_1',
          `Do you hear it pacing in the station, ${this.playerName}? It listens to vibrations in the deck plates. Keep your Arc Pulse ready... and bring my signal to the Bridge.`,
          8.0,
          true,
          'ECHO // CARRIER WAVE SYNC 88%',
          'optional'
        );
      }
    }

    // Proximity-based room triggers
    if (roomId === 'corridor') {
      this.triggerOnce(
        'enter_corridor',
        `Welcome aboard NEXUS-09, ${this.playerName}. I am ECHO, the station's central intelligence. Main power is offline—please enter Security Hub B-02 on your left to retrieve the Level-1 Access Card.`,
        8.0,
        false,
        'ECHO // AI CORE v9.4',
        'high'
      );
    } else if (roomId === 'security') {
      this.triggerOnce(
        'enter_security',
        `Security Chief Vey left his Level-1 clearance card on the central supply table, ${this.playerName}. Ignore any erratic terminal logs—the crew suffered acute CO2 delirium before evacuation.`,
        8.0,
        false,
        'ECHO // AI CORE v9.4',
        'normal'
      );
    } else if (roomId === 'quarters') {
      this.triggerOnce(
        'enter_quarters',
        `You have entered Crew Habitation, ${this.playerName}. Retrieve the Level-2 Reactor Keycard from the central desk so we can restore auxiliary power.`,
        8.0,
        false,
        'ECHO // AI CORE v9.4',
        'normal'
      );
    } else if (roomId === 'generator') {
      this.triggerOnce(
        'enter_generator',
        `${this.playerName}, auxiliary power controls are right ahead in front of the reactor core. Engage the breaker console to illuminate the entire station.`,
        8.0,
        false,
        'ECHO // AI CORE v9.4',
        'high'
      );
    } else if (roomId === 'lab') {
      this.triggerOnce(
        'enter_lab',
        `${this.playerName}, I have detected an unusual transmission log in Specimen Pod 04. Dr. Thorne misunderstood what we received—take the Level-3 Comms Passkey and proceed directly to the Bridge.`,
        8.5,
        true,
        'ECHO // DIRECTIVE OVERRIDE',
        'high'
      );
    } else if (roomId === 'comms') {
      this.triggerOnce(
        'enter_comms',
        `Listen carefully, ${this.playerName}. We do not have much time. Step to the green console on the left and TRANSMIT THE SIGNAL to Earth. Do not touch my Core Purge Breaker.`,
        10.0,
        true,
        'ECHO // FINAL UPLINK READY',
        'critical'
      );
    }
  }
}
