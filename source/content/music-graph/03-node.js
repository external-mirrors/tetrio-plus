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
    backgroundsEnabled
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
    }

    static recalculateBackground() {
      if (!backgroundsEnabled) return;

      let backgrounds = nodes
        .filter(node => node.source.background)
        .sort((a, b) => {
          a = a.source.backgroundLayer;
          b = b.source.backgroundLayer;
          return a == b ? 0 : (a > b ? -1 : 1);
        })
        .map(node => `url(${imageCache[node.source.id].src})`)
        .join(', ');

      gameCanvas.style.backgroundImage = backgrounds || null;
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
              () => this.runTrigger(trigger, SYNC_DELAY/1000),
              trigger.value*1000 - SYNC_DELAY
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
        this.runTriggersByName('node-end');
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
          this.runTriggersByName('node-end', SYNC_DELAY / 1000);
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
        child.runTriggersByName('parent-node-destroyed');
      this.children.length = 0;
      Node.recalculateBackground();
    }

    runTriggersByName(name, audioDelay=0) {
      for (let trigger of this.source.triggers)
        if (trigger.event == name)
          this.runTrigger(trigger, audioDelay);
    }

    runTrigger(trigger, audioDelay=0) {
      // console.log(
      //   `Node ${this.source.name} running trigger ` +
      //   `${trigger.event} ${trigger.mode} ${trigger.target}`
      // );
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
          var node = new Node();
          node.setSource(src, startTime, audioDelay);
          nodes.push(node);
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
            SHORT_SYNC_DELAY/1000
          );
          break;

        case 'dispatch':
          musicGraph.dispatchEvent(trigger.dispatchEvent, null);
          break;
      }
    }

    toString() {
      let debug = ['Node ', this.source.name];
      for (let trigger of this.source.triggers) {
        debug.push('\n​ ​ ​ ​ ');
        debug.push(trigger.event + ' ');

        if (eventValueExtendedModes[trigger.event])
          debug.push(trigger.valueOperator + ' ');

        if (eventValueEnabled[trigger.event])
          debug.push(trigger.value + ' ');

        debug.push(trigger.mode + ' ');

        if (trigger.mode == 'fork' || trigger.mode == 'goto')
          debug.push((graph[trigger.target] || {}).name);

        if (trigger.mode == 'dispatch')
          debug.push(trigger.dispatchEvent);
      }
      return debug.join('');
    }
  }
});
