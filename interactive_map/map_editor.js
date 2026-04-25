(function () {
  "use strict";

const mapRegions = window.MapRegions || {};
const REGIONS = Array.isArray(mapRegions.REGIONS) ? mapRegions.REGIONS : [];
const applyTransform =
  typeof mapRegions.applyTransform === "function" ? mapRegions.applyTransform : () => {};
const clampScale = typeof mapRegions.clampScale === "function" ? mapRegions.clampScale : (s) => s;
const findRegionById =
  typeof mapRegions.findRegionById === "function" ? mapRegions.findRegionById : () => null;

const EDITOR_TOGGLE_KEYS = new Set(["e", "E", "у", "У"]);
const COPY_KEYS = new Set(["c", "C", "с", "С"]);

function createEditorUI() {
  const panel = document.createElement("div");
  panel.id = "editor-panel";
  panel.innerHTML = `
    <div class="ed-head">
      <strong>Editor</strong>
      <span class="ed-hint">E — вкл/выкл · клик — выбрать · drag — двигать · колесо — масштаб · ←↑→↓ — точно · +/− — масштаб · C — копировать</span>
    </div>
    <div class="ed-body">
      <label>Область:
        <select id="ed-region"></select>
      </label>
      <div class="ed-row">
        <label>x <input id="ed-x" type="number" step="1"></label>
        <label>y <input id="ed-y" type="number" step="1"></label>
        <label>scale <input id="ed-s" type="number" step="0.05" min="0.05"></label>
      </div>
      <pre id="ed-out"></pre>
    </div>
  `;
  document.body.appendChild(panel);
  return panel;
}

function isFormControlTarget(target) {
  return Boolean(target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function clientToViewBox(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;

  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return { x: 0, y: 0 };
  }

  const transformedPoint = point.matrixTransform(ctm.inverse());
  return { x: transformedPoint.x, y: transformedPoint.y };
}

function formatRegionMeta(region) {
  return `{ id: "${region.id}", x: ${Math.round(region.x)}, y: ${Math.round(region.y)}, scale: ${Number(
    region.scale.toFixed(3)
  )} }`;
}

function initEditor(svg, regionElements) {
  if (!svg || !Array.isArray(regionElements) || !REGIONS.length) {
    return;
  }

  const panel = createEditorUI();
  const select = panel.querySelector("#ed-region");
  const xInput = panel.querySelector("#ed-x");
  const yInput = panel.querySelector("#ed-y");
  const scaleInput = panel.querySelector("#ed-s");
  const output = panel.querySelector("#ed-out");

  REGIONS.forEach((region) => {
    const option = document.createElement("option");
    option.value = region.id;
    option.textContent = region.title;
    select.appendChild(option);
  });

  let isEditing = false;
  let currentRegionId = REGIONS[0]?.id ?? null;
  let dragState = null;

  function getCurrentRegion() {
    return findRegionById(currentRegionId);
  }

  function getRegionElement(regionId) {
    return svg.querySelector(`.region[data-id="${regionId}"]`);
  }

  function syncInputs(region) {
    select.value = region.id;
    xInput.value = Math.round(region.x);
    yInput.value = Math.round(region.y);
    scaleInput.value = Number(region.scale.toFixed(3));
    output.textContent = formatRegionMeta(region);
  }

  function syncHighlighting() {
    regionElements.forEach((regionElement) => {
      regionElement.classList.toggle(
        "is-editing",
        regionElement.getAttribute("data-id") === currentRegionId
      );
    });
  }

  function updateCurrentRegion() {
    const region = getCurrentRegion();
    const regionElement = getRegionElement(currentRegionId);
    if (!region || !regionElement) {
      return;
    }

    applyTransform(regionElement, region);
    syncInputs(region);
    syncHighlighting();
  }

  function setEditingState(nextState) {
    isEditing = nextState;
    document.body.classList.toggle("editor-on", isEditing);
    panel.classList.toggle("is-open", isEditing);

    if (isEditing) {
      updateCurrentRegion();
      return;
    }

    regionElements.forEach((regionElement) => {
      regionElement.classList.remove("is-editing");
    });
  }

  function adjustCurrentRegion(mutator) {
    const region = getCurrentRegion();
    if (!region) {
      return;
    }

    mutator(region);
    updateCurrentRegion();
  }

  document.addEventListener("keydown", (event) => {
    if (isFormControlTarget(event.target)) {
      return;
    }

    if (EDITOR_TOGGLE_KEYS.has(event.key)) {
      setEditingState(!isEditing);
      return;
    }

    if (!isEditing) {
      return;
    }

    const step = event.shiftKey ? 10 : 1;

    switch (event.key) {
      case "ArrowLeft":
        adjustCurrentRegion((region) => {
          region.x -= step;
        });
        event.preventDefault();
        return;
      case "ArrowRight":
        adjustCurrentRegion((region) => {
          region.x += step;
        });
        event.preventDefault();
        return;
      case "ArrowUp":
        adjustCurrentRegion((region) => {
          region.y -= step;
        });
        event.preventDefault();
        return;
      case "ArrowDown":
        adjustCurrentRegion((region) => {
          region.y += step;
        });
        event.preventDefault();
        return;
      case "+":
      case "=":
        adjustCurrentRegion((region) => {
          region.scale = clampScale(region.scale * 1.05);
        });
        event.preventDefault();
        return;
      case "-":
      case "_":
        adjustCurrentRegion((region) => {
          region.scale = clampScale(region.scale / 1.05);
        });
        event.preventDefault();
        return;
      default:
        if (COPY_KEYS.has(event.key)) {
          navigator.clipboard?.writeText(output.textContent).catch(() => {});
        }
    }
  });

  select.addEventListener("change", () => {
    currentRegionId = select.value;
    updateCurrentRegion();
  });

  xInput.addEventListener("input", () => {
    adjustCurrentRegion((region) => {
      region.x = Number(xInput.value) || 0;
    });
  });

  yInput.addEventListener("input", () => {
    adjustCurrentRegion((region) => {
      region.y = Number(yInput.value) || 0;
    });
  });

  scaleInput.addEventListener("input", () => {
    adjustCurrentRegion((region) => {
      region.scale = clampScale(Number(scaleInput.value) || 0);
    });
  });

  regionElements.forEach((regionElement) => {
    regionElement.addEventListener("pointerdown", (event) => {
      if (!isEditing) {
        return;
      }

      const regionId = regionElement.getAttribute("data-id");
      const region = findRegionById(regionId);
      const point = clientToViewBox(svg, event);
      currentRegionId = regionId;
      dragState = {
        regionId,
        startX: point.x,
        startY: point.y,
        originX: region.x,
        originY: region.y,
      };

      regionElement.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      updateCurrentRegion();
    });

    regionElement.addEventListener("pointermove", (event) => {
      if (!isEditing || !dragState || dragState.regionId !== regionElement.getAttribute("data-id")) {
        return;
      }

      const region = findRegionById(dragState.regionId);
      const point = clientToViewBox(svg, event);
      region.x = dragState.originX + (point.x - dragState.startX);
      region.y = dragState.originY + (point.y - dragState.startY);
      updateCurrentRegion();
    });

    const endDrag = (event) => {
      if (!dragState || dragState.regionId !== regionElement.getAttribute("data-id")) {
        return;
      }

      dragState = null;

      try {
        regionElement.releasePointerCapture(event.pointerId);
      } catch (_) {}
    };

    regionElement.addEventListener("pointerup", endDrag);
    regionElement.addEventListener("pointercancel", endDrag);

    regionElement.addEventListener(
      "wheel",
      (event) => {
        if (!isEditing) {
          return;
        }

        const regionId = regionElement.getAttribute("data-id");
        currentRegionId = regionId;
        adjustCurrentRegion((region) => {
          const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
          region.scale = clampScale(region.scale * factor);
        });
        event.preventDefault();
      },
      { passive: false }
    );
  });

  const initialRegion = getCurrentRegion();
  if (initialRegion) {
    syncInputs(initialRegion);
  }
}

window.initMapEditor = initEditor;

})();
