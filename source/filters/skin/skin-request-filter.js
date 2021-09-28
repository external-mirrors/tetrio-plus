createRewriteFilter('Custom skin', 'https://tetr.io/res/skins/minos/connected.2x.png', {
  enabledFor: async (storage, url) => {
    let { skin } = await storage.get('skin');
    return !!skin;
  },
  onStop: async (storage, url, src, callback) => {
    let { skin } = await storage.get('skin');
    callback({ type: 'image/png', data: skin, encoding: 'base64-data-url' });
  }
});
createRewriteFilter('Custom skin (ghost)', 'https://tetr.io/res/skins/ghost/connected.2x.png', {
  enabledFor: async (storage, url) => {
    let { ghost } = await storage.get('ghost');
    return !!ghost;
  },
  onStop: async (storage, url, src, callback) => {
    let { ghost } = await storage.get('ghost');
    callback({ type: 'image/png', data: ghost, encoding: 'base64-data-url' });
  }
});
