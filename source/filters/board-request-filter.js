// WIP
// Still needs:
// - proper importer
// - tpse support
for (let key of ['board', 'queue', 'grid']) {
  createRewriteFilter(`Board asset: ${key}`, `https://tetr.io/res/skins/board/generic/${key}.png`, {
    enabledFor: async (storage, url) => {
      let res = await storage.get(key);
      return res[key];
    },
    onStop: async (storage, url, src, callback) => {
      callback({
        type: 'image/png',
        data: (await storage.get(key))[key],
        encoding: 'base64-data-url'
      });
    }
  })
}
