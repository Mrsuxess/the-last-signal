import { SoundManager } from './SoundManager';

export type VoicePriority = 'critical' | 'high' | 'normal' | 'optional';

export interface VoiceUtteranceItem {
  id: string;
  text: string;
  priority: VoicePriority;
  corrupted?: boolean;
  durationSec: number;
}

const PRIORITY_RANK: Record<VoicePriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  optional: 1
};

export class EchoVoiceSystem {
  public voiceEnabled = true;
  public voiceVolume = 0.85;
  public isSpeaking = false;
  public currentItem: VoiceUtteranceItem | null = null;
  public lastSpokenText = '';
  public lastSpokenId = '';
  public spokenHistory: Array<{ id: string; text: string; priority: VoicePriority }> = [];

  private spokenIds = new Set<string>();
  private queue: VoiceUtteranceItem[] = [];
  private activeTimer = 0;
  private preferredVoice: SpeechSynthesisVoice | null = null;

  constructor(private sound: SoundManager) {
    this.initSpeechVoices();
  }

  private initSpeechVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const selectVoice = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return;
        const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
        const pool = enVoices.length > 0 ? enVoices : voices;
        this.preferredVoice =
          pool.find((v) => /google uk english female|samantha|victoria|daniel|natural|neural/i.test(v.name)) ||
          pool[0] ||
          null;
      } catch {
        // Ignore in headless environments
      }
    };
    selectVoice();
    try {
      window.speechSynthesis.onvoiceschanged = selectVoice;
    } catch {
      // Ignore
    }
  }

  public setConfig(enabled: boolean, volume: number): void {
    const wasEnabled = this.voiceEnabled;
    this.voiceEnabled = enabled;
    this.voiceVolume = Math.max(0, Math.min(1, volume));
    if (wasEnabled && !enabled) {
      this.stopAll();
    }
  }

  public reset(): void {
    this.stopAll();
    this.spokenIds.clear();
    this.spokenHistory = [];
    this.lastSpokenText = '';
    this.lastSpokenId = '';
  }

  public stopAll(): void {
    this.queue = [];
    this.currentItem = null;
    this.isSpeaking = false;
    this.activeTimer = 0;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  public hasSpoken(id: string): boolean {
    return this.spokenIds.has(id);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public speak(
    id: string,
    text: string,
    priority: VoicePriority = 'normal',
    corrupted = false,
    allowRepeat = false
  ): boolean {
    if (!this.voiceEnabled) return false;
    if (!allowRepeat && this.spokenIds.has(id)) {
      return false;
    }

    // Avoid duplicate queued IDs
    if (this.currentItem?.id === id || this.queue.some((q) => q.id === id)) {
      return false;
    }

    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText) return false;

    const wordCount = cleanText.split(' ').length;
    const durationSec = Math.max(2.0, Math.min(7.5, wordCount * 0.34));

    const item: VoiceUtteranceItem = {
      id,
      text: cleanText,
      priority,
      corrupted,
      durationSec
    };

    // If a critical message arrives while a lower-priority message is active, preempt immediately
    if (
      this.currentItem &&
      PRIORITY_RANK[priority] > PRIORITY_RANK[this.currentItem.priority] &&
      priority === 'critical'
    ) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore
        }
      }
      // Remove optional messages from queue when critical danger occurs
      this.queue = this.queue.filter((q) => q.priority !== 'optional');
      this.startItem(item);
      return true;
    }

    if (!this.currentItem) {
      this.startItem(item);
      return true;
    }

    // Insert into queue sorted by priority rank (highest first)
    this.queue.push(item);
    this.queue.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
    if (this.queue.length > 4) {
      this.queue.length = 4;
    }
    return true;
  }

  private startItem(item: VoiceUtteranceItem): void {
    this.currentItem = item;
    this.isSpeaking = true;
    this.activeTimer = item.durationSec;
    this.spokenIds.add(item.id);
    this.lastSpokenId = item.id;
    this.lastSpokenText = item.text;
    this.spokenHistory.push({ id: item.id, text: item.text, priority: item.priority });

    // Play atmospheric synthetic AI vocal cadence in Web Audio
    this.sound.playAiVocalCadence(item.text, Boolean(item.corrupted), this.voiceVolume);

    // Trigger Browser SpeechSynthesis with calm, controlled AI delivery
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(item.text);
        if (this.preferredVoice) {
          utter.voice = this.preferredVoice;
        }
        utter.lang = 'en-US';
        utter.volume = Math.max(0, Math.min(1, this.voiceVolume * this.sound.getMasterVolume()));
        // Slightly mechanical, calm station intelligence pitch & rate (urgent during critical warnings)
        utter.pitch = item.corrupted ? 0.76 : item.priority === 'critical' ? 0.92 : 0.86;
        utter.rate = item.priority === 'critical' ? 1.04 : 0.96;

        utter.onend = () => {
          if (this.currentItem?.id === item.id) {
            this.advanceQueue();
          }
        };
        utter.onerror = () => {
          // Keep timer-based progression active if headless TTS finishes early or errors
        };

        window.speechSynthesis.speak(utter);
      } catch {
        // Fallback to timer-driven cadence in headless browsers
      }
    }
  }

  private advanceQueue(): void {
    const next = this.queue.shift();
    if (next) {
      this.startItem(next);
    } else {
      this.currentItem = null;
      this.isSpeaking = false;
      this.activeTimer = 0;
    }
  }

  public update(dt: number): void {
    if (!this.currentItem) return;
    this.activeTimer -= dt;
    if (this.activeTimer <= 0) {
      this.advanceQueue();
    }
  }
}
