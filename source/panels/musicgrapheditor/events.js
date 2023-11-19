
export const events = [
  'node-end',
  'time-passed',
  'repeating-time-passed',
  'random-target',
  'parent-node-destroyed',
  'video-background-seeked',

  'fx-countdown',
  'fx-zen-levelup',
  'fx-master-levelup',
  'fx-100-players-left',
  'fx-30-players-left',
  'fx-10-players-left',
  'fx-60-seconds-left',
  'fx-30-seconds-left'
];

export const fxHasPlayerEnemyVariants = [
  'board-height',
  'fx-line-clear',
  'fx-combo',
  'fx-offense',
  'fx-defense',
  'fx-any-spin',
  'fx-t-spin',
  'fx-o-spin',
  'fx-i-spin',
  'fx-j-spin',
  'fx-l-spin',
  'fx-s-spin',
  'fx-z-spin',
];
for (let sfx of fxHasPlayerEnemyVariants)
  events.push(sfx); // -player/-enemy have extra UI

[
  "home",
  "play1p",
  "playmulti",
  "about",
  "multilisting",
  "lobby",
  "victory",
  "multilog",
  "endleague",
  "league",
  "40l",
  "blitz",
  "zen",
  "custom",
  "results",
  "tetra",
  "tetra_records",
  "tetra_me",
  "tetra_players",
  "config",
  "config_bgmtweak",
  "config_account",
  "config_account_orders",
  "config_electron"
].forEach(evt => {
  events.push(`menu-${evt}-open`);
  events.push(`menu-${evt}-close`);
});
['forfeit', 'retry', 'replay', 'spectate'].forEach(evt => {
  events.push(`hud-${evt}-open`);
  events.push(`hud-${evt}-close`);
});

// run this snippet in the sound effects editor to generate/update this:
// console.log(app.sprites.map(sprite => `"${sprite.name}"`).join(', '))
let soundEffects = ["allclear", "applause", "boardappear", "btb_1", "btb_2", "btb_3", "btb_break", "clearbtb", "clearline", "clearquad", "clearspin", "clutch", "combo_1", "combo_10", "combo_10_power", "combo_11", "combo_11_power", "combo_12", "combo_12_power", "combo_13", "combo_13_power", "combo_14", "combo_14_power", "combo_15", "combo_15_power", "combo_16", "combo_16_power", "combo_1_power", "combo_2", "combo_2_power", "combo_3", "combo_3_power", "combo_4", "combo_4_power", "combo_5", "combo_5_power", "combo_6", "combo_6_power", "combo_7", "combo_7_power", "combo_8", "combo_8_power", "combo_9", "combo_9_power", "combobreak", "countdown1", "countdown2", "countdown3", "countdown4", "countdown5", "counter", "cutin_superlobby", "damage_alert", "damage_large", "damage_medium", "damage_small", "death", "detonate1", "detonate2", "detonated", "elim", "exchange", "failure", "finessefault", "finish", "fire", "floor", "gameover", "garbage_in_large", "garbage_in_medium", "garbage_in_small", "garbage_out_large", "garbage_out_medium", "garbage_out_small", "garbagerise", "garbagesmash", "go", "harddrop", "hit", "hold", "hyperalert", "i", "impact", "j", "l", "level1", "level10", "level100", "level500", "levelup", "losestock", "maintenance", "map_change", "matchintro", "menuback", "menuclick", "menuconfirm", "menuhit1", "menuhit2", "menuhit3", "menuhover", "menutap", "mission", "mission_free", "mission_league", "mission_versus", "mmstart", "move", "no", "notify", "o", "offset", "pause_continue", "pause_exit", "pause_retry", "pause_start", "personalbest", "piece_change", "protected_large", "protected_medium", "protected_small", "purchase_start", "queue_change", "ranklower", "rankraise", "ratinglower", "ratingraise", "redo", "ribbon", "ribbon_off", "ribbon_on", "ribbon_tap", "rotate", "rsg", "rsg_go", "s", "scoreslide_in", "scoreslide_out", "shatter", "showscore", "sidehit", "social_close", "social_close_minor", "social_dm", "social_invite", "social_notify_major", "social_notify_minor", "social_offline", "social_online", "social_open", "social_open_minor", "softdrop", "spin", "spinend", "staffsilence", "staffspam", "staffwarning", "supporter", "t", "target", "thunder1", "thunder2", "thunder3", "thunder4", "thunder5", "thunder6", "timer1", "timer2", "topout", "undo", "userjoin", "userleave", "victory", "warning", "warp", "worldrecord", "z"];
soundEffects.forEach(sfx => {
  events.push('sfx-' + sfx);
  // events.push('sfx-' + sfx + '-any');
  // events.push('sfx-' + sfx + '-player');
  // events.push('sfx-' + sfx + '-enemy');
});

// Events that use the 'predicateExpression' field and their labels
export const eventValueExtendedModes = {
  'board-height-player': 'Rows high',
  'board-height-enemy': 'Rows high',
  'fx-countdown': 'Count',
  'fx-line-clear-player': 'Lines cleared',
  'fx-line-clear-enemy': 'Lines cleared',
  'fx-offense-player': 'Lines sent',
  'fx-offense-enemy': 'Lines sent',
  'fx-defense-player': 'Lines blocked',
  'fx-defense-enemy': 'Lines blocked',
  'fx-combo-player': 'Combo',
  'fx-combo-enemy': 'Combo'
}

export const eventHasTarget = {
  'fork': true,
  'goto': true,
  'kill': false,
  'random': false,
  'dispatch': false,
  'create': false,
  'set': false
}
