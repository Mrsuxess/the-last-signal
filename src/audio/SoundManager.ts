export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private dreadGain: GainNode | null = null;
  private dreadOsc: OscillatorNode | null = null;
  private initialized = false;
  private volume = 0.8;
  private nextImpactTime = 4;
  private nextHeartbeatTime = 0;

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      this.startAmbientDrone();
      this.initialized = true;
    } catch {
      // Headless or audio-restricted environment fallback
    }
  }

  public setMasterVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getMasterVolume(): number {
    return this.volume;
  }

  public silenceDread(): void {
    if (this.dreadGain && this.ctx) {
      this.dreadGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  private connectWithPan(sourceNode: AudioNode, pan = 0): AudioNode {
    if (!this.ctx || !this.masterGain) return sourceNode;
    if (typeof this.ctx.createStereoPanner === 'function' && Math.abs(pan) > 0.01) {
      try {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        sourceNode.connect(panner);
        panner.connect(this.masterGain);
        return panner;
      } catch {
        // Fallback to direct connection
      }
    }
    sourceNode.connect(this.masterGain);
    return sourceNode;
  }

  private startAmbientDrone(): void {
    if (!this.ctx || !this.masterGain) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.17;
    this.ambientGain.connect(this.masterGain);

    // Deep hull hum (52 Hz + 78 Hz fifths)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 52;

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 78;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 135;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.14;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 42;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(this.ambientGain);

    osc1.start();
    osc2.start();
    lfo.start();

    // Creature proximity dread drone
    this.dreadGain = this.ctx.createGain();
    this.dreadGain.gain.value = 0.0;
    this.dreadGain.connect(this.masterGain);

    this.dreadOsc = this.ctx.createOscillator();
    this.dreadOsc.type = 'sawtooth';
    this.dreadOsc.frequency.value = 39;

    const dreadFilter = this.ctx.createBiquadFilter();
    dreadFilter.type = 'bandpass';
    dreadFilter.frequency.value = 115;
    dreadFilter.Q.value = 2.4;

    this.dreadOsc.connect(dreadFilter);
    dreadFilter.connect(this.dreadGain);
    this.dreadOsc.start();
  }

  public updateAmbient(
    elapsedTime: number,
    creatureDist: number,
    isChasing: boolean,
    isHiding: boolean,
    lowOxygen: boolean
  ): void {
    if (!this.ctx || !this.initialized) return;

    if (this.dreadGain && this.dreadOsc) {
      const proximity = Math.max(0, 1 - creatureDist / 22);
      const targetGain = isChasing ? 0.3 : proximity * 0.22;
      this.dreadGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.15);
      this.dreadOsc.frequency.setTargetAtTime(isChasing ? 66 : 38 + proximity * 22, this.ctx.currentTime, 0.2);
    }

    // Heartbeat thump when hiding with creature nearby, being chased, or critically low O2
    if ((isChasing || (isHiding && creatureDist < 16) || lowOxygen) && elapsedTime > this.nextHeartbeatTime) {
      const interval = isChasing ? 0.55 : 0.82;
      this.nextHeartbeatTime = elapsedTime + interval;
      this.playHeartbeat();
    }

    // Occasional distant metallic groans or electrical crackles
    if (elapsedTime > this.nextImpactTime) {
      this.nextImpactTime = elapsedTime + 6.5 + Math.random() * 9;
      if (Math.random() < 0.6) {
        this.playDistantMetallicImpact();
      } else {
        this.playElectricalInterference();
      }
    }
  }

  public playHeartbeat(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(58, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.16);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playDistantMetallicImpact(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145 + Math.random() * 50, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 1.4);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 1.5);
  }

  public playElectricalInterference(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.3 ? 1 : 0.1);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    noise.start(now);
  }

  public playFootstep(isSprinting: boolean, isCrouching: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const baseFreq = isSprinting ? 130 : isCrouching ? 75 : 100;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq + (Math.random() * 18 - 9), now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.09);

    const vol = isSprinting ? 0.17 : isCrouching ? 0.045 : 0.1;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playFlashlightToggle(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.setValueAtTime(920, now + 0.02);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playArcPulseSound(hitCreature: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // High-voltage electromagnetic discharge sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1650, now);
    osc.frequency.exponentialRampToValueAtTime(hitCreature ? 95 : 180, now + 0.42);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.46);

    // Secondary sub-harmonic EMP thump on hit
    if (hitCreature) {
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(340, now + 0.04);
      subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.65);

      subGain.gain.setValueAtTime(0.32, now + 0.04);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.onended = () => {
        subOsc.disconnect();
        subGain.disconnect();
      };
      subOsc.start(now + 0.04);
      subOsc.stop(now + 0.7);
    }

    this.playElectricalInterference();
  }

  public playCreatureDefeatedSound(): void {
    if (!this.ctx || !this.masterGain) return;
    this.silenceDread();
    const now = this.ctx.currentTime;

    // Dramatic bio-electric core collapse and metallic shriek decay
    const freqs = [480, 320, 190, 95];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      osc.frequency.exponentialRampToValueAtTime(24, now + 1.6);

      gain.gain.setValueAtTime(0.22, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.65);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now + idx * 0.08);
      osc.stop(now + 1.7);
    });
  }

  public playCreatureAttackImpact(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.45);

    gain.gain.setValueAtTime(0.34, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playDoorSound(locked: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (locked) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.setValueAtTime(140, now + 0.1);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.26);
      return;
    }

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.55);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 650;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    noise.start(now);
  }

  public playPickupSound(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(780, now + 0.07);
    osc.frequency.setValueAtTime(1040, now + 0.14);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.29);
  }

  public playGeneratorPowerUp(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 1.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 1.8);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 2.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 2.15);

    // Progressive relay lock-in chimes as sector lights come online
    const relayFreqs = [440, 554.37, 659.25, 880];
    relayFreqs.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const rOsc = this.ctx.createOscillator();
      const rGain = this.ctx.createGain();
      rOsc.type = 'triangle';
      const t0 = now + 0.35 + i * 0.28;
      rOsc.frequency.setValueAtTime(freq, t0);
      rGain.gain.setValueAtTime(0.11, t0);
      rGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
      rOsc.connect(rGain);
      rGain.connect(this.masterGain);
      rOsc.onended = () => {
        rOsc.disconnect();
        rGain.disconnect();
      };
      rOsc.start(t0);
      rOsc.stop(t0 + 0.25);
    });
  }

  public playScannerPing(distToTarget: number, creatureNear: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const pitch = Math.max(420, Math.min(1350, 1250 - distToTarget * 18));
    osc.type = creatureNear ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    if (creatureNear) {
      osc.frequency.linearRampToValueAtTime(pitch * 0.65, now + 0.18);
    }

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playEchoTransmissionTone(corrupted = false): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    this.playElectricalInterference();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(corrupted ? 310 : 660, now);
    osc.frequency.setValueAtTime(corrupted ? 220 : 880, now + 0.09);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playAiVocalCadence(text: string, corrupted = false, voiceVol = 0.85): void {
    if (!this.ctx || !this.masterGain || voiceVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const words = text.split(/\s+/).filter(Boolean);
    const pulseCount = Math.min(10, Math.max(3, Math.ceil(words.length * 0.65)));
    const basePitch = corrupted ? 168 : 215;

    for (let i = 0; i < pulseCount; i++) {
      const t0 = now + 0.06 + i * 0.11;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = corrupted ? 'sawtooth' : 'triangle';
      const charSeed = (words[i % words.length]?.charCodeAt(0) || 70) % 7;
      osc.frequency.setValueAtTime(basePitch + charSeed * 14, t0);
      osc.frequency.linearRampToValueAtTime(basePitch + ((charSeed + 3) % 7) * 11, t0 + 0.085);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(corrupted ? 950 : 1350, t0);
      filter.Q.value = 3.2;

      const amp = Math.min(0.065, 0.045 * voiceVol);
      gain.gain.setValueAtTime(amp, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.095);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      osc.start(t0);
      osc.stop(t0 + 0.1);
    }
  }

  public playCreatureAlert(isChaseStart: boolean, pan = 0): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    if (isChaseStart) {
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.85);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(gain);
      const out = this.connectWithPan(gain, pan);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        if (out !== gain) out.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.92);
    } else {
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(gain);
      const out = this.connectWithPan(gain, pan);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        if (out !== gain) out.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.45);
    }
  }

  public playCreatureStep(distance: number, pan = 0): void {
    if (!this.ctx || !this.masterGain || distance > 24) return;
    const now = this.ctx.currentTime;
    const atten = Math.max(0.01, (1 - distance / 24) * 0.24);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(68, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.16);

    gain.gain.setValueAtTime(atten, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    const out = this.connectWithPan(gain, pan);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      if (out !== gain) out.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playEndingCinematicSound(trustedEcho: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    this.silenceDread();
    const now = this.ctx.currentTime;

    const freqs = trustedEcho ? [110, 138.59, 164.81, 220] : [130.81, 196.0, 261.63, 329.63];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = trustedEcho ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      if (trustedEcho) {
        osc.frequency.linearRampToValueAtTime(f * 0.92, now + 3.2);
      }
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 3.5);
    }
  }
}
