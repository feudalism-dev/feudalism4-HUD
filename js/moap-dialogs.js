// MOAP-safe dialogs (replaces window.confirm / window.alert in Second Life MOAP)
(function (global) {
    var activeDone = null;
    var installed = false;
    var backdropEnabled = false;
    var backdropTimer = null;

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        var overlay = document.getElementById('moap-dialog-overlay');
        var body = document.getElementById('moap-dialog-body');
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
            document.body.appendChild(overlay);
            body = document.getElementById('moap-dialog-body');
        }
        if (overlay.parentNode !== document.body) {
            document.body.appendChild(overlay);
        }
        if (!overlay._moapBound) {
            overlay._moapBound = true;
            overlay.querySelector('.moap-dialog-close').addEventListener('click', function () {
                cancelActiveDialog();
            });
            overlay.addEventListener('click', function (e) {
                if (!backdropEnabled) {
                    return;
                }
                if (e.target === overlay) {
                    cancelActiveDialog();
                }
            });
            var panel = overlay.querySelector('.moap-dialog-panel');
            if (panel) {
                panel.addEventListener('mousedown', function (e) {
                    e.stopPropagation();
                });
                panel.addEventListener('mouseup', function (e) {
                    e.stopPropagation();
                });
                panel.addEventListener('click', function (e) {
                    e.stopPropagation();
                });
            }
        }
        return {
            overlay: overlay,
            body: body || document.getElementById('moap-dialog-body')
        };
    }

    function installGlobalHandlers() {
        if (installed) {
            return;
        }
        installed = true;
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && activeDone) {
                cancelActiveDialog();
            }
        });
    }

    function hideOverlay(els) {
        if (!els || !els.overlay) {
            return;
        }
        els.overlay.classList.add('hidden');
        els.overlay.setAttribute('aria-hidden', 'true');
        setBodyDialogOpen(false);
        backdropEnabled = false;
        if (backdropTimer) {
            clearTimeout(backdropTimer);
            backdropTimer = null;
        }
    }

    function showOverlay(els, html, allowBackdropCancel) {
        if (!els || !els.body) {
            return;
        }
        els.body.innerHTML = html;
        if (els.overlay.parentNode !== document.body) {
            document.body.appendChild(els.overlay);
        }
        els.overlay.classList.remove('hidden');
        els.overlay.setAttribute('aria-hidden', 'false');
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

    function cancelActiveDialog() {
        if (!activeDone) {
            return false;
        }
        var done = activeDone;
        activeDone = null;
        done(false);
        return true;
    }

    function bindActionButton(id, handler) {
        var btn = document.getElementById(id);
        if (!btn) {
            return;
        }
        btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
        }, { once: true });
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            handler();
        }, { once: true });
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

            setTimeout(function () {
                var focusBtn = document.getElementById('moap-dialog-cancel');
                if (focusBtn && focusBtn.focus) {
                    try {
                        focusBtn.focus();
                    } catch (e) { /* MOAP may block focus */ }
                }
            }, 0);
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

    global.MoapDialogs = {
        showConfirm: showConfirm,
        showAlert: showAlert,
        cancelActiveDialog: cancelActiveDialog,
        isActive: isActive
    };
})(typeof window !== 'undefined' ? window : this);
