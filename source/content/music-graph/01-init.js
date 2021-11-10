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
    backgrounds,
    musicGraph,
    musicEnabled,
    musicGraphEnabled,
    musicGraphBackground
  } = await storage.get([
    'music',
    'backgrounds',
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
  const eventValueExtendedModes =  {
    'fx-countdown': true,
    'fx-offense-player': true,
    'fx-offense-enemy': true,
    'fx-defense-player': true,
    'fx-defense-enemy': true,
    'fx-combo-player': true,
    'fx-combo-enemy': true,
    'fx-line-clear-player': true,
    'fx-line-clear-enemy': true,
    'board-height-player': true,
    'board-height-enemy': true
  };
  // A list of events that use the value field
  const eventValueEnabled = {
    'time-passed': true,
    'text-b2b-combo': true,
    ...eventValueExtendedModes
  };

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
    imageCache: {},
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

    let bg = backgrounds.filter(e => e.id == el.background)[0];
    let ext = bg?.filename?.split('.')?.slice(-1)?.[0] || 'png';

    if (bg.type == 'video') {
      let video = document.createElement('video');
      let url = window.location.origin + '/res/bg/1.jpg?bgId=' + el.background;
      let mime = ext == 'mp4' ? 'video/mp4' : 'video/webm';
      let wrongBlob = await (await fetch(url)).blob();
      let rightBlob = wrongBlob.slice(0, wrongBlob.size, mime);
      video.src = URL.createObjectURL(rightBlob);
      video.preload = 'auto';
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.style.width = '100vw';
      video.style.height = '100vh';
      video.style.position = 'absolute';
      video.style.objectFit = 'cover';
      musicGraphData.imageCache[el.id] = video;
    } else {
      let img = new Image();
      img.src = '/res/bg/1.jpg?bgId=' + el.background;
      img.style.width = '100vw';
      img.style.height = '100vh';
      img.style.position = 'absolute';
      img.style.objectFit = 'cover';
      musicGraphData.imageCache[el.id] = img;
    }
  }
  for (let node of Object.values(musicGraphData.imageCache)) {
    node.style.opacity = 0;
    document.body.appendChild(node); // force preload
  }

  for (let module of modules)
    module(musicGraphData);

  for (let graphObject of Object.values(graph)) {
    if (graphObject.type != 'root') continue;
    let node = new musicGraphData.Node();
    musicGraphData.nodes.push(node);
    node.setSource(graphObject);
  }

  console.log("[TETR.IO PLUS] Music graph ready")
})().catch(ex => {
  console.error("[TETR.IO PLUS] Music graph error:", ex);
});
