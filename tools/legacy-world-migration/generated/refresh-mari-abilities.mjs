// Repeatable world-level refresh for Mari's legacy abilities.
// Dry-run by default. To apply, set:
// globalThis.PROJECT_ANDROMEDA_APPLY_MARI_ABILITY_REFRESH = true

const actorId = 'hDXTJgw3d3VIjktx';
const apply = globalThis.PROJECT_ANDROMEDA_APPLY_MARI_ABILITY_REFRESH === true;

const updates = [
  {
    _id: '44qG2cAUuVih2stK',
    name: 'Боевой купол',
    'system.description':
      'Действием создайте купольный щит вокруг своей позиции. Щит защищает выбранную зону от атак с одного направления, имеет 2 стресса и Защиту 9. Используйте способность дважды за сцену.',
    'system.usageFrequency': 'scene',
    'system.activationCost': 'action',
    'system.activationType': 'action',
    'system.duration': 'untilEndOfScene',
    'system.area': 'zone',
    'system.defense': '',
    'system.range': 'self',
    'system.targets': '',
    'system.requiresRoll': false,
    'system.skill': '',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  },
  {
    _id: '6TQQouvLBE6LEAcC',
    name: 'Зарядка',
    'system.description':
      'Свободным действием восстановите одному из своих силовых щитов половину его текущего стресса, округляя вниз.',
    'system.usageFrequency': 'scene',
    'system.activationCost': 'freeAction',
    'system.activationType': 'freeAction',
    'system.duration': '',
    'system.area': '',
    'system.defense': '',
    'system.range': '',
    'system.targets': 'single',
    'system.requiresRoll': false,
    'system.skill': '',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  },
  {
    _id: '9vEoXJMd5XxuwsH8',
    name: 'Дальний взлом',
    'system.description':
      'Свободным действием подготовьте следующий взлом технического устройства. Его можно провести на расстоянии до 20 × вашего ранга метров, не видя цель. Пока идёт взлом, вы концентрируетесь на процессе.',
    'system.usageFrequency': 'scene',
    'system.activationCost': 'freeAction',
    'system.activationType': 'freeAction',
    'system.duration': '',
    'system.area': '',
    'system.defense': '',
    'system.range': '20 × rank m',
    'system.targets': 'single',
    'system.requiresRoll': false,
    'system.skill': 'khakerstvo',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  },
  {
    _id: 'CI9eUBUOgR7Vt2wE',
    name: 'Помехи',
    'system.description':
      'Действием сделайте проверку Хакерства. На час создайте вокруг себя зону помех радиусом 40 м, которая перемещается вместе с вами. В зоне не работают электронная связь и передача данных; чтобы отправить или принять сообщение, нужно превзойти результат вашей проверки Хакерства.',
    'system.usageFrequency': 'scene',
    'system.activationCost': 'action',
    'system.activationType': 'action',
    'system.duration': '1 hour',
    'system.area': '40 m radius',
    'system.defense': '',
    'system.range': 'self',
    'system.targets': '',
    'system.requiresRoll': true,
    'system.skill': 'khakerstvo',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  },
  {
    _id: 'FlSLtPLpcvaEzvGt',
    name: 'Взлом',
    'system.description':
      'Пассивно: вы можете взламывать технические устройства с расстояния до 500 м и без прямой видимости. Пока идёт взлом, вы концентрируетесь на процессе.',
    'system.usageFrequency': 'passive',
    'system.activationCost': 'passive',
    'system.activationType': 'passive',
    'system.duration': '',
    'system.area': '',
    'system.defense': '',
    'system.range': '500 m',
    'system.targets': 'single',
    'system.requiresRoll': false,
    'system.skill': 'khakerstvo',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  },
  {
    _id: 'GEwUsSFwvYW0D9qR',
    name: 'Силовой заслон',
    'system.description':
      'Свободным действием создайте в пределах 30 м стену силового поля шириной 2 м и высотой 2 м. Стена имеет 6 стресса, Защиту 5 и рассеивается через минуту.',
    'system.usageFrequency': 'scene',
    'system.activationCost': 'freeAction',
    'system.activationType': 'freeAction',
    'system.duration': '1 minute',
    'system.area': '2 × 2 m',
    'system.defense': '',
    'system.range': '30 m',
    'system.targets': '',
    'system.requiresRoll': false,
    'system.skill': '',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  },
  {
    _id: 'Ym6we5XtqCB6Wn2E',
    name: 'Быстрый взлом',
    'system.description':
      'Действием сделайте проверку Хакерства против Контроля технической цели. При успехе отдайте взломанной цели один простой приказ.',
    'system.usageFrequency': 'scene',
    'system.activationCost': 'action',
    'system.activationType': 'action',
    'system.duration': '',
    'system.area': '',
    'system.defense': 'control',
    'system.range': '',
    'system.targets': 'single',
    'system.requiresRoll': true,
    'system.skill': 'khakerstvo',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  },
  {
    _id: 'cRTW1uBGHBZAcPuI',
    name: 'Отражающий щит',
    'system.description':
      'Реакцией создайте вокруг цели в пределах 30 м отражающий щит на минуту. Щит имеет 7 Защиты и 20 стресса. Когда щит атакуют, он наносит атакующему 3 урона.',
    'system.usageFrequency': 'scene',
    'system.activationCost': 'reaction',
    'system.activationType': 'reaction',
    'system.duration': '1 minute',
    'system.area': '',
    'system.defense': '',
    'system.range': '30 m',
    'system.targets': 'single',
    'system.requiresRoll': false,
    'system.skill': '',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  },
  {
    _id: 'jmaBXH8AGNwEldIj',
    name: 'Обнаружение техники',
    'system.description':
      'Свободным действием определите все электронные устройства в радиусе 20 × вашего ранга метров.',
    'system.usageFrequency': 'scene',
    'system.activationCost': 'freeAction',
    'system.activationType': 'freeAction',
    'system.duration': 'untilStartOfYourNextTurn',
    'system.area': '20 × rank m radius',
    'system.defense': '',
    'system.range': 'self',
    'system.targets': '',
    'system.requiresRoll': false,
    'system.skill': '',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  },
  {
    _id: 'lzv9QvFukjYCpFCM',
    name: 'Программируя реальность',
    'system.description':
      'Действием на минуту получите возможность манипулировать предметом массой до 3 кг в пределах 30 м: двигать его, переключать, активировать или выполнять похожее простое действие. Если предмет удерживают или контролируют, сделайте проверку Мощи против сложности, выбранной ведущим.',
    'system.usageFrequency': 'scene',
    'system.activationCost': 'action',
    'system.activationType': 'action',
    'system.duration': '1 minute',
    'system.area': '',
    'system.defense': '',
    'system.range': '30 m',
    'system.targets': 'single',
    'system.requiresRoll': false,
    'system.skill': 'moshch',
    'system.skillBonus': '0/0/0/0',
    'system.stepEffects': []
  }
];

const actor = game.actors.get(actorId);
if (!game.user?.isGM) throw new Error('Обновить способности может только GM.');
if (!actor) throw new Error(`Не найдена Мари: ${actorId}`);

const missing = updates
  .filter((update) => !actor.items.get(update._id))
  .map((update) => update.name);
const report = {
  apply,
  actor: actor.name,
  abilities: updates.map((update) => update.name),
  missing,
  ready: missing.length === 0
};

if (!apply || !report.ready) {
  console.table(
    updates.map(
      ({
        _id,
        name,
        'system.activationCost': activation,
        'system.skill': skill,
        'system.usageFrequency': frequency,
        'system.requiresRoll': requiresRoll
      }) => ({ _id, name, activation, frequency, skill, requiresRoll })
    )
  );
  console.log('Mari ability refresh dry-run', report);
  ui.notifications[report.ready ? 'info' : 'error'](
    report.ready
      ? 'Проверка обновления способностей Мари прошла: изменения не применены.'
      : 'Проверка обновления Мари нашла отсутствующие способности. Смотрите консоль.'
  );
} else {
  await actor.updateEmbeddedDocuments('Item', updates, { render: false });
  actor.prepareData();
  console.log('Mari ability refresh applied', report);
  ui.notifications.info('Способности Мари обновлены.');
}

report;
