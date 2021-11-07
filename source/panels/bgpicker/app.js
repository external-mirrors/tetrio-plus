async function importFile(elementId, handler) {
  let el = document.getElementById(elementId);
  el.addEventListener('change', async evt => {
    let status = document.createElement('em');
    status.innerText = 'processing...';
    document.body.appendChild(status);
    window.scrollTo(0, document.body.scrollHeight);

    for (let file of evt.target.files) {
      var reader = new FileReader();
      reader.readAsDataURL(file, "UTF-8");
      reader.onerror = evt => alert('Failed to load background');
      await new Promise(res => reader.onload = res);
      await handler({ filename: file.name, result: reader.result.toString() });
    }

    el.type = '';
    el.type = 'file';
    status.remove();
    // window.close();
  }, false);
}

function randomId() {
  return new Array(16).fill(0).map(e =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');
}

importFile('regular', async file => {
  let backgrounds = (await browser.storage.local.get('backgrounds')).backgrounds || [];
  let id = randomId();
  backgrounds.push({ id, type: 'image', filename: file.filename });
  await browser.storage.local.set({
    backgrounds: backgrounds,
    ['background-' + id]: file.result
  });
});
importFile('video', async file => {
  let backgrounds = (await browser.storage.local.get('backgrounds')).backgrounds || [];
  let id = randomId();
  backgrounds.push({ id, type: 'video', filename: file.filename });
  await browser.storage.local.set({
    backgrounds: backgrounds,
    ['background-' + id]: file.result
  });
});
importFile('animated', async file => {
  let id = randomId();
  let { animatedBackground } = await browser.storage.local.get('animatedBackground');
  if (animatedBackground) {
    await browser.storage.local.remove(`background-${animatedBackground.id}`);
  }
  await browser.storage.local.set({
    animatedBackground: { id, filename: file.filename },
    ['background-' + id]: file.result
  });
});
