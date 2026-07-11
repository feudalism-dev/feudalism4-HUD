/**
 * Feudalism 4 — JSONP client for LSL HTTP-IN (MOAP / CEF 139)
 * JSONP client for LSL HTTP-IN (MOAP / CEF 139).
 * Used by hud-bridge-poc.html and production hud.html (Phase 2+).
 * Pattern: slarcadepub/shared/sl-api.js
 */
(function (global) {
    "use strict";

    var BRIDGE_BUILD = "f4-bridge-v8.2-delete";

    var session = {
        token: "",
        avatar: "",
        name: ""
    };
    var apiBase = "";
    var bridgeMode = false;
    var hudMode = false;

    function validCallbackName(name) {
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
    }

    function nextCallback() {
        return "f4cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    }

    function jsonp(apiUrl, params, timeoutMs) {
        return new Promise(function (resolve, reject) {
            var cb = nextCallback();
            if (!validCallbackName(cb)) {
                reject(new Error("callback"));
                return;
            }
            var qs = "callback=" + encodeURIComponent(cb);
            var key;
            for (key in params) {
                if (Object.prototype.hasOwnProperty.call(params, key)) {
                    if (params[key] === undefined || params[key] === null || params[key] === "") {
                        continue;
                    }
                    qs += "&" + encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key]));
                }
            }
            var sep = apiUrl.indexOf("?") >= 0 ? "&" : "?";
            var url = apiUrl + sep + qs;
            var script = document.createElement("script");
            var timer = null;
            var done = false;

            function finish(err, data) {
                if (done) {
                    return;
                }
                done = true;
                if (timer) {
                    clearTimeout(timer);
                }
                delete global[cb];
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            }

            global[cb] = function (data) {
                finish(null, data);
            };

            script.onerror = function () {
                finish(new Error("jsonp_failed"));
            };

            if (timeoutMs) {
                timer = setTimeout(function () {
                    finish(new Error("timeout"));
                }, timeoutMs);
            }

            script.src = url;
            document.head.appendChild(script);
        });
    }

    function setSession(next) {
        session = {
            token: next.token || "",
            avatar: next.avatar || "",
            name: next.name || ""
        };
    }

    function setApiBase(url) {
        apiBase = url || "";
        if (apiBase && apiBase.charAt(apiBase.length - 1) !== "/") {
            apiBase += "/";
        }
    }

    function readQueryParam(name) {
        var search = global.location.search;
        if (!search || search.length < 2) {
            return "";
        }
        var key = name + "=";
        var parts = search.substring(1).split("&");
        var i;
        for (i = 0; i < parts.length; i++) {
            if (parts[i].indexOf(key) === 0) {
                return decodeURIComponent(parts[i].substring(key.length).replace(/\+/g, " "));
            }
        }
        return "";
    }

    function initFromMoapUrl() {
        var cap = readQueryParam("sl_cap");
        var token = readQueryParam("sl_token");
        bridgeMode = readQueryParam("f4_bridge") === "1";
        hudMode = readQueryParam("sl_hud") === "1";
        if (!cap && !token && !bridgeMode) {
            return false;
        }
        if (cap) {
            setApiBase(cap);
        }
        setSession({
            token: token,
            avatar: readQueryParam("uuid") || readQueryParam("sl_avatar"),
            name: readQueryParam("displayname") || readQueryParam("sl_name")
        });
        return true;
    }

    function apiParams(extra) {
        var p = {};
        if (session.token) {
            p.token = session.token;
        }
        var key;
        for (key in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, key)) {
                p[key] = extra[key];
            }
        }
        return p;
    }

    function isBridgeMode() {
        return bridgeMode && !!apiBase;
    }

    function getSession() {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        return jsonp(apiBase, apiParams({ action: "session" }), 25000);
    }

    function getCharacter() {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        return jsonp(apiBase, apiParams({ action: "get_character" }), 25000);
    }

    function ping() {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        return jsonp(apiBase, apiParams({ action: "ping" }), 15000);
    }

    function endSession() {
        if (!apiBase || !session.token) {
            return Promise.resolve({ ok: true, ended: true });
        }
        return jsonp(apiBase, apiParams({ action: "end" }), 10000);
    }

    function saveStats(statsCsv, characterId, options) {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        if (!options) {
            options = {};
        }
        var extra = { action: "save_stats", stats: statsCsv };
        if (characterId !== undefined && characterId !== null && characterId !== "") {
            extra.character_id = characterId;
        }
        if (options.allowStarter === true || options.allowStarterSeed === true) {
            extra.allow_starter = "1";
        }
        return jsonp(apiBase, apiParams(extra), 25000);
    }

    function saveEcon(xpSpent, apBalance, characterId, xpLifetime) {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        var extra = { action: "save_econ" };
        if (xpSpent !== undefined && xpSpent !== null && xpSpent !== "") {
            extra.xp_spent = xpSpent;
        }
        if (apBalance !== undefined && apBalance !== null && apBalance !== "") {
            extra.ap_balance = apBalance;
        }
        if (xpLifetime !== undefined && xpLifetime !== null && xpLifetime !== "") {
            extra.xp_lifetime = xpLifetime;
        }
        if (characterId !== undefined && characterId !== null && characterId !== "") {
            extra.character_id = characterId;
        }
        return jsonp(apiBase, apiParams(extra), 25000);
    }

    function createCharacter(charData) {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        if (!charData) {
            charData = {};
        }
        var extra = {
            action: "create_character",
            name: charData.name || "Unnamed",
            title: charData.title || "",
            gender: charData.gender || "other",
            species_id: charData.species_id || "human",
            class_id: charData.class_id || "",
            universe_id: charData.universe_id || "default",
            has_mana: charData.has_mana ? "1" : "0",
            mode: charData.mode || "roleplay",
            setup_complete: charData.setup_complete ? "1" : "0",
            currency: charData.currency != null ? String(charData.currency) : "50"
        };
        if (charData.stats) {
            if (typeof charData.stats === "string") {
                extra.stats = charData.stats;
            } else if (Array.isArray(charData.stats)) {
                extra.stats = charData.stats.join(",");
            } else if (typeof charData.stats === "object") {
                var order = [
                    "agility", "animal_handling", "athletics", "awareness", "crafting",
                    "deception", "endurance", "entertaining", "fighting", "healing",
                    "influence", "intelligence", "knowledge", "marksmanship", "persuasion",
                    "stealth", "survival", "thievery", "will", "wisdom"
                ];
                var parts = [];
                var si;
                for (si = 0; si < order.length; si++) {
                    var sv = charData.stats[order[si]];
                    parts.push(sv != null ? String(sv) : "2");
                }
                extra.stats = parts.join(",");
            }
        }
        return jsonp(apiBase, apiParams(extra), 30000);
    }

    function listCharacters() {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        return jsonp(apiBase, apiParams({ action: "list_characters" }), 25000);
    }

    function updateCharacter(charData, characterId) {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        if (!charData) {
            charData = {};
        }
        var id = characterId || charData.id || "";
        var extra = {
            action: "update_character",
            character_id: id,
            name: charData.name || "Unnamed",
            title: charData.title || "",
            gender: charData.gender || "other",
            species_id: charData.species_id || "human",
            class_id: charData.class_id || "",
            universe_id: charData.universe_id || "default",
            has_mana: charData.has_mana ? "1" : "0",
            mode: charData.mode || "roleplay",
            setup_complete: charData.setup_complete ? "1" : "0",
            currency: charData.currency != null ? String(charData.currency) : "50"
        };
        return jsonp(apiBase, apiParams(extra), 25000);
    }

    function setActiveCharacter(characterId) {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        return jsonp(apiBase, apiParams({
            action: "set_active",
            character_id: characterId || ""
        }), 20000);
    }

    function getActiveCharacter() {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        return jsonp(apiBase, apiParams({ action: "get_active" }), 20000);
    }

    function deleteCharacter(characterId) {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        return jsonp(apiBase, apiParams({
            action: "delete_character",
            character_id: characterId || ""
        }), 30000);
    }

    function sendCommand(cmd) {
        if (!apiBase) {
            return Promise.resolve({ ok: false, error: "no_cap" });
        }
        return jsonp(apiBase, apiParams({ action: "command", cmd: cmd }), 20000);
    }

    global.F4Bridge = {
        BRIDGE_BUILD: BRIDGE_BUILD,
        initFromMoapUrl: initFromMoapUrl,
        isBridgeMode: isBridgeMode,
        isHudMode: function () { return hudMode; },
        getSession: getSession,
        getCharacter: getCharacter,
        ping: ping,
        endSession: endSession,
        saveStats: saveStats,
        saveEcon: saveEcon,
        createCharacter: createCharacter,
        listCharacters: listCharacters,
        updateCharacter: updateCharacter,
        setActiveCharacter: setActiveCharacter,
        getActiveCharacter: getActiveCharacter,
        deleteCharacter: deleteCharacter,
        sendCommand: sendCommand,
        getApiBase: function () { return apiBase; },
        getSessionInfo: function () { return session; },
        setApiBase: setApiBase,
        setSession: setSession
    };

    initFromMoapUrl();
})(typeof window !== "undefined" ? window : globalThis);
