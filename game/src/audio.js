// All sound is synthesised with WebAudio: no audio files, nothing fetched.
// Engine hum, siren, gunshots, crashes, pickups and mission jingles are
// built from oscillators and filtered noise. Everything is guarded so a
// browser without audio (or with it blocked) never breaks the game.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur + 0.02);
    } catch { /* audio is cosmetic */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    try {
      const len = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = context.createGain();
      gain.gain.value = vol || 0.3;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch { /* audio is cosmetic */ }
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 2800);
      tone(180, 0.08, 'square', 0.18, 60);
    },
    enemyShoot() {
      noise(0.1, 0.25, 2000);
    },
    punch() {
      noise(0.08, 0.3, 900);
    },
    crash() {
      noise(0.25, 0.45, 500);
      tone(90, 0.2, 'sine', 0.3, 40);
    },
    explosion() {
      noise(0.7, 0.6, 300);
      tone(60, 0.6, 'sine', 0.4, 28);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.22);
      setTimeout(() => tone(990, 0.14, 'sine', 0.22), 90);
    },
    cash() {
      tone(880, 0.08, 'triangle', 0.2);
      setTimeout(() => tone(1174, 0.1, 'triangle', 0.2), 70);
      setTimeout(() => tone(1568, 0.16, 'triangle', 0.2), 140);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.22), i * 110));
    },
    busted() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.14), i * 160));
    },
    engine(speedRatio, on) {
      if (!ensure()) return;
      try {
        if (!engineOsc) {
          engineOsc = context.createOscillator();
          engineGain = context.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0;
          const filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 700;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        const target = on ? 0.05 + speedRatio * 0.09 : 0;
        engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(70 + speedRatio * 130, context.currentTime, 0.1);
      } catch { /* audio is cosmetic */ }
    },
    siren(on, dt) {
      if (!ensure()) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = context.createOscillator();
          sirenGain = context.createGain();
          sirenOsc.type = 'sine';
          sirenGain.gain.value = 0.045;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
        } else if (!on && sirenOsc) {
          sirenOsc.stop();
          sirenOsc = null;
          sirenGain = null;
          return;
        }
        if (sirenOsc) {
          sirenTimer += dt || 0.016;
          const f = 650 + Math.sin(sirenTimer * 5) * 220;
          sirenOsc.frequency.setTargetAtTime(f, context.currentTime, 0.05);
        }
      } catch { /* audio is cosmetic */ }
    },
  };
}
