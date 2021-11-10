musicGraph(musicGraph => {
  const {
    nodes,
    audioContext: context,
    imageCache,
    graph,
    eventValueEnabled,
    eventValueExtendedModes,
    audioBuffers,
    getGlobalVolume,
    backgroundsEnabled,
    ExpVal
  } = musicGraph;

  /**
   * To achieve good audio playback, audio events are scheduled
   * SYNC_DElAY milliseconds into the future. Rather than waiting
   * once the event fires, the event is instead scheduled early
   * and the new audio node state is delayed for some number
   * of milliseconds.
   * this value (30ms) is only used for node-end, random-target
   * uses a 15ms variant. (TODO: document why)
   */
  const SYNC_DELAY = 30;
  const SHORT_SYNC_DELAY = 15;
  let nonce = 0;

  const gameCanvas = document.getElementById('pixi');
  gameCanvas.style.backgroundPosition = 'center';
  gameCanvas.style.backgroundSize = 'cover';

  const background = document.createElement('div');
  background.id = "tetrio-plus-background-layers";
  background.style.position = 'fixed';
  background.style.zIndex = -1;
  background.style.width = '100vw';
  background.style.height = '100vh';
  background.style.top = '0px';
  background.style.left = '0px';
  document.body.appendChild(background);

  /**
   * If the nodes in the music graphs are like classes, then the Node is
   * an instance of one of those classes. It has internal state and uses
   * triggers from the graph node classes to fork or goto other graph nodes.
   */
  musicGraph.Node = class Node {
    constructor() {
      // console.log("Created new node");
      this.id = nonce++;
      this.audio = null; // AudioBufferSourceNode
      this.volume = null; // GainNode
      this.timeouts = [];
      this.startedAt = null;
      this.children = [];
      this.variables = {};
    }

    static recalculateBackground() {
      if (!backgroundsEnabled) return;

      let sortedNodes = nodes
        .filter(node => node.source.background)
        .sort((a, b) => {
          a = a.source.backgroundLayer;
          b = b.source.backgroundLayer;
          return a == b ? 0 : (a > b ? -1 : 1);
        })
        .reverse()
        .map(node => {
          let el = imageCache[node.source.id];
          el.style.opacity = 1;
          return el;
        });

      let justRemoved = new Set(background.children);

      while (background.lastChild)
        background.lastChild.remove();
      background.append(...sortedNodes);

      for (let node in sortedNodes)
        justRemoved.delete(node);

      for (let el in justRemoved)
        if (el instanceof HTMLVideoElement)
          el.currentTime = 0;

      gameCanvas.style.backgroundImage = null;
    }

    setSource(source, startTime=0, audioDelay=0, crossfade=false) {
      if (this.destroyed) return;
      // console.log(`Node ${this?.source?.name} -> ${source.name}`)
      this.source = source;
      Node.recalculateBackground();

      for (let timeout of this.timeouts)
        clearTimeout(timeout);
      this.timeouts.length = 0;

      this.restartAudio(startTime, crossfade, audioDelay);

      for (let trigger of this.source.triggers) {
        switch (trigger.event) {
          case 'time-passed':
            this.timeouts.push(setTimeout(
              () => this.runTrigger(trigger, null, SYNC_DELAY/1000),
              trigger.timePassedDuration*1000 - SYNC_DELAY
            ));
            break;
        }
      }
    }

    /**
     * @param startTime Where to start in the given audio buffer
     * @param crossfade Whether to use crossfade effects
     * @param audioDelay How long to wait before starting the new audio node
     *                   and stopping the old one.
     */
    restartAudio(startTime, crossfade=false, audioDelay=0) {
      if (this.destroyed) return;
      if (!this.source.audio) {
        this.runTriggersByName('node-end', null);
        return;
      }

      let audioSource = context.createBufferSource();
      audioSource.buffer = audioBuffers[this.source.audio];

      audioSource.playbackRate.value = this.source.effects.speed;

      let gainNode = context.createGain();
      gainNode.gain.value = this.source.effects.volume * getGlobalVolume();

      if (this.audio) {
        if (!crossfade) {
          this.audio.stop(context.currentTime + audioDelay);
        } else {
          let oldAudio = this.audio;
          let oldVolume = this.volume;
          gainNode.gain.value = 0;

          let start = Date.now() + audioDelay;
          let end = start + crossfade * 1000 + audioDelay;
          let startVolOld = oldVolume.gain.value;

          let interval = setInterval(() => {
            let progress = 1 - (end - Date.now()) / (end - start);
            if (progress > 1) {
              clearInterval(interval);
              oldAudio.stop(context.currentTime + audioDelay);
              return;
            }

            oldVolume.gain.value = (1 - progress) * startVolOld;
            this.volume.gain.value = (
              progress *
              this.source.effects.volume *
              getGlobalVolume()
            );
          }, 16);
        }
      }

      audioSource.connect(gainNode).connect(context.destination);
      let start = startTime + this.source.audioStart;
      let duration = startTime + (
        (this.source.audioEnd || audioSource.buffer.duration) -
        this.source.audioStart
      );
      audioSource.start(context.currentTime + audioDelay, start, duration);
      this.startedAt = context.currentTime + audioDelay - startTime;

      this.timeouts.push(setTimeout(
        () => {
          if (this.audio != audioSource) return;
          this.runTriggersByName('node-end', null, SYNC_DELAY / 1000);
        },
        duration * 1000 - SYNC_DELAY
      ));

      this.audio = audioSource;
      this.volume = gainNode;
    }

    get currentTime() {
      return context.currentTime - this.startedAt;
    }

    destroy() {
      this.destroyed = true;
      if (this.audio)
        this.audio.stop();
      let index = nodes.indexOf(this);
      if (index !== -1)
        nodes.splice(index, 1);
      for (let child of this.children)
        child.runTriggersByName('parent-node-destroyed', null);
      this.children.length = 0;
      Node.recalculateBackground();
    }

    runTriggersByName(name, value, audioDelay=0) {
      for (let trigger of this.source.triggers)
        if (trigger.event == name)
          this.runTrigger(trigger, value, audioDelay);
    }

    testTrigger(trigger, value) {
      if (typeof value == 'number') this.variables.$ = value;

      if (trigger.predicateExpression.trim().length > 0) {
        try {
          let value = ExpVal.get(trigger.predicateExpression).evaluate(this.variables);
          if (!value) return false;
        } catch(ex) {
          console.warn(`[TETR.IO PLUS] Music graph: error evaluating predicate ${trigger.predicateExpression}`, ex);
        }
      }

      return true;
    }

    runTrigger(trigger, value, audioDelay=0) {
      if (!this.testTrigger(trigger, value))
        return false;

      let startTime = trigger.preserveLocation
        ? this.currentTime * trigger.locationMultiplier
        : 0;
      switch (trigger.mode) {
        case 'fork':
          var src = graph[trigger.target];
          if (!src) {
            console.error("[TETR.IO PLUS] Unknown node #" + trigger.target);
            break;
          }
          if (nodes.length >= 100) {
            console.error("[TETR.IO PLUS] Music graph: Too many nodes, aborting fork.");
            break;
          }
          var node = new Node();
          Object.assign(node.variables, this.variables);
          nodes.push(node);
          node.setSource(src, startTime, audioDelay);
          Node.recalculateBackground();
          this.children.push(node);
          break;

        case 'goto':
          var src = graph[trigger.target];
          if (!src) {
            console.error("[TETR.IO PLUS] Unknown node #" + trigger.target);
            break;
          }
          let crossfade = trigger.crossfade && trigger.crossfadeDuration;
          this.setSource(src, startTime, audioDelay, crossfade);
          break;

        case 'kill':
          this.destroy();
          break;

        case 'random':
          let triggers = this.source.triggers.filter(trigger =>
            trigger.event == 'random-target' && trigger.mode != 'random'
          );
          if (triggers.length == 0) break;
          this.runTrigger(
            triggers[Math.floor(Math.random() * triggers.length)],
            null,
            SHORT_SYNC_DELAY/1000
          );
          break;

        case 'dispatch':
          try {
            let val = trigger.dispatchExpression.trim().length > 0
              ? ExpVal.get(trigger.dispatchExpression).evaluate({ ...this.variables, $: value })
              : null;
            musicGraph.dispatchEvent(trigger.dispatchEvent, val);
          } catch(ex) {
            console.warn('[TETR.IO PLUS] Music graph: error running trigger', trigger, ex);
          }
          break;

        case 'set':
          try {
            console.log(trigger.setExpression);
            let val = ExpVal.get(trigger.setExpression).evaluate(this.variables);
            console.log("set", trigger)
            this.variables[trigger.setVariable] = val;
          } catch(ex) {
            console.warn('[TETR.IO PLUS] Music graph: error running trigger', trigger, ex);
            debugger;
          }
          break;
      }
    }

    toString() {
      let debug = ['Node ', this.source.name];
      for (let [key, val] of Object.entries(this.variables))
        debug.push(` ${key}=${val}`);
      for (let trigger of this.source.triggers) {
        debug.push('\n​ ​ ​ ​');
        debug.push(' ' + trigger.event);

        if (trigger.event == 'time-passed')
          debug.push(' ' + trigger.timePassedDuration + 's');

        debug.push(' ' + trigger.mode);

        if (trigger.mode == 'fork' || trigger.mode == 'goto')
          debug.push(' ' + (graph[trigger.target] || {}).name);

        if (trigger.mode == 'set')
          debug.push(` ${trigger.setVariable} = ${trigger.setExpression}`);

        if (trigger.mode == 'dispatch') {
          debug.push(' ' + trigger.dispatchEvent);
          if (trigger.dispatchExpression.trim().length > 0)
            debug.push(` (${trigger.dispatchExpression})`);
        }

        if (trigger.predicateExpression.trim().length > 0)
          debug.push(' if ' + trigger.predicateExpression);
      }
      return debug.join('');
    }
  }
});
