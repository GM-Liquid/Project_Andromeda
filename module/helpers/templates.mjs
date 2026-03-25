/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  const paths = [
    'systems/project-andromeda/templates/actor/partials/actor-sheet-content.hbs',
    'systems/project-andromeda/templates/actor/partials/item-group-section.hbs',
    'systems/project-andromeda/templates/actor/actor-character-sheet.hbs',
    'systems/project-andromeda/templates/actor/actor-npc-sheet.hbs',
    'systems/project-andromeda/templates/actor/actor-player-character-sheet.hbs',
    'systems/project-andromeda/templates/actor/actor-minion-sheet.hbs',
    'systems/project-andromeda/templates/actor/actor-rank-and-file-sheet.hbs',
    'systems/project-andromeda/templates/actor/actor-elite-sheet.hbs',
    'systems/project-andromeda/templates/item/cartridge-sheet.hbs',
    'systems/project-andromeda/templates/item/implant-sheet.hbs',
    'systems/project-andromeda/templates/item/armor-sheet.hbs',
    'systems/project-andromeda/templates/item/weapon-sheet.hbs',
    'systems/project-andromeda/templates/item/generic-sheet.hbs'
  ];
  return loadTemplates(paths);
};
