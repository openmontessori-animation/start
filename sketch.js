
let uiPanel;
let doneButton;
let uiBounds = { x: 20, y: 20, w: 220, h: 150 };

let exportJustStarted = false;
let renderLayer;
let mediaRecorder;
let recordedChunks = [];
let recordingVideo = false;
let exporting = false;
let studentName = "";
let animationTitle = "";

let exportState = {
  active: false,
  t: 0
};

let lastHoveredSegment = -1;
let controls = [];
let selectedIndex = -1;
let dragRadius = 10;
let dragStartT = null;
let deleteThreshold = 80;
let lockedSegment = -1;
let minGap = 0.002;
let hoveredIndex = -1;
let hasPreview = false;
let previewPath = [];
let totalPathLength = 0;

let hoverAnim = [];        // per control point
let segmentHoverAnim = 0;  // single value

let pointerX = 0;
let pointerY = 0;
let isPointerDown = false;

let appState = {
  mode: "draw",
  isPlaying: true,
  baseT: 0,
  scrubT: null,
  settings: {
    smooth: 0.5,
    controlPoints: 10,
    speed: 0.5,
    showTiming: true,
    showLine: true,
    showHatch: false,
    showDots: true,
    showOnion: false,
    showControls: true
  }
};

let drawnPath = [];
let path = [];

let smoothedX, smoothedY;

function setup() {
  createCanvas(windowWidth, windowHeight);
renderLayer = createGraphics(width, height);
  // --- UI PANEL ---
  uiPanel = createDiv();
  uiPanel.position(20, 20);
  uiPanel.style("background", "#ffffff");
  uiPanel.style("padding", "12px 14px");
  uiPanel.style("border-radius", "6px");
  uiPanel.style("border", "1px solid #ddd");
  uiPanel.style("font-family", "Arial");
  uiPanel.style("font-size", "12px");
  uiPanel.style("color", "#222");

  // --- UI ELEMENTS ---
  doneButton = createButton("Done");
  doneButton.parent(uiPanel);

uiPanel.html("");

createDiv("Draw Path").parent(uiPanel);

doneButton = createButton("Done");
doneButton.parent(uiPanel);

  //createDiv("Control Points").parent(uiPanel);

  // --- UI STYLE ---
  doneButton.style("margin-bottom", "8px");
   doneButton.style("margin-top", "8px");
  doneButton.style("padding", "4px 10px");
  doneButton.style("font-size", "12px");



  // --- UI BEHAVIOR ---
  doneButton.mousePressed(() => {
    finalizePath();
  });



let c = document.querySelector("canvas");

c.style.touchAction = "none";

c.addEventListener("touchmove", (e) => {
  e.preventDefault();
}, { passive: false });

c.addEventListener("pointermove", (e) => {
  e.preventDefault();
  pointerX = e.clientX;
  pointerY = e.clientY;
});

c.addEventListener("pointerdown", (e) => {
  e.preventDefault();

  if (isPointerDown) return;
  isPointerDown = true;

  pointerX = e.clientX;
  pointerY = e.clientY;

  if (overUI()) return;

  handlePointerPressed(e);
});

c.addEventListener("pointerup", (e) => {
  e.preventDefault();
  isPointerDown = false;

  handlePointerReleased(e);
});
}

function draw() {
  background(255);
if (isPointerDown) {
  handlePointerDragged();
}
  if (appState.mode === "draw") {
    drawUserPath();
  } else if (appState.mode === "edit") {
    runEditor();
  }

// draw your animation INTO renderLayer
// (same logic as main draw but using renderLayer)

renderLayer.background(255);

if (appState.mode === "edit") {
  drawEditorToGraphics(renderLayer);
}
}

function drawUserPath() {

  // --- WHILE DRAWING: show smoothed live path ---
  if (!hasPreview) {
    let smoothed = getSmoothedPath(drawnPath);

    noFill();
    stroke(0);
    beginShape();
    for (let p of smoothed) {
      vertex(p.x, p.y);
    }
    endShape();

    return;
  }

  // --- AFTER RELEASE: show preview path ---
if (!previewPath || previewPath.length < 2) return;

noFill();
  stroke(0);
  beginShape();
  for (let p of previewPath) {
    vertex(p.x, p.y);
  }
  endShape();


}

function runEditor() {

  while (hoverAnim.length < controls.length) {
  hoverAnim.push(0);
}
// --- TIME UPDATE ---
if (exportState.active) {

  let baseSpeed = 0.25;

  let referenceLength = 800;
  let lengthFactor = totalPathLength / referenceLength;
  lengthFactor = Math.sqrt(lengthFactor);

  let adjustedSpeed = baseSpeed / lengthFactor;

 if (exportJustStarted) {
    exportJustStarted = false;
    // 🚫 skip this frame entirely
  } else {
    exportState.t += deltaTime * 0.001 * adjustedSpeed * appState.settings.speed;
  }


  if (exportState.t >= 1) {
    exportState.t = 1;

    mediaRecorder.stop();
    recordingVideo = false;
    exporting = false;
    exportState.active = false;

    return; // stop this frame cleanly
  }

}
else if (appState.isPlaying && appState.scrubT === null) {

  let baseSpeed = 0.25;

  let referenceLength = 800;

  let lengthFactor = totalPathLength / referenceLength;
  lengthFactor = Math.sqrt(lengthFactor);

  let adjustedSpeed = baseSpeed / lengthFactor;

  appState.baseT += deltaTime * 0.001 * adjustedSpeed * appState.settings.speed;
  appState.baseT %= 1;
}
if (appState.settings.showControls) {
  drawHatchMarks();
}
let hoveredSegment;

if (selectedIndex !== -1 && lockedSegment !== -1) {
  hoveredSegment = lockedSegment;
} else {
  hoveredSegment = getHoveredSegment();
}

// --- animate segment hover ---
let target = (hoveredSegment !== -1) ? 1 : 0;
segmentHoverAnim = lerp(segmentHoverAnim, target, 0.2); // 👈 better speed

if (hoveredSegment !== -1) {
  let t1 = controls[hoveredSegment].t;
  let t2 = controls[hoveredSegment + 1].t;

  let col = lerpColor(color('#e0e0e0'), color('#b0b0b0'), segmentHoverAnim);

  stroke(col);
  strokeWeight(lerp(1, 2, segmentHoverAnim));
  noFill();
beginShape();

let steps = max(20, int(abs(t2 - t1) * path.length));

for (let i = 0; i <= steps; i++) {
  let tt = lerp(t1, t2, i / steps);
  let pos = getPositionAtT(tt);
  vertex(pos.x, pos.y);
}

endShape();

  strokeWeight(1);
}
// --- ACTIVE TIME ---
let t;

if (exportState.active) {
  t = exportState.t;
} else {
  t = (appState.scrubT !== null) ? appState.scrubT : appState.baseT;
}
  if (appState.scrubT === null && scrubber) {
  scrubber.value(appState.baseT);
}
 if (appState.settings.showLine) {
  noFill();
stroke('#c4c4c4');
   beginShape();
  for (let p of path) {
    vertex(p.x, p.y);
  }
  endShape();
}

hoveredIndex = -1;

for (let i = 1; i < controls.length - 1; i++) {
  let pos = getPositionAtT(controls[i].t);
  if (dist(pointerX, pointerY, pos.x, pos.y) < dragRadius) {
    hoveredIndex = i;
    break;
  }
}

// --- animate hover ---
for (let i = 0; i < controls.length; i++) {
  let target = (i === hoveredIndex) ? 1 : 0;
  hoverAnim[i] = lerp(hoverAnim[i], target, 0.15); // 👈 smooth
}

if (appState.settings.showDots) {
  drawTimingTicks();
}
if (appState.settings.showControls) {
for (let i = 0; i < controls.length; i++) {
  let c = controls[i];
  let pos = getPositionAtT(c.t);

for (let i = 0; i < controls.length; i++) {
  let c = controls[i];
  let pos = getPositionAtT(c.t);

  let h = hoverAnim[i]; // 0 → 1

  stroke('#bbbbbb');

  if (i === 0 || i === controls.length - 1) {
    fill('#c4c4c4');
    circle(pos.x, pos.y, 7);
  }
  else if (i === selectedIndex) {
    fill('#7aa2fc');
    circle(pos.x, pos.y, 12);
  } 
  else {
    // 👇 blend between white and hover blue
    let col = lerpColor(color('#ffffff'), color('#5a78bb'), h);

    // 👇 subtle size animation too (feels great)
    let size = lerp(7, 10, h);

    fill(col);
    circle(pos.x, pos.y, size);
  }
}
}
}

  let totalSegments = controls.length - 1;
let scaledT = t * totalSegments;
  let segmentIndex = floor(scaledT);
  segmentIndex = min(segmentIndex, totalSegments - 1);

  let segmentT = scaledT - segmentIndex;

  let i = segmentIndex;

  let p1 = controls[i].t;
  let p2 = controls[i + 1].t;

  let p0 = i > 0 ? controls[i - 1].t : p1 - (p2 - p1);
  let p3 = i < controls.length - 2 ? controls[i + 2].t : p2 + (p2 - p1);

let mappedT = getRemappedT(t);
let pos = getPositionAtT(mappedT);

  fill(0);
  noStroke();
  circle(pos.x, pos.y, 20);
if (appState.settings.showOnion) {
  drawOnionSkin(t);
}
  
  // --- cursor feedback ---
if (hoveredIndex !== -1) {
  cursor('grab');
} else if (segmentHoverAnim > 0.1) {
  cursor('pointer');
} else {
  cursor('default');
}
  if (appState.mode === "edit") {
  drawInstructions();
}
  
  
}

function handlePointerPressed(e) {
  if (overUI()) return;

  if (appState.mode === "draw") {
    smoothedX = pointerX;
    smoothedY = pointerY;

    drawnPath = [];
    drawnPath.push({ x: smoothedX, y: smoothedY });

    hasPreview = false;
    previewPath = [];
  } else {
    selectedIndex = -1;

    // --- control point hit ---
    for (let i = 1; i < controls.length - 1; i++) {
      let pos = getPositionAtT(controls[i].t);

      if (dist(pointerX, pointerY, pos.x, pos.y) < dragRadius) {
        selectedIndex = i;
        dragStartT = controls[i].t;
        lockedSegment = i - 1;
        return;
      }
    }

    // --- segment hit (add point) ---
    let seg = getHoveredSegment();

    if (seg !== -1) {
      let t1 = controls[seg].t;
      let t2 = controls[seg + 1].t;

      let hover = getClosestPointOnPath(pointerX, pointerY);
      let newT = constrain(hover.t, t1 + minGap, t2 - minGap);

      controls.splice(seg + 1, 0, { t: newT });

      selectedIndex = seg + 1;
      dragStartT = newT;
      lockedSegment = seg;

      return;
    }

    // --- scrub ---
    appState.isScrubbing = true;
    appState.lastScrubX = pointerX;
    appState.scrubT = appState.baseT;
  }
}
function handlePointerDragged() {
  if (overUI()) return;

  if (appState.mode === "draw") {
    let dx = pointerX - smoothedX;
    let dy = pointerY - smoothedY;
    let speed = sqrt(dx * dx + dy * dy);

    let baseSmooth = 0.35;
    let adaptiveSmooth = baseSmooth * map(speed, 0, 20, 0.2, 1, true);

    smoothedX = lerp(smoothedX, pointerX, adaptiveSmooth);
    smoothedY = lerp(smoothedY, pointerY, adaptiveSmooth);

    let last = drawnPath[drawnPath.length - 1];

    if (!last || dist(smoothedX, smoothedY, last.x, last.y) > 2) {
      drawnPath.push({ x: smoothedX, y: smoothedY });
    }

    return;
  }

  // --- scrubbing ---
  if (appState.isScrubbing) {
    let dx = pointerX - appState.lastScrubX;

    let sensitivity =
      0.002 * (1 - abs(appState.scrubT - 0.5) * 0.5);

    appState.scrubT += dx * sensitivity;
    appState.scrubT = constrain(appState.scrubT, 0, 1);

    appState.lastScrubX = pointerX;
    return;
  }

  // --- dragging control points ---
  if (selectedIndex <= 0 || selectedIndex >= controls.length - 1) return;

  let tMin = controls[selectedIndex - 1].t + minGap;
  let tMax = controls[selectedIndex + 1].t - minGap;

  let hover = getClosestPointOnPath(pointerX, pointerY);

  if (dragStartT !== null) {
    let maxJump = 0.1;
    if (abs(hover.t - controls[selectedIndex].t) > maxJump) {
      hover.t = controls[selectedIndex].t;
    }
  }

  let targetT = constrain(hover.t, tMin, tMax);
  let newT = lerp(controls[selectedIndex].t, targetT, 0.4);

  if (abs(newT - controls[selectedIndex].t) < 0.0005) {
    newT = controls[selectedIndex].t;
  }

  let pos = getPositionAtT(newT);
  let d = dist(pointerX, pointerY, pos.x, pos.y);

  // --- delete gesture ---
  if (
    d > deleteThreshold &&
    controls.length > 2 &&
    selectedIndex !== 0 &&
    selectedIndex !== controls.length - 1
  ) {
    controls.splice(selectedIndex, 1);
    selectedIndex = -1;
    return;
  }

  controls[selectedIndex].t = newT;
}
function handlePointerReleased() {
  selectedIndex = -1;
  lockedSegment = -1;

  if (appState.isScrubbing) {
    appState.baseT = appState.scrubT;
    appState.scrubT = null;
    appState.isScrubbing = false;
  }

  if (appState.mode === "draw" && drawnPath.length > 1) {
    hasPreview = true;
    rebuildPreview();
  }
}
function keyPressed() {
  // prevent page scroll when pressing space
  if (key === ' ') {
    appState.isPlaying = !appState.isPlaying;

    // update button label if it exists
    if (playButton) {
      playButton.html(appState.isPlaying ? "Pause" : "Play");
    }

    return false; // 👈 important (prevents browser scroll)
  }
}
function finalizePath() {
  path = previewPath;
computePathLength();
  if (previewPath.length < 2) return;

  path = previewPath;
controls = [
  { t: 0 },
  { t: 1 }
];
  appState.settings.showDots = false;   // ❌ off
appState.settings.showOnion = true;   // ✅ on
  appState.mode = "edit";

  buildEditUI(); // 👈 ADD THIS
}

let scrubber, playButton, resetButton;

function buildEditUI() {
  uiPanel.html("");
createDiv("Timing Visualizer")
  .parent(uiPanel)
  .style("margin-bottom", "10px")
    .style("margin-bottom", "10px")

  .style("font-size", "14px")
  .style("color", "#666");
  createDiv().parent(uiPanel).style("margin-top", "6px");
  // --- PLAY / PAUSE ---
  playButton = createButton("⏸");
  playButton.parent(uiPanel);

  playButton.style("width", "40px");
  playButton.style("height", "30px");

  playButton.mousePressed(() => {
    appState.isPlaying = !appState.isPlaying;
    playButton.html(appState.isPlaying ? "⏸" : "▶");
  });

  
  // --- SPEED SLIDER ---
let speedLabel = createDiv("Speed").parent(uiPanel);
speedLabel.style("margin-top", "8px");

let speedSlider = createSlider(0, 1, 0.5, 0.001);
speedSlider.parent(uiPanel);
speedSlider.style("width", "180px");

// --- set initial speed ---
let raw = speedSlider.value();
appState.settings.speed = lerp(0.6, 1.6, raw);

// --- update speed ---
speedSlider.input(() => {
  let raw = speedSlider.value();
  let mapped = lerp(0.3, 6, raw);
  appState.settings.speed = mapped;
});
speedSlider.style("width", "180px");


  createDiv("View").parent(uiPanel).style("margin-top", "8px");
  // --- VISIBILITY TOGGLES ---
  let lineCB = createCheckbox(" Line", true).parent(uiPanel);
  let controlsCB = createCheckbox(" Control Points", true).parent(uiPanel);
let dotsCB = createCheckbox("Timing Dots", appState.settings.showDots).parent(uiPanel);
let onionCB = createCheckbox("Onion Skin", appState.settings.showOnion).parent(uiPanel);
appState.settings.showHatch = controlsCB.checked();
  lineCB.changed(() => appState.settings.showLine = lineCB.checked());
  controlsCB.changed(() => appState.settings.showControls = controlsCB.checked());
  dotsCB.changed(() => appState.settings.showDots = dotsCB.checked());
  onionCB.changed(() => appState.settings.showOnion = onionCB.checked());

  // --- START OVER ---
  let resetButton = createButton("New Line");
  resetButton.parent(uiPanel);
  resetButton.style("margin-top", "10px");

  resetButton.mousePressed(() => {
    resetApp();
  });
  let exportBtn = createButton("Export");
exportBtn.parent(uiPanel);
exportBtn.style("margin-top", "12px");
exportBtn.style("width", "100%");

exportBtn.mousePressed(() => {
  exportVideo();
});
}

function resetApp() {
  appState.mode = "draw";
appState.settings = {
  smooth: 0.5,
  controlPoints: 10,
  speed: 0.5,
  showTiming: true,
  showLine: true,
  showDots: false,
  showOnion: true,
  showControls: true
};
  drawnPath = [];
  previewPath = [];
  path = [];
  controls = [];

  hasPreview = false;

  appState.baseT = 0;
  appState.scrubT = null;
  appState.isPlaying = true;

  uiPanel.html("");

  createDiv("Draw Path").parent(uiPanel);

  doneButton = createButton("Done");
    doneButton.style("margin-bottom", "8px");
   doneButton.style("margin-top", "8px");
  doneButton.style("padding", "4px 10px");
  doneButton.style("font-size", "12px");
  doneButton.parent(uiPanel);
  doneButton.mousePressed(finalizePath);
  
}

function getSmoothedPath(points) {
  if (points.length < 2) return points;

  let result = [];
  let sx = points[0].x;
  let sy = points[0].y;

  result.push({ x: sx, y: sy });

  for (let i = 1; i < points.length; i++) {
    let px = points[i].x;
    let py = points[i].y;

    let dx = px - sx;
    let dy = py - sy;
    let speed = sqrt(dx * dx + dy * dy);

let baseSmooth = 0.35; // midpoint of your previous range (nice balance)
    let adaptiveSmooth = baseSmooth * map(speed, 0, 20, 0.2, 1, true);

    sx = lerp(sx, px, adaptiveSmooth);
    sy = lerp(sy, py, adaptiveSmooth);

    result.push({ x: sx, y: sy });
  }

  return result;
}

function resamplePath(points, spacing = 5) {
  let newPath = [];
  let d = 0;

  for (let i = 0; i < points.length - 1; i++) {
    let p1 = points[i];
    let p2 = points[i + 1];

    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let segmentLength = sqrt(dx * dx + dy * dy);

    if (segmentLength === 0) continue;

    let dir = {
      x: dx / segmentLength,
      y: dy / segmentLength
    };

    while (d < segmentLength) {
      let newPoint = {
        x: p1.x + dir.x * d,
        y: p1.y + dir.y * d
      };

      newPath.push(newPoint);
      d += spacing;
    }

    d -= segmentLength;
  }

  return newPath;
}

function generateControlPoints(n) {
  controls = [];

  for (let i = 0; i < n; i++) {
    let t = i / (n - 1);
    controls.push({ t });
  }
}

function findClosestT(mx, my, tMin, tMax) {
  let bestT = tMin;
  let bestDist = Infinity;

  let steps = 100;

  for (let i = 0; i <= steps; i++) {
    let t = lerp(tMin, tMax, i / steps);
    let pos = getPositionAtT(t);

    let d = dist(mx, my, pos.x, pos.y);

    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }

  return bestT;
}

function catmullRomNonUniform(p0, p1, p2, p3, t) {
  function tj(ti, pi, pj) {
    return Math.pow(Math.abs(pj - pi), 0.5) + ti;
  }

  let t0 = 0;
  let t1 = tj(t0, p0, p1);
  let t2 = tj(t1, p1, p2);
  let t3 = tj(t2, p2, p3);

  let tInterp = lerp(t1, t2, t);

  let A1 = map(tInterp, t0, t1, p0, p1);
  let A2 = map(tInterp, t1, t2, p1, p2);
  let A3 = map(tInterp, t2, t3, p2, p3);

  let B1 = map(tInterp, t0, t2, A1, A2);
  let B2 = map(tInterp, t1, t3, A2, A3);

  let C  = map(tInterp, t1, t2, B1, B2);

  return C;
}

function getSegmentLength(i) {
  let p1 = path[i];
  let p2 = path[i + 1];
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getPositionAtT(t) {
  t = constrain(t, 0, 1);

  let totalLength = 0;

  for (let i = 0; i < path.length - 1; i++) {
    totalLength += getSegmentLength(i);
  }

  let target = totalLength * t;
  let remaining = target;

  for (let i = 0; i < path.length - 1; i++) {
    let segLen = getSegmentLength(i);

    if (remaining > segLen) {
      remaining -= segLen;
    } else {
      let localT = remaining / segLen;

      let p1 = path[i];
      let p2 = path[i + 1];

      return {
        x: lerp(p1.x, p2.x, localT),
        y: lerp(p1.y, p2.y, localT)
      };
    }
  }

  let last = path[path.length - 1];
  return { x: last.x, y: last.y };
}

function drawTimingTicks() {
  stroke('#cccccc'); // very light grey
  strokeWeight(1);

  for (let i = 0; i < controls.length - 1; i++) {
    let t1 = controls[i].t;
    let t2 = controls[i + 1].t;

    let segmentT = abs(t2 - t1);

    // 👇 density: more ticks for shorter segments (slower motion)
    let count = int(map(segmentT, 0, 0.2, 12, 4, true));

    for (let j = 1; j < count; j++) {
      let tt = lerp(t1, t2, j / count);
      let pos = getPositionAtT(tt);

      // --- tangent ---
      let tPrev = max(0, tt - 0.001);
      let tNext = min(1, tt + 0.001);

      let p1 = getPositionAtT(tPrev);
      let p2 = getPositionAtT(tNext);

      let dx = p2.x - p1.x;
      let dy = p2.y - p1.y;

      let len = sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      // --- perpendicular ---
      let nx = -dy / len;
      let ny = dx / len;

      // 👇 half-size hatch (compared to main ones)
      let half = 8;

      line(
        pos.x - nx * half,
        pos.y - ny * half,
        pos.x + nx * half,
        pos.y + ny * half
      );
    }
  }
}
function rebuildPreview() {
  if (drawnPath.length < 2) return;

  let smoothed = getSmoothedPath(drawnPath);
  if (!smoothed || smoothed.length < 2) return;

  let newPath = resamplePath(smoothed);
  if (!newPath || newPath.length < 2) return;

  // 🔥 Only assign if valid AND different
  if (newPath.length >= 2) {
    previewPath = newPath;
  }
}

function overUI() {
  return (
    pointerX > uiBounds.x &&
    pointerX < uiBounds.x + uiBounds.w &&
    pointerY > uiBounds.y &&
    pointerY < uiBounds.y + uiBounds.h
  );
}

function drawOnionSkin(t) {
  let steps = 5;          // number of ghosts
  let spacing = 0.01;    // time spacing (tweak this)

  for (let i = 1; i <= steps; i++) {
let dt = Math.pow(i / steps, 1.2) * steps * spacing;    let tt = t - dt;

    if (tt < 0) continue;

    // 👇 THIS is the key: apply timing remap
    let mappedT = getRemappedT(tt);
    let pos = getPositionAtT(mappedT);

    // --- visual falloff ---
    let fade = i / steps;

    let alpha = lerp(120, 20, fade);
    let size  = lerp(18, 6, fade);

    push();
    noStroke();
    fill(0, alpha);
    circle(pos.x, pos.y, size);
    pop();
  }
}

function getRemappedT(tInput) {
  let totalSegments = controls.length - 1;

  let scaledT = tInput * totalSegments;
  let segmentIndex = floor(scaledT);
  segmentIndex = min(segmentIndex, totalSegments - 1);

  let segmentT = scaledT - segmentIndex;

  let i = segmentIndex;

  let p1 = controls[i].t;
  let p2 = controls[i + 1].t;

  let p0 = i > 0 ? controls[i - 1].t : p1 - (p2 - p1);
  let p3 = i < controls.length - 2 ? controls[i + 2].t : p2 + (p2 - p1);

  return catmullRomNonUniform(p0, p1, p2, p3, segmentT);
}

function getHoveredSegment() {
  let bestIndex = -1;
  let bestDist = 15;

  let totalSegments = path.length - 1;

  for (let i = 0; i < totalSegments; i++) {
    let a = path[i];
    let b = path[i + 1];

    let result = projectPointToSegment(pointerX, pointerY, a, b);

    if (result.dist < bestDist) {

      let t = (i + result.u) / totalSegments;

      for (let j = 0; j < controls.length - 1; j++) {
        if (t >= controls[j].t && t <= controls[j + 1].t) {

          // 👇 prefer previous segment if very close
          if (
            lastHoveredSegment === j &&
            result.dist < bestDist + 5 // small buffer
          ) {
            bestIndex = j;
            bestDist = result.dist;
            break;
          }

          // otherwise take best normally
          if (result.dist < bestDist) {
            bestIndex = j;
            bestDist = result.dist;
          }
        }
      }
    }
  }

  lastHoveredSegment = bestIndex;
  return bestIndex;
}

function drawHatchMarks() {
  let size = 20;

  for (let i = 0; i < controls.length; i++) {
    let t = controls[i].t;

    let pos = getPositionAtT(t);

    // approximate tangent
    let tPrev = max(0, t - 0.001);
    let tNext = min(1, t + 0.001);

    let p1 = getPositionAtT(tPrev);
    let p2 = getPositionAtT(tNext);

    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;

    // normalize perpendicular
    let len = sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    let nx = -dy / len;
    let ny = dx / len;

    let half = size / 2;

    stroke(0);
    line(
      pos.x - nx * half,
      pos.y - ny * half,
      pos.x + nx * half,
      pos.y + ny * half
    );
  }
}

function getPositionAtTPreview(path, t) {
  t = constrain(t, 0, 1);

  let totalLength = 0;
  let lengths = [];

  for (let i = 0; i < path.length - 1; i++) {
    let len = dist(path[i].x, path[i].y, path[i+1].x, path[i+1].y);
    lengths.push(len);
    totalLength += len;
  }

  let target = totalLength * t;
  let accum = 0;

  for (let i = 0; i < lengths.length; i++) {
    if (accum + lengths[i] >= target) {
      let localT = (target - accum) / lengths[i];

      let p1 = path[i];
      let p2 = path[i + 1];

      return {
        x: lerp(p1.x, p2.x, localT),
        y: lerp(p1.y, p2.y, localT)
      };
    }
    accum += lengths[i];
  }

  return path[path.length - 1];
}

function projectPointToSegment(px, py, a, b) {
  let abx = b.x - a.x;
  let aby = b.y - a.y;

  let apx = px - a.x;
  let apy = py - a.y;

  let abLenSq = abx * abx + aby * aby;

  // avoid divide by zero
  if (abLenSq === 0) {
    return {
      u: 0,
      point: { x: a.x, y: a.y },
      dist: dist(px, py, a.x, a.y)
    };
  }

  let u = (apx * abx + apy * aby) / abLenSq;
  u = constrain(u, 0, 1);

  let x = a.x + abx * u;
  let y = a.y + aby * u;

  let d = dist(px, py, x, y);

  return {
    u,
    point: { x, y },
    dist: d
  };
}

function getClosestPointOnPath(mx, my) {
  let best = {
    dist: Infinity,
    t: 0,
    point: null
  };

  let totalSegments = path.length - 1;

  for (let i = 0; i < totalSegments; i++) {
    let a = path[i];
    let b = path[i + 1];

    let result = projectPointToSegment(mx, my, a, b);

    if (result.dist < best.dist) {
      let segmentT = i / totalSegments;
      let nextT = (i + 1) / totalSegments;

      best = {
        dist: result.dist,
        t: lerp(segmentT, nextT, result.u),
        point: result.point
      };
    }
  }

  return best;
}



function computePathLength() {
  totalPathLength = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalPathLength += getSegmentLength(i);
  }
}

function drawInstructions() {
  push();

  let padding = 20;
  let lineHeight = 16;

  let lines = [
    "Click path to add points / Click and drag to move points / Drag points away to delete / Drag screen to scrub timeline"
    
    
  ];

  textAlign(LEFT, BOTTOM);
  textSize(12);
  fill('#a6a6a6');
  noStroke();

  let x = padding;
  let y = height - padding;

  for (let i = 0; i < lines.length; i++) {
    text(lines[lines.length - 1 - i], x, y - i * lineHeight);
  }

  pop();
}

function exportVideo() {

  if (path.length === 0) return;

  animationTitle = prompt("Enter animation title:", "My Animation") || "Untitled";
  studentName = prompt("Enter student name:", "Student Name") || "Unknown";

  let stream = renderLayer.canvas.captureStream(30);

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = function(e) {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = function() {
    let blob = new Blob(recordedChunks, { type: 'video/webm' });

    let filename = `${animationTitle}_${studentName}.webm`;

    let url = URL.createObjectURL(blob);

    let a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    exporting = false;
  };

  //exporting = true;
exportState.active = true;
exportState.t = 0;


exportJustStarted = true;


// 🔥 CRITICAL RESETS
appState.baseT = 0;
appState.scrubT = null;
appState.isPlaying = false;

mediaRecorder.start();
recordingVideo = true;

}

function drawEditorToGraphics(g) {
  let t;

  if (exportState.active) {
    t = exportState.t;
  } else {
    t = (appState.scrubT !== null) ? appState.scrubT : appState.baseT;
  }

  let mappedT = getRemappedT(t);
  let pos = getPositionAtT(mappedT);

  g.fill(0);
  g.noStroke();
  g.circle(pos.x, pos.y, 20);
}
