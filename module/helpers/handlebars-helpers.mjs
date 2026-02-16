// systems/project-andromeda/helpers/handlebars-helpers.mjs

Handlebars.registerHelper('concat', (...args) => {
  args.pop();
  return args.join('');
});

Handlebars.registerHelper('toPascalCase', (str) => {
  if (typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

// Return the rank label for the single supported world mode.
Handlebars.registerHelper('rankLabel', function (rankNum) {
  if (!rankNum) return game.i18n.localize('MY_RPG.Rank.Unspecified');
  return game.i18n.localize(`MY_RPG.RankGradient.Rank${rankNum}`);
});

// Kept for backwards compatibility; Unity is now the only mode.
Handlebars.registerHelper('ifUnity', function (options) {
  return options.fn(this);
});

// Kept for backwards compatibility; always resolves to the Unity key.
Handlebars.registerHelper('worldChoice', function (unityKey) {
  return unityKey;
});

Handlebars.registerHelper('isTab', function (value, expected, options) {
  if (value === expected) {
    return options.fn(this);
  }
  return options.inverse(this);
});
