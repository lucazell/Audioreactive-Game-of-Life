"use strict";

/**
 * LifeCanvasDrawer – Zeichnet ein LifeUniverse-Quadtree-Objekt auf ein HTML-Canvas.
 * Diese Klasse stammt aus deinem Original-Repo und wurde hier unverändert übernommen,
 * um sie in p5.js zu verwenden. In deinem p5-Sketch rufst du einfach z. B.
 *
 *   const drawer = new LifeCanvasDrawer();
 *   drawer.init(canvasElement);       // canvasElement kann auch document.body sein (dann wird ein neues <canvas> erzeugt)
 *   drawer.set_size(width, height);
 *   drawer.redraw(life.root);
 *
 * auf. LifeCanvasDrawer kümmert sich um Hoch-/Runterskalierung (devicePixelRatio) und
 * um sehr schnelles Pixel-Blitting via ImageData.  
 *
 * Wichtig: Wenn du mit p5.js arbeitest, übergebe hier am besten das von p5 erstellte
 * Canvas-Element (z.B. `canvas.elt`), damit kein zweites Canvas darunter/oberhalb entsteht.
 */

 /** @constructor */
function LifeCanvasDrawer()
{
    var

        // Wo sich das Viewport im Canvas befindet (in Pixeln, relativer Origin)
        /** @type {number} */
        canvas_offset_x = 0,
        /** @type {number} */
        canvas_offset_y = 0,

        // Canvas-Breite und -Höhe in physischen Pixeln (inkl. devicePixelRatio)
        canvas_width,
        canvas_height,

        // Aktuelles HTML-Canvas-Element und sein 2D-Kontext
        /** @type {HTMLCanvasElement} */
        canvas = null,
        /** @type {CanvasRenderingContext2D} */
        context = null,

        // ImageData + rohes Array-Buffer-View (Int32Array) zum schnellen Schreiben
        image_data = null,
        image_data_data = null,

        // Aktueller Zoom-Faktor (Cell-Size in Pixeln)
        /** @type {number} */
        cell_width = 1,

        // Aktuelle Zell- und Hintergrundfarbe (als CSS-Strings)
        /** @type {string|null} */
        cell_color = null,
        /** @type {string|null} */
        background_color = null,

        // Randbreite (in Vielfachen des Zooms)
        border_width = 0,

        // Zusätzliche Debug-Flags
        draw_border = false,   // Wenn true, wird bei jeder Zelle ein 1px-Rahmen gezeichnet
        draw_debug = false;    // Wenn true, werden zusätzliche Debug-Infos gerendert

    // Öffentliche Felder / Methoden
    var drawer = this;
    this.canvas = null;           // Wird auf das HTML-Canvas gesetzt
    this.cell_color = cell_color;
    this.background_color = background_color;
    this.border_width = border_width;

    this.init       = init;       // init(dom_parent_or_canvas)
    this.redraw     = redraw;     // redraw(node)
    this.move       = move;       // move(dx, dy)
    this.zoom_at    = zoom_at;    // zoom_at(mouse_x, mouse_y, delta)
    this.zoom_centered = zoom_centered; // zoom_centered(zoom_in)
    this.fit_bounds = fit_bounds; // fit_bounds(xmin, ymin, xmax, ymax)
    this.set_size   = set_size;   // set_size(width, height)

    ////////////////////////////////////////////////////////////////////////////////
    // init(dom_parent_or_canvas)
    //   Wenn `dom_parent_or_canvas` ein HTMLCanvasElement ist, wird dieses als Zeichenfläche
    //   genutzt. Andernfalls wird ein neues <canvas> erzeugt und in den übergebenen DOM-Knoten gehängt.
    //   Gibt true zurück, wenn Canvas-Rendering verfügbar ist.
    function init(dom_parent_or_canvas)
    {
        // Falls ein <canvas>-Element übergeben wurde, nimm es
        if(dom_parent_or_canvas instanceof HTMLCanvasElement) {
            canvas = dom_parent_or_canvas;
            context = canvas.getContext("2d");
            drawer.canvas = canvas;
            return true;
        }

        // Andernfalls: Erzeuge neues Canvas und hänge es ans DOM
        var dom_parent = dom_parent_or_canvas;
        canvas = document.createElement("canvas");
        if(!canvas.getContext) {
            return false;
        }
        drawer.canvas = canvas;
        context = canvas.getContext("2d");
        dom_parent.appendChild(canvas);
        return true;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // set_size(width, height)
    //   Setzt die sichtbare Canvas-Größe (in CSS-Pixeln) und passt internal die
    //   physischen Pixel (devicePixelRatio) an. Initialisiert oder aktualisiert
    //   `image_data` und `image_data_data`.
    function set_size(width, height)
    {
        if(width !== canvas_width || height !== canvas_height)
        {
            // Setze CSS-Größe (für p5 kann dies bereits geschehen sein, aber wir stellen sicher, dass es konsistent ist)
            canvas.style.width  = width  + "px";
            canvas.style.height = height + "px";

            // Bestimme devicePixelRatio, um das interne Canvas „scharf“ darzustellen
            var factor = window.devicePixelRatio || 1;

            // Rechne in physische Pixel um
            canvas.width  = Math.round(width  * factor);
            canvas.height = Math.round(height * factor);
            canvas_width  = canvas.width;
            canvas_height = canvas.height;

            // Erzeuge neues ImageData-Objekt für schnelles Pixel-Blitting
            image_data = context.createImageData(canvas_width, canvas_height);
            // Lege Int32-View auf den Daten-Buffer, um pro Pixel schneller 32-Bit-Werte zu setzen
            image_data_data = new Int32Array(image_data.data.buffer);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////
    // move(dx, dy)
    //   Verschiebt das Viewport um dx, dy (in Zellen, nicht Pixel!). Der Effekt tritt
    //   erst nach dem nächsten redraw auf.
    function move(dx, dy)
    {
        // dx, dy sind Offset in Zellen; also in Pixel multipliziert mit cell_width
        canvas_offset_x += dx * cell_width;
        canvas_offset_y += dy * cell_width;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // zoom_at(x, y, delta)
    //   Zoomt an der Position (x, y) (in CSS-Pixeln relativ zum Canvas-Element-Anfang).
    //   `delta` > 1 → reinzoomen, < 1 → rauszoomen. Die Zelle unter (x, y) bleibt im Fokus.
    function zoom_at(x, y, delta)
    {
        // Neue Zell-Größe in Pixeln (physisch)
        var old_cw = cell_width;
        var new_cw = Math.max(1, Math.min(old_cw * delta, 256)); // z.B. zwischen 1px und 256px
        var factor = new_cw / old_cw;

        // Passe Canvas-Offset an, damit das Zoom-Zentrum (x,y) beibehalten wird
        var rx = (x + canvas_offset_x) / old_cw;
        var ry = (y + canvas_offset_y) / old_cw;
        canvas_offset_x = Math.round(rx * new_cw - x);
        canvas_offset_y = Math.round(ry * new_cw - y);
        cell_width = new_cw;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // zoom_centered(zoom_in)
    //   Zoomt ein oder aus, zentriert auf das Canvas-Mittel. `zoom_in` ist boolean.
    function zoom_centered(zoom_in)
    {
        var factor = zoom_in ? 2 : 0.5;
        // Mittelpunkt des Canvas in CSS-Pixeln
        var mx = canvas_width  / (window.devicePixelRatio || 1) / 2;
        var my = canvas_height / (window.devicePixelRatio || 1) / 2;
        zoom_at(mx, my, factor);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // fit_bounds(xmin, ymin, xmax, ymax)
    //   Zoomt und verschiebt so, dass das Rechteck [xmin..xmax]×[ymin..ymax] (in Zellen)
    //   pixelgenau auf das Canvas passt. Nützlich, um z. B. ein geladenes Pattern komplett
    //   sichtbar zu machen.
    function fit_bounds(xmin, ymin, xmax, ymax)
    {
        var w = xmax - xmin + 1;
        var h = ymax - ymin + 1;
        if(w <= 0 || h <= 0) return;

        // Bestimme physische Canvas-Größe in CSS-Pixeln
        var css_w = canvas_width  / (window.devicePixelRatio || 1);
        var css_h = canvas_height / (window.devicePixelRatio || 1);

        // Cell-Size so wählen, dass Pattern vollständig reingeht
        var cw1 = Math.floor(css_w / w);
        var cw2 = Math.floor(css_h / h);
        cell_width = Math.max(1, Math.min(cw1, cw2));

        // Pattern mittig positionieren
        var px = Math.round((css_w  - w * cell_width) / 2);
        var py = Math.round((css_h - h * cell_width) / 2);
        canvas_offset_x = -xmin * cell_width + px;
        canvas_offset_y = -ymin * cell_width + py;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // redraw(node)
    //   Zeichnet das gesamte Quadtree `node` (life.root) aufs Canvas. Nutzt
    //   devicePixelRatio-angepasstes ImageData und Int32-View für Performance.
    function redraw(node)
    {
        if(!image_data_data) return;

        // Fülle Hintergrund (falls gewünscht)
        if(background_color)
        {
            // Konvertiere CSS-String zu 32-Bit ARGB
            var bg = parseCSSColor(background_color);
            // bg.r, bg.g, bg.b
            var argb = (255 << 24) | (bg.b << 16) | (bg.g << 8) | (bg.r);
            for(var i = 0; i < image_data_data.length; i++)
            {
                image_data_data[i] = argb;
            }
        }
        else
        {
            // Schwarz als Default
            for(var i = 0; i < image_data_data.length; i++)
            {
                image_data_data[i] = 0xff000000; // 255,0,0,0
            }
        }

        // Zeichne alle lebenden Zellen (Depth-First-Traversal des Quadtrees)
        if(node && node.population > 0)
        {
            drawNode(node, 0, 0, 1 << node.level);
        }

        // Wenn Debug-Flag aktiv, zeichne eventuell Rahmen um alle Zellen
        if(draw_border && cell_width >= 2)
        {
            // Wir haben zusätzliche 1px-Rahmen in CSS-Pixeln
            var bw = border_width * (window.devicePixelRatio || 1);
            var cd = cell_width * (window.devicePixelRatio || 1);
            context.lineWidth = bw;
            context.strokeStyle = "#444444";
            // Linie zu jedem Pixel-Gridpunkt
            var w_px = canvas_width;
            var h_px = canvas_height;
            for(var x = 0; x <= w_px; x += cd)
            {
                context.beginPath();
                context.moveTo(x + 0.5, 0);
                context.lineTo(x + 0.5, h_px);
                context.stroke();
            }
            for(var y = 0; y <= h_px; y += cd)
            {
                context.beginPath();
                context.moveTo(0, y + 0.5);
                context.lineTo(w_px, y + 0.5);
                context.stroke();
            }
        }

        // Schreibe das ImageData aufs Canvas
        context.putImageData(image_data, 0, 0);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Rekursive Funktion: Zeichnet einzelne Node-Bereiche in das ImageData-Array.
    //   node: aktuelles Quadtree-Node
    //   x0, y0: Ursprung (Zellen-Koordinaten) des Node
    //   size: Breite/Höhe des Node in Zellen (size = 2^level)
    function drawNode(node, x0, y0, size)
    {
        // Wenn keine lebenden Zellen, nichts zeichnen
        if(node.population === 0) return;

        // Wenn wir im Minimum angekommen sind (level = 0 ⇒ 2×2-Block)
        if(node.level === 0)
        {
            // Wir erhalten auf level=0 jeweils 2×2 Zellen (a,b,c,d)
            // Jedes dieser Bits wird als cell_width×cell_width-Rechteck gemalt.
            var bits = [node.a, node.b, node.c, node.d];
            for(var i = 0; i < 4; i++)
            {
                if(bits[i])
                {
                    // Berechne Zell-Koordinaten
                    var dx = (i === 1 || i === 3) ? 1 : 0;
                    var dy = (i >= 2) ? 1 : 0;
                    // Zell-Koordinate in globalen Zellenkoordinaten
                    var xx = x0 + dx;
                    var yy = y0 + dy;

                    // Jetzt in Pixel umrechnen (physische Pixel)
                    var px = xx * cell_width + canvas_offset_x * (window.devicePixelRatio || 1);
                    var py = yy * cell_width + canvas_offset_y * (window.devicePixelRatio || 1);
                    var pw = cell_width * (window.devicePixelRatio || 1);

                    // Farbe bestimmen und ARGB-Value
                    var col = cell_color ? parseCSSColor(cell_color) : { r: 0, g: 255, b: 0 };
                    var argb = (255 << 24) | (col.b << 16) | (col.g << 8) | (col.r);

                    // Setze cw×cw Pixel in image_data_data auf argb
                    // Pointer auf oberstes Pixel der Zelle
                    var row_width = canvas_width;
                    var start = (py * canvas_width + px) | 0;
                    for(var yy2 = 0; yy2 < pw; yy2++)
                    {
                        var ptr = start + yy2 * row_width;
                        for(var xx2 = 0; xx2 < pw; xx2++)
                        {
                            image_data_data[ptr + xx2] = argb;
                        }
                    }
                }
            }
            return;
        }

        // Wenn Node-Level > 0, unterteile in vier Subbäume
        var half = size >> 1;

        // NW
        drawNode(node.nw, x0,        y0,         half);
        // NE
        drawNode(node.ne, x0 + half, y0,         half);
        // SW
        drawNode(node.sw, x0,        y0 + half,  half);
        // SE
        drawNode(node.se, x0 + half, y0 + half,  half);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // parseCSSColor(cssColor)
    //   Wandelt ein CSS-Farbstring (Hex-Notation, z.B. "#0f0" oder "#008800") in ein
    //   Objekt {r:…, g:…, b:…} um. Wird intern für `cell_color` und `background_color` genutzt.
    function parseCSSColor(color)
    {
        if(color.length === 4) { // z.B. "#0f0"
            return {
                r: parseInt(color[1] + color[1], 16),
                g: parseInt(color[2] + color[2], 16),
                b: parseInt(color[3] + color[3], 16)
            };
        }
        else { // z.B. "#00ff00"
            return {
                r: parseInt(color.slice(1, 3), 16),
                g: parseInt(color.slice(3, 5), 16),
                b: parseInt(color.slice(5, 7), 16)
            };
        }
    }
}
