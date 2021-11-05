musicGraph(graph => {
  let { Node, nodes, eventValueEnabled, eventValueExtendedModes } = graph;
  let recentEvents = [];

  let f8menu = document.getElementById('devbuildid');
  let f8menuActive = false;
  if (!f8menu) {
    console.log("[TETR.IO PLUS] Can't find '#devbuildid'?")
  } else {
    let div = document.createElement('div');
    f8menu.parentNode.insertBefore(div, f8menu.nextSibling.nextSibling);
    div.style.fontFamily = 'monospace';
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

    function testTrigger(trigger) {
      if (trigger.event != eventName)
        return false;
        
      if (typeof value == 'number') {
        if (eventValueExtendedModes[trigger.event]) {
          switch (trigger.valueOperator || '==') {
            case '==': if (!(value == trigger.value)) return false; break;
            case '!=': if (!(value != trigger.value)) return false; break;
            case '>': if (!(value > trigger.value)) return false; break;
            case '<': if (!(value < trigger.value)) return false; break;
          }
        } else {
          if (trigger.value != value && trigger.value != 0)
            return false;
        }
      }

      return true;
    }

    for (let nodeSrc of Object.values(graph.graph)) {
      for (let trigger of nodeSrc.triggers) {
        if (trigger.mode == 'create' && testTrigger(trigger)) {
          let node = new Node();
          nodes.push(node);
          node.setSource(nodeSrc);
        }
      }
    }

    for (let node of [...nodes]) // slice since events could add or remove nodes
      for (let trigger of node.source.triggers)
        if (trigger.mode != 'create' && testTrigger(trigger))
          node.runTrigger(trigger, 0);
  }
});
