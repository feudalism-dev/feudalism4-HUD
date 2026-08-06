/**

 * Feudalism 4 — JSONP client for LSL HTTP-IN (MOAP / CEF 139)

 * Used by hud-bridge-poc.html and production hud.html (Phase 2+).

 * Pattern: slarcadepub/shared/sl-api.js

 *

 * Endpoint order: worn HUD sl_cap first, then Firestore feud4_relays fallback.

 */

(function (global) {

    "use strict";



    var BRIDGE_BUILD = "f4-bridge-v8.3-relay";



    var FIRESTORE_PROJECT = "feudalism4-rpg";

    var RELAY_COLLECTION = "feud4_relays";

    var RELAY_LIST_TTL_MS = 90000;

    var RELAY_STALE_SEC = 600;

    var RELAY_PING_TIMEOUT_MS = 8000;

    var MAX_RELAY_TRIES = 3;



    var session = {

        token: "",

        avatar: "",

        name: ""

    };

    var hudCap = "";

    var apiBase = "";

    var bridgeMode = false;

    var hudMode = false;

    var forceRelay = false;

    var lastGoodRelay = "";

    var relayCache = {

        urls: [],

        fetchedAt: 0

    };



    function validCallbackName(name) {

        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);

    }



    function nextCallback() {

        return "f4cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    }



    function normalizeCapUrl(url) {

        url = url || "";

        if (url && url.charAt(url.length - 1) !== "/") {

            url += "/";

        }

        return url;

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

        apiBase = normalizeCapUrl(url);

        if (apiBase) {

            hudCap = apiBase;

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

        forceRelay = readQueryParam("f4_force_relay") === "1";

        if (!cap && !token && !bridgeMode && !readQueryParam("uuid") && !readQueryParam("sl_avatar")) {

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

        if (session.avatar || hudCap) {

            bridgeMode = true;

        }

        return true;

    }



    function apiParams(extra) {

        var p = {};

        if (session.token) {

            p.token = session.token;

        }

        // Always send avatar uuid when known — required for Setup Relay fallback.

        if (session.avatar) {

            p.uuid = session.avatar;

        }

        var key;

        for (key in extra) {

            if (Object.prototype.hasOwnProperty.call(extra, key)) {

                p[key] = extra[key];

            }

        }

        return p;

    }



    function canUseRelays() {

        return !!session.avatar;

    }



    function isBridgeMode() {

        return bridgeMode && !!(hudCap || canUseRelays());

    }



    function getSessionInfo() {

        return session;

    }



    function fieldString(fields, name) {

        if (!fields || !fields[name]) {

            return "";

        }

        if (fields[name].stringValue != null) {

            return String(fields[name].stringValue);

        }

        return "";

    }



    function fieldInt(fields, name) {

        if (!fields || !fields[name]) {

            return 0;

        }

        if (fields[name].integerValue != null) {

            return parseInt(fields[name].integerValue, 10) || 0;

        }

        if (fields[name].doubleValue != null) {

            return Math.floor(fields[name].doubleValue) || 0;

        }

        return 0;

    }



    function httpGetJson(url) {

        return new Promise(function (resolve, reject) {

            if (typeof fetch === "function") {

                fetch(url).then(function (res) {

                    if (!res.ok) {

                        throw new Error("http_" + res.status);

                    }

                    return res.json();

                }).then(resolve).catch(reject);

                return;

            }

            var xhr = new XMLHttpRequest();

            xhr.open("GET", url, true);

            xhr.onreadystatechange = function () {

                if (xhr.readyState !== 4) {

                    return;

                }

                if (xhr.status >= 200 && xhr.status < 300) {

                    try {

                        resolve(JSON.parse(xhr.responseText || "{}"));

                    } catch (e) {

                        reject(e);

                    }

                } else {

                    reject(new Error("http_" + xhr.status));

                }

            };

            xhr.onerror = function () {

                reject(new Error("xhr_failed"));

            };

            xhr.send();

        });

    }



    function parseRelayDocs(payload) {

        var docs = (payload && payload.documents) ? payload.documents : [];

        var now = Math.floor(Date.now() / 1000);

        var out = [];

        var i;

        for (i = 0; i < docs.length; i++) {

            var fields = docs[i].fields || {};

            var status = fieldString(fields, "status").toLowerCase();

            var url = normalizeCapUrl(fieldString(fields, "url"));

            var updatedAt = fieldInt(fields, "updatedAt");

            if (!url || status !== "up") {

                continue;

            }

            if (updatedAt > 0 && (now - updatedAt) > RELAY_STALE_SEC) {

                continue;

            }

            out.push({

                url: url,

                updatedAt: updatedAt

            });

        }

        out.sort(function (a, b) {

            return (b.updatedAt || 0) - (a.updatedAt || 0);

        });

        return out.map(function (r) {

            return r.url;

        });

    }



    function fetchRelayUrls(forceRefresh) {

        var now = Date.now();

        if (!forceRefresh && relayCache.urls.length && (now - relayCache.fetchedAt) < RELAY_LIST_TTL_MS) {

            return Promise.resolve(relayCache.urls.slice());

        }

        if (global.firebase && typeof global.firebase.firestore === "function") {

            try {

                var db = global.firebase.firestore();

                return db.collection(RELAY_COLLECTION).where("status", "==", "up").get().then(function (snap) {

                    var nowSec = Math.floor(Date.now() / 1000);

                    var rows = [];

                    snap.forEach(function (doc) {

                        var d = doc.data() || {};

                        var url = normalizeCapUrl(d.url || "");

                        var updatedAt = parseInt(d.updatedAt, 10) || 0;

                        if (!url) {

                            return;

                        }

                        if (updatedAt > 0 && (nowSec - updatedAt) > RELAY_STALE_SEC) {

                            return;

                        }

                        rows.push({ url: url, updatedAt: updatedAt });

                    });

                    rows.sort(function (a, b) {

                        return (b.updatedAt || 0) - (a.updatedAt || 0);

                    });

                    relayCache.urls = rows.map(function (r) {

                        return r.url;

                    });

                    relayCache.fetchedAt = Date.now();

                    return relayCache.urls.slice();

                }).catch(function () {

                    return fetchRelayUrlsRest();

                });

            } catch (e) {

                return fetchRelayUrlsRest();

            }

        }

        return fetchRelayUrlsRest();

    }



    function fetchRelayUrlsRest() {

        var url = "https://firestore.googleapis.com/v1/projects/" + FIRESTORE_PROJECT

            + "/databases/(default)/documents/" + RELAY_COLLECTION + "?pageSize=30";

        return httpGetJson(url).then(function (payload) {

            relayCache.urls = parseRelayDocs(payload);

            relayCache.fetchedAt = Date.now();

            return relayCache.urls.slice();

        }).catch(function () {

            relayCache.urls = [];

            relayCache.fetchedAt = Date.now();

            return [];

        });

    }



    function uniqueUrls(list) {

        var seen = {};

        var out = [];

        var i;

        for (i = 0; i < list.length; i++) {

            var u = list[i];

            if (!u || seen[u]) {

                continue;

            }

            seen[u] = true;

            out.push(u);

        }

        return out;

    }



    function buildCandidateBases(preferRelaysOnly, relayUrls) {

        var list = [];

        if (!preferRelaysOnly && !forceRelay && hudCap) {

            list.push(hudCap);

        }

        if (lastGoodRelay) {

            list.push(lastGoodRelay);

        }

        var i;

        for (i = 0; i < relayUrls.length; i++) {

            list.push(relayUrls[i]);

        }

        return uniqueUrls(list);

    }



    function actionAllowsRelay(action) {

        if (action === "command") {

            return false;

        }

        return true;

    }



    function markEndpoint(url, isHud) {

        apiBase = url;

        if (!isHud) {

            lastGoodRelay = url;

        }

    }



    function callJsonp(params, timeoutMs) {

        if (!params) {

            params = {};

        }

        var action = params.action || "";

        var useRelays = canUseRelays() && actionAllowsRelay(action);

        var preferRelaysOnly = forceRelay || !hudCap;



        if (!hudCap && !useRelays) {

            return Promise.resolve({ ok: false, error: "no_cap" });

        }



        function tryBases(bases, index) {

            if (index >= bases.length) {

                return Promise.reject(new Error("all_endpoints_failed"));

            }

            var base = bases[index];

            var isHud = !!(hudCap && base === hudCap);

            return jsonp(base, apiParams(params), timeoutMs).then(function (data) {

                // Old HUD/relay builds return ok:false unknown_action for new verbs —
                // treat as transport miss and try the next candidate (usually relay).
                if (data && data.ok === false && data.error === "unknown_action"
                    && useRelays && index + 1 < bases.length) {

                    return tryBases(bases, index + 1);

                }

                markEndpoint(base, isHud);

                return data;

            }).catch(function (err) {

                if (isHud) {

                    // Prefer fresh relay list after HUD transport fail.

                    return fetchRelayUrls(true).then(function (urls) {

                        var next = buildCandidateBases(true, urls).slice(0, MAX_RELAY_TRIES + 1);

                        if (!next.length) {

                            return Promise.reject(err);

                        }

                        return tryBases(next, 0);

                    });

                }

                if (lastGoodRelay === base) {

                    lastGoodRelay = "";

                }

                return tryBases(bases, index + 1);

            });

        }



        if (!useRelays) {

            return jsonp(hudCap, apiParams(params), timeoutMs).then(function (data) {

                markEndpoint(hudCap, true);

                return data;

            });

        }



        return fetchRelayUrls(preferRelaysOnly).then(function (urls) {

            var bases = buildCandidateBases(preferRelaysOnly, urls);

            if (!preferRelaysOnly && hudCap) {

                // Cap relay attempts after HUD (including lastGood which may duplicate).

                var hudFirst = [hudCap];

                var rest = [];

                var i;

                for (i = 0; i < bases.length; i++) {

                    if (bases[i] !== hudCap) {

                        rest.push(bases[i]);

                    }

                }

                bases = hudFirst.concat(rest.slice(0, MAX_RELAY_TRIES));

            } else {

                bases = bases.slice(0, MAX_RELAY_TRIES);

            }

            if (!bases.length) {

                return Promise.resolve({ ok: false, error: "no_cap" });

            }

            return tryBases(bases, 0).catch(function () {

                return { ok: false, error: "bridge_unavailable" };

            });

        });

    }



    function getSession() {

        return callJsonp({ action: "session" }, 25000);

    }



    function getCharacter() {

        return callJsonp({ action: "get_character" }, 25000);

    }



    function ping() {

        return callJsonp({ action: "ping" }, RELAY_PING_TIMEOUT_MS);

    }



    function endSession() {

        if (!session.token && !hudCap) {

            return Promise.resolve({ ok: true, ended: true });

        }

        return callJsonp({ action: "end" }, 10000);

    }



    function saveStats(statsCsv, characterId, options) {

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

        return callJsonp(extra, 25000);

    }



    function saveEcon(xpSpent, apBalance, characterId, xpLifetime, options) {

        if (!options) {

            options = {};

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

        if (options.allowSeed === true || options.allowStarterSeed === true) {

            extra.allow_seed = "1";

        }

        return callJsonp(extra, 25000);

    }



    function createCharacter(charData) {

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

                    parts.push(sv != null ? String(sv) : "1");

                }

                extra.stats = parts.join(",");

            }

        }

        if (charData.state && typeof charData.state === "string" && charData.state !== "") {

            extra.state = charData.state;

        } else if (charData.xp_lifetime != null || charData.xp_spent != null || charData.ap_balance != null) {

            var life = parseInt(charData.xp_lifetime, 10);

            if (isNaN(life) || life < 0) {

                life = 20000;

            }

            var spent = parseInt(charData.xp_spent, 10);

            if (isNaN(spent) || spent < 0) {

                spent = 0;

            }

            var ap = parseInt(charData.ap_balance, 10);

            if (isNaN(ap) || ap < 0) {

                ap = 0;

            }

            var healthPipe = "100/100/100";

            var staminaPipe = "100/100/100";

            var manaPipe = "0/0/0";

            function poolPipe(pool, fallback) {

                if (!pool || pool.base == null) {

                    return fallback;

                }

                var cur = pool.current != null ? pool.current : pool.base;

                var mx = pool.max != null ? pool.max : pool.base;

                return String(cur) + "/" + String(pool.base) + "/" + String(mx);

            }

            if (charData.health && charData.health.base != null) {

                healthPipe = poolPipe(charData.health, healthPipe);

            }

            if (charData.stamina && charData.stamina.base != null) {

                staminaPipe = poolPipe(charData.stamina, staminaPipe);

            }

            if (charData.mana && charData.mana.base != null) {

                manaPipe = poolPipe(charData.mana, manaPipe);

            }

            // Use / not | so LSL createChar || delimiters cannot be confused with pool separators.

            extra.state = life + "," + spent + "," + ap + "," + healthPipe + "," + staminaPipe + "," + manaPipe;

        }

        return callJsonp(extra, 30000);

    }



    function listCharacters() {

        return callJsonp({ action: "list_characters" }, 25000);

    }



    function coerceManaFlag(value) {

        return value === true || value === 1 || value === "1" || value === "true";

    }



    function updateCharacter(charData, characterId) {

        if (!charData) {

            charData = {};

        }

        var id = characterId || charData.id || "";

        // updateIdent replaces the whole f4char_ blob — callers must merge first.

        // Keep last-resort defaults only when a field is still empty after merge.

        var setupRaw = charData.setup_complete;

        var setupDone = setupRaw === true || setupRaw === 1 || setupRaw === "1" || setupRaw === "true";

        var extra = {

            action: "update_character",

            character_id: id,

            name: charData.name || "Unnamed",

            title: charData.title != null ? String(charData.title) : "",

            gender: charData.gender || "other",

            species_id: charData.species_id || "human",

            class_id: charData.class_id != null ? String(charData.class_id) : "",

            universe_id: charData.universe_id || "default",

            has_mana: coerceManaFlag(charData.has_mana) ? "1" : "0",

            mode: charData.mode || "roleplay",

            setup_complete: setupDone ? "1" : "0",

            currency: charData.currency != null ? String(charData.currency) : "50"

        };

        return callJsonp(extra, 25000);

    }



    function setActiveCharacter(characterId) {

        return callJsonp({

            action: "set_active",

            character_id: characterId || ""

        }, 20000);

    }



    function getActiveCharacter() {

        return callJsonp({ action: "get_active" }, 20000);

    }



    function deleteCharacter(characterId) {

        return callJsonp({

            action: "delete_character",

            character_id: characterId || ""

        }, 30000);

    }



    function getInventoryPage(options) {

        var opts = options || {};

        var extra = {

            action: "inventory_page",

            character_id: opts.characterId || opts.character_id || "",

            cursor: opts.cursor != null ? String(opts.cursor) : "",

            pageSize: opts.pageSize != null ? String(opts.pageSize) : "30",

            filter: opts.filter || "all",

            reqSeq: opts.reqSeq != null ? String(opts.reqSeq) : String(Date.now())

        };

        return callJsonp(extra, 30000);

    }



    function sendCommand(cmd) {

        // HUD-only (relay rejects command).

        if (!hudCap) {

            return Promise.resolve({ ok: false, error: "no_cap" });

        }

        return jsonp(hudCap, apiParams({ action: "command", cmd: cmd }), 20000);

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

        getInventoryPage: getInventoryPage,

        sendCommand: sendCommand,

        getApiBase: function () { return apiBase || hudCap; },

        getHudCap: function () { return hudCap; },

        getSessionInfo: getSessionInfo,

        setApiBase: setApiBase,

        setSession: setSession,

        refreshRelays: function () { return fetchRelayUrls(true); },

        getLastEndpoint: function () { return apiBase; }

    };



    initFromMoapUrl();

})(typeof window !== "undefined" ? window : globalThis);


