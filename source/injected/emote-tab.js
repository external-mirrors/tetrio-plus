/* Added by Jabster28 | MIT Licensed */
/* Modified by UniQMG */
(async () => {
  let user = localStorage.userID
    ? (await (await fetch(`/api/users/${localStorage.userID}`, {
        headers: new Headers({
          Authorization: 'Bearer ' + localStorage.userToken,
        }),
      })).json()).user
    : { supporter: false, verified: false, staff: false };

  while (!window.emoteMap)
    await new Promise(res => setTimeout(res, 100));

  const emotes = window.emoteMap;
  const emoteList = [];

  function add(emotes, allowed) {
    for (let key of Object.keys(emotes))
      emoteList.push({ name: key, url: emotes[key], allowed });
  }
  add(emotes.base, true);
  add(emotes.supporter, user.supporter);
  add(emotes.verified, user.verified);
  add(emotes.staff, user.role == 'admin');

  const picker = document.createElement('div');
  picker.classList.add('tetrioplus-emote-picker');
  picker.classList.add('chat-message');
  for (let { name, url, allowed } of emoteList) {
    let el = document.createElement('div');
    el.classList.add('emote');
    el.classList.toggle('disallowed', !allowed);
    el.setAttribute('data-emote', name);

    if (allowed) {
      el.addEventListener('click', () => {
        let input = picker.parentElement.id == 'room_chat'
          ? document.getElementById('chat_input')
          : document.getElementById('ingame_chat_input');
        let pre = input.value.slice(0, input.selectionStart+1);
        let post = input.value.slice(input.selectionStart);
        input.value = pre.replace(/:[^:]*$/, `:${name}:`) + post;
        picker.remove();
      });
    }

    let img = document.createElement('img');
    img.src = '/res/' + url;
    el.appendChild(img);

    let label = document.createElement('span');
    label.classList.add('label');
    label.innerText = `:${name}:`;
    if (!allowed)
      label.innerText += ` (can't use)`;
    el.appendChild(label);

    picker.appendChild(el);
  }

  function updateEmotes(input, anchor) {
    let sliced = input.value.slice(0, input.selectionStart+1);
    let emote = /(?::[^:]+)?:([^:]*)$/.exec(sliced)?.[1];
    if (emote === undefined) {
      picker.remove();
      return;
    }
    anchor.appendChild(picker);

    let count = 0;
    let activeSet = false;
    for (let img of picker.children) {
      let match = img.getAttribute('data-emote').startsWith(emote);
      img.classList.toggle('match', match);
      if (match) count++;
      if (!activeSet && match && !img.classList.contains('disallowed')) {
        img.classList.add('active');
        activeSet = true;
      } else {
        img.classList.remove('active');
      }
    }
    picker.classList.toggle('list', count <= 17); // 17 = # of ranks
  }

  let elements = [
    ['chat_input', 'room_chat'],
    ['ingame_chat_input', 'ingame_chat']
  ].map(list => list.map(id => document.getElementById(id)));

  for (let [input, messages] of elements) {
    input.addEventListener('input', () => updateEmotes(input, messages));
    input.addEventListener('keydown', (evt) => {
      if (!picker.isConnected) return;
      let pickable = [...picker.querySelectorAll('.match:not(.disallowed)')];
      let currentPick = picker.querySelector('.match.active') || pickable[0];
      if (evt.key == 'ArrowUp' || evt.key == 'ArrowDown') {
        let delta = evt.key == 'ArrowUp' ? -1 : 1;
        let newIndex = pickable.indexOf(currentPick) + delta;
        newIndex = (newIndex % pickable.length + pickable.length) % pickable.length;
        currentPick.classList.remove('active');
        pickable[newIndex].classList.add('active');
        evt.stopImmediatePropagation();
        evt.preventDefault();
      }
      if (evt.key == 'Enter') {
        if (!currentPick) return;
        currentPick.click();
        evt.stopImmediatePropagation();
        evt.preventDefault();
      }
    })
  }
})()
