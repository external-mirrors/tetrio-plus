// code here gets called before the 'ready' event is emitted. it's placed here, in this specific folder for compatibility with desktop client patchers.
// please do not move this file, and remember to update the path in source/electron/electron-main.js if you rename it.

protocol.registerSchemesAsPrivileged([{
    scheme: 'tetrio-plus',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }, {
    scheme: 'tetrio-plus-internal',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }]);
