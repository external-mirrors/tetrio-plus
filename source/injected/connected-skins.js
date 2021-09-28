(() => {
  if (window.location.pathname != '/') return;
  int = setInterval(() => {
    // Enables connected skins
    if (window.DEVHOOK_CONNECTED_SKIN) {
      window.DEVHOOK_CONNECTED_SKIN();
      clearInterval(int);
    }
  }, 1000);
})();
