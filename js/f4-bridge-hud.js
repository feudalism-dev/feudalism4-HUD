/**
 * Feudalism 4 — production hud.html helpers for JSONP bridge (pipe-line session).
 * Requires shared/f4-api.js (F4Bridge).
 *
 * Session wire format (LSL → JS via JSONP string callback):
 *   OK|characterId|xp_lifetime|xp_spent|ap_balance|stats_csv
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
            xp_lifetime: parseInt(econ.xp_lifetime, 10) || 0,
            xp_spent: parseInt(econ.xp_spent, 10) || 0,
            ap_balance: parseInt(econ.ap_balance, 10) || 0,
            stats_csv: csv,
            line: "legacy"
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
            return { ok: false, error: parts[1] || "error" };
        }
        if (parts[0] !== "OK") {
            return { ok: false, error: "bad_prefix" };
        }
        return {
            ok: true,
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
            return F4Bridge.getSession();
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
        fetchSession: fetchSession,
        parseSessionLine: parseSessionLine,
        decodeMoapField: decodeMoapField,
        poolFromPipe: poolFromPipe
    };
})(typeof window !== "undefined" ? window : globalThis);
