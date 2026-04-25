(function () {
  "use strict";

const SAMPLE_URLS = {
  decaying: "decaying-sonic-boom.mp3",
  stress: "stress-transition-sound.mp3",
  swing: "slow-swing.mp3",
};

const SAMPLE_DOM_IDS = {
  decaying: "snd-decaying",
  stress: "snd-stress",
  swing: "snd-swing",
};

const SAMPLE_NAMES = Object.keys(SAMPLE_URLS);

function resetAudioElement(audioElement) {
  try {
    audioElement.pause();
    audioElement.currentTime = 0;
  } catch (_) {}
}

function createNoiseBuffer(audioContext, durationSeconds) {
  const frameCount = Math.max(1, Math.floor(audioContext.sampleRate * durationSeconds));
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channelData[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

const AudioFX = (() => {
  let audioContext = null;
  let masterGain = null;
  const cachedAudioElements = {};

  function ensureContext() {
    if (!audioContext) {
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
          return null;
        }

        audioContext = new AudioContextCtor();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.7;
        masterGain.connect(audioContext.destination);
      } catch (_) {
        return null;
      }
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  }

  function getAudioElement(name) {
    if (cachedAudioElements[name]) {
      return cachedAudioElements[name];
    }

    const domId = SAMPLE_DOM_IDS[name];
    let audioElement = domId ? document.getElementById(domId) : null;

    if (!audioElement) {
      const url = SAMPLE_URLS[name];
      if (!url) {
        return null;
      }

      try {
        audioElement = new Audio(url);
        audioElement.preload = "auto";
      } catch (_) {
        return null;
      }
    }

    cachedAudioElements[name] = audioElement;
    return audioElement;
  }

  function preloadAudio() {
    SAMPLE_NAMES.forEach((name) => {
      const audioElement = getAudioElement(name);
      if (!audioElement || typeof audioElement.load !== "function") {
        return;
      }

      try {
        audioElement.load();
      } catch (_) {}
    });
  }

  function primeAudio() {
    SAMPLE_NAMES.forEach((name) => {
      const audioElement = getAudioElement(name);
      if (!audioElement) {
        return;
      }

      try {
        audioElement.muted = true;
        const playback = audioElement.play();
        const reset = () => {
          resetAudioElement(audioElement);
          audioElement.muted = false;
        };

        if (playback && typeof playback.then === "function") {
          playback.then(reset).catch(() => {
            audioElement.muted = false;
          });
          return;
        }

        reset();
      } catch (_) {}
    });
  }

  function animateVolume(audioElement, from, to, durationSeconds, onDone) {
    const startedAt = performance.now();
    const durationMs = Math.max(1, durationSeconds * 1000);
    audioElement.volume = Math.max(0, Math.min(1, from));

    const tick = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      audioElement.volume = Math.max(0, Math.min(1, from + (to - from) * progress));

      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }

      if (onDone) {
        onDone();
      }
    };

    requestAnimationFrame(tick);
  }

  function playAudioElement(name, options = {}) {
    const audioElement = getAudioElement(name);
    if (!audioElement) {
      return;
    }

    const { volume = 0.65, fadeIn = 0.1, fadeOut = 0.6 } = options;
    resetAudioElement(audioElement);
    audioElement.muted = false;
    audioElement.volume = 0;

    const playback = audioElement.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => {});
    }

    animateVolume(audioElement, 0, volume, fadeIn);

    const scheduleFadeOut = () => {
      const duration = Number.isFinite(audioElement.duration) && audioElement.duration > 0
        ? audioElement.duration
        : 2;
      const fadeOutStart = Math.max(fadeIn + 0.05, duration - fadeOut);

      window.setTimeout(() => {
        animateVolume(audioElement, audioElement.volume, 0, fadeOut, () => {
          resetAudioElement(audioElement);
        });
      }, fadeOutStart * 1000);
    };

    if (Number.isFinite(audioElement.duration) && audioElement.duration > 0) {
      scheduleFadeOut();
      return;
    }

    const onMetadataLoaded = () => {
      audioElement.removeEventListener("loadedmetadata", onMetadataLoaded);
      scheduleFadeOut();
    };

    audioElement.addEventListener("loadedmetadata", onMetadataLoaded);
  }

  function unlock() {
    ensureContext();
    primeAudio();
  }

  function createNoiseSource(durationSeconds) {
    const context = ensureContext();
    if (!context) {
      return null;
    }

    const source = context.createBufferSource();
    source.buffer = createNoiseBuffer(context, durationSeconds);
    return source;
  }

  function playClick() {
    const context = ensureContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(1600, now);
    oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.07);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    oscillator.connect(gain).connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  }

  function playFrost() {
    const context = ensureContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const duration = 1.9;

    const noise = createNoiseSource(duration);
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 3800;

    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.22, now + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    noise.connect(highpass).connect(noiseGain).connect(masterGain);
    noise.start(now);
    noise.stop(now + duration);

    [1760, 2637, 3520, 4186].forEach((frequency, index) => {
      const start = now + index * 0.09;
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + 1.3);

      oscillator.connect(gain).connect(masterGain);
      oscillator.start(start);
      oscillator.stop(start + 1.35);
    });
  }

  function playTef() {
    const context = ensureContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const duration = 4.6;

    const rain = createNoiseSource(duration);
    const rainBandpass = context.createBiquadFilter();
    rainBandpass.type = "bandpass";
    rainBandpass.frequency.setValueAtTime(1600, now);
    rainBandpass.frequency.linearRampToValueAtTime(1250, now + duration);
    rainBandpass.Q.value = 0.7;

    const rainLowpass = context.createBiquadFilter();
    rainLowpass.type = "lowpass";
    rainLowpass.frequency.value = 2400;

    const rainGain = context.createGain();
    rainGain.gain.setValueAtTime(0.0001, now);
    rainGain.gain.linearRampToValueAtTime(0.18, now + 0.55);
    rainGain.gain.linearRampToValueAtTime(0.13, now + 2.6);
    rainGain.gain.linearRampToValueAtTime(0.06, now + duration - 0.9);
    rainGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    rain.connect(rainBandpass).connect(rainLowpass).connect(rainGain).connect(masterGain);
    rain.start(now);
    rain.stop(now + duration);

    for (let index = 0; index < 16; index += 1) {
      const start = now + 0.25 + Math.random() * 2.4;
      const tail = Math.min(1, (now + 2.85 - start) / 0.6, (start - now) / 0.4);
      const drop = createNoiseSource(0.09);
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2200 + Math.random() * 2400;
      filter.Q.value = 5.5;

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.09 * tail, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.1);

      drop.connect(filter).connect(gain).connect(masterGain);
      drop.start(start);
      drop.stop(start + 0.12);
    }

    const fluteNotes = [
      { frequency: 440.0, at: 0.35, duration: 0.55, hold: 0.65 },
      { frequency: 523.25, at: 0.95, duration: 0.45, hold: 0.65 },
      { frequency: 587.33, at: 1.45, duration: 0.5, hold: 0.65 },
      { frequency: 659.25, at: 2.0, duration: 0.55, hold: 0.65 },
      { frequency: 587.33, at: 2.6, duration: 0.4, hold: 0.6 },
      { frequency: 440.0, at: 3.0, duration: 1.5, hold: 0.35 },
    ];

    fluteNotes.forEach((note) => {
      const start = now + note.at;

      const oscillator = context.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(note.frequency, start);

      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 5.2;

      const lfoGain = context.createGain();
      lfoGain.gain.value = 2.2;
      lfo.connect(lfoGain).connect(oscillator.frequency);

      const oscillatorGain = context.createGain();
      oscillatorGain.gain.setValueAtTime(0.0001, start);
      oscillatorGain.gain.linearRampToValueAtTime(0.085, start + 0.08);
      oscillatorGain.gain.setValueAtTime(0.085, start + note.duration * note.hold);
      oscillatorGain.gain.exponentialRampToValueAtTime(0.0005, start + note.duration);

      oscillator.connect(oscillatorGain).connect(masterGain);
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.05);
      lfo.start(start);
      lfo.stop(start + note.duration + 0.05);

      const breath = createNoiseSource(Math.min(0.6, note.duration + 0.1));
      const breathBandpass = context.createBiquadFilter();
      breathBandpass.type = "bandpass";
      breathBandpass.frequency.value = note.frequency * 2;
      breathBandpass.Q.value = 6;

      const breathGain = context.createGain();
      breathGain.gain.setValueAtTime(0.0001, start);
      breathGain.gain.linearRampToValueAtTime(0.024, start + 0.05);
      breathGain.gain.exponentialRampToValueAtTime(0.0005, start + note.duration * 0.9);

      breath.connect(breathBandpass).connect(breathGain).connect(masterGain);
      breath.start(start);
      breath.stop(start + note.duration + 0.05);
    });

    const echoStart = now + 3.8;
    const echoEnd = now + duration;
    const echo = context.createOscillator();
    echo.type = "sine";
    echo.frequency.value = 220;

    const echoGain = context.createGain();
    echoGain.gain.setValueAtTime(0.0001, echoStart);
    echoGain.gain.linearRampToValueAtTime(0.05, echoStart + 0.4);
    echoGain.gain.exponentialRampToValueAtTime(0.0005, echoEnd);

    echo.connect(echoGain).connect(masterGain);
    echo.start(echoStart);
    echo.stop(echoEnd + 0.05);
  }

  function playWestStates() {
    const context = ensureContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const duration = 4.8;

    const wind = createNoiseSource(duration);
    const windLowpass = context.createBiquadFilter();
    windLowpass.type = "lowpass";
    windLowpass.frequency.setValueAtTime(240, now);
    windLowpass.frequency.linearRampToValueAtTime(780, now + 1.4);
    windLowpass.frequency.linearRampToValueAtTime(210, now + duration);
    windLowpass.Q.value = 5;

    const windGain = context.createGain();
    windGain.gain.setValueAtTime(0.0001, now);
    windGain.gain.linearRampToValueAtTime(0.38, now + 0.8);
    windGain.gain.linearRampToValueAtTime(0.26, now + 2.3);
    windGain.gain.linearRampToValueAtTime(0.13, now + duration - 0.9);
    windGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    wind.connect(windLowpass).connect(windGain).connect(masterGain);
    wind.start(now);
    wind.stop(now + duration);

    const rumble = context.createOscillator();
    rumble.type = "sine";
    rumble.frequency.setValueAtTime(46, now);
    rumble.frequency.linearRampToValueAtTime(40, now + duration);

    const rumbleGain = context.createGain();
    rumbleGain.gain.setValueAtTime(0.0001, now);
    rumbleGain.gain.linearRampToValueAtTime(0.12, now + 0.9);
    rumbleGain.gain.linearRampToValueAtTime(0.08, now + 2.6);
    rumbleGain.gain.linearRampToValueAtTime(0.04, now + duration - 0.6);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    rumble.connect(rumbleGain).connect(masterGain);
    rumble.start(now);
    rumble.stop(now + duration + 0.05);

    const hornNotes = [
      { frequency: 196.0, at: 0.4, duration: 0.9, hold: 0.55 },
      { frequency: 164.81, at: 1.4, duration: 1.0, hold: 0.55 },
      { frequency: 164.81, at: 2.55, duration: 2.05, hold: 0.55 },
    ];

    hornNotes.forEach((note) => {
      const start = now + note.at;

      const horn = context.createOscillator();
      horn.type = "sawtooth";
      horn.frequency.setValueAtTime(note.frequency, start);

      const hornLowpass = context.createBiquadFilter();
      hornLowpass.type = "lowpass";
      hornLowpass.frequency.value = note.frequency * 4.5;

      const hornGain = context.createGain();
      hornGain.gain.setValueAtTime(0.0001, start);
      hornGain.gain.linearRampToValueAtTime(0.08, start + 0.25);
      hornGain.gain.setValueAtTime(0.08, start + note.duration * note.hold);
      hornGain.gain.exponentialRampToValueAtTime(0.0005, start + note.duration);

      horn.connect(hornLowpass).connect(hornGain).connect(masterGain);
      horn.start(start);
      horn.stop(start + note.duration + 0.05);

      const breath = createNoiseSource(note.duration + 0.1);
      const breathBandpass = context.createBiquadFilter();
      breathBandpass.type = "bandpass";
      breathBandpass.frequency.value = note.frequency * 3;
      breathBandpass.Q.value = 3.5;

      const breathGain = context.createGain();
      breathGain.gain.setValueAtTime(0.0001, start);
      breathGain.gain.linearRampToValueAtTime(0.03, start + 0.15);
      breathGain.gain.exponentialRampToValueAtTime(0.0005, start + note.duration);

      breath.connect(breathBandpass).connect(breathGain).connect(masterGain);
      breath.start(start);
      breath.stop(start + note.duration + 0.05);
    });

    [1.05, 2.2].forEach((at) => {
      const start = now + at;
      const creak = createNoiseSource(0.4);
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(360 + Math.random() * 180, start);
      filter.frequency.linearRampToValueAtTime(220, start + 0.3);
      filter.Q.value = 11;

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.09);
      gain.gain.linearRampToValueAtTime(0.035, start + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.38);

      creak.connect(filter).connect(gain).connect(masterGain);
      creak.start(start);
      creak.stop(start + 0.42);
    });
  }

  function playSevas() {
    const context = ensureContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const duration = 3.3;
    const bellFundamental = 146.83;
    const bellPartials = [1, 1.5, 2, 2.67, 4];
    const bellGains = [0.22, 0.14, 0.1, 0.06, 0.035];

    bellPartials.forEach((ratio, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = bellFundamental * ratio;

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(bellGains[index], now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

      oscillator.connect(gain).connect(masterGain);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.05);
    });

    const water = createNoiseSource(duration);
    const waterLowpass = context.createBiquadFilter();
    waterLowpass.type = "lowpass";
    waterLowpass.frequency.setValueAtTime(480, now);
    waterLowpass.frequency.linearRampToValueAtTime(820, now + duration * 0.55);
    waterLowpass.frequency.linearRampToValueAtTime(320, now + duration);
    waterLowpass.Q.value = 1.2;

    const waterGain = context.createGain();
    waterGain.gain.setValueAtTime(0.0001, now);
    waterGain.gain.linearRampToValueAtTime(0.11, now + 0.6);
    waterGain.gain.linearRampToValueAtTime(0.07, now + duration - 0.8);
    waterGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    water.connect(waterLowpass).connect(waterGain).connect(masterGain);
    water.start(now);
    water.stop(now + duration);

    [0.55, 1.2, 1.9, 2.55].forEach((at) => {
      const start = now + at;
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(380, start);
      oscillator.frequency.exponentialRampToValueAtTime(165, start + 0.3);

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.35);

      oscillator.connect(gain).connect(masterGain);
      oscillator.start(start);
      oscillator.stop(start + 0.4);
    });
  }

  function playNales() {
    const context = ensureContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const duration = 4.7;

    [
      { frequency: 73.42, gain: 0.11 },
      { frequency: 110.0, gain: 0.07 },
    ].forEach((drone) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = drone.frequency;

      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(420, now);
      lowpass.frequency.linearRampToValueAtTime(680, now + duration * 0.55);
      lowpass.frequency.linearRampToValueAtTime(320, now + duration);
      lowpass.Q.value = 4.5;

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(drone.gain, now + 0.55);
      gain.gain.linearRampToValueAtTime(drone.gain * 0.7, now + 2.6);
      gain.gain.linearRampToValueAtTime(drone.gain * 0.35, now + duration - 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

      oscillator.connect(lowpass).connect(gain).connect(masterGain);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.05);
    });

    const sand = createNoiseSource(duration);
    const sandBandpass = context.createBiquadFilter();
    sandBandpass.type = "bandpass";
    sandBandpass.frequency.setValueAtTime(1900, now);
    sandBandpass.frequency.linearRampToValueAtTime(850, now + duration);
    sandBandpass.Q.value = 0.9;

    const sandGain = context.createGain();
    sandGain.gain.setValueAtTime(0.0001, now);
    sandGain.gain.linearRampToValueAtTime(0.13, now + 0.6);
    sandGain.gain.linearRampToValueAtTime(0.09, now + 2.6);
    sandGain.gain.linearRampToValueAtTime(0.045, now + duration - 0.9);
    sandGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    sand.connect(sandBandpass).connect(sandGain).connect(masterGain);
    sand.start(now);
    sand.stop(now + duration);

    const pluckNotes = [
      { frequency: 293.66, at: 0.45, decay: 0.55 },
      { frequency: 311.13, at: 1.0, decay: 0.55 },
      { frequency: 369.99, at: 1.55, decay: 0.55 },
      { frequency: 392.0, at: 2.1, decay: 0.55 },
      { frequency: 369.99, at: 2.6, decay: 0.55 },
      { frequency: 293.66, at: 3.05, decay: 1.6 },
    ];

    pluckNotes.forEach((note) => {
      const start = now + note.at;

      const body = context.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(note.frequency, start);

      const bodyHighpass = context.createBiquadFilter();
      bodyHighpass.type = "highpass";
      bodyHighpass.frequency.value = 180;

      const bodyGain = context.createGain();
      bodyGain.gain.setValueAtTime(0.0001, start);
      bodyGain.gain.linearRampToValueAtTime(0.1, start + 0.008);
      bodyGain.gain.exponentialRampToValueAtTime(0.0005, start + note.decay);

      body.connect(bodyHighpass).connect(bodyGain).connect(masterGain);
      body.start(start);
      body.stop(start + note.decay + 0.05);

      const bite = context.createOscillator();
      bite.type = "sine";
      bite.frequency.setValueAtTime(note.frequency * 2, start);

      const biteGain = context.createGain();
      biteGain.gain.setValueAtTime(0.0001, start);
      biteGain.gain.linearRampToValueAtTime(0.045, start + 0.005);
      biteGain.gain.exponentialRampToValueAtTime(0.0005, start + 0.35);

      bite.connect(biteGain).connect(masterGain);
      bite.start(start);
      bite.stop(start + 0.4);
    });

    [0.3, 1.45, 2.55, 3.05].forEach((at, index) => {
      const start = now + at;
      const peak = index === 3 ? 0.1 : 0.15;
      const drum = context.createOscillator();
      drum.type = "sine";
      drum.frequency.setValueAtTime(96, start);
      drum.frequency.exponentialRampToValueAtTime(54, start + 0.22);

      const drumGain = context.createGain();
      drumGain.gain.setValueAtTime(0.0001, start);
      drumGain.gain.linearRampToValueAtTime(peak, start + 0.006);
      drumGain.gain.exponentialRampToValueAtTime(0.0005, start + 0.3);

      drum.connect(drumGain).connect(masterGain);
      drum.start(start);
      drum.stop(start + 0.34);
    });

    const anchorStart = now + 3.05;
    const anchorEnd = now + duration;
    const anchor = context.createOscillator();
    anchor.type = "sine";
    anchor.frequency.value = 73.42;

    const anchorGain = context.createGain();
    anchorGain.gain.setValueAtTime(0.0001, anchorStart);
    anchorGain.gain.linearRampToValueAtTime(0.08, anchorStart + 0.4);
    anchorGain.gain.exponentialRampToValueAtTime(0.0005, anchorEnd);

    anchor.connect(anchorGain).connect(masterGain);
    anchor.start(anchorStart);
    anchor.stop(anchorEnd + 0.05);
  }

  function playDecayingSonicBoom() {
    playAudioElement("decaying", { volume: 0.62, fadeIn: 0.05, fadeOut: 1.6 });
  }

  function playStressTransition() {
    playAudioElement("stress", { volume: 0.75, fadeIn: 0.08, fadeOut: 1.3 });
  }

  function playSlowSwing() {
    playAudioElement("swing", { volume: 0.6, fadeIn: 0.12, fadeOut: 1.1 });
  }

  const regionSounds = {
    fpedvesga: playFrost,
    tef: playTef,
    west_states: playWestStates,
    sevas: playSevas,
    nales: playNales,
  };

  function playRegion(regionId) {
    const play = regionSounds[regionId];
    if (play) {
      play();
    }
  }

  ["pointerdown", "keydown", "touchstart", "mousedown"].forEach((eventName) => {
    window.addEventListener(eventName, unlock, { capture: true, passive: true });
  });

  return {
    unlock,
    playClick,
    playRegion,
    playDecayingSonicBoom,
    playStressTransition,
    playSlowSwing,
    preload: preloadAudio,
  };
})();

window.AudioFX = AudioFX;

})();
