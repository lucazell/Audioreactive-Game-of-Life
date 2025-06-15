"use strict";

//------------------------------------------------------------------------------
// life.js: Hashlife-Implementierung von John Tromp (leicht modifiziert für p5.js)
// Diese Datei definiert LifeUniverse, Node-Strukturen und alle nötigen Funktionen,
// um Conway’s Game of Life sehr effizient über Quadtrees (Hashlife) zu simulieren.
//------------------------------------------------------------------------------

/** @const */ var LOAD_FACTOR = 0.9;
/** @const */ var HASHMAP_INITIAL = 1 << 16;
/** @const */ var MIN_LEVEL = 3;

/**
 * LifeUniverse: Hauptklasse, die das Hashlife-Quadtree verwaltet und Simulation
 * sowie Zellen-Operationen (set_bit, clear_bit etc.) bereitstellt.
 */
function LifeUniverse() {
  // Hashmap für interne Nodes
  this.hashmap_size = HASHMAP_INITIAL;
  this.hashmap = new Array(this.hashmap_size + 1);
  for (var i = 0; i <= this.hashmap_size; i++) this.hashmap[i] = undefined;
  this.last_id = 4;

  // Erzeuge vier „leere“ Ebene-0-Nodes, um alle 2×2-Muster abzudecken:
  // ID 0: 0 0 | 0 0
  // ID 1: 0 1 | 1 0
  // ID 2: 1 0 | 0 1
  // ID 3: 1 1 | 1 1
  this.quads = new Array(4);
  this.quads[0] = new Node(0, 0, 0, 0, undefined, undefined, 0, 0, 0, 0, 0, 0, 0, 0);
  this.quads[1] = new Node(0, 1, 0, 1, undefined, undefined, 1, 0, 0, 1, 0, 0, 0, 1);
  this.quads[2] = new Node(1, 0, 1, 0, undefined, undefined, 0, 1, 1, 0, 0, 0, 1, 0);
  this.quads[3] = new Node(1, 1, 1, 1, undefined, undefined, 1, 1, 1, 1, 0, 0, 0, 0);

  // Erstelle eine leere Ebene-1-Node (alles tote Zellen in 2×2-Blöcken)
  this.empty = new Array(1);
  this.empty[0] = this.make_leaf(0, 0, 0, 0);

  // Root-Node: Start mit leerem Baum (level = MIN_LEVEL, alles tot)
  this.root = this.empty[0];
  for (var i = 1; i <= MIN_LEVEL; i++) {
    this.empty[i] = this.create_node(
      this.empty[i - 1], this.empty[i - 1],
      this.empty[i - 1], this.empty[i - 1]
    );
    this.root = this.empty[i];
  }

  this.generation = 0;
  this.rewind_stack = [];
  this.rewind_ptr = 0;

  // Hash-Knoten initial eintragen
  this.node_hash(this.root);
}

/**
 * Node-Konstruktor: Jedes Node repräsentiert ein Quadrat von 2^level × 2^level Zellen.
 * Für level ≥ 1 werden die vier Subknoten nw, ne, sw, se referenziert. Für level = 0
 * repräsentiert das Node direkt ein 2×2-Subfeld über bitflags (a–j). population zählt,
 * wie viele lebende Zellen in diesem Node sind.
 */
function Node(a, b, c, d,
              nw, ne, sw, se,
              e, f, g, h,
              level, population) {
  // Für level = 0: bitflags a,b,c,d; für level > 0: Verweise auf child-Nodes
  this.a = a; this.b = b; this.c = c; this.d = d;
  this.nw = nw; this.ne = ne; this.sw = sw; this.se = se;
  // Bitflags für Mitte-1-Region (nur bei level > 0)
  this.e = e; this.f = f; this.g = g; this.h = h;
  this.level = level;
  this.population = population;
  this.id = 0;        // Eindeutige ID für Hash-Vergleich
  this.cache = null;  // „Mittlerer“ Subbaum für schnelles Vorwärtsrechnen
}

/**
 * Erzeuge ein neues Blatt (level = 0) aus vier Bits (0/1).
 * population = Anzahl der Bits, die = 1 sind.
 */
LifeUniverse.prototype.make_leaf = function(a, b, c, d) {
  var pop = a + b + c + d;
  var node = new Node(a, b, c, d, null, null, null, null, 0, 0, 0, 0, 0, pop);
  this.node_hash(node);
  return node;
};

/**
 * Erzeuge ein neues Node (level > 0) aus vier Subknoten (nw, ne, sw, se).
 * e,f,g,h werden nicht nötig initialisiert, population wird berechnet.
 */
LifeUniverse.prototype.create_node = function(nw, ne, sw, se) {
  var lvl = nw.level + 1;
  // Summe aller vier Kinder-Populationen
  var pop = nw.population + ne.population + sw.population + se.population;
  var node = new Node(0, 0, 0, 0, nw, ne, sw, se, 0, 0, 0, 0, lvl, pop);
  this.node_hash(node);
  return node;
};

/**
 * Berechnet den Hashwert und speichert das Node in der Hashmap.
 * Wenn ein äquivalentes Node existiert, gibt es das existierende zurück.
 */
LifeUniverse.prototype.node_hash = function(node) {
  if (node.id) return node; // Bereits gehashed

  // Hash aus ID der Kinder-Referenzen (level > 0) oder aus Bits (level = 0)
  var h;
  if (node.level === 0) {
    h = ((node.a * 8) ^ (node.b * 4) ^ (node.c * 2) ^ node.d) & (this.hashmap_size - 1);
  } else {
    // Kombiniere IDs der vier Kinder
    h = ((node.nw.id * 1000003) ^
         (node.ne.id * 1000009) ^
         (node.sw.id * 1000033) ^
         (node.se.id * 1000037)
        ) & (this.hashmap_size - 1);
  }

  // Lineares Sondieren (Open Addressing) bei Kollisionen
  while (this.hashmap[h] !== undefined) {
    var other = this.hashmap[h];
    if (other.level === node.level) {
      var same;
      if (node.level === 0) {
        same = (other.a === node.a && other.b === node.b && other.c === node.c && other.d === node.d);
      } else {
        same = (other.nw === node.nw && other.ne === node.ne && other.sw === node.sw && other.se === node.se);
      }
      if (same) {
        return other; // Bereits vorhanden
      }
    }
    h = (h + 1) & (this.hashmap_size - 1);
  }

  // Noch nicht vorhanden: füge neu ein
  node.id = ++this.last_id;
  this.hashmap[h] = node;

  // Falls Hashmap zu voll, vergrößern und rehashen
  if (this.last_id > this.hashmap_size * LOAD_FACTOR) {
    this.hashmap_resize();
  }
  return node;
};

/**
 * Verdoppelt die Hashmap-Größe und rehashes alle existierenden Nodes.
 */
LifeUniverse.prototype.hashmap_resize = function() {
  var old_map = this.hashmap;
  var old_size = this.hashmap_size;

  this.hashmap_size = this.hashmap_size << 1;
  this.hashmap = new Array(this.hashmap_size + 1);
  for (var i = 0; i <= this.hashmap_size; i++) this.hashmap[i] = undefined;

  this.last_id = 4;
  this.node_hash(this.root);

  // t = performance.now();  // optional für Debug
  // Rehash aller existierenden Einträge
  for (var i = 0; i < old_size; i++) {
    var node = old_map[i];
    if (node !== undefined) {
      node.id = 0;
    }
  }
  for (var i = 0; i < old_size; i++) {
    var node = old_map[i];
    if (node !== undefined) {
      this.node_hash(node);
    }
  }
};

/**
 * Ermittle das „mittlere“ Sub-Node (level – 1) für ein Node. Wird zum schnellen
 * Vorwärtsrechnen um eine halbe Generation genutzt. Speichert das Ergebnis in node.cache.
 */
LifeUniverse.prototype.node_center = function(node) {
  if (node.cache !== null) return node.cache; // bereits berechnet

  // level 2 oder größer: Baue durch Rekursions-Aufrufe das Zentrum zusammen
  var lvl = node.level;
  if (lvl === 2) {
    // Spezialfall: Baue direkte 4×4-zu-2×2-Übergangsmatrix
    var n00 = node.nw; var n01 = node.ne; var n10 = node.sw; var n11 = node.se;
    var a = n00.se.a + n00.se.b + n00.se.c + n00.se.d +
            n01.sw.a + n01.sw.b + n01.sw.c + n01.sw.d +
            n10.ne.a + n10.ne.b + n10.ne.c + n10.ne.d +
            n11.nw.a + n11.nw.b + n11.nw.c + n11.nw.d;
    a = (a === 3 || (a === 4 && n00.se.d)) ? 1 : 0;
    var b = n00.se.b + n00.se.c + n00.se.d + n01.sw.b + n01.sw.c + n01.sw.d +
            n10.ne.b + n10.ne.c + n10.ne.d + n11.nw.b + n11.nw.c + n11.nw.d;
    b = (b === 3 || (b === 4 && n00.se.c)) ? 1 : 0;
    var c = n00.se.c + n00.se.d + n01.sw.a + n01.sw.c + n01.sw.d +
            n10.ne.c + n10.ne.d + n11.nw.a + n11.nw.c + n11.nw.d;
    c = (c === 3 || (c === 4 && n00.se.d)) ? 1 : 0;
    var d = n00.se.d + n01.sw.b + n01.sw.c + n01.sw.d +
            n10.ne.b + n10.ne.c + n10.ne.d + n11.nw.b + n11.nw.c + n11.nw.d;
    d = (d === 3 || (d === 4 && n00.se.d)) ? 1 : 0;
    node.cache = this.make_leaf(a, b, c, d);
    return node.cache;
  }

  // Allgemeiner Fall (level > 2): Baue die 4 teilweisen Knoten, rufe center rekursiv
  var n00 = node.nw, n01 = node.ne, n10 = node.sw, n11 = node.se;
  var a = this.node_center(this.create_node(n00.nw, n00.ne, n00.sw, n00.se));
  var b = this.node_center(this.create_node(n00.ne, n01.nw, n00.se, n01.sw));
  var c = this.node_center(this.create_node(n00.sw, n00.se, n10.nw, n10.ne));
  var d = this.node_center(this.create_node(n00.se, n01.sw, n10.ne, n11.nw));
  var e = this.node_center(this.create_node(n01.nw, n01.ne, n01.sw, n01.se));
  var f = this.node_center(this.create_node(n01.sw, n01.se, n11.nw, n11.ne));
  var g = this.node_center(this.create_node(n10.nw, n10.ne, n10.sw, n10.se));
  var h = this.node_center(this.create_node(n10.ne, n11.nw, n10.se, n11.sw));
  var i = this.node_center(this.create_node(n10.sw, n10.se, n11.sw, n11.se));
  // Zusammensetzen mit create_node:
  var nw_ = this.create_node(a, b, c, d);
  var ne_ = this.create_node(b, e, d, f);
  var sw_ = this.create_node(c, d, g, h);
  var se_ = this.create_node(d, f, h, i);
  node.cache = this.create_node(nw_, ne_, sw_, se_);
  return node.cache;
};

/**
 * Berechnet das Node vierte Generationen weiter (2^(level - 2) Schritte) und
 * gibt das Resultat-Node zurück. Ist level < 2, wird null zurückgegeben.
 */
LifeUniverse.prototype.node_forward = function(node) {
  if (node.population === 0) return node.nw; // Alle Zellen tot → leeres Subfeld
  if (node.level === 1) {
    // 2×2 → einfach nächsten Zustand per Nachbarschaft berechnen
    var n00 = node;
    var n = n00.a + n00.b + n00.c + n00.d;
    var a = (n === 3 || (n === 4 && n00.a)) ? 1 : 0;
    var b = (n === 3 || (n === 4 && n00.b)) ? 1 : 0;
    var c = (n === 3 || (n === 4 && n00.c)) ? 1 : 0;
    var d = (n === 3 || (n === 4 && n00.d)) ? 1 : 0;
    return this.make_leaf(a, b, c, d);
  }
  // level > 1: nehme ‚cache‘ oder berechne center und rekursiven forward
  var c = this.node_center(node);
  return c.cache !== null ? c.cache : this.node_forward(c);
};

/**
 * Berechne exakt eine Generation weiter. Hier wird rekursiv node_forward auf
 * Subbäumen aufgerufen, um O(log n)-Zeit pro Schritt zu erreichen (Hashlife).
 */
LifeUniverse.prototype.next_generation = function(single_step) {
  if (single_step === undefined) single_step = true;
  if (this.root.population === 0) return; // Nichts zu tun, alles tot
  // Falls Generationen-Schritte > 1: expandiere das Root-Quad, bis Resultat passt
  var level = this.root.level;
  while (level < MIN_LEVEL || (single_step && this.root.level < MIN_LEVEL + 1)) {
    this.expand_root();
  }
  // Einzelschritt: forward um 1 Schritt
  this.root = this.node_forward(this.root);
  this.generation++;
};

/**
 * Erweitert das Root-Quad um eine Ebene, indem außenrum Leerzellen eingefügt
 * werden. Nötig, damit fortlaufende node_forward-Aufrufe nicht über den Rand gehen.
 */
LifeUniverse.prototype.expand_root = function() {
  var e = this.empty[this.root.level - 1];
  this.root = this.create_node(
    this.create_node(e, e, e, this.root.nw),
    this.create_node(e, e, this.root.ne, e),
    this.create_node(e, this.root.sw, e, e),
    this.create_node(this.root.se, e, e, e)
  );
};

/**
 * Setzt eine Zelle auf lebendig (true) oder tot (false). Fügt dabei nötige
 * Ebenen hinzu, damit die Koordinate ins Root-Quad passt. (Unendliches Grid.)
 */
LifeUniverse.prototype.set_bit = function(x, y, val) {
  if (val === undefined) val = true;
  // Wenn außerhalb aktueller Root-Grenzen, erweitere so lange
  while (Math.abs(x) >= (1 << this.root.level) || Math.abs(y) >= (1 << this.root.level)) {
    this.expand_root();
  }
  // Rekursive Funktion: setze unten im Quadtree das Bit
  this.root = this.node_set_bit(this.root, x, y, val);
  return this.root;
};

/**
 * Löscht eine Zelle (set_bit mit val = false).
 */
LifeUniverse.prototype.clear_bit = function(x, y) {
  return this.set_bit(x, y, false);
};

/**
 * Interne rekursive Methode, die ein Bit in Node (level ≥ 0) setzt. Liefert das
 * evtl. neue Node zurück (mit Hashlife-Interna aktualisiert).
 */
LifeUniverse.prototype.node_set_bit = function(node, x, y, val) {
  var lvl = node.level;
  if (lvl === 0) {
    // 2×2-Blatt → finde lokale Koordinaten (bitpos)
    var a = node.a, b = node.b, c = node.c, d = node.d;
    if (x === 0 && y === 0) a = val ? 1 : 0;
    if (x === 1 && y === 0) b = val ? 1 : 0;
    if (x === 0 && y === 1) c = val ? 1 : 0;
    if (x === 1 && y === 1) d = val ? 1 : 0;
    return this.make_leaf(a, b, c, d);
  }
  // Ebenen > 0: Entscheide, in welches Subquad (nw, ne, sw, se) das Bit liegt
  var half = 1 << (lvl - 1);
  var left = (x < 0 ? -1 : 1), top = (y < 0 ? -1 : 1);
  var ax = x + (left * half), ay = y + (top * half);
  var nw = node.nw, ne = node.ne, sw = node.sw, se = node.se;
  if (left === -1 && top === -1) {
    nw = this.node_set_bit(nw, ax, ay, val);
  } else if (left === 1 && top === -1) {
    ne = this.node_set_bit(ne, ax, ay, val);
  } else if (left === -1 && top === 1) {
    sw = this.node_set_bit(sw, ax, ay, val);
  } else {
    se = this.node_set_bit(se, ax, ay, val);
  }
  return this.create_node(nw, ne, sw, se);
};

/**
 * Liest heraus, ob eine Zelle an (x,y) lebendig ist (true) oder tot (false).
 */
LifeUniverse.prototype.get_bit = function(x, y) {
  var node = this.root;
  if (Math.abs(x) >= (1 << node.level) || Math.abs(y) >= (1 << node.level)) {
    return false; // jenseits des aktuellen Baums → tot
  }
  return this.node_get_bit(node, x, y);
};

/**
 * Interne rekursive Methode für get_bit.
 */
LifeUniverse.prototype.node_get_bit = function(node, x, y) {
  var lvl = node.level;
  if (lvl === 0) {
    if (x === 0 && y === 0) return !!node.a;
    if (x === 1 && y === 0) return !!node.b;
    if (x === 0 && y === 1) return !!node.c;
    if (x === 1 && y === 1) return !!node.d;
    return false;
  }
  var half = 1 << (lvl - 1);
  var left = (x < 0 ? -1 : 1), top = (y < 0 ? -1 : 1);
  var ax = x + (left * half), ay = y + (top * half);
  if (left === -1 && top === -1) {
    return this.node_get_bit(node.nw, ax, ay);
  } else if (left === 1 && top === -1) {
    return this.node_get_bit(node.ne, ax, ay);
  } else if (left === -1 && top === 1) {
    return this.node_get_bit(node.sw, ax, ay);
  } else {
    return this.node_get_bit(node.se, ax, ay);
  }
};

/**
 * Berechnet die Ausdehnung (xmin, xmax, ymin, ymax) aller lebenden Zellen in
 * der Liste field_x, field_y (Arrays gleicher Länge).
 */
LifeUniverse.prototype.get_bounds = function(field_x, field_y) {
  if (field_x.length === 0) {
    return { xmin: 0, ymin: 0, xmax: 0, ymax: 0 };
  }
  var xmin = field_x[0], xmax = field_x[0];
  var ymin = field_y[0], ymax = field_y[0];
  for (var i = 1; i < field_x.length; i++) {
    if (field_x[i] < xmin) xmin = field_x[i];
    if (field_x[i] > xmax) xmax = field_x[i];
    if (field_y[i] < ymin) ymin = field_y[i];
    if (field_y[i] > ymax) ymax = field_y[i];
  }
  return { xmin: xmin, ymin: ymin, xmax: xmax, ymax: ymax };
};

/**
 * Zentriert ein Feld (Arrays field_x, field_y) innerhalb des aktuellen Root-Levels.
 * scaledBounds: { xmin, ymin, xmax, ymax }. Passt die Koordinaten an, so dass
 * sie mittig platziert sind.
 */
LifeUniverse.prototype.make_center = function(field_x, field_y, scaledBounds) {
  var dx = scaledBounds.xmin + scaledBounds.xmax;
  var dy = scaledBounds.ymin + scaledBounds.ymax;
  // Mittelpunkte berechnen
  var mx = Math.floor(dx / 2);
  var my = Math.floor(dy / 2);
  // Alle Koordinaten so verschieben, dass sie um (0,0) zentriert sind
  for (var i = 0; i < field_x.length; i++) {
    field_x[i] -= mx;
    field_y[i] -= my;
  }
};

/**
 * Setzt das gesamte Feld anhand von x- und y-Arrays (lebende Zellen),
 * nutzt get_bounds und make_center. Speichert Root neu.
 */
LifeUniverse.prototype.setup_field = function(field_x, field_y, scaledBounds) {
  this.root = this.empty[scaledBounds.level]; // Grundzustand: alles tot auf minimal nötigem Level
  this.make_center(field_x, field_y, scaledBounds);
  for (var i = 0; i < field_x.length; i++) {
    this.set_bit(field_x[i], field_y[i], true);
  }
  this.generation = 0;
  this.save_rewind_state();
};

/**
 * Speichert den aktuellen Root-Zustand für „Rewind“ (zurückspulen).
 */
LifeUniverse.prototype.save_rewind_state = function() {
  this.rewind_stack[this.rewind_ptr++] = this.root;
};

/**
 * Lädt den letzten gespeicherten Zustand (Rewind). Falls nichts vorhanden, kein Effekt.
 */
LifeUniverse.prototype.load_rewind_state = function() {
  if (this.rewind_ptr <= 1) return;
  this.rewind_ptr--;
  this.root = this.rewind_stack[this.rewind_ptr - 1];
};

/**
 * Löscht die Rewind-Historie.
 */
LifeUniverse.prototype.clear_rewind = function() {
  this.rewind_stack = [];
  this.rewind_ptr = 0;
};

/**
 * Ermittelt alle lebenden Zellen (x,y) im Node und fügt sie in boundary-Array ein.
 * Wird z. B. vom Renderer benutzt, um alle Pixel zu zeichnen. boundary = [] am Start,
 * left, top = Koordinaten-Ursprung, findBits = Bitmaske, die vorgibt, welche
 * Subbäume durchsucht werden sollen.
 */
LifeUniverse.prototype.node_get_boundary = function(node, left, top, findBits, boundary) {
  if (node.population === 0 || findBits === 0) return;
  if (node.level === 0) {
    if (findBits & 1 && node.a) boundary.push([left, top]);
    if (findBits & 2 && node.b) boundary.push([left + 1, top]);
    if (findBits & 4 && node.c) boundary.push([left, top + 1]);
    if (findBits & 8 && node.d) boundary.push([left + 1, top + 1]);
    return;
  }
  var offset = 1 << (node.level - 2);

  // Bestimme für jeden Teil-Quadranten, ob er durchsucht werden soll
  var MASK_LEFT   = 1 | 4;
  var MASK_RIGHT  = 2 | 8;
  var MASK_TOP    = 1 | 2;
  var MASK_BOTTOM = 4 | 8;

  var find_nw = ((findBits & MASK_LEFT) && (findBits & MASK_TOP)) ? MASK_LEFT & MASK_TOP : 0;
  var find_ne = ((findBits & MASK_RIGHT) && (findBits & MASK_TOP)) ? MASK_RIGHT & MASK_TOP : 0;
  var find_sw = ((findBits & MASK_LEFT) && (findBits & MASK_BOTTOM)) ? MASK_LEFT & MASK_BOTTOM : 0;
  var find_se = ((findBits & MASK_RIGHT) && (findBits & MASK_BOTTOM)) ? MASK_RIGHT & MASK_BOTTOM : 0;

  // Sind in den Ecken lebende Zellen? Dann erweitere Suchfelder entsprechend
  if (node.nw.population) {
    find_nw &= ~MASK_LEFT;
    find_sw &= ~MASK_TOP;
  }
  if (node.ne.population) {
    find_ne &= ~MASK_RIGHT;
    find_nw &= ~MASK_TOP;
  }
  if (node.sw.population) {
    find_sw &= ~MASK_BOTTOM;
    find_se &= ~MASK_LEFT;
  }
  if (node.se.population) {
    find_se &= ~MASK_RIGHT;
    find_ne &= ~MASK_BOTTOM;
  }

  // Rekursiver Abstieg
  this.node_get_boundary(node.nw, left, top, find_nw, boundary);
  this.node_get_boundary(node.ne, left + offset, top, find_ne, boundary);
  this.node_get_boundary(node.sw, left, top + offset, find_sw, boundary);
  this.node_get_boundary(node.se, left + offset, top + offset, find_se, boundary);
};

/**
 * Liefert alle (x,y)-Paare lebender Zellen im gesamtem Root-Quadtree.
 */
LifeUniverse.prototype.get_all_cells = function() {
  var boundary = [];
  // Vollständige Suchbitmaske für Level 0: 1|2|4|8 = 15
  this.node_get_boundary(this.root, - (1 << (this.root.level - 1)), - (1 << (this.root.level - 1)), 15, boundary);
  return boundary;
};

/**
 * Liefert die Population (Anzahl lebender Zellen) der aktuellen Root.
 */
LifeUniverse.prototype.get_population = function() {
  return this.root.population;
};

// Exportieren, falls Node.js / ES-Module benötigt (in p5.js brauchen wir das nicht):
// if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
//   module.exports = LifeUniverse;
// }
//------------------------------------------------------------------------------

/** End of life.js **/
