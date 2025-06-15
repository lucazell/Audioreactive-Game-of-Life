"use strict";

// Globale Variablen
let life;           // LifeUniverse (Hashlife)
let drawer;         // LifeCanvasDrawer (Canvas-Zeichnung)
let fft;            // p5.FFT für Audio-Analyse
let soundFile;      // p5.SoundFile, die geladene Musik
let isPlaying = false;  // Flag, ob Musik läuft

function setup() {
  // 1) p5-Canvas anlegen (nimmt gesamten Viewport ein)
  createCanvas(windowWidth, windowHeight);

  // 2) LifeUniverse und LifeCanvasDrawer erzeugen
  life = new LifeUniverse();
  drawer = new LifeCanvasDrawer();

  // drawer initialisieren: übergib das DOM-Element (p5 platziert ein <canvas> in body)
  // LifeCanvasDrawer erwartet ein HTMLElement; wir geben document.body, damit
  // sein eigenes <canvas> im Body erscheint (über p5s Canvas gelegt).
  const ok = drawer.init(document.body);
  if (!ok) {
    console.error("Canvas nicht verfügbar.");
    noLoop();
    return;
  }

  // 3) Drawer-Größe anpassen: wir wollen genau die p5-Größe nutzen
  drawer.set_size(windowWidth, windowHeight);

  // 4) Wir geben dem Drawer ein paar Styling-Defaults
  drawer.cell_color = "#00ff00";         // Leucht-Grün für lebende Zellen
  drawer.background_color = "#000000";   // Schwarzer Hintergrund
  drawer.border_width = 0;               // kein Rand um jede Zelle

  // 5) FFT initialisieren (Glättung 0.8, 256 Bänder)
  fft = new p5.FFT(0.8, 256);

  // 6) File-Input konfigurieren: sobald der Nutzer eine Datei auswählt, rufen wir 'handleFile' auf
  const fileInput = select("#audio-file-input");
  fileInput.changed(handleFile);

  // 7) Leeres (zufälliges) Startmuster: 20% lebende Zellen in einem 100×100-Bereich
  initRandomPattern(100, 100, 0.2);
}

function windowResized() {
  // Wenn das Fenster skaliert wird, passen wir p5 und unseren Drawer an
  resizeCanvas(windowWidth, windowHeight);
  drawer.set_size(windowWidth, windowHeight);
}

// initRandomPattern: Erzeugt ein zufälliges Feld mit width×height, Dichte d
function initRandomPattern(widthCells, heightCells, density) {
  // Anzahl insgesamt zu setzender Zellen
  const total = Math.round(widthCells * heightCells * density);

  // Berechne Offset, um später alle Koordinaten zu zentrieren:
  const dx = Math.floor(widthCells / 2);
  const dy = Math.floor(heightCells / 2);
  const maxDist = Math.max(dx, dy);

  // Erzeuge „leere“ Ebenen (empty[]) so weit, dass eine Root diesen Bereich abdecken kann
  // Gewünschtes Level: 2^(level-1) > maxDist  ⇒  level > log2(maxDist) + 1
  const desiredLevel = Math.ceil(Math.log2(maxDist)) + 1;
  // Fülle life.empty bis desiredLevel, falls nötig
  while (life.empty.length <= desiredLevel) {
    const i = life.empty.length;
    life.empty[i] = life.create_node(
      life.empty[i - 1],
      life.empty[i - 1],
      life.empty[i - 1],
      life.empty[i - 1]
    );
  }
  // Erweitere die Root-Ebene, bis sie mindestens desiredLevel hat
  while (life.root.level < desiredLevel) {
    life.expand_root();
  }

  // Setze bei allen Zufallskoordinaten eine lebende Zelle
  for (let i = 0; i < total; i++) {
    // Zufällige Koordinate im Bereich [0..widthCells-1], [0..heightCells-1]
    const rx = Math.floor(Math.random() * widthCells);
    const ry = Math.floor(Math.random() * heightCells);
    // Zentriert: subtrahiere Mittelwert
    const x = rx - dx;
    const y = ry - dy;
    life.set_bit(x, y, true);
  }

  // (Optional) Speichere den Initialzustand
  life.save_rewind_state();

  // Zeichne das aktuelle Feld
  drawer.redraw(life.root);
}

function draw() {
  background(0); // p5-Hintergrund (dient nur als Fallback)

  if (isPlaying && soundFile && soundFile.isLoaded()) {
    // 1) FFT analysieren
    fft.analyze();

    // Frequenzbänder abrufen (0–255)
    const bass   = fft.getEnergy("bass");
    const mid    = fft.getEnergy("mid");
    const treble = fft.getEnergy("treble");

    // 2) Neue Zellen abhängig von Energie hinzufügen
    //    Wir wählen drei vertikale Bereiche (unteres Drittel, mittleres Drittel, oberes Drittel)
    addCellsByEnergy(
      bass,
      Math.floor(life.root.level * -1.0),
      Math.floor(life.root.level * -0.66)
    );
    addCellsByEnergy(
      mid,
      Math.floor(life.root.level * -0.66),
      Math.floor(life.root.level * -0.33)
    );
    addCellsByEnergy(
      treble,
      Math.floor(life.root.level * -0.33),
      Math.floor(life.root.level *  0.0)
    );
    // Hinweis: life.root.level ist der aktuelle Quadtree-Level (als Potenz von 2).
  }

  // 3) Eine Generation weiterberechnen (single step = true)
  life.next_generation(true);

  // 4) Den aktuellen Quadtree zeichnen
  drawer.redraw(life.root);

  // OPTIONAL: (Debug) Zeichne HUD, z. B. Generation und Population
  // fill(255);
  // textSize(14);
  // text(`Gen: ${life.generation}`, 10, height - 30);
  // text(`Pop: ${life.root.population}`, 10, height - 10);
}

// addCellsByEnergy: Fügt abhängig von ’energy‘ eine bestimmte Anzahl
// Zellen bei zufälligen X-Koordinaten in der Y-Region [yStart, yEnd] ein.
function addCellsByEnergy(energy, yStart, yEnd) {
  // Map energy (0–255) auf 0–50 Zellen pro Frame
  const count = Math.floor(map(energy, 0, 255, 0, 50));
  for (let i = 0; i < count; i++) {
    // X zufällig im Bereich [–size/2 … +size/2], Y zufällig zwischen yStart und yEnd
    const size = Math.pow(2, life.root.level - 1);
    const x = Math.floor(random(-size, size));
    const y = Math.floor(random(yStart, yEnd));
    life.set_bit(x, y, true);  // neue Zelle setzen
  }
}

// handleFile: Callback, wenn der Nutzer eine Audiodatei ausgewählt hat
function handleFile(file) {
  if (file.type === "audio") {
    // Wenn schon ein Song läuft, stoppen
    if (soundFile) {
      soundFile.stop();
      isPlaying = false;
    }
    // Lade p5.SoundFile aus dem File-Input
    soundFile = loadSound(file.data, () => {
      // Sobald das File geladen ist, abspielen und FFT-Input setzen
      soundFile.play();
      fft.setInput(soundFile);
      isPlaying = true;
    });
  } else {
    console.warn("Die gewählte Datei ist kein Audio-Dateityp.");
  }
}
