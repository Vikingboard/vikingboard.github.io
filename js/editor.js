// Save editor helpers: file download and a leave-page warning while edits aren't downloaded.
window.vatEditor = {
    download(fileName, bytes) {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    },
    setUnsavedGuard(enabled) {
        window.onbeforeunload = enabled ? (e => { e.preventDefault(); e.returnValue = ''; }) : null;
    },
};
