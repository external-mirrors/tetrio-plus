const modules = [];
function musicGraph(module) {
  modules.push(module);
}

(async () => {
  if (window.location.pathname != '/') return;
  let storage = await getDataSourceForDomain(window.location);
  let { tetrioPlusEnabled } = await storage.get('tetrioPlusEnabled');
  if (!tetrioPlusEnabled) return;
  let {
    music,
    musicGraph,
    musicEnabled,
    musicGraphEnabled,
    musicGraphBackground
  } = await storage.get([
    'music',
    'musicGraph',
    'musicEnabled',
    'musicGraphEnabled',
    'musicGraphBackground'
  ]);
  if (!musicEnabled || !musicGraphEnabled || !musicGraph)
    return;

  const musicRoot = '/res/bgm/akai-tsuchi-wo-funde.mp3?song=';
  const audioContext = new AudioContext();
  const audioBuffers = {};

  const graph = {};
  for (let src of JSON.parse(musicGraph)) {
    graph[src.id] = src;
    if (!src.audio) continue;
    if (audioBuffers[src.audio]) continue;

    let key = 'song-' + src.audio;
    let base64 = (await storage.get(key))[key];
    let rawBuffer = await fetch(base64).then(res => res.arrayBuffer());
    let decoded = await audioContext.decodeAudioData(rawBuffer);
    audioBuffers[src.audio] = decoded;
  }

  // A list of events that use == != > < valueOperators
  const eventValueExtendedModes = [
    'text-spike',
    'text-combo',
    'board-height-player',
    'board-height-enemy'
  ];
  // A list of events that use the value field
  const eventValueEnabled = [
    'time-passed',
    'text-b2b-combo',
    ...eventValueExtendedModes
  ];

  let globalVolume = 0;
  let lastUpdate = 0;
  function getGlobalVolume() {
    if (Date.now() - lastUpdate > 1000) {
      globalVolume = JSON.parse(localStorage.userConfig).volume.music;
      lastUpdate = Date.now();
    }
    return globalVolume;
  }

  const musicGraphData = {
    nodes: [],
    audioContext,
    graph,
    audioBuffers,
    eventValueExtendedModes,
    eventValueEnabled,
    getGlobalVolume,
    backgroundsEnabled: musicGraphBackground
  };

  // cache images so they can appear instantly
  let cache = [];
  for (let el of Object.values(graph)) {
    if (!el.background) continue;
    let img = new Image();
    img.src = '/res/bg/1.jpg?bgId=' + el.background;
    cache.push(img);
  }

  for (let module of modules)
    module(musicGraphData);

  for (let graphObject of Object.values(graph)) {
    if (graphObject.type != 'root') continue;
    let node = new musicGraphData.Node();
    node.setSource(graphObject);
    musicGraphData.nodes.push(node)
  }

  console.log("[TETR.IO PLUS] Music graph ready")
})().catch(ex => {
  console.error("[TETR.IO PLUS] music graph error:", ex);
});
