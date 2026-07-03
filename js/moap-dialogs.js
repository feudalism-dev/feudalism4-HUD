// MOAP-safe dialogs (replaces window.confirm / window.alert in Second Life MOAP)
(function (global) {
    var activeDone = null;
    var installed = false;
    var backdropEnabled = false;
    var backdropCancelAllowed = true;
    var backdropTimer = null;
    var activeEls = null;

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function isSlMoap() {
        return !!(global.IS_SL_BROWSER);
    }

    function isActive() {
        return activeDone !== null;
    }

    function setBodyDialogOpen(open) {
        if (!document.body) {
            return;
        }
        if (open) {
            document.body.classList.add('moap-dialog-open');
        } else {
            document.body.classList.remove('moap-dialog-open');
        }
    }

    function ensureOverlay() {
        var modal;
        var body;
        if (isSlMoap()) {
            // CEF-139 MOAP: fixed overlays outside #app often miss clicks — use Setup #modal.
            modal = document.getElementById('modal');
            body = document.getElementById('modal-body');
            if (modal && body) {
                return { overlay: modal, body: body, useHudModal: true };
            }
        }

        var overlay = document.getElementById('moap-dialog-overlay');
        body = document.getElementById('moap-dialog-body');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'moap-dialog-overlay';
            overlay.className = 'moap-dialog-overlay hidden';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML =
                '<div class="moap-dialog-panel">' +
                '<button type="button" class="moap-dialog-close" aria-label="Close">&times;</button>' +
                '<div id="moap-dialog-body"></div>' +
                '</div>';
            var appRoot = document.getElementById('app');
            if (appRoot) {
                appRoot.appendChild(overlay);
            } else {
                document.body.appendChild(overlay);
            }
            body = document.getElementById('moap-dialog-body');
        }
        if (!overlay._moapBound) {
            overlay._moapBound = true;
            overlay.querySelector('.moap-dialog-close').addEventListener('click', function () {
                cancelActiveDialog('close');
            });
            overlay.addEventListener('click', function (e) {
                if (!backdropEnabled) {
                    return;
                }
                if (e.target === overlay) {
                    cancelActiveDialog('backdrop');
                }
            });
            var panel = overlay.querySelector('.moap-dialog-panel');
            if (panel) {
                panel.addEventListener('click', function (e) {
                    e.stopPropagation();
                });
            }
        }
        return {
            overlay: overlay,
            body: body || document.getElementById('moap-dialog-body'),
            useHudModal: false
        };
    }

    function installGlobalHandlers() {
        if (installed) {
            return;
        }
        installed = true;
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && activeDone) {
                cancelActiveDialog('escape');
            }
        });
    }

    function hideOverlay(els) {
        if (!els || !els.overlay) {
            return;
        }
        if (els.useHudModal) {
            els.overlay.classList.add('hidden');
            var closeBtn = els.overlay.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.style.display = '';
            }
        } else {
            els.overlay.classList.add('hidden');
            els.overlay.setAttribute('aria-hidden', 'true');
        }
        setBodyDialogOpen(false);
        backdropEnabled = false;
        backdropCancelAllowed = true;
        activeEls = null;
        if (backdropTimer) {
            clearTimeout(backdropTimer);
            backdropTimer = null;
        }
    }

    function showOverlay(els, html, allowBackdropCancel) {
        if (!els || !els.body) {
            return;
        }
        activeEls = els;
        backdropCancelAllowed = !!allowBackdropCancel;
        els.body.innerHTML = html;
        if (els.useHudModal) {
            var closeBtn = els.overlay.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.style.display = '';
            }
            els.overlay.classList.remove('hidden');
        } else {
            els.overlay.classList.remove('hidden');
            els.overlay.setAttribute('aria-hidden', 'false');
        }
        setBodyDialogOpen(true);
        backdropEnabled = false;
        if (backdropTimer) {
            clearTimeout(backdropTimer);
        }
        if (allowBackdropCancel) {
            backdropTimer = setTimeout(function () {
                backdropEnabled = true;
                backdropTimer = null;
            }, 350);
        }
    }

    function cancelActiveDialog(source) {
        if (!activeDone) {
            return false;
        }
        if (source === 'backdrop' && !backdropCancelAllowed) {
            return true;
        }
        if (source === 'backdrop' && !backdropEnabled && !backdropCancelAllowed) {
            return true;
        }
        if (source === 'backdrop' && !backdropEnabled) {
            return true;
        }
        var done = activeDone;
        activeDone = null;
        if (activeEls) {
            hideOverlay(activeEls);
        }
        done(false);
        return true;
    }

    function bindActionButton(id, handler) {
        var btn = document.getElementById(id);
        if (!btn) {
            return;
        }
        btn.onclick = function (e) {
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            handler();
            return false;
        };
    }

    function showConfirm(options) {
        installGlobalHandlers();
        var opts = options || {};
        var title = opts.title || 'Confirm';
        var message = opts.message || '';
        var confirmLabel = opts.confirmLabel || 'Confirm';
        var cancelLabel = opts.cancelLabel || 'Cancel';
        var danger = !!opts.danger;
        var allowBackdropCancel = opts.allowBackdropCancel;
        if (allowBackdropCancel === undefined) {
            allowBackdropCancel = !danger;
        }
        var confirmClass = danger ? 'moap-dialog-btn moap-dialog-btn-danger' : 'moap-dialog-btn moap-dialog-btn-primary';
        var els = ensureOverlay();

        return new Promise(function (resolve) {
            var settled = false;
            function done(value) {
                if (settled) {
                    return;
                }
                settled = true;
                activeDone = null;
                hideOverlay(els);
                resolve(!!value);
            }

            activeDone = done;

            var safeMessage = escapeHtml(String(message)).replace(/\n/g, '<br>');
            var content =
                '<div class="moap-dialog">' +
                '<h2 class="moap-dialog-title">' + escapeHtml(String(title)) + '</h2>' +
                '<p class="moap-dialog-message">' + safeMessage + '</p>' +
                '<div class="moap-dialog-actions">' +
                '<button type="button" class="moap-dialog-btn" id="moap-dialog-cancel">' + escapeHtml(String(cancelLabel)) + '</button>' +
                '<button type="button" class="' + confirmClass + '" id="moap-dialog-confirm">' + escapeHtml(String(confirmLabel)) + '</button>' +
                '</div></div>';

            showOverlay(els, content, allowBackdropCancel);

            bindActionButton('moap-dialog-confirm', function () {
                done(true);
            });
            bindActionButton('moap-dialog-cancel', function () {
                done(false);
            });
        });
    }

    function showAlert(options) {
        installGlobalHandlers();
        var opts = options || {};
        var title = opts.title || 'Notice';
        var message = opts.message || '';
        var okLabel = opts.okLabel || 'OK';
        var els = ensureOverlay();

        return new Promise(function (resolve) {
            var settled = false;
            function done() {
                if (settled) {
                    return;
                }
                settled = true;
                activeDone = null;
                hideOverlay(els);
                resolve();
            }

            activeDone = function () {
                done();
            };

            var safeMessage = escapeHtml(String(message)).replace(/\n/g, '<br>');
            var content =
                '<div class="moap-dialog">' +
                '<h2 class="moap-dialog-title">' + escapeHtml(String(title)) + '</h2>' +
                '<p class="moap-dialog-message">' + safeMessage + '</p>' +
                '<div class="moap-dialog-actions">' +
                '<button type="button" class="moap-dialog-btn moap-dialog-btn-primary" id="moap-dialog-ok">' + escapeHtml(String(okLabel)) + '</button>' +
                '</div></div>';

            showOverlay(els, content, true);

            bindActionButton('moap-dialog-ok', done);
        });
    }

    function showChoice(options) {
        installGlobalHandlers();
        var opts = options || {};
        var title = opts.title || 'Choose';
        var message = opts.message || '';
        var buttons = opts.buttons || [];
        var allowBackdropCancel = opts.allowBackdropCancel === true;
        var els = ensureOverlay();

        return new Promise(function (resolve) {
            var settled = false;
            function done(value) {
                if (settled) {
                    return;
                }
                settled = true;
                activeDone = null;
                hideOverlay(els);
                resolve(value);
            }

            activeDone = function () {
                done(null);
            };

            var safeMessage = escapeHtml(String(message)).replace(/\n/g, '<br>');
            var actionsHtml = '';
            var i;
            for (i = 0; i < buttons.length; i++) {
                var b = buttons[i];
                var btnClass = 'moap-dialog-btn';
                if (b.primary) {
                    btnClass += ' moap-dialog-btn-primary';
                }
                if (b.danger) {
                    btnClass += ' moap-dialog-btn-danger';
                }
                actionsHtml += '<button type="button" class="' + btnClass + '" id="' + escapeHtml(String(b.id)) + '">'
                    + escapeHtml(String(b.label)) + '</button>';
            }

            var content =
                '<div class="moap-dialog">' +
                '<h2 class="moap-dialog-title">' + escapeHtml(String(title)) + '</h2>' +
                '<p class="moap-dialog-message">' + safeMessage + '</p>' +
                '<div class="moap-dialog-actions">' + actionsHtml + '</div></div>';

            showOverlay(els, content, allowBackdropCancel);

            for (i = 0; i < buttons.length; i++) {
                (function (btn) {
                    bindActionButton(btn.id, function () {
                        done(btn.value);
                    });
                })(buttons[i]);
            }
        });
    }

    global.MoapDialogs = {
        showConfirm: showConfirm,
        showAlert: showAlert,
        showChoice: showChoice,
        cancelActiveDialog: cancelActiveDialog,
        isActive: isActive
    };
})(typeof window !== 'undefined' ? window : this);
