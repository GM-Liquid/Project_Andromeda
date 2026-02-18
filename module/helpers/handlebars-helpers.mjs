// systems/project-andromeda/helpers/handlebars-helpers.mjs

Handlebars.registerHelper('concat', (...args) => {
  args.pop();
  return args.join('');
});

Handlebars.registerHelper('toPascalCase', (str) => {
  if (typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

// Return the rank label.
Handlebars.registerHelper('rankLabel', function (rankNum) {
  if (!rankNum) return game.i18n.localize('MY_RPG.Rank.Unspecified');
  return game.i18n.localize(`MY_RPG.RankNumeric.Rank${rankNum}`);
});

Handlebars.registerHelper('isTab', function (value, expected, options) {
  if (value === expected) {
    return options.fn(this);
  }
  return options.inverse(this);
});
