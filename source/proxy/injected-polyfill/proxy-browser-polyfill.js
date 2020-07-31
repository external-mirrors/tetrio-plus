// tpse is set by the filter loader

// onConnect listeners. Since everything runs in the same context
// on the proxy version, these are fully syncronous
let globalListeners = [];
let connections = [];

var browser = {
  proxy: true,
  runtime: {
    getURL(relative) {
      return '/internal/' + relative;
    },
    async getBrowserInfo() {
      return {
        name: 'Tetrio Plus Proxy',
        vendor: 'UniQMG',
        version: '¯\\_(ツ)_/¯',
        buildId: '¯\\_(ツ)_/¯'
      }
    },
    onConnect: {
      addListener(callback) {
        callback({
          onMessage: {
            addListener(listener) {
              globalListeners.push(listener)
            }
          },
          postMessage(msg) {
            for (let connection of connections)
              for (let listener of connection.listeners)
                listener(msg);
          }
        })
      }
    },
    connect() {
      let connection = {
        listeners: [],
        postMessage(msg) {
          for (let listener of globalListeners)
            listener(msg);
        },
        onMessage: {
          addListener(listener) {
            connection.listeners.push(listener);
          }
        }
      };
      connections.push(connection);
      return connection;
    }
  },
  extension: {
    getURL(relative) {
      return browser.runtime.getURL(relative);
    }
  },
  storage: {
    local: {
      async get(keys) { return tpse; },
      async set()     { throw new Error('Not implemented'); },
      async remove()  { throw new Error('Not implemented'); },
      async clear()   { throw new Error('Not implemented'); }
    }
  }
}

// polyfill for domain-specific-storage-fetcher.js
var getDataSourceForDomain = async function() {
  return browser.storage.local;
}
