import { MODULE_ID } from '../config.mjs';

// systems/project-andromeda/helpers/handlebars-helpers.mjs

Handlebars.registerHelper('concat', (...args) => {
  args.pop();
  return args.join('');
});

Handlebars.registerHelper('toPascalCase', (str) => {
  if (typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

// Return the rank label based on current world mode
Handlebars.registerHelper('rankLabel', function (rankNum) {
  if (!rankNum) return game.i18n.localize('MY_RPG.Rank.Unspecified');
  const mode = game.settings.get(MODULE_ID, 'worldType');
  const base = mode === 'stellar' ? 'MY_RPG.RankNumeric' : 'MY_RPG.RankGradient';
  return game.i18n.localize(`${base}.Rank${rankNum}`);
});

// Conditionally render content only for the Unity world
Handlebars.registerHelper('ifUnity', function (options) {
  const mode = game.settings.get(MODULE_ID, 'worldType');
  return mode === 'unity' ? options.fn(this) : options.inverse(this);
});

// Choose localisation key based on world mode
Handlebars.registerHelper('worldChoice', function (unityKey, stellarKey) {
  const mode = game.settings.get(MODULE_ID, 'worldType');
  return mode === 'unity' ? unityKey : stellarKey;
});
