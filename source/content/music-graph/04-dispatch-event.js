musicGraph(graph => {
  let {
    Node,
    nodes,
    cleanup,
    sendDebugEvent,
    globalVariables,
    ExpVal
  } = graph;
  let recentEvents = [];
  let eventLastFired = {};

  let f8menu = document.getElementById('devbuildid');
  let f8menuActive = false;
  if (!f8menu) {
    console.log("[TETR.IO PLUS] Can't find '#devbuildid'?")
  } else {
    let div = document.createElement('div');
    cleanup.push(() => div.remove());
    div.style.fontFamily = 'monospace';
    div.classList.add('tetrio-plus-music-graph-debug');
    div.innerHTML = `
      TETR.IO PLUS music graph debug<br>
      -- Recent events --
      <div id="tetrio_plus_music_graph_events">
      </div>
      -- Global variables --
      <div id="tetrio_plus_music_graph_variables">
      </div>

      <style>
        #tetrio_plus_music_graph_events span {
          min-width: 300px;
          border: 1px solid #AAA;
          margin-right: 2px;
          display: inline-block;
        }
      </style>
    `;
    f8menu.parentNode.insertBefore(div, f8menu.nextSibling.nextSibling);

    let events = document.getElementById('tetrio_plus_music_graph_events');
    let variables = document.getElementById('tetrio_plus_music_graph_variables');
    setInterval(() => {
      f8menuActive = !f8menu.parentNode.classList.contains('off');
      if (!f8menuActive) return;

      events.innerHTML = ``;
      for (let event of [...recentEvents].reverse()) {
        let span = document.createElement('span');
        span.innerText = event;
        let delay = Date.now() - eventLastFired[event];
        if (delay < 1000) {
          let opacity = 1 - Math.sqrt(delay / 1000);
          let color = '#FFA500' + Math.floor(opacity * 120).toString(16).padStart(2, '0');
          span.style.backgroundColor = color;
        }
        events.appendChild(span);
      }

      variables.innerHTML = ``;
      for (let [key, value] of Object.entries(globalVariables)) {
        let span = document.createElement('span');
        span.innerText = `${key}: ${value}`;
        span.style.marginRight = '4px';
        variables.appendChild(span);
      }
    }, 100);
  }

  /**
   * Dispatches a global event to the music graph,
   * running the relevent triggers on all nodes.
   * @param eventName the name of the event to dispatch.
   * @param value an object map of variables that are overlaid while the event is active. If a single number is passed, it's used as the `$` key ({ $: value })
   */
  graph.dispatchEvent = function dispatchEvent(eventName, value) {
    value = value ?? {};
    if (typeof value == 'number')
      value = { $: value };

    if (f8menuActive) {
      let valueKeys = Object.keys(value);
      let dataString = valueKeys.length == 0
        ? null
        : valueKeys.length == 1 && valueKeys[0] == '$'
          ? value.$
          : Object.entries(value).map(([k,v]) => `${k}=${v}`).join(', ');
      let str = dataString != null
        ? `${eventName} (${dataString})`
        : eventName;

      let index = recentEvents.indexOf(str);
      if (index !== -1)
        recentEvents.splice(index, 1);

      recentEvents.push(str);
      eventLastFired[str] = Date.now();

      if (recentEvents.length > 20)
        recentEvents = recentEvents.slice(-20);
    }


    for (let nodeSrc of Object.values(graph.graph)) {
      for (let trigger of nodeSrc.triggers) {
        if (trigger.mode == 'create' && trigger.event == eventName) {
          if (nodes.length >= 100) {
            console.error("[TETR.IO PLUS] Music graph: Too many nodes, aborting create.");
            break;
          }
          let node = new Node();
          if (node.testTrigger(trigger, value)) {
            nodes.push(node);
            node.setSource(nodeSrc);
          }
        }
      }
    }

    for (let node of nodes.slice()) // slice since events could add or remove nodes
      for (let trigger of node.source.triggers)
        if (trigger.mode != 'create' && trigger.event == eventName)
          node.runTrigger(trigger, value, 0);
  }
});
