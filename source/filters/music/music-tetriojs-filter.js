/*
  This filter rewrites the hardcoded music definition object in
  the tetrio.js source file to facillitate adding new music.
*/
createRewriteFilter("Tetrio.js Music", "https://tetr.io/js/tetrio.js*", {
  enabledFor: async (storage, url) => {
    if (url.indexOf('tetrio-plus-bypass') != -1) return false;
    let { musicEnabled } = await storage.get('musicEnabled');
    return musicEnabled;
  },
  onStop: async (storage, url, src, callback) => {
    let { disableVanillaMusic } = await storage.get('disableVanillaMusic');
    let songs = (await storage.get('music')).music || [];

    // tetrio naively populates the music tweaker using innerHTML
    // so strip all special characters to make it safe
    for (let song of songs) {
      for (let key of ['name', 'jpname', 'artist', 'jpartist']) {
        let strip = /[^一-龠ぁ-ゔァ-ヴーa-zA-Z0-9ａ-ｚＡ-Ｚ０-９々〆〤ヶ ]/gu;
        song.metadata[key] = song.metadata[key].replace(strip, '');
      }
    }

    let newSongObject = {};
    for (let song of songs) {
      /*
        Inject the song ID as a url query parameter on top of an existing song
        This is done so we get correct headers, the song chosen is arbitrary
        The song song ID is intercepted in the next webRequest handler and
        mapped to the correct custom song content

        TETR.IO concatenates the song name as `/res/bgm/${songname}.mp3`, so
        we add an extra query parameter to "comment out" the extra .mp3
      */
      let key = `akai-tsuchi-wo-funde.mp3?song=${song.id}&tetrioplusinjectioncomment=`;
      if (song.metadata.genre == 'OVERRIDE') {
        newSongObject[song.override] = song.metadata;
      } else {
        newSongObject[key] = song.metadata;
      }
    }

    // As of TETR.IO 6.4.1, some keys were renamed. Rather than doing a migration, it's a lot easier to
    // just rewrite them to match here. Loop positions were also changed from milliseconds to seconds,
    // and instead of using a length now use an end.
    for (let song of songs) {
      song.metadata.untranslatedName = song.metadata.jpname;
      song.metadata.untranslatedArtist = song.metadata.jpartist;
      song.metadata.loopStart /= 1000;
      song.metadata.loopEnd = song.metadata.loopStart + song.metadata.loopLength / 1000;
      delete song.metadata.jpname;
      delete song.metadata.jpartist;
      delete song.metadata.loopLength;
    }


    // Some values used in the music definition were refactored out into constants.
    // This may not be particularly future-proof, but should work for now.
    // Also fill in true/false since those will get caught up by the constant-substitution regex.
    let constants = { true: true, false: false };
    let regex = /(\w+)=['"](INTERFACE|SPECIAL|BATTLE|CALM|HURT\s*RECORD)['"]/g;
    for (let [_, constant, value] of src.matchAll(regex))
      constants[constant] = `"${value}"`;
    console.log("Extracted music definition constants", constants);

    let replaced = false;
    /**
     * This replacer function locates the songs defined in the source code
     * and the music pools which come immediately after. It attempts to parse
     * the songs (They're not quite json) and add in custom songs.
     */
    src = src.replace(
      /(\w+)=({"kuchu-toshi":{[^}]+}(?:,"?[^"]+"?:{[^}]+})+})(.{0,10000}?)(\w+)=({calm:\[[^\]]+\](?:,battle:\[[^\]]+\])+})/,
      (fullmatch, musicVar, musicJson, inbetweenBit, musicpoolVar, musicpoolJson) => {
        // Attempt to sanitize the json into actual json
        let sanitizedMusicJson = musicJson
          // What is with these true/false constants?
          .replace(/!0/g, 'true')
          .replace(/!1/g, 'false')
          // Quote unquoted keys
          .replace(
            /(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9_]+)(['"])?:/g,
            '$1"$3":'
          )
          // Fill in constants
          .replace(
            /("[^"]+":)([A-Za-z]+)/g,
            (_, key, constant) => {
              if (!constants) console.error("Unknown constant", constant)
              return key + constants[constant];
            }
          )
          // Add leading 0 to numbers, since json doesn't allow numbers to start with a dot
          .replace(/("[^"]+":)(\.\d+)/, (_, key, number) => key + '0' + number);

        let music;
        if (disableVanillaMusic) {
          music = {};
        } else {
          try {
            console.log("parsing", { musicJson, sanitizedMusicJson });
            music = JSON.parse(sanitizedMusicJson);
            for (let song of Object.values(music)) {
              song.genre = constants[song.genre] || song.genre;
              song.source = constants[song.source] || song.source;
            }
            console.log("parsed", music);
          } catch(ex) {
            console.error(
              'Failed to parse sanitized music pool json',
              sanitizedMusicJson, ex
            );
            return fullmatch;
          }
        }

        Object.assign(music, newSongObject);
        let newMusicJson = JSON.stringify(music);

        // Note: as of 6.4.1, TETR.IO generates 'random' from 'calm' and 'battle' pools automatically.
        // The 'random' field will be overwritten, and then the whole definition is frozen.
        let newMusicPool = { random: [], calm: [], battle: [] };
        for (let songkey of Object.keys(music)) {
          let song = music[songkey];
          switch (song.genre) {
            case 'INTERFACE':
            case 'DISABLED':
            case 'OVERRIDE':
            case 'SPECIAL': // new in TETR.IO 6.4.1, not sure what it does yet.
              break;

            case 'CALM':
              newMusicPool.calm.push(songkey);
              break;

            case 'BATTLE':
              newMusicPool.battle.push(songkey);
              break;

            default:
              console.log("Unknown genre", song.genre, song);
              break;
          }
        }
        let newMusicPoolJson = JSON.stringify(newMusicPool);

        fullmatch, musicVar, musicJson, inbetweenBit, musicpoolVar, musicpoolJson
        let rewrite = (
          musicVar + '=' + `new Proxy(${b64Recode(JSON.parse(newMusicJson))}, {
            get(obj, prop) {
              return (obj[prop] || {
                name: "Missing song",
                untranslatedName: "Missing song",
                artist: "",
                untranslatedArtist: "",
                genre: 'INTERFACE',
                source: 'TETR.IO PLUS',
                loop: false,
                loopStart: 0,
                loopLength: 0
              })
            }
          })` +
          inbetweenBit +
          musicpoolVar + '=' + b64Recode(JSON.parse(newMusicPoolJson))
        );
        // console.log(
        //   "Rewriting music definition",
        //   { from: fullmatch, to: rewrite }
        // );
        replaced = true;
        return rewrite;
      }
    );

    // console.log("Rewrite successful: " + replaced);
    if (!replaced) console.error(
      "Custom music rewrite failed. " +
      "Please update your plugin. "
    );

    callback({
      type: 'text/javascript',
      data: src,
      encoding: 'text'
    });

    // filter.write(new TextEncoder().encode(src));
  }
});
