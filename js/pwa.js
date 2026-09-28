// Install prompt, service worker registration and update checks. Loaded before Blazor so no browser event is missed.
window.vatPwa = (() => {
    const updateCheckInterval = 30 * 60 * 1000;
    let installPrompt = null;
    let waitingWorker = null;
    let app = null;
    const notify = (method, ...args) => app?.invokeMethodAsync(method, ...args);

    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        installPrompt = e;
        notify('OnInstallAvailable', true);
    });
    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        notify('OnInstallAvailable', false);
    });

    function onWaiting(worker) {
        // Only an update if a worker already controls the page; the very first install needs no refresh.
        if (!navigator.serviceWorker.controller) return;
        waitingWorker = worker;
        notify('OnUpdateReady');
    }

    async function register() {
        if (!('serviceWorker' in navigator)) return;
        // Registering also checks for a new version on every load; updateViaCache 'none' bypasses the HTTP cache.
        const registration = await navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' });
        if (registration.waiting) onWaiting(registration.waiting);
        registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            worker?.addEventListener('statechange', () => { if (worker.state === 'installed') onWaiting(worker); });
        });

        const check = () => registration.update().catch(() => { });
        setInterval(check, updateCheckInterval);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });

        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloading) return;
            reloading = true;
            location.reload();
        });
    }

    register();

    return {
        init(dotNetRef) {
            app = dotNetRef;
            return { canInstall: installPrompt !== null, updateReady: waitingWorker !== null };
        },
        async install() {
            if (!installPrompt) return;
            installPrompt.prompt();
            await installPrompt.userChoice;
            installPrompt = null;
            notify('OnInstallAvailable', false);
        },
        applyUpdate() {
            waitingWorker?.postMessage('skipWaiting');
        },
    };
})();
