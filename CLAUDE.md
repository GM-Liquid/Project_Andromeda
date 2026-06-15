# CLAUDE.md — Project Andromeda

Полное руководство по проекту (правила версионирования, модель данных, Quartz-пайплайн,
парность локализации EN/RU и пр.) живёт в `AGENTS.md`. Оно импортируется целиком ниже —
**считай `AGENTS.md` источником правды и следуй ему**. Этот файл добавляет только то, что
специфично для работы через Claude Code.

@AGENTS.md

---

## Окружение

- ОС: **Windows**, оболочка по умолчанию — **PowerShell** (`$null`, `$env:VAR`, backtick для
  переноса строки; bash тоже доступен через Bash-инструмент).
- Node **22** (Quartz требует `node >=22`, `npm >=10.9.2`).
- Соседний приватный репо `../Docs_Project_Andromeda` присутствует локально — Quartz-скрипты
  и канонические каталоги читаются из него автоматически.
- `gh` CLI **не установлен**. Локальный git работает; для PR / issue / ревью-комментариев
  нужно поставить `gh` и выполнить `gh auth login`. Пуш по HTTPS-origin запросит креды.

## Рабочий процесс

- Я **редактирую файлы напрямую** и сам запускаю линтер/тесты — копипаст-блоки выдавать не
  нужно (правило §7.3 в `AGENTS.md` было заточено под Codex).
- Любая новая UI-строка добавляется **одновременно** в `lang/en.json` и `lang/ru.json` с
  идентичными ключами.
- Бамп версии `system.json` — только при изменении shipped Foundry-файлов и строго по правилам
  §4. Quartz / публичная книга правил / docs версию **не** бампают.

## Команды (из корня репо)

```powershell
npm run lint          # eslint .
npm run format        # prettier . --write
npm test              # node --test по module/** и data/gear/tests/**
npm run build:pack    # собрать компендиум gear-library из data/gear/catalog/*.json

# Quartz-side тесты
npm run --prefix .quartz-site test:rulebook-source
npm run --prefix .quartz-site test:rulebook-blocks
```

Prettier: одинарные кавычки, `printWidth 100`, `tabWidth 2`, без trailing comma, `endOfLine lf`.
`.hbs` исключены из Prettier (`.prettierignore`) — встроенный glimmer-парсер не понимает Foundry-
партиалы `{{>...}}`. Весь правленый JS-код должен проходить eslint + prettier; крупные файлы в
`module/` имеют пред-существующий формат-дрейф, поэтому форматируй точечно, не весь файл.

## Каталог снаряжения = компендиум (см. AGENTS.md §6.2)

Канон контента живёт в `data/gear/catalog/*.json`. `npm run build:pack` компилирует его в
компендиум-пак `gear-library` (LevelDB, `classic-level`). Пак — build-артефакт: в `.gitignore`,
собирается локально и в CI, кладётся в релиз. Листы персонажей линкуются на предметы пака
(`flags.project-andromeda.libraryItemUuid` = `Compendium.…`). Применение к кампаниям — **только при
смене версии системы** (рефреш) + одноразовая миграция ссылок. Менял каталог → `npm run build:pack`
и перезапусти мир.

## Проверка в Foundry

`npm test` ничего не проверяет в игре. Foundry читает систему напрямую из этого репо через
junction:

```
D:\Foundry systems\Data\systems\project-andromeda  →  D:\Моя_НРИ\Project Andromeda
```

Правки в файлах сразу попадают в систему — отдельная сборка/копирование не нужны. Чтобы увидеть:

- JS/`.mjs`, `.hbs`, `system.json`/`template.json`, `lang/*.json` → перезагрузить мир (выйти в
  Setup и зайти обратно, либо `F5`).
- Только CSS → обычно достаточно hard-reload (`Ctrl+Shift+R`).
