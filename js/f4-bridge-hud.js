/**
 * Feudalism 4 — production hud.html helpers for JSONP bridge (Phase 2).
 * Requires shared/f4-api.js (F4Bridge).
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
        var deadline = Date.now() + (maxMs || 12000);
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
            return sleep(400).then(attempt);
        }
        return attempt();
    }

    function fetchSession() {
        if (!isEnabled()) {
            return Promise.resolve({ ok: false, error: "no_bridge" });
        }
        return waitForBridgeReady(12000).then(function () {
            return F4Bridge.getSession();
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
        decodeMoapField: decodeMoapField,
        poolFromPipe: poolFromPipe
    };
})(typeof window !== "undefined" ? window : globalThis);
