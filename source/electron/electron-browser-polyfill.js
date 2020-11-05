(() => {
  const electron = typeof window != 'undefined' && window?.process?.versions?.electron;
  const node = typeof module != 'undefined' && module.exports;
  if (electron || node) {
    console.log("Running under electron - polyfilling browser");

    // provided by tetrio desktop
    const Store = require('electron-store');
    // const store = new Store({ name: 'tetrio-plus' });
    const keystore = new Store({
      name: 'key-index',
      cwd: 'tetrioplus',
      defaults: { keys: [] }
    });

    const { promisify } = require('util');
    const electron = require('electron');
    const path = require('path');
    const fs = require('fs');

    // onConnect listeners. Since the content scripts
    // run in the same context while under electron,
    // these are fully syncronous
    let globalListeners = [];
    let connections = [];

    const browser = {
      electron: true,
      management: {
        async uninstallSelf() {
          if (!confirm(
            "Are you sure you want to uninstall TETR.IO PLUS? " +
            "The application will quit after uninstalling."
          )) throw new Error('Uninstall cancelled');
          electron.ipcRenderer.send('tetrio-plus-cmd', 'uninstall');
        }
      },
      runtime: {
        getURL(relative) {
          let absolute = 'tetrio-plus-internal://' + relative;
          return absolute;
        },
        getManifest() {
          return require('../../desktop-manifest.js');
        },
        async getBrowserInfo() {
          return {
            name: 'Tetrio Desktop',
            vendor: 'osk',
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
      theme: {
        async getCurrent() {
          return null;
        },
        onUpdated: {
          addListener() { /* /dev/null */},
          removeListener() { /* /dev/null */ }
        }
      },
      extension: {
        getURL(relative) {
          return browser.runtime.getURL(relative);
        }
      },
      windows: {
        create({ type, url, width, height }) {
          console.log("Create", url);
          let panel = new electron.remote.BrowserWindow({
            width,
            height,
            webPreferences: {
              nodeIntegration: false,
              enableRemoteModule: true,
              preload: path.join(__dirname, 'electron-browser-polyfill.js')
            }
          });
          panel.loadURL(url);
          panel.on('closed', () => {
            window.location.reload();
          });
        }
      },
      tabs: {
        create({ url, active }) {
          browser.windows.create({ type: null, url, width: 800, height: 800 });
        },
        openExternal(url) {
          console.log('Opening', url, 'externally');
          require('electron').shell.openExternal(url);
        },
        electronOnMainNavigate(callback) {
          require('electron').ipcRenderer.on('client-navigated', (event, url) => {
            callback(url);
          });
        },
        electronClearPack() {
          require('electron').ipcRenderer.send('tetrio-plus-cmd', 'reset location');
        }
      },
      storage: {
        local: {
          async get(keys) {
            if (typeof keys == 'string') keys = [keys];

            let values = {};
            for (let key of keys) {
              if (!(/^[A-Za-z0-9\-_]+$/.test(key)))
                throw new Error("Invalid key: " + key);
              values[key] = new Store({
                name: 'tpkey-' + key,
                cwd: 'tetrioplus'
              }).get('value');
            }

            // Prevent infinite loops in some users that don't expect
            // the promise to resolve syncronously
            await new Promise(r => setTimeout(r, 100));
            return values;
          },
          async set(vals) {
            for (let [key, value] of Object.entries(vals)) {
              if (!(/^[A-Za-z0-9\-_]+$/.test(key)))
                throw new Error("Invalid key: " + key);

              let keys = keystore.get('keys');
              if (keys.indexOf(key) == -1)
                keys.push(key);
              keystore.set({ keys });

              new Store({
                name: 'tpkey-' + key,
                cwd: 'tetrioplus'
              }).set({ value });
            }
          },
          async remove(keys) {
            if (typeof keys == 'string') keys = [keys];
            for (let key of keys) {
              if (!(/^[A-Za-z0-9\-_]+$/.test(key)))
                throw new Error("Invalid key: " + key);

              let keys = keystore.get('keys');
              if (keys.indexOf(key) !== -1)
                keys.splice(keys.indexOf(key), 1);
              keystore.set({ keys });

              let {path} = new Store({ name: 'tpkey-'+key, cwd: 'tetrioplus' });
              await promisify(fs.unlink)(path);
            }
          },
          async clear() {
            await browser.storage.local.remove(keystore.get('keys'));
          }
        }
      }
    };


    if (typeof module != 'undefined' && module.exports)
      module.exports = browser;
    if (typeof window != 'undefined') {
      window.browser = browser;
      window.openInBrowser = href => {
        electron.shell.openExternal(href);
      }
    }
  }
})();
