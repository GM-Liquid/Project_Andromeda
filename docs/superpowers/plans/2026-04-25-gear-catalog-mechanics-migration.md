# Gear Catalog Mechanics Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate public gear catalogs and Quartz readers from the legacy `usage` / `properties` / `tags` / `status` / `quartz` / `finalCost` shape to the new canonical schema with `mechanics.usage`, `mechanics.properties`, `mechanics.effects`, and `price`.

**Architecture:** Keep the migration local to the public repo and update the Quartz sync pipeline to read only the new schema. Catalog entries become self-contained: all machine-readable mechanics needed for rendering and later price calculation live in `mechanics`, while player-facing prose stays in `description` and `shortDescription`.

**Tech Stack:** Node.js ES modules, existing Quartz sync pipeline, JSON catalogs, Node test runner

---

### Task 1: Lock Quartz expectations to the new catalog schema

**Files:**
- Modify: `D:/Моя_НРИ/Project Andromeda/.quartz-site/scripts/sync-book.test.mjs`

- [ ] **Step 1: Update the concept-catalog fixture to the new shape**

```js
const conceptCatalog = [
  {
    id: "testovyi-kontsept",
    name: "Тестовый концепт",
    type: "ability",
    rank: 1,
    skill: "mistika",
    mechanics: {
      usage: {
        activation: "active",
        frequency: "oncePerScene",
        actionCost: "action",
        range: { type: "meters", value: 15 },
        targets: { type: "single", value: 1 },
        defense: "fortitude",
      },
      properties: {},
      effects: [],
    },
    description: "Полное описание тестовой концепт-способности.",
    shortDescription: "Краткое описание тестовой концепт-способности.",
    price: 777,
  },
]
```

- [ ] **Step 2: Replace legacy `status`-based lookups with new always-visible expectations**

```js
const equipmentEntry = equipmentCatalog.at(0)
const abilityEntry = abilitiesCatalog.at(0)
assert.ok(equipmentEntry)
assert.ok(abilityEntry)
```

- [ ] **Step 3: Add assertions for new `price` and `mechanics`-driven rendering**

```js
assert.match(generated, /\|.*777.*\|/u)
assert.doesNotMatch(generated, /finalCost|status|quartz/u)
```

- [ ] **Step 4: Run the focused test file and confirm failures point to old schema reads**

Run: `node --test .quartz-site/scripts/sync-book.test.mjs`
Expected: FAIL in `sync-book.mjs` while still reading `status`, `tags`, `quartz`, or `finalCost`

### Task 2: Rewrite `sync-book.mjs` to consume the new schema only

**Files:**
- Modify: `D:/Моя_НРИ/Project Andromeda/.quartz-site/scripts/sync-book.mjs`
- Test: `D:/Моя_НРИ/Project Andromeda/.quartz-site/scripts/sync-book.test.mjs`

- [ ] **Step 1: Add helpers for nested `mechanics.usage` / `mechanics.properties` access**

```js
function getGearUsageValue(item, key) {
  const value = item?.mechanics?.usage?.[key]
  return value === null || value === undefined ? "" : String(value).trim()
}

function getGearPropertyValue(item, key) {
  const value = item?.mechanics?.properties?.[key]
  return value === null || value === undefined ? "" : String(value).trim()
}
```

- [ ] **Step 2: Remove `status` filtering and return all non-empty items**

```js
function getRenderableGearCatalogItems(catalog) {
  const items = Array.isArray(catalog?.items) ? catalog.items : []
  return items.filter((item) => item?.id && item?.name)
}
```

- [ ] **Step 3: Replace `tags`-based equipment-type labels with `skill`-based labels**

```js
function getEquipmentTypeLabel(item) {
  if (item.skill === "blizhniy_boy") return "Ближнее"
  if (item.skill === "strelba") return "Стрелковое"
  return "Снаряжение"
}
```

- [ ] **Step 4: Replace `quartz` fallbacks with canonical field reads**

```js
function getGearDescription(item) {
  return String(item.description ?? "").trim()
}

function getGearShortDescription(item) {
  return String(item.shortDescription ?? "").trim() || buildStructuredGearPreview(item)
}
```

- [ ] **Step 5: Replace `finalCost` reads with `price`**

```js
function getGearCatalogPrice(item) {
  if (item.price === null || item.price === undefined) return ""
  return String(item.price)
}
```

- [ ] **Step 6: Re-run the focused test file and confirm green before catalog edits**

Run: `node --test .quartz-site/scripts/sync-book.test.mjs`
Expected: PASS

### Task 3: Migrate armor, equipment, and abilities catalogs to the new schema

**Files:**
- Modify: `D:/Моя_НРИ/Project Andromeda/data/gear/catalog/armor.json`
- Modify: `D:/Моя_НРИ/Project Andromeda/data/gear/catalog/equipment.json`
- Modify: `D:/Моя_НРИ/Project Andromeda/data/gear/catalog/abilities.json`

- [ ] **Step 1: Convert each entry to the new root field set**

```json
{
  "id": "shans",
  "name": "Шанс",
  "type": "armor",
  "rank": 2,
  "skill": null,
  "mechanics": {
    "usage": {
      "activation": "passive",
      "frequency": "passive"
    },
    "properties": {
      "fortitudeBonus": 3,
      "controlBonus": 1
    },
    "effects": [
      {
        "key": "grantTempStress",
        "trigger": "battleStart",
        "amount": 6
      }
    ]
  },
  "description": "Штурмовой комплект для входа под огонь и удержания линии.",
  "shortDescription": "Штурмовой комплект для входа под огонь и удержания линии.",
  "price": null
}
```

- [ ] **Step 2: Remove legacy fields from all three catalogs**

```json
// delete:
"usage"
"properties"
"tags"
"status"
"quartz"
"finalCost"
```

- [ ] **Step 3: Normalize machine keys in `skill`, `usage`, `properties`, and `effects`**

```json
"skill": "strelba"
"frequency": "oncePerScene"
"actionCost": "freeAction"
"defense": "fortitude"
"properties": { "damage": 4, "concealable": true }
```

- [ ] **Step 4: Validate JSON formatting by loading each file through Node**

Run: `node -e "for (const file of ['data/gear/catalog/armor.json','data/gear/catalog/equipment.json','data/gear/catalog/abilities.json']) JSON.parse(require('fs').readFileSync(file,'utf8'))"`
Expected: no output, exit code 0

### Task 4: Run end-to-end Quartz verification

**Files:**
- Test: `D:/Моя_НРИ/Project Andromeda/.quartz-site/scripts/sync-book.test.mjs`
- Test: `D:/Моя_НРИ/Project Andromeda/.quartz-site/content/rulebook/04-sposobnosti-i-snaryazhenie.md`

- [ ] **Step 1: Run the catalog sync tests after the data migration**

Run: `node --test .quartz-site/scripts/sync-book.test.mjs`
Expected: PASS

- [ ] **Step 2: Rebuild generated chapter output through the tested sync path**

Run: `node .quartz-site/scripts/sync-book.mjs`
Expected: generated chapter 04 updates without schema errors

- [ ] **Step 3: Sanity-check the generated chapter for the expected tables**

Run: `Select-String -Path '.quartz-site\\content\\rulebook\\04-sposobnosti-i-snaryazhenie.md' -Pattern 'Броня|Снаряжение|Способности|Цена' -Encoding utf8`
Expected: matching lines are found in the generated markdown
