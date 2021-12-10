const modules = [];
function musicGraph(module) {
  modules.push(module);
}

(async function initializeMusicGraph(createRoot=true) {
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
  if (!musicEnabled || !musicGraphEnabled)
    return;
  musicGraph = musicGraph ?? '[]';

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
    cleanup: [],
    audioContext,
    graph,
    imageCache: {},
    sendDebugEvent,
    audioBuffers,
    getGlobalVolume,
    backgroundsEnabled: musicGraphBackground
  };

  musicGraphData.cleanup.push(() => {
    audioContext.close();
  });

  // Event stream for the music graph debugger
  let port = null;
  function reconnect() {
    if (port) port.disconnect();
    console.log("[TETR.IO PLUS] Music graph attempting debugger connection");
    port = browser.runtime.connect({
      name: 'music-graph-event-stream'
    });

    let reconnTimeout = setTimeout(() => {
      // console.log("[TETR.IO PLUS] Music graph attempting reconnection");
      reconnect();
    }, 10000);

    port.onDisconnect.addListener(() => {
      console.log("[TETR.IO PLUS] Music graph debugger disconnected");
      clearTimeout(reconnTimeout);
      setTimeout(() => reconnect(), 5000);
    });

    port.onMessage.addListener(async (msg) => {
      if (msg.type == 'spawn') {
        if (!graph[msg.sourceId]) return;
        let node = new musicGraphData.Node();
        musicGraphData.nodes.push(node);
        node.setSource(graph[msg.sourceId]);
        console.log('[TETR.IO PLUS] Music graph debugger spawned node', node);
      }
      if (msg.type == 'kill') {
        for (let node of musicGraphData.nodes)
          if (node.id == msg.instanceId) {
            node.destroy();
            console.log("[TETR.IO PLUS] Music graph debugger destroyed node", node);
          }
      }
      if (msg.type == 'hello') {
        console.log("[TETR.IO PLUS] Music graph debugger connected");
        clearTimeout(reconnTimeout);
        // Catch the debugger up to the existing state...
        sendDebugEvent('reset');
        for (let node of musicGraphData.nodes) {
          sendDebugEvent('node-created', {
            instanceId: node.id
          });
          sendDebugEvent('node-source-set', {
            instanceId: node.id,
            sourceId: node.source.id,
            lastSourceId: null
          });
          for (let [name, value] of Object.values(node.variables)) {
            sendDebugEvent('node-set-variable', {
              instanceId: node.id,
              sourceId: node.source.id,
              variable: name,
              value: value
            });
          }
        }
      }
      if (msg.type == 'reload') {
        console.log("[TETR.IO PLUS] RELOADING MUSIC GRAPH");

        try {
          // Clean up old graph...
          port.disconnect();
          port = null;
          let resurrections = [];
          for (let node of musicGraphData.nodes) {
            resurrections.push({
              id: node.id,
              sourceId: node.source.id,
              time: node.currentTime,
              variables: node.variables,
              children: node.children.map(child => child.id)
            });
            musicGraphData.cleanup.push(() => node.destroy());
          }
          for (let handler of musicGraphData.cleanup)
            handler();

          // Start new graph and copy what nodes we can
          let newGraphData = await initializeMusicGraph(false);
          for (let {id, sourceId, time, variables, children} of resurrections) {
            let source = newGraphData.graph[sourceId];
            if (!source) continue;
            let node = new newGraphData.Node();
            Object.assign(node.variables, variables);
            node.children = children
              .map(childId => newGraphData.nodes.filter(node => node.id == childId)[0])
              .filter(e => e);
            newGraphData.nodes.push(node);
            node.setSource(source, time, 0, false, true);
          }
        } catch(ex) {
          alert("Failed to reload music graph: " + ex);
          console.error(ex);
        }
      }
    });
  }
  reconnect();
  function sendDebugEvent(name, data) {
    if (!port) return;
    port.postMessage({ type: 'event', name, data });
  }

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
      video.style.position = 'fixed';
      video.style.objectFit = 'cover';
      video.style['z-index'] = '-1';
      musicGraphData.imageCache[el.id] = video;
    } else {
      let img = new Image();
      img.src = '/res/bg/1.jpg?bgId=' + el.background;
      img.style.width = '100vw';
      img.style.height = '100vh';
      img.style.position = 'fixed';
      img.style.objectFit = 'cover';
      img.style['z-index'] = '-1';
      musicGraphData.imageCache[el.id] = img;
    }
  }
  for (let node of Object.values(musicGraphData.imageCache)) {
    node.style.opacity = 0;
    document.body.appendChild(node); // force preload
  }

  for (let module of modules)
    module(musicGraphData);

  if (createRoot) {
    for (let graphObject of Object.values(graph)) {
      if (graphObject.type != 'root') continue;
      let node = new musicGraphData.Node();
      musicGraphData.nodes.push(node);
      node.setSource(graphObject);
    }
  }

  console.log("[TETR.IO PLUS] Music graph ready");
  return musicGraphData;
})().catch(ex => {
  console.error("[TETR.IO PLUS] Music graph error:", ex);
});
