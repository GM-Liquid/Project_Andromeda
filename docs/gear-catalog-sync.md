# Gear Catalog → Compendium Pack

The shipped gear catalog is distributed as the **`gear-library` compendium pack**, compiled from JSON. There is no longer an in-world "import" step or a manual sync window.

## Source of truth

Canon lives in the catalog JSON, mirrored from the canonical private repo path:

```text
D:\Моя_НРИ\Docs_Project_Andromeda\data\gear\catalog
```

- `data/gear/catalog/armor.json`
- `data/gear/catalog/equipment.json`
- `data/gear/catalog/abilities.json`

`concept-abilities.json` is intentionally excluded.

## Build

`npm run build:pack` (`tools/build-pack.mjs`, uses `classic-level`) compiles those JSON files into `packs/gear-library`, reusing the runtime transform in `module/helpers/gear-catalog.mjs` so the pack never drifts from the catalog. Each item carries `flags.project-andromeda.sheetSyncId` (`gear:<catalog>:<id>`) and a deterministic `_id` derived from it, so rebuilds keep stable compendium UUIDs. Items are grouped into pack folders by type and rank (`Броня/Ранг N`, `Оружие/Ранг N`, `Предметы/Ранг N`, `Способности/Ранг N`; no valid rank → `Без ранга`). The `equipment.json` catalog is split the same way the public rulebook renders two tables: weapon-skilled entries (`blizhniy_boy`/`strelba`) become `weapon` items under `Оружие`, the rest stay `equipment` items under `Предметы`.

The pack is a **build artifact**: gitignored, built locally and in CI (`.github/workflows/release.yml`), and copied into the release zip. It is registered in `system.json` `packs[]`.

## Applying to campaigns

Character-sheet items link to their pack source via `flags.project-andromeda.libraryItemUuid` (a `Compendium.…` UUID), stamped when an item is dropped onto an actor. On a **system version change**, linked actor items are refreshed from the pack (shared fields only; local `quantity`/`equipped`/`cooldown` preserved). Re-entering the world on an unchanged version changes nothing. See `AGENTS.md` §6.2 for the full model.

Cleanup of leftover world catalog items from the pre-pack era is opt-in:

```js
game.projectAndromeda.removeOrphanCatalogWorldItems({ dryRun: true });
```
