createRewriteFilter("OSD hooks", "https://tetr.io/js/tetrio.js*", {
  enabledFor: async (storage, request) => {
    let res = await storage.get('enableOSD');
    return res.enableOSD;
  },
  onStop: async (storage, url, src, callback) => {
    /*
      This patch emits a custom event when a new board is initialized
    */
    patched = false;
    let reg2 = /(bindEventSource:\s*function\((\w+)\)\s*{)([^}]+})/;
    src = src.replace(reg2, (match, pre, varName, post) => {
      patched = true;
      return (
        pre + `
        document.dispatchEvent(new CustomEvent('tetrio-plus-on-game', {
          detail: ${varName}
        }));` +
        post
      );
    });
    if (!patched) console.log('OSD hooks filter broke, stage 1/2');

    callback({
      type: 'text/javascript',
      data: src,
      encoding: 'text'
    });
  }
})
