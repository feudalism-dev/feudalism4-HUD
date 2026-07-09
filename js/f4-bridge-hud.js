/**
 * Feudalism 4 — production hud.html helpers for JSONP bridge (pipe-line session).
 * Requires shared/f4-api.js (F4Bridge).
 *
 * Session wire format (LSL → JS via JSONP string callback):
 *   v4: OK|characterId|name|title|gender|species_id|xp|spent|ap|stats_csv
 *   v3: OK|characterId|xp|spent|ap|stats_csv
 *   ERR|reason
 */
(function (global) {
    "use strict";

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function decodeMoapField(value) {
        if (value == null || value === "") {
            return "";
        }
        try {
            return decodeURIComponent(String(value).replace(/\+/g, " "));
        } catch (e) {
            return String(value).replace(/\+/g, " ");
        }
    }

    function isEnabled() {
        return !!(global.F4Bridge && F4Bridge.isBridgeMode && F4Bridge.isBridgeMode() && F4Bridge.getApiBase());
    }

    function waitForBridgeReady(maxMs) {
        var deadline = Date.now() + (maxMs || 8000);
        function attempt() {
            if (isEnabled()) {
                return F4Bridge.ping().then(function (res) {
                    if (res && res.ok) {
                        return true;
                    }
                    throw new Error("ping_failed");
                });
            }
            if (Date.now() >= deadline) {
                return Promise.reject(new Error("bridge_timeout"));
            }
            return sleep(300).then(attempt);
        }
        return attempt();
    }

    function normalizeLegacySession(obj) {
        if (!obj || !obj.ok) {
            return obj || { ok: false, error: "no_session" };
        }
        var csv = (obj.stats && obj.stats.csv) ? String(obj.stats.csv) : "";
        var econ = obj.econ || {};
        return {
            ok: true,
            characterId: obj.characterId || "",
            name: obj.name || "",
            title: obj.title || "",
            gender: obj.gender || "",
            species_id: obj.species_id || "",
            xp_lifetime: parseInt(econ.xp_lifetime, 10) || 0,
            xp_spent: parseInt(econ.xp_spent, 10) || 0,
            ap_balance: parseInt(econ.ap_balance, 10) || 0,
            stats_csv: csv,
            line: "legacy",
            format: "legacy"
        };
    }

    function parseSessionLine(line) {
        if (line && typeof line === "object") {
            return normalizeLegacySession(line);
        }
        if (!line || typeof line !== "string") {
            return { ok: false, error: "bad_line" };
        }
        var parts = line.split("|");
        if (parts[0] === "ERR") {
            return { ok: false, error: parts[1] || "error", line: line };
        }
        if (parts[0] !== "OK") {
            return { ok: false, error: "bad_prefix", line: line };
        }
        if (parts.length >= 10) {
            return {
                ok: true,
                format: "v4",
                characterId: parts[1] || "",
                name: decodeMoapField(parts[2] || ""),
                title: decodeMoapField(parts[3] || ""),
                gender: decodeMoapField(parts[4] || ""),
                species_id: decodeMoapField(parts[5] || ""),
                xp_lifetime: parseInt(parts[6], 10) || 0,
                xp_spent: parseInt(parts[7], 10) || 0,
                ap_balance: parseInt(parts[8], 10) || 0,
                stats_csv: parts[9] || "",
                line: line
            };
        }
        return {
            ok: true,
            format: "v3",
            characterId: parts[1] || "",
            xp_lifetime: parseInt(parts[2], 10) || 0,
            xp_spent: parseInt(parts[3], 10) || 0,
            ap_balance: parseInt(parts[4], 10) || 0,
            stats_csv: parts[5] || "",
            line: line
        };
    }

    function fetchSession() {
        if (!isEnabled()) {
            return Promise.resolve({ ok: false, error: "no_bridge" });
        }
        return waitForBridgeReady(8000).then(function () {
            return F4Bridge.getCharacter();
        }).then(function (res) {
            return parseSessionLine(res);
        });
    }

    function poolFromPipe(pipeStr) {
        if (!pipeStr || typeof pipeStr !== "string") {
            return null;
        }
        var parts = pipeStr.split("|");
        if (parts.length < 3) {
            return null;
        }
        var current = parseInt(parts[0], 10);
        var base = parseInt(parts[1], 10);
        var max = parseInt(parts[2], 10);
        if (isNaN(current) || isNaN(base) || isNaN(max)) {
            return null;
        }
        return { current: current, base: base, max: max };
    }

    global.F4BridgeHud = {
        isEnabled: isEnabled,
        waitForBridgeReady: waitForBridgeReady,
        parseSessionLine: parseSessionLine,
        fetchSession: fetchSession,
        poolFromPipe: poolFromPipe,
        decodeMoapField: decodeMoapField
    };
}(typeof window !== "undefined" ? window : this));
