// MOAP-safe dialogs (replaces window.confirm / window.alert in Second Life MOAP)
(function (global) {
    var activeDone = null;
    var installed = false;

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function ensureOverlay() {
        var modal = document.getElementById('modal');
        var body = document.getElementById('modal-body');
        if (modal && body) {
            return { overlay: modal, body: body, useHudModal: true };
        }

        var overlay = document.getElementById('moap-dialog-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'moap-dialog-overlay';
            overlay.className = 'moap-dialog-overlay hidden';
            overlay.innerHTML =
                '<div class="moap-dialog-panel">' +
                '<button type="button" class="moap-dialog-close" aria-label="Close">&times;</button>' +
                '<div id="moap-dialog-body"></div>' +
                '</div>';
            document.body.appendChild(overlay);
            overlay.querySelector('.moap-dialog-close').addEventListener('click', function () {
                cancelActiveDialog();
            });
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) {
                    cancelActiveDialog();
                }
            });
        }
        return {
            overlay: overlay,
            body: document.getElementById('moap-dialog-body'),
            useHudModal: false
        };
    }

    function installGlobalHandlers() {
        if (installed) return;
        installed = true;
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && activeDone) {
                cancelActiveDialog();
            }
        });
        var hudModal = document.getElementById('modal');
        if (hudModal) {
            hudModal.addEventListener('click', function (e) {
                if (e.target === hudModal && activeDone) {
                    cancelActiveDialog();
                }
            });
        }
    }

    function hideOverlay(els) {
        if (!els || !els.overlay) return;
        els.overlay.classList.add('hidden');
    }

    function showOverlay(els, html) {
        if (!els || !els.body) return;
        els.body.innerHTML = html;
        els.overlay.classList.remove('hidden');
    }

    function cancelActiveDialog() {
        if (!activeDone) return false;
        var done = activeDone;
        activeDone = null;
        done(false);
        return true;
    }

    function showConfirm(options) {
        installGlobalHandlers();
        var opts = options || {};
        var title = opts.title || 'Confirm';
        var message = opts.message || '';
        var confirmLabel = opts.confirmLabel || 'Confirm';
        var cancelLabel = opts.cancelLabel || 'Cancel';
        var danger = !!opts.danger;
        var confirmClass = danger ? 'moap-dialog-btn moap-dialog-btn-danger' : 'moap-dialog-btn moap-dialog-btn-primary';
        var els = ensureOverlay();

        return new Promise(function (resolve) {
            var settled = false;
            function done(value) {
                if (settled) return;
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

            showOverlay(els, content);

            document.getElementById('moap-dialog-confirm').addEventListener('click', function () {
                done(true);
            }, { once: true });
            document.getElementById('moap-dialog-cancel').addEventListener('click', function () {
                done(false);
            }, { once: true });
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
                if (settled) return;
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

            showOverlay(els, content);

            document.getElementById('moap-dialog-ok').addEventListener('click', done, { once: true });
        });
    }

    global.MoapDialogs = {
        showConfirm: showConfirm,
        showAlert: showAlert,
        cancelActiveDialog: cancelActiveDialog
    };
})(typeof window !== 'undefined' ? window : this);
