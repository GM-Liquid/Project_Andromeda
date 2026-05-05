# UI Референсы

Анализ `D:\Foundry systems\Data\modules\tidy5e-sheet` с опорой на `D:\Foundry systems\Data\systems\dnd5e`.

Дата анализа: 2026-05-05

## Что именно проверено

- `tidy5e-sheet.css`
- `tidy5e-sheet.js.map` и исходные Svelte-компоненты, встроенные в source map
- `dnd5e.css`

## Важное ограничение

Tidy5e сейчас содержит две разные визуальные системы листа персонажа:

- `Classic` — старый parchment/light UI
- `Quadrone` — новый карточно-табличный UI

Поэтому ниже я разделяю референсы по двум листам. Если секция повторно использует общий компонент таблицы или карточки, я это отмечаю явно.

---

## 1. Базовая типографика

### Общие шрифтовые источники

| Роль | Значение | Откуда приходит |
|---|---|---|
| Classic body | `"Signika", sans-serif` | `--t5e-body-font-family` в `tidy5e-sheet.css` |
| Classic title | `"Modesto Condensed", "Palatino Linotype", serif` | `--t5e-title-font-family` |
| Quadrone default | `"Roboto Condensed", Roboto, Arial, sans-serif` | `--t5e-font-family-default` -> `--t5e-font-roboto-condensed` |
| Quadrone title | `Modesto Condensed` | `--t5e-font-family-title` / `.h1`, `.font-title-*` |
| DnD5e fallback font set | `Modesto Condensed`, `Roboto`, `Roboto Condensed`, `Roboto Slab` | `dnd5e.css` |

### Базовые размеры

| Токен / literal                | Значение | Где используется                                                               |
| ------------------------------ | -------- | ------------------------------------------------------------------------------ |
| `0.625rem`                     | 10 px    | иконки-конфиги, служебные подписи, пассив/проф. индикаторы                     |
| `0.6875rem` / `--font-size-11` | 11 px    | Quadrone `font-default-small`, `font-label-small`, `font-data-small`           |
| `0.75rem`                      | 12 px    | Classic skills, table headers, table rows, search, notices                     |
| `0.8125rem` / `--font-size-13` | 13 px    | Quadrone `font-label-medium`, `font-data-medium`, `font-default-medium`        |
| `1rem`                         | 16 px    | часть компактных подписей и line-height в header-секциях                       |
| `1.125rem` / `--font-size-18`  | 18 px    | Quadrone `font-title-small`, Classic HP overlay, Classic Hit Dice, card labels |
| `1.25rem`                      | 20 px    | Classic level badge, Classic block titles                                      |
| `1.5rem`                       | 24 px    | Classic actor name input, Classic block scores                                 |
| `1.75rem` / `--font-size-28`   | 28 px    | Quadrone `font-title-medium`, `font-data-xlarge`, `font-label-xlarge`          |
| `2.25rem`                      | 36 px    | Classic AC shield value                                                        |
| `2.875rem` / `--font-size-46`  | 46 px    | Quadrone `.h1`, `font-title-large`                                             |

### Базовые line-height

| Токен | Значение |
|---|---|
| `--t5e-lineheight-small` | `0.75rem` |
| `--t5e-lineheight-default` | `0.875rem` |
| `--t5e-lineheight-longform` | `1.125rem` |

### Quadrone utility classes

Это важно, потому что в Quadrone компоненты часто не задают `font-size` напрямую, а используют utility-классы:

| Класс | Фактический шрифт |
|---|---|
| `.h1` | `font-title-large` = Modesto 46 px |
| `.font-title-medium` | Modesto 28 px |
| `.font-title-small` | Modesto 18 px |
| `.font-data-xlarge` | Roboto Condensed, 700, 28 px |
| `.font-data-medium` | Roboto Condensed, 700, 13 px |
| `.font-data-small` | Roboto Condensed, 700, 11 px |
| `.font-label-xlarge` | Roboto Condensed, 500, 28 px |
| `.font-label-medium` | Roboto Condensed, 500, 13 px |
| `.font-default-medium` | Roboto Condensed, 400, 13 px |

---

## 2. Базовые цвета и состояния

Ниже перечислены токены, которые реально видны на персонажном листе.

### Classic palette

| Токен | Значение | Где видно |
|---|---|---|
| `--t5e-primary-font-color` | `rgba(0, 0, 0, .9)` | основной текст, имена, primary table cells |
| `--t5e-secondary-color` | `rgba(0, 0, 0, .65)` | вторичный текст: class list, usage, часть подписей |
| `--t5e-tertiary-color` | `rgba(0, 0, 0, .4)` | слабые иконки, passive, config icons, trait icons |
| `--t5e-light-color` | `rgba(0, 0, 0, .25)` | light borders, separators, table icon tint |
| `--t5e-faint-color` | `rgba(0, 0, 0, .1)` | zebra background skills/traits, subtle panels |
| `--t5e-faintest-color` | `rgba(0, 0, 0, .05)` | фон item-row и grid-cell base |
| `--t5e-header-background` | `rgba(255, 255, 255, .2)` | фон header и tabs toolbar |
| `--t5e-primary-accent-color` | `var(--t5e-theme-color-default)` = красно-коричневый акцент темы | hover rollables, focus, context border |
| `--t5e-xp-bar-background` | `#5ee192` | заполнение XP bar |
| `--t5e-icon-background` | `#ece9df` | фон Rest, Hit Dice, resource pods |
| `--t5e-warning-accent-color` | `#9a2a30` через `--t5e-color-palette-red-60` | notices, AE-marker, warning blocks |

### Classic state colors

| Токен | Значение | Где видно |
|---|---|---|
| `--t5e-prepared-background` | `rgba(50, 205, 50, .3)` | prepared spell rows |
| `--t5e-equipped-background` | `rgba(50, 205, 50, .3)` | equipped inventory rows / tiles |
| `--t5e-pact-background` | `rgba(250, 0, 180, .3)` | pact spells |
| `--t5e-atwill-background` | `rgba(226, 246, 4, .3)` | at-will spells |
| `--t5e-innate-background` | `rgba(255, 0, 0, .3)` | innate spells |
| `--t5e-ritual-only-background` | `hsla(260.09, 100%, 45.1%, .2588)` | ritual-only spells |
| `--t5e-alwaysprepared-background` | `rgba(0, 0, 255, .15)` | always prepared spells |
| `--t5e-magic-accent-color` | `#ada11a` | magic item outline / glow |
| `--t5e-grid-pane-favorite-icon-color` | `#00c864` | favorite star in grid tiles |
| `--t5e-hp-bar-color` | `rgba(0, 200, 0, .6)` | HP bar fill |
| `--t5e-resource-bar-color` | `#78a7f2` | generic resource fill |
| `--t5e-encumbrance-bar-background` | `#6c8aa5` | encumbrance meter |
| `--t5e-hp-overlay-background` | `#ff0000` | HP overlay/death visual accents |

### Quadrone palette

Quadrone активно использует отдельные semantic tokens:

| Токен | Значение |
|---|---|
| `--t5e-color-text-default` | `#000000` |
| `--t5e-color-text-gold` | `#9f9275` |
| `--t5e-color-text-gold-emphasis` | `#73633f` |
| `--t5e-color-text-gold-light` | `#f0f0e1` |
| `--t5e-color-text-lighter` | `#4b4a44` |
| `--t5e-color-text-lightest` | `#666666` |
| `--t5e-color-icon-button` | `#303236` |
| `--t5e-vitals-button-icon-color` | золотистый `#e2d0a8` |
| `--t5e-component-card-default` | `#f8f4f1` |
| `--t5e-component-card-darker` | `#f1ebe8` |
| `--t5e-component-card-dark-darker` | `#16181d` |
| `--t5e-table-row-divider` | `#e0d8d4` |
| `--header-shadow` | `0 0 .5rem rgba(0, 0, 0, .64)` |

---

## 3. Classic Character Sheet

## 3.1 Header: имя, XP, уровень, класс, origin summary

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Имя персонажа | `Modesto`, `1.5rem`, `700` | основной текст `rgba(0,0,0,.9)` | `.actor-name input` |
| Level badge | `Modesto`, `1.25rem` | фон `--t5e-faint-color`, текст `--t5e-secondary-color` | плашка уровня в header |
| XP inputs | inherit body, высота `1rem` | XP fill `#5ee192`, трек с `--t5e-tertiary-color` и `--t5e-light-color` | current/max XP |
| Class list | body `Signika`, `0.75rem` | `--t5e-secondary-color` | строка классов и сабклассов |
| Player name | body `Signika`, `0.75rem`, `600` | `--t5e-primary-font-color` | отдельный акцент в class-list |
| Origin summary | body `Signika`, `0.75rem` | top/bottom border `--t5e-separator-color` | size, creature type, species, background, alignment, proficiency |

## 3.2 Портретный блок: HP, Temp HP, Rest, Hit Dice, Death Saves

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Портрет | размер `9.375rem` или `6.25rem` | round portrait optional | базовый actor portrait |
| HP overlay на портрете | `Modesto`, `1.125rem`, `700` | ресурсный контейнер на `#ece9df`, outline/shadow `rgba(0,0,0,.4)` | текущие/макс HP поверх портрета |
| Temp HP inputs | body `Signika`, `0.75rem` | стандартные input colors | два маленьких поля под портретом |
| Rest button cluster | icon pod `2.125rem`, цифра rest `1.125rem`, icon `1rem` | `#ece9df` pod, `rgba(0,0,0,.4)` icon, outline, shadow | левый нижний угол портрета |
| Hit Dice pod | `Modesto`, `1.25rem`, `700` | тот же icon pod palette | правый нижний угол портрета |
| Death saves overlay | использует тревожный красный/белый набор | `--t5e-hp-overlay-background`, death-save text/icon tokens | появляется при 0 HP |

## 3.3 AC, abilities, initiative

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| AC shield value | `Modesto`, `2.25rem`, `700` | основной текст | центральное число в щите |
| Название ability / INT, STR и т.п. | `Modesto`, `1.25rem` | underline `--t5e-separator-color` | общий `block-title` |
| Значение ability score | `Modesto`, `1.5rem`, `700` | основной текст | `block-score` |
| Ability mod / save | `0.75rem` | mod background `#505050`, hover accent `--t5e-primary-accent-color`, text white | нижняя строка ability block |
| Proficiency/config icons под ability | `0.625rem` | `--t5e-tertiary-color` | маленькие иконки под блоком |
| Tooltip labels `Mod` / `Save` | `0.625rem` | фон `rgba(0,0,0,.9)`, текст white | всплывают при hover ability |
| Initiative block title | `Modesto`, `1.25rem` | как у ability blocks | `INI` в центре d20 |
| Initiative score | `Modesto`, `1.5rem`, `700` | основной текст | центр d20 блока |

## 3.4 Skills panel

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Весь список skills | body `Signika`, `0.75rem` | border `--t5e-faint-color` | левая колонка Attributes tab |
| Skill row | `0.75rem`, line-height `0.875rem` | чётные строки `--t5e-faint-color` | zebra list |
| Skill name | `0.75rem`, `400`; у proficient -> `700` | основной текст | rollable label навыка |
| Proficiency/config icons | `0.625rem` | `--t5e-tertiary-color`, hover -> primary/primary-font | левая часть строки |
| Passive value | `0.75rem` | `--t5e-tertiary-color` | правый край строки |
| Ability abbreviation в skill row | `0.75rem` | inherit | короткий столбец ability |
| Toggle “show proficient only” | `0.625rem` | border `--t5e-faint-color`, text `--t5e-secondary-color` | нижняя кнопка списка |

## 3.5 Traits panel

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Весь блок traits | inherit body | border `--t5e-faint-color` | senses, languages, immunities, proficiencies |
| Чётные строки trait groups | inherit body | `--t5e-faint-color` | zebra striping |
| Trait icons | small SVG `0.75rem x 0.875rem` | fill `--t5e-tertiary-color` | у заголовков секций |
| Secondary separators/text | inherit | `--t5e-tertiary-color` | например `|` и служебный текст |
| Hit dice counter inside traits | `0.75rem` | inherit | если traits marked important |

## 3.6 Classic tables: inventory, features, spellbook, effects, favorites

Это главный reused-визуальный паттерн Classic.

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Table header row | body `Signika`, `0.75rem` | bg `--t5e-table-header-row-color`, inset border `--t5e-table-header-row-border-color` | все list-view секции |
| Header icon | `0.625rem` | `--t5e-light-color` | weight, bolt, range, school и т.д. |
| Header primary cell | `0.75rem`, `700` | `--t5e-primary-font-color` | имя секции и счётчик |
| Table row container | body `Signika`, `0.75rem` | bg `--t5e-faintest-color` | базовый фон строк |
| Primary row text | body `Signika`, `0.75rem`, primary | `--t5e-primary-color` | названия предметов/спеллов/фич |
| Secondary row text | body `Signika`, `0.75rem` | `--t5e-secondary-color` | usage, quantity, weight |
| AE marker / warning chip | `0.75rem`, `600` | bg `#9a2a30`, text `rgba(255,255,255,.8)` | active effect warning / marker |

### Цветовые состояния в таблицах Classic

| Состояние | Цвет |
|---|---|
| Prepared / Equipped | `rgba(50, 205, 50, .3)` |
| Pact | `rgba(250, 0, 180, .3)` |
| At-will | `rgba(226, 246, 4, .3)` |
| Innate | `rgba(255, 0, 0, .3)` |
| Ritual-only | `hsla(260.09, 100%, 45.1%, .2588)` |
| Always prepared | `rgba(0, 0, 255, .15)` |
| Magic item outline | `#ada11a` |

## 3.7 Inventory grid и Spellbook grid

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Grid section label | `0.75rem` | inherit | `inventory-primary-column-label`, `spell-primary-column-label` |
| Tile size | `3.125rem x 3.125rem` | base outline `--t5e-light-color` | inventory/spell grid tiles |
| Context border | n/a | `--t5e-primary-accent-color` | выделение контекстного tile |
| Equipped tile | n/a | bg `--t5e-equipped-background`, inner accent green | inventory grid equipped |
| Magic tile | n/a | inset glow `#ada11a` | magic item emphasis |
| Attunement badge | icon `~0.7188rem` | bg `#ada11a`, text `rgba(0,0,0,.4)` | маленький круг справа сверху |
| Favorite icon | `0.625rem` | `#00c864` + text-shadow | левый верхний угол tile |
| Hover use icon | `1.125rem` | `--t5e-tertiary-color`, hover -> primary-font | d20 icon on hover |
| Quantity / uses on tile | `0.75rem` | text-shadow for contrast | нижняя планка tile |

## 3.8 Search, notices, utility toolbar

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Search input | `0.75rem` | border `--t5e-light-color` | используется в attributes/features/spellbook и т.д. |
| Search close icon | `0.75rem` | `--t5e-tertiary-color` | крестик очистки |
| Utility toolbar | inherit | нижняя граница `--t5e-separator-color` | верх каждой content tab |
| Notice / warning block | `0.75rem` | bg `#9a2a30`, text light | empty/no spells/warnings |

## 3.9 Spell footer

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Spell DC / attack mod footer | inherits Classic footer styling | uses rollable/secondary footer fields | нижняя строка spellbook tab |
| Spell slot pips | pip size `0.75rem` | empty transparent, active accent, temp blue, hover activate green, hover deactivate warning red | слот-трекер в режиме pips |

---

## 4. Quadrone Character Sheet

## 4.1 Header: имя, subtitle, уровень, proficiency

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Actor name | `.h1` = `Modesto 46 px` | text shadow `0 0 .5rem rgba(0,0,0,.64)` | главный заголовок Quadrone |
| Actor subtitle | `font-label-medium` + `font-data-medium` = 13 px Roboto Condensed | gold / default / lighter text tokens | speed, senses, size, species, alignment, classes, spell DC |
| XP label/value/max | label 13 px, value 13 px | gold/default/lighter, optional XP bar | правый header block |
| Level number | `font-data-xlarge` = 28 px, 700 | `color-text-default` | в `level-block` |
| PB label/sign | `font-label-medium` = 13 px | gold / lightest | `PB` и знак |
| PB value | `font-data-medium` = 13 px | default | число proficiency bonus |
| Rest buttons в header | icon-only buttons | gold-toned button palette | справа от имени |

## 4.2 AC / abilities row

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| AC value | default text, крупный shield display | shield background image | отдельный badge в header abilities row |
| AC label | `font-label-medium` | gold | подпись `AC` |
| Ability abbreviation | `font-label-medium` = 13 px | `color-text-gold` | `STR`, `DEX` и т.д. |
| Ability modifier sign | `font-label-xlarge` = 28 px | `color-text-lightest` | слева от значения |
| Ability modifier value | `font-data-xlarge` = 28 px | `color-text-default` | главное число ability |
| “Edit Score” label | `font-label-medium` | default | показывается только при редактировании |
| Ability score disk label | `font-title-small` = Modesto 18 px | default | нижний кружок с raw score |
| Saving throw row внутри ability card | sign `font-label-medium`, value `font-data-medium` | lightest/default | нижняя зона ability card |

## 4.3 Skills card и Saving Throws card

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Card shell | карточка `#f8f4f1` или `#f1ebe8` | field border, subtle shadow | Filigree card / regular card |
| Card header title | `font-label-medium` = 13 px | default text, icon diminished | `Skills`, `Class Saves` |
| Header legend (`Modifier / Passive`) | `font-default-medium` = 13 px | `color-text-lightest` | справа в header |
| Skill ability abbrev | `font-label-medium` = 13 px | `color-text-gold-emphasis` | столбец `DEX`, `WIS` и т.д. |
| Skill name | default button text | default text | roll button навыка |
| Skill modifier sign | `font-label-medium` = 13 px | `color-text-lightest` | перед числом |
| Skill modifier value | `font-data-medium` = 13 px | default | число mod |
| Passive | default size | `color-text-lighter` | вместо config button в read-only |
| Saving throw name | default | default text | reuse `use-ability-list` |
| Saving throw modifier | 13 px label/data pair | lightest/default | тот же паттерн, что в skills |

## 4.4 Sidebar: Favorites / Traits / Skills / Tools

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Sidebar width | `17.25rem` | отдельная колонка | `--sidebar-expanded-width` |
| Sidebar tab strip | button-group | gold separator background в wrap-группе | переключатели Favorites / Traits и др. |
| Sidebar headings `h3/h4` | inherit Quadrone heading styles | `color-text-lighter` | секции sidebar |
| Sidebar heading icons | `var(--font-size-12)` | `color-icon-button` | маленькие иконки слева |
| Sidebar skills/tools/abilities lists | reuse `skill-list`/`tool-list`/`ability-list` | без отдельного фона | компактный вариант тех же карточек |
| Favorite rows | list-entry/favorite layout | same text system as item/skill favorites | sidebar favorites tab |
| Empty state | dashed container | `color-text-lighter`, hover -> default | когда список пуст |

## 4.5 Action bar над Inventory / Features / Spellbook

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Весь action bar | compact controls row | container-based responsive bar | expand/collapse, search, filters, sort |
| Filter toggle buttons | text rendered at `--font-size-13` | uses button-group palette | pinned filters |
| Button group shell | field border + shadow | `--t5e-component-field-border` | группировки кнопок |
| Search field | compact Quadrone input | field palette | общий action bar control |

## 4.6 Quadrone tables: inventory, features, spellbook

Это основной reused-компонент Quadrone (`TidyItemTable`).

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Table header row | gradient header, default text | left = darker theme color, right = theme color | inventory/features/spellbook sections |
| Spell method header | gradient tied to spell method color | method-based accent | cantrip / prepared / pact / ritual groups |
| Diminished header | grey gradient | `grey-21` -> `grey-34` | collapsed/unemphasized groups |
| Header/header cell divider | subtle inset border | black alpha `.16/.28` | hover slightly strengthens border |
| Table row default | flex row | base parchment-ish row | standard item rows |
| Expanded row | white gradient | `#fff` -> `#ffffff7a` | open summary row |
| Equipped row | white/bright gradient | stronger highlight | equipped items |
| Diminished row | lighter text, transparent bg | `color-text-lighter` | unprepared/disabled rows |
| Secondary cell dividers | `#e0d8d4` | vertical separators between columns | all non-primary columns |

### Состояния row-level в Quadrone

| Состояние | Визуал |
|---|---|
| `equipped` | светлый gradient row |
| `diminished` | серый текст, grayscale image, italic item name |
| `rarity` | row/use-button tint завязан на rarity color |
| spell-method header | цвет шапки меняется по `method-*` |

## 4.7 Inventory footer и Spellbook footer

| Часть листа | Шрифт / размер | Цвета / фон | Наблюдение |
|---|---|---|---|
| Attunement tracker | value `font-data-medium`, max `font-label-medium` | gold/lightest accents | нижний inventory footer |
| Currency row | default Quadrone input system | denomination markers и icons | нижняя currency panel |
| Footer buttons | icon-only | standard Quadrone button palette | add item, currency manager, concentration |
| Spellcasting summary cards | card system | parchment card palette | нижний spellbook footer |

---

## 5. Где какой шрифт реально встречается

### `Modesto Condensed`

- Classic:
  - имя персонажа
  - badge уровня
  - AC shield value
  - заголовки ability/initiative blocks
  - сами значения ability/initiative
  - HP overlay на портрете
  - Hit Dice на портрете
- Quadrone:
  - actor name (`.h1`)
  - title-sized labels внутри ability score badge
  - title-style section headings там, где используется `font-title-*`

### `Signika`

- Classic:
  - class list
  - origin summary
  - skills list
  - traits list
  - search input
  - table rows/features/inventory/spellbook/effects/favorites
  - notices

### `Roboto Condensed`

- Quadrone:
  - subtitle строки header
  - skill cards
  - saving throw cards
  - action bar buttons/filters
  - значения level/PB/modifiers
  - inventory / feature / spellbook tables
  - footer counters, attunement, currencies

---

## 6. Краткие выводы для UI в Project Andromeda

- `Classic` строится на контрасте `Modesto` для «героических» чисел/заголовков и `Signika` для всей рабочей информации.
- `Classic` любит мягкие полупрозрачные чёрные overlays на parchment-фоне: `faint`, `faintest`, `light`, `tertiary`.
- `Classic` кодирует состояния предметов и заклинаний в цвет фона строки: prepared/equipped = зелёный, pact = розовый, at-will = жёлтый, innate = красный, ritual = фиолетовый.
- `Quadrone` — это уже почти дизайн-система: отдельные utility-классы шрифтов, semantic color tokens и единый card/table framework.
- Для собственного UI полезно заимствовать не literal-цвета, а паттерн:
  - title font для identity и «больших чисел»
  - condensed sans для данных
  - отдельные semantic tokens для `default / gold / lighter / lightest`
  - общую row/card систему, а не уникальный стиль на каждый раздел

---

## 7. Самые полезные референсы по частям листа

Если нужно быстро смотреть по зонам листа, а не по токенам:

- `Classic`: Header, Portrait block, Skills, Traits, Inventory/Features/Spellbook tables, Inventory/Spell grids, Search/Notice.
- `Quadrone`: Header, Ability row, Skills card, Saving Throws card, Sidebar, Action bar, Inventory/Feature/Spellbook tables, Footers.

Если понадобится, следующий логичный шаг — сделать вторую версию этого файла уже в формате `design tokens + component inventory`, то есть с нормализованным списком `title/data/label/state` для прямого переноса в UI-систему Project Andromeda.
