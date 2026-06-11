export function getFoundryActorSheetClass() {
  return globalThis.foundry?.appv1?.sheets?.ActorSheet ?? globalThis.ActorSheet;
}

export function getFoundryItemSheetClass() {
  return globalThis.foundry?.appv1?.sheets?.ItemSheet ?? globalThis.ItemSheet;
}

export function getFoundryActorSheetsCollection() {
  return globalThis.foundry?.documents?.collections?.Actors ?? globalThis.Actors;
}

export function getFoundryItemSheetsCollection() {
  return globalThis.foundry?.documents?.collections?.Items ?? globalThis.Items;
}

export function loadFoundryTemplates(paths) {
  const templateLoader =
    globalThis.foundry?.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  return templateLoader(paths);
}
