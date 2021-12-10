musicGraph(graph => {
  let {
    Node,
    nodes,
    cleanup,
    sendDebugEvent,
    ExpVal
  } = graph;
  let recentEvents = [];

  let f8menu = document.getElementById('devbuildid');
  let f8menuActive = false;
  if (!f8menu) {
    console.log("[TETR.IO PLUS] Can't find '#devbuildid'?")
  } else {
    let div = document.createElement('div');
    cleanup.push(() => div.remove());
    f8menu.parentNode.insertBefore(div, f8menu.nextSibling.nextSibling);
    div.style.fontFamily = 'monospace';
    div.classList.add('tetrio-plus-music-graph-debug');
    setInterval(() => {
      f8menuActive = !f8menu.parentNode.classList.contains('off');
      if (!f8menuActive) return;

      div.innerText = [
        'TETR.IO PLUS music graph debug',
        'Recent events: ' + [...recentEvents].reverse().join(', '),
        ...nodes.map(node => node.toString())
      ].join('\n');
    }, 100);
  }

  /**
   * Dispatches a global event to the music graph,
   * running the relevent triggers on all nodes.
   * @param eventName the name of the event to dispatch.
   * @param value the event's associated value. usage varies by event.
   */
  graph.dispatchEvent = function dispatchEvent(eventName, value) {
    sendDebugEvent('event-dispatched', { name: eventName, value });
    if (f8menuActive) {
      let str = typeof value == 'number'
        ? `${eventName} (${value})`
        : eventName;

      let index = recentEvents.indexOf(str);
      if (index !== -1)
        recentEvents.splice(index, 1);

      recentEvents.push(str);

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
