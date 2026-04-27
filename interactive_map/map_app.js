(function () {
  "use strict";

const AudioFX = window.AudioFX;
const initEditor = window.initMapEditor;
const mapRegions = window.MapRegions || {};
const {
  REGIONS,
  applyTransform,
  findRegionById,
  getOverlayEyebrow,
  getRegionTitle,
} = mapRegions;

const safeAudioFX = AudioFX && typeof AudioFX === "object"
  ? AudioFX
  : {
      unlock() {},
      playClick() {},
      playRegion() {},
      playDecayingSonicBoom() {},
      playStressTransition() {},
      playSlowSwing() {},
      preload() {},
    };

const safeInitEditor = typeof initEditor === "function" ? initEditor : () => {};

if (!window.MapRegions || !Array.isArray(REGIONS) || typeof applyTransform !== "function") {
  throw new Error("Map regions failed to initialize. Check script loading order in index.html.");
}

const SVG_NS = "http://www.w3.org/2000/svg";
const INTRO_AUTO_END = 14500;
const INTRO_STEPS = [
  { id: "made-by", enterAt: 400, leaveAt: null },
  { id: "author", enterAt: 400, leaveAt: null },
  { id: "book", enterAt: 8700, leaveAt: 14100 },
  { id: "subtitle", enterAt: 12600, leaveAt: 14100 },
];

const INTRO_STEP_SOUNDS = {
  "made-by": () => safeAudioFX.playDecayingSonicBoom(),
  book: () => safeAudioFX.playStressTransition(),
  subtitle: () => safeAudioFX.playSlowSwing(),
};

function isEditorEnabled() {
  return document.body.classList.contains("editor-on");
}

function createRegionElement(region) {
  const tagName = region.d ? "path" : "polygon";
  const regionElement = document.createElementNS(SVG_NS, tagName);

  if (region.d) {
    regionElement.setAttribute("d", region.d);
  } else {
    regionElement.setAttribute("points", region.points);
  }

  applyTransform(regionElement, region);
  regionElement.setAttribute("class", "region");
  regionElement.setAttribute("data-id", region.id);
  regionElement.setAttribute("tabindex", "0");
  regionElement.setAttribute("role", "button");
  regionElement.setAttribute("aria-label", region.title);
  return regionElement;
}

function renderRegions(svg) {
  return REGIONS.map((region) => {
    const regionElement = createRegionElement(region);
    svg.appendChild(regionElement);
    return regionElement;
  });
}

function runIntro() {
  const intro = document.getElementById("intro");
  const skipButton = document.getElementById("intro-skip");
  const enterHint = document.getElementById("intro-enter");
  const atlas = document.getElementById("atlas");
  if (!intro || !atlas) {
    return;
  }

  const steps = new Map();
  INTRO_STEPS.forEach((step) => {
    const stepElement = intro.querySelector(`[data-step="${step.id}"]`);
    if (stepElement) {
      steps.set(step.id, stepElement);
    }
  });

  const timers = [];
  let isStarted = false;
  let isFinished = false;

  enterHint?.classList.add("is-visible");

  function finishIntro() {
    if (isFinished) {
      return;
    }

    isFinished = true;
    timers.forEach((timerId) => clearTimeout(timerId));
    intro.classList.add("is-hidden");
    intro.setAttribute("aria-hidden", "true");
    atlas.classList.add("is-visible");
    atlas.setAttribute("aria-hidden", "false");
    document.body.classList.remove("is-intro");
    window.setTimeout(() => intro.remove(), 1200);
  }

  function startIntro() {
    if (isStarted) {
      return;
    }

    isStarted = true;
    safeAudioFX.unlock();
    enterHint?.classList.remove("is-visible");

    INTRO_STEPS.forEach((step) => {
      const stepElement = steps.get(step.id);
      if (!stepElement) {
        return;
      }

      timers.push(
        window.setTimeout(() => {
          stepElement.classList.add("is-visible");
          INTRO_STEP_SOUNDS[step.id]?.();
        }, step.enterAt)
      );

      if (step.leaveAt != null) {
        timers.push(
          window.setTimeout(() => {
            stepElement.classList.add("is-leaving");
          }, step.leaveAt)
        );
      }
    });

    timers.push(window.setTimeout(finishIntro, INTRO_AUTO_END));
  }

  intro.addEventListener("click", (event) => {
    if (event.target === skipButton) {
      return;
    }

    if (!isStarted) {
      startIntro();
      return;
    }

    finishIntro();
  });

  skipButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    finishIntro();
  });

  window.addEventListener("keydown", function keyHandler(event) {
    if (isFinished) {
      window.removeEventListener("keydown", keyHandler);
      return;
    }

    const isTriggerKey =
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "Escape" ||
      event.key.length === 1;

    if (!isTriggerKey) {
      return;
    }

    if (!isStarted) {
      startIntro();
      return;
    }

    finishIntro();
  });
}

function initOverlay() {
  const overlay = document.getElementById("region-overlay");
  const titleElement = document.getElementById("overlay-title");
  const eyebrowElement = document.getElementById("overlay-eyebrow");
  const closeButton = document.getElementById("overlay-close");

  if (!overlay) {
    return { open() {}, close() {} };
  }

  function open(regionId) {
    const region = findRegionById(regionId);
    if (!region) {
      return;
    }

    if (titleElement) {
      titleElement.textContent = getRegionTitle(regionId);
    }

    if (eyebrowElement) {
      eyebrowElement.textContent = getOverlayEyebrow(regionId);
    }

    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  closeButton?.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) {
      close();
    }
  });

  return { open, close };
}

function initGlobalClickSound() {
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (isEditorEnabled()) {
        return;
      }

      const target = event.target;
      if (target?.closest?.(".region")) {
        return;
      }

      safeAudioFX.playClick();
    },
    { capture: true }
  );
}

function setup() {
  const svg = document.getElementById("hit-layer");

  if (!svg) {
    return;
  }

  const regionElements = renderRegions(svg);
  const overlay = initOverlay();

  function selectRegion(selectedRegionElement) {
    regionElements.forEach((regionElement) => {
      regionElement.classList.toggle("is-active", regionElement === selectedRegionElement);
    });
  }

  regionElements.forEach((regionElement) => {
    regionElement.addEventListener("click", (event) => {
      if (isEditorEnabled()) {
        event.preventDefault();
        return;
      }

      const regionId = regionElement.getAttribute("data-id");
      selectRegion(regionElement);
      safeAudioFX.playRegion(regionId);
      overlay.open(regionId);
    });

    regionElement.addEventListener("keydown", (event) => {
      if (isEditorEnabled()) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        regionElement.click();
      }
    });
  });

  try {
    safeInitEditor(svg, regionElements);
  } catch (_) {}
  initGlobalClickSound();
  safeAudioFX.unlock();
  safeAudioFX.preload();
  runIntro();
}

document.addEventListener("DOMContentLoaded", setup);

})();
