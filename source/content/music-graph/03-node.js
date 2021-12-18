musicGraph(musicGraph => {
  const {
    nodes,
    audioContext: context,
    imageCache,
    sendDebugEvent,
    graph,
    audioBuffers,
    getGlobalVolume,
    backgroundsEnabled,
    musicGraphNodeLimit,
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
      sendDebugEvent('node-created', {
        instanceId: this.id
      });
      this.audio = null; // AudioBufferSourceNode
      this.volume = null; // GainNode
      this.timeouts = [];
      this.startedAt = null;
      this.children = [];
      this.variables = {};
      this.background = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        opacity: 0,
        currentElement: null
      };
    }

    static recalculateBackground() {
      if (!backgroundsEnabled) return;

      let justRemoved = new Set(background.children);
      while (background.lastChild) {
        background.lastChild.__tetrioplus_image_cache.push(background.lastChild);
        background.lastChild.remove();
      }

      for (let node of nodes)
        node.background.currentElement = null;

      let sortedNodes = nodes
        .filter(node => node.source.background)
        .sort((a, b) => {
          a = a.source.backgroundLayer;
          b = b.source.backgroundLayer;
          return a == b ? 0 : (a > b ? -1 : 1);
        })
        .reverse()
        .map(node => {
          let cache = imageCache[node.source.id];
          let el = cache.ready.length > 0
            ? cache.ready.pop()
            : cache.base.cloneNode();
          el.__tetrioplus_image_cache = cache.ready;
          node.background.currentElement = el;
          el.style.opacity = 1;
          return [node, el];
        });

      background.append(...sortedNodes.map(([node, el]) => el));

      for (let [node, el] of sortedNodes) {
        if (el.play) el.play();
        el.style.left = `${node.background.x}vw`;
        el.style.top = `${node.background.y}vh`;
        el.style.width = `${node.background.width}vw`;
        el.style.height = `${node.background.height}vh`;
        justRemoved.delete(el);
      }

      for (let el of justRemoved)
        if (el instanceof HTMLVideoElement)
          el.currentTime = 0;

      gameCanvas.style.backgroundImage = null;
    }

    setSource(source, startTime=0, audioDelay=0, crossfade=false, suppressEmptyNodeEnd=false, parentSourceId=null) {
      if (this.destroyed) return;
      sendDebugEvent('node-source-set', {
        instanceId: this.id,
        sourceId: source.id,
        lastSourceId: this.source?.id || parentSourceId
      });
      this.source = source;
      Node.recalculateBackground();

      for (let timeout of this.timeouts)
        clearTimeout(timeout);
      this.timeouts.length = 0;

      this.restartAudio(startTime, crossfade, audioDelay, suppressEmptyNodeEnd);

      for (let trigger of this.source.triggers) {
        switch (trigger.event) {
          case 'time-passed':
            this.timeouts.push(setTimeout(
              () => this.runTrigger(trigger, null, SYNC_DELAY/1000),
              trigger.timePassedDuration*1000 - SYNC_DELAY + audioDelay*1000
            ));
            break;
          case 'repeating-time-passed':
            this.timeouts.push(setTimeout(
              () => {
                this.timeouts.push(setInterval(
                  () => this.runTrigger(trigger, null, SYNC_DELAY/1000),
                  trigger.timePassedDuration*1000
                ));
              },
              SYNC_DELAY + audioDelay*1000
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
    restartAudio(startTime, crossfade=false, audioDelay=0, suppressEmptyNodeEnd=false) {
      if (this.destroyed) return;
      if (!this.source.audio) {
        if (!suppressEmptyNodeEnd)
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

    static _constrain(val, lower=0, upper=1) {
      if (isNaN(+val)) return 0;
      return Math.min(Math.max(val, lower), upper);
    }

    get computedVariables() {
      let node = this;
      return {
        get $volume() {
          return node.volume
        },
        set $volume(val) {
          node.volume = Node._constrain(val, 0, 1);
        },
        $age: node.currentTime,
        $time: context.currentTime,

        // WIP
        get $bg_x() { return node.background.x },
        get $bg_y() { return node.background.y },
        get $bg_width() { return node.background.width },
        get $bg_height() { return node.background.height },
        get $bg_opacity() { return node.background.opacity },
        get $bg_paused() { return node.background.currentElement?.paused || 0 },
        get $bg_time() { return node.background.currentElement?.currentTime || 0 },

        set $bg_x(val) {
          node.background.x = Node._constrain(val, -100, 100);
          Node.recalculateBackground();
        },
        set $bg_y(val) {
          node.background.y = Node._constrain(val, -100, 100);
          Node.recalculateBackground();
        },
        set $bg_width(val) {
          node.background.width = Node._constrain(val, 0, 100);
          Node.recalculateBackground();
        },
        set $bg_height(val) {
          node.background.height = Node._constrain(val, 0, 100);
          Node.recalculateBackground();
        },
        set $bg_opacity(val) {
          node.background.opacity = Node._constrain(val, 0, 1);
          Node.recalculateBackground();
        },
        set $bg_paused(val) {
          let video = node.background.currentElement;
          if (!(video instanceof HTMLVideoElement)) return;
          if (val) {
            video.pause();
          } else {
            video.play();
          }
        },
        set $bg_time(val) {
          let video = node.background.currentElement;
          if (!(video instanceof HTMLVideoElement)) return;
          video.currentTime = Node._constrain(val, 0, video.duration || Infinity);
          video.pause();
        }
      }
    }

    destroy() {
      if (!this.destroyed) {
        sendDebugEvent('node-destroyed', {
          instanceId: this.id,
          sourceId: this.source.id
        });
      }
      this.destroyed = true;

      if (this.audio) this.audio.stop();

      let index = nodes.indexOf(this);
      if (index !== -1) nodes.splice(index, 1);

      for (let timeout of this.timeouts)
        clearTimeout(timeout);

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
      if (trigger.predicateExpression.trim().length > 0) {
        try {
          let expValue = ExpVal.get(trigger.predicateExpression).evaluate({
            ...this.variables,
            ...this.computedVariables,
            $: value || 0
          });
          if (!expValue) return false;
        } catch(ex) {
          console.warn(`[TETR.IO PLUS] Music graph: error evaluating predicate ${trigger.predicateExpression}`, ex);
        }
      }

      return true;
    }

    runTrigger(trigger, value, audioDelay=0) {
      if (this.destroyed) return;
      try {
        let result = this.testTrigger(trigger, value);
        sendDebugEvent('node-run-trigger', {
          instanceId: this.id,
          sourceId: this.source.id,
          success: result,
          trigger: this.source.triggers.indexOf(trigger),
          value: value
        }, true);
        if (!result) return false;

        let startTime = trigger.preserveLocation
          ? this.currentTime * trigger.locationMultiplier
          : 0;
        switch (trigger.mode) {
          case 'fork': {
            var src = graph[trigger.target];
            if (!src) {
              console.error("[TETR.IO PLUS] Unknown node #" + trigger.target);
              break;
            }
            if (nodes.length >= musicGraphNodeLimit) {
              throw new Error(
                "[TETR.IO PLUS] Music graph: Too many nodes (" + nodes.length +
                "), aborting fork. You can raise this limit in the Music " +
                "Graph's global config."
              );
            }
            var node = new Node();
            Object.assign(node.variables, this.variables);
            nodes.push(node);
            let crossfade = trigger.crossfade && trigger.crossfadeDuration;
            node.setSource(src, startTime, audioDelay, crossfade, false, this.source.id);
            Node.recalculateBackground();
            this.children.push(node);
            break;
          }
          case 'goto': {
            var src = graph[trigger.target];
            if (!src) {
              console.error("[TETR.IO PLUS] Unknown node #" + trigger.target);
              break;
            }
            let crossfade = trigger.crossfade && trigger.crossfadeDuration;
            this.setSource(src, startTime, audioDelay, crossfade);
            break;
          }
          case 'kill': {
            this.destroy();
            break;
          }
          case 'random': {
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
          }
          case 'dispatch': {
            let val = trigger.dispatchExpression.trim().length > 0
              ? ExpVal.get(trigger.dispatchExpression).evaluate({
                  ...this.variables,
                  ...this.computedVariables,
                  $: value || 0
                })
              : null;
            musicGraph.dispatchEvent(trigger.dispatchEvent, val);
            break;
          }
          case 'set': {
            let val = ExpVal.get(trigger.setExpression).evaluate({
              ...this.variables,
              ...this.computedVariables,
              $: value || 0
            });
            let computed = this.computedVariables;
            if (typeof computed[trigger.setVariable] !== 'undefined') {
              computed[trigger.setVariable] = val;
            } else {
              this.variables[trigger.setVariable] = val;
              sendDebugEvent('node-set-variable', {
                instanceId: this.id,
                sourceId: this.source.id,
                variable: trigger.setVariable,
                value: val
              });
            }
            break;
          }
        }
      } catch(ex) {
        console.warn('[TETR.IO PLUS] Music graph: error running trigger', trigger, ex);
      }
    }

    toString() {
      let debug = ['Node ', this.source.name];
      for (let [key, val] of Object.entries(this.variables))
        debug.push(` ${key}=${val}`);
      for (let trigger of this.source.triggers) {
        debug.push('\n​ ​ ​ ​');
        debug.push(' ' + trigger.event);

        if (['repeating-time-passed', 'time-passed'].includes(trigger.event))
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
