import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { getRulebookManifest } from './rulebook.manifest.mjs';
import * as syncBookModule from './sync-book.mjs';

test('skills chapter is generated from the canonical chapter 3 source file', () => {
  const entry = getRulebookManifest().find((item) => item.id === 'rulebook-skills');

  assert.ok(entry);
  assert.equal(entry.type, 'generated');
  assert.equal(entry.source, 'Глава 3. Навыки.md');
  assert.deepEqual(entry.aliases, ['skills-reference']);
});

test('transformSkillsReferenceSource converts the skills source into summary and accordions', () => {
  assert.equal(typeof syncBookModule.transformSkillsReferenceSource, 'function');

  const transformed =
    syncBookModule.transformSkillsReferenceSource(`### Что означают значения навыков

Навыки растут от **0** до **10**.

### Список навыков
#### Навыки Тела

**Мощь**
Описание мощи.

#### Навыки Духа

**Мистика**
Описание мистики.
`);

  assert.match(transformed, /:::summary/);
  assert.match(transformed, /### Что означают значения навыков/);
  assert.match(transformed, /Навыки растут от \*\*0\*\* до \*\*10\*\*\./);
  assert.match(transformed, /^### Навыки Тела$/m);
  assert.match(transformed, /^### Навыки Духа$/m);
  assert.doesNotMatch(transformed, /^## Навыки Тела$/m);
  assert.match(transformed, /:::accordion "Мощь" \| Тело/);
  assert.match(transformed, /:::accordion "Мистика" \| Дух/);
});

test('transformSkillsReferenceSource fails loudly when the skills list heading is missing', () => {
  assert.equal(typeof syncBookModule.transformSkillsReferenceSource, 'function');

  assert.throws(
    () =>
      syncBookModule.transformSkillsReferenceSource(`### Что означают значения навыков

Навыки растут от **0** до **10**.
`),
    /Список навыков/
  );
});

test('extractSkillTitles returns the current public skill list in source order', () => {
  assert.equal(typeof syncBookModule.extractSkillTitles, 'function');

  const extracted = syncBookModule.extractSkillTitles(`### Что означают значения навыков

Навыки растут от **0** до **10**.

### Список навыков
#### Навыки Тела

**Мощь**
Описание мощи.

**Ловкость**
Описание ловкости.

#### Навыки Разума

**Анализ**
Описание анализа.

#### Навыки Духа

**Резонанс**
Описание резонанса.
`);

  assert.deepEqual(extracted, ['Мощь', 'Ловкость', 'Анализ', 'Резонанс']);
});

test('public mirror includes chapter 3 skills for fallback builds without the private docs repo', async () => {
  const mirrorPath = fileURLToPath(
    new URL('../../Книга правил v0.4/Глава 3. Навыки.md', import.meta.url)
  );

  await assert.doesNotReject(() => access(mirrorPath));
});
