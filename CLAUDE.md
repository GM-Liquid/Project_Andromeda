# CLAUDE.md — Project Andromeda

Руководство по проекту (источники правды, версионирование, границы, эвристики) живёт в
`AGENTS.md` — он импортируется целиком ниже, **считай его источником правды и следуй ему**.
Для подсистем есть scoped-файлы (`module/`, `data/gear/`, `.quartz-site/`,
`.github/workflows/`) — перед правкой читай ближайший к редактируемым файлам.
Этот файл добавляет только то, что специфично для работы через Claude Code.

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
  нужно.
- Правило `codex/<slug>` в `AGENTS.md` касается веток Codex; ветки из Claude Code называй
  обычно (`fix/…`, `feat/…`), коммиты — Conventional Commits.

## Команды

Основные команды и их тайминги — в таблице **Verified Commands** в `AGENTS.md`
(`check:all`, `lint`, `test:foundry`, `check:quartz`, `test:quartz`, `build:pack`).
Дополнительно бывают полезны:

```powershell
npm test                  # алиас test:foundry
npm run format            # prettier . --write
npm run format:catalogs   # форматирование JSON-каталогов

# точечные Quartz-тесты (вместо полного test:quartz)
npm run --prefix .quartz-site test:rulebook-source
npm run --prefix .quartz-site test:rulebook-blocks
```

Prettier: одинарные кавычки, `printWidth 100`, `tabWidth 2`, без trailing comma, `endOfLine lf`.
`.hbs` исключены из Prettier (`.prettierignore`) — встроенный glimmer-парсер не понимает Foundry-
партиалы `{{>...}}`. Весь правленый JS-код должен проходить eslint + prettier; крупные файлы в
`module/` имеют пред-существующий формат-дрейф, поэтому форматируй точечно, не весь файл.

## Каталог снаряжения = компендиум (детали — `data/gear/AGENTS.md`)

`npm run build:pack` компилирует `data/gear/catalog/*.json` в компендиум-пак `gear-library`
(LevelDB, `classic-level`). Пак — build-артефакт: в `.gitignore`, собирается локально и в CI,
кладётся в релиз. Перед сборкой закрой Foundry (или процесс, держащий `LOCK` пака). Листы
персонажей линкуются на предметы пака (`flags.project-andromeda.libraryItemUuid` =
`Compendium.…`). Применение к кампаниям — **только при смене версии системы** (рефреш) +
одноразовая миграция ссылок. Менял каталог → `npm run build:pack` и перезапусти мир.

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
