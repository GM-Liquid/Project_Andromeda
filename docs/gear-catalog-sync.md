# Gear Catalog Foundry Sync

Foundry item sync now imports from the packaged gear catalog JSON files:

- `data/gear/catalog/armor.json`
- `data/gear/catalog/equipment.json`
- `data/gear/catalog/abilities.json`

`concept-abilities.json` is intentionally excluded.

The packaged public catalogs are a mirror of the canonical private repo path:

```text
D:\Моя_НРИ\Docs_Project_Andromeda\data\gear\catalog
```

Use the Foundry system settings menu **Gear Catalog Item Sync** to preview or apply the import. The import targets world `Item` documents. It keeps actor item links intact by updating existing world items in place whenever possible, then relying on the existing item library sync to refresh linked actor items.

Stable import identity uses `flags.project-andromeda.sheetSyncId` with values like `gear:equipment:<catalog-id>`. The flag name is legacy, but the source is now the JSON catalog.

Imported items are grouped into Foundry Item folders by catalog type and rank:

- `Броня/Ранг N`
- `Снаряжение/Ранг N`
- `Способности/Ранг N`

Entries without a valid rank are placed under `Без ранга` inside the type folder.
