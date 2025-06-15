"use strict";

/**
 * formats.js – Parser und Generatoren für verschiedene Life-Formate (RLE, Plaintext, Life 1.05/1.06)
 * Angepasst für p5.js – einfach in dein HTML einbinden und auf das globale Objekt `formats` zugreifen.
 *
 * Usage-Beispiel:
 *   let rleText = "x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!";
 *   let result = formats.parse_rle(rleText);
 */

var
    /** @const */ MIN_BUFFER_SIZE   = 0x100,
    /** @const */ MAX_BUFFER_SIZE   = 0x1000000,
    /** @const */ DENSITY_ESTIMATE  = 0.009,
    /** @const */ MAX_LINE_LENGTH   = 70;

var formats = (function() {
    return {
        parse_rle:       parse_rle,
        parse_plaintext: parse_plaintext,
        parse_pattern:   parse_pattern,
        parse_rule:      parse_rule,
        rule2str:        rule2str,
        rule2str_rle:    rule2str_rle,
        generate_rle:    generate_rle
    };

    function parse_pattern(pattern_text) {
        // Entferne kommentierte Zeilen und führende Leerzeilen
        let tmp = pattern_text.replace(/^\s*(#|;|!|\n)/g, "");
        // Korrigierter Regex: x=<Zahl>, y=<Zahl>
        if (/x *= *\d+ *, *y *= *\d+/.test(tmp)) {
            return parse_rle(pattern_text);
        }
        if (/^#Life\s+1\.06/.test(pattern_text)) {
            return parse_life106(pattern_text);
        }
        if (/^#Life\s+1\.05/.test(pattern_text)) {
            return parse_life105(pattern_text);
        }
        return parse_plaintext(pattern_text);
    }

    function parse_rle(pattern_string) {
        let result = parse_comments(pattern_string, "#");
        let x = 0, y = 0, header_match;

        pattern_string = result.pattern_string;
        let pos = pattern_string.indexOf("\n");
        if (pos === -1) {
            return { error: "RLE Syntax Error: No Header" };
        }

        let header_line = pattern_string.substring(0, pos).trim();
        if ((header_match = header_line.match(
                /^x *= *(\d+) *, *y *= *(\d+)(?: *, *rule *= *([a-zA-Z0-9\/()]+))?/
             )) === null) {
            return { error: "RLE Syntax Error: Invalid Header: " + header_line };
        }

        result.width  = parseInt(header_match[1], 10);
        result.height = parseInt(header_match[2], 10);
        result.rule   = header_match[3] || "B3/S23";
        result.rule_s = parse_rule_rle(result.rule, true);
        result.rule_b = parse_rule_rle(result.rule, false);

        result.x = [];
        result.y = [];
        result.comment += "\nRule: " + rule2str(result.rule_s, result.rule_b) + "\n";

        let body = pattern_string.substring(pos + 1).replace(/[ \t\r]/g, "");
        let run_count = 0, c;
        for (let i = 0; i < body.length; i++) {
            c = body.charAt(i);
            if (c >= '0' && c <= '9') {
                run_count = run_count * 10 + (c.charCodeAt(0) - 48);
            } else {
                let count = run_count === 0 ? 1 : run_count;
                if (c === "b") {
                    x += count;
                } else if (c === "o") {
                    for (let k = 0; k < count; k++) {
                        result.x.push(x);
                        result.y.push(y);
                        x++;
                    }
                } else if (c === "$") {
                    y += count;
                    x = 0;
                } else if (c === "!") {
                    break;
                }
                run_count = 0;
            }
        }

        return result;
    }

    function parse_plaintext(pattern_string) {
        let result = parse_comments(pattern_string, "!");
        let lines = result.pattern_string.replace(/\r/g, "").split("\n");
        let height = lines.length;
        let width  = 0;

        for (let row = 0; row < lines.length; row++) {
            if (lines[row].length > width) width = lines[row].length;
        }

        result.x = [];
        result.y = [];
        result.width  = width;
        result.height = height;
        result.rule   = "B3/S23";
        result.rule_s = parse_rule_rle(result.rule, true);
        result.rule_b = parse_rule_rle(result.rule, false);

        for (let row = 0; row < lines.length; row++) {
            let line = lines[row];
            for (let col = 0; col < line.length; col++) {
                let c = line.charAt(col);
                if (c === "o" || c === "O") {
                    result.x.push(col);
                    result.y.push(row);
                }
            }
        }

        return result;
    }

    function parse_life106(pattern_string) {
        let lines = pattern_string.replace(/\r/g, "").split("\n");
        if (!/^#Life\s+1\.06/.test(lines[0])) {
            return { error: "Life 1.06: No valid header" };
        }
        let coords = [];
        for (let i = 1; i < lines.length; i++) {
            let parts = lines[i].trim().split(/\s+/);
            if (parts.length >= 2 && parts[0] !== "" && parts[1] !== "") {
                coords.push([parseInt(parts[0], 10), parseInt(parts[1], 10)]);
            }
        }
        if (coords.length === 0) {
            return { error: "Life 1.06: No cell coordinates found" };
        }
        let xmin = coords[0][0], xmax = coords[0][0], ymin = coords[0][1], ymax = coords[0][1];
        for (let i = 1; i < coords.length; i++) {
            let [x, y] = coords[i];
            if (x < xmin) xmin = x;
            if (x > xmax) xmax = x;
            if (y < ymin) ymin = y;
            if (y > ymax) ymax = y;
        }
        let result = {
            x: [],
            y: [],
            width: xmax - xmin + 1,
            height: ymax - ymin + 1,
            rule: "B3/S23"
        };
        for (let i = 0; i < coords.length; i++) {
            result.x.push(coords[i][0] - xmin);
            result.y.push(coords[i][1] - ymin);
        }
        result.rule_s = parse_rule_rle(result.rule, true);
        result.rule_b = parse_rule_rle(result.rule, false);
        return result;
    }

    function parse_life105(pattern_string) {
        let lines = pattern_string.replace(/\r/g, "").split("\n");
        if (!/^#Life\s+1\.05/.test(lines[0])) {
            return { error: "Life 1.05: No valid header" };
        }
        let coords = [];
        for (let i = 1; i < lines.length; i++) {
            let parts = lines[i].trim().split(/\s+/);
            if (parts.length >= 2 && parts[0] !== "" && parts[1] !== "") {
                coords.push([parseInt(parts[0], 10), parseInt(parts[1], 10)]);
            }
        }
        if (coords.length === 0) {
            return { error: "Life 1.05: No cell coordinates found" };
        }
        let xmin = coords[0][0], xmax = coords[0][0], ymin = coords[0][1], ymax = coords[0][1];
        for (let i = 1; i < coords.length; i++) {
            let [x, y] = coords[i];
            if (x < xmin) xmin = x;
            if (x > xmax) xmax = x;
            if (y < ymin) ymin = y;
            if (y > ymax) ymax = y;
        }
        let result = {
            x: [],
            y: [],
            width: xmax - xmin + 1,
            height: ymax - ymin + 1,
            rule: "B3/S23"
        };
        for (let i = 0; i < coords.length; i++) {
            result.x.push(coords[i][0] - xmin);
            result.y.push(coords[i][1] - ymin);
        }
        result.rule_s = parse_rule_rle(result.rule, true);
        result.rule_b = parse_rule_rle(result.rule, false);
        return result;
    }

    function parse_comments(pattern_string, comment_prefix) {
        let lines = pattern_string.replace(/\r/g, "").split("\n");
        let result = { comment: "", pattern_string: "" };
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.startsWith(comment_prefix)) {
                result.comment += line + "\n";
            } else {
                result.pattern_string += line + "\n";
            }
        }
        return result;
    }

    function parse_rule_rle(rule_string, survived) {
        rule_string = rule_string.replace(/\s/g, "").toUpperCase();
        let rule_s = [false, false, false, false, false, false, false, false, false];
        let rule_b = [false, false, false, false, false, false, false, false, false];
        let parts = rule_string.split("/");
        if (parts.length === 2) {
            for (let part of parts) {
                if (part.startsWith("B")) {
                    for (let i = 1; i < part.length; i++) {
                        let d = parseInt(part.charAt(i), 10);
                        if (!isNaN(d) && d >= 0 && d <= 8) rule_b[d] = true;
                    }
                } else if (part.startsWith("S")) {
                    for (let i = 1; i < part.length; i++) {
                        let d = parseInt(part.charAt(i), 10);
                        if (!isNaN(d) && d >= 0 && d <= 8) rule_s[d] = true;
                    }
                } else {
                    for (let ch of part) {
                        let d = parseInt(ch, 10);
                        if (!isNaN(d) && d >= 0 && d <= 8) {
                            if (part === parts[0]) rule_s[d] = true;
                            else rule_b[d] = true;
                        }
                    }
                }
            }
        }
        return survived ? rule_s : rule_b;
    }

    function parse_rule(rule_str, survived) {
        let parts = rule_str.toUpperCase().split("/");
        let rule_s = [false, false, false, false, false, false, false, false, false];
        let rule_b = [false, false, false, false, false, false, false, false, false];
        if (parts.length === 2) {
            for (let part of parts) {
                if (part.startsWith("B")) {
                    for (let i = 1; i < part.length; i++) {
                        let d = parseInt(part.charAt(i), 10);
                        if (!isNaN(d) && d >= 0 && d <= 8) rule_b[d] = true;
                    }
                } else if (part.startsWith("S")) {
                    for (let i = 1; i < part.length; i++) {
                        let d = parseInt(part.charAt(i), 10);
                        if (!isNaN(d) && d >= 0 && d <= 8) rule_s[d] = true;
                    }
                } else {
                    for (let ch of part) {
                        let d = parseInt(ch, 10);
                        if (!isNaN(d) && d >= 0 && d <= 8) {
                            if (part === parts[0]) rule_s[d] = true;
                            else rule_b[d] = true;
                        }
                    }
                }
            }
        } else {
            return false;
        }
        return survived ? rule_s : rule_b;
    }

    function rule2str(rule_s, rule_b) {
        let s = "S", b = "B";
        for (let i = 0; i <= 8; i++) if (rule_s[i]) s += i;
        for (let i = 0; i <= 8; i++) if (rule_b[i]) b += i;
        return b + "/" + s;
    }

    function rule2str_rle(rule_s, rule_b) {
        let s = "", b = "";
        for (let i = 0; i <= 8; i++) if (rule_b[i]) b += i;
        for (let i = 0; i <= 8; i++) if (rule_s[i]) s += i;
        return b + "/" + s;
    }

    function generate_rle(life, bounds) {
        let cells = life.get_all_cells();
        let width  = bounds.xmax - bounds.xmin + 1;
        let height = bounds.ymax - bounds.ymin + 1;

        let result = [];
        result.push("x = " + width + ", y = " + height + ", rule = " + rule2str_rle(life.rule_s, life.rule_b));

        let grid = new Array(height);
        for (let i = 0; i < height; i++) grid[i] = new Array(width).fill(0);
        for (let i = 0; i < cells.length; i++) {
            let [cx, cy] = cells[i];
            if (cx >= bounds.xmin && cx <= bounds.xmax && cy >= bounds.ymin && cy <= bounds.ymax) {
                grid[cy - bounds.ymin][cx - bounds.xmin] = 1;
            }
        }

        function encode_line(row) {
            let line = "";
            let run_length = 0;
            let last = 0;
            for (let col = 0; col < width; col++) {
                let cell = row[col];
                if (cell === last) {
                    run_length++;
                } else {
                    if (run_length > 1) line += run_length;
                    line += (last === 1 ? "o" : "b");
                    run_length = 1;
                    last = cell;
                }
            }
            if (run_length > 1) line += run_length;
            line += (last === 1 ? "o" : "b");
            return line;
        }

        let body_parts = [];
        for (let row = 0; row < height; row++) {
            body_parts.push(encode_line(grid[row]));
            if (row < height - 1) body_parts.push("$");
        }
        body_parts.push("!");

        let lines_out = [];
        let current_line = "";
        for (let part of body_parts) {
            if (current_line.length + part.length > MAX_LINE_LENGTH) {
                lines_out.push(current_line);
                current_line = "";
            }
            current_line += part;
        }
        lines_out.push(current_line);

        return result.join("\n") + "\n" + lines_out.join("\n");
    }
})();
