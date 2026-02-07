# -*- coding: utf-8 -*-

# Основные правила симуляции (описание для быстрых правок баланса):
# - Бой идёт раундами, максимум DEFAULT_MAX_ROUNDS. В начале раунда оба бойца:
#   сбрасывают действия/реакцию, применяют ДОТ (Bleeding), затем происходит движение.
# - Экономика: ACTIONS_PER_ROUND действий в раунд, одна реакция (REACTION_AVAILABLE_DEFAULT).
# - Движение: melee сокращает дистанцию, ranged отступает при контакте с melee.
#   Могут быть "рывки" с тратой действий для сближения. Дистанция ограничена
#   DISTANCE_MIN..DISTANCE_MAX. С вероятностью OPPORTUNITY_LEAVE_CHANCE возможна
#   реакционная атака при выходе melee из зоны угрозы.
# - Дальность атаки: дистанция должна быть <= range оружия (MELEE_BASE_RANGE /
#   RANGED_BASE_RANGE + Reach X).
# - Бросок атаки: d1..dice. raw_roll используется для Dangerous/Escalation.
#   Модификаторы броска: Accuracy X (+ к броску, но не выше dice),
#   Guarantee X (поднимает бросок до X, кроме случая roll=1),
#   Stabilization X (если не двигался в раунде),
#   Penetration X (bonus = cover bonus if target is in cover and target rank < X).
# - Defense: Magical X multiplies up to X damage by 2.5 (no rounding). Splash multiplies all damage by 1.5.
#   Melee cover adds MELEE_COVER_BONUS.
# - Попадание: total_roll = roll + skill + stabilization + penetration;
#   hit, если total_roll >= defense.
# - Урон: damage = (total_roll - defense) + weapon.damage.
#   При raw_roll == dice добавляется Escalation X. При попадании урон
#   не ниже MIN_HIT_DAMAGE.
# - Burst: вместо одной атаки делает 3 выстрела с помехой (2 куба, выбрать меньший) и тратит 2 действия.
# - Assault: при стрельбе вблизи не провоцирует ответные атаки от melee.
# - Промах: перебросы от Reroll (пока есть). Если всё равно промах и есть
#   Armor Pierce X против ранга <= X, наносится ARMOR_PIERCE_MIN_DAMAGE.
# - Dangerous X: если raw_roll > X, атакующий получает DANGEROUS_SELF_DAMAGE.
# - Risk: при промахе может вызвать реакционную атаку защитника, если есть реакция
#   и он в дальности.
# - Реакции: одна реакция за раунд. Aggressive Fire даёт реакционную атаку
#   после своих действий, если цель в дальности. При стрельбе по melee в зоне
#   его досягаемости melee может ответить реакцией.
# - Статусы: Bleed наносит BLEED_DAMAGE_PER_ROUND в начале раунда; Slow снижает
#   скорость (SLOW_SPEED_MULT) на SLOW_DURATION_ROUNDS; Immobilize запрещает
#   движение на IMMOBILIZE_DURATION_ROUNDS; Stun убирает STUN_ACTION_LOSS действий;
#   Disorienting снимает реакцию. Длительности тикают в конце раунда.
# - Метрики симуляции: action damage считается как урон / потраченные действия
#   (включая перезарядку и рывки). Реакции действия не тратят и в знаменатель
#   не входят. Для control-свойств дополнительно считается damage prevention —
#   снижение урона противника на наши потраченные действия относительно базовой версии.
# - Reload X: после X выстрелов требуется потратить действие на перезарядку.

# Базовые параметры бойца по рангу, от которых строится симуляция.
# dice = базовый куб характеристик, skill = фиксированный бонус навыка,
# hp/defense/speed = базовые хиты/защита/скорость.
# NOTE: Magical X multiplies up to X damage by 2.5 (no rounding) and no longer affects defense.
# NOTE: Splash multiplies all damage by 1.5.
# NOTE: Assault prevents opportunity attacks at close range and stops ranged retreat.
# NOTE: Penetration X applies when target is in cover and target rank < X.
RANK_PARAMS = {
    1: {"dice": 6, "skill": 1, "hp": 15.0, "defense": 4.0, "speed": 6.0},
    2: {"dice": 8, "skill": 3, "hp": 20.0, "defense": 6.0, "speed": 9.0},
    3: {"dice": 10, "skill": 6, "hp": 25.0, "defense": 9.0, "speed": 12.0},
    4: {"dice": 12, "skill": 10, "hp": 30.0, "defense": 13.0, "speed": 15.0},
}

# Базовый урон “голого” оружия по рангу (без свойств).
BASELINE_DAMAGE_BY_RANK = {
    1: 2,
    2: 3,
    3: 5,
    4: 10,
}

# Максимальный допустимый урон оружия по рангу (ограничитель баланса).
MAX_DAMAGE_BY_RANK = {
    1: 4,
    2: 6,
    3: 10,
    4: 20,
}

# Математические и статистические параметры точности.
EPSILON = 1e-6
TARGET_MARGIN = 0.0025
EXTREME_CONFIDENCE = 0.999999

# Ограничения симуляции: максимальные раунды и стартовая дистанция по умолчанию.
DEFAULT_MAX_ROUNDS = 100
DEFAULT_INITIAL_DISTANCE = 25.0

# Экономика хода: сколько действий в раунде и есть ли реакция по умолчанию.
ACTIONS_PER_ROUND = 2
REACTION_AVAILABLE_DEFAULT = True

# Базовые дистанции и модификаторы перемещения.
MELEE_BASE_RANGE = 2.0
RANGED_BASE_RANGE = 100.0
RANGED_RETREAT_SPEED_MULT = 0.5
SLOW_SPEED_MULT = 0.5
DISTANCE_MIN = 0.0
DISTANCE_MAX = 100.0

# Модификаторы защиты / пробития для отдельных механик.
MELEE_COVER_BONUS = 2.0
MAGIC_DAMAGE_MULTIPLIER = 2.5
SPLASH_DAMAGE_MULTIPLIER = 1.5
PENETRATION_BONUS = 2.0

# Минимальные значения урона, чтобы эффекты не “проваливались” в ноль.
MIN_HIT_DAMAGE = 1.0
ARMOR_PIERCE_MIN_DAMAGE = 1.0
DANGEROUS_SELF_DAMAGE = 1.0

# Параметры статусов: урон/длительность/штрафы действий.
BLEED_DAMAGE_PER_ROUND = 1.0
SLOW_DURATION_ROUNDS = 2
IMMOBILIZE_DURATION_ROUNDS = 2
STUN_ACTION_LOSS = 1

# Шанс “уйти от атаки”, когда покидаешь зону угрозы.
OPPORTUNITY_LEAVE_CHANCE = 0.0

# Типы оружия, используемые в симуляции.
WEAPON_TYPES = ("melee", "ranged")

# Список свойств и их тип значения:
# True = флаговое свойство, 1 = свойство с числовым X (значение по умолчанию).
PROPERTY_DEFS = [
    ("Magical", 1),
    ("Splash", True),
    ("Burst", True),
    ("Assault", True),
    ("Armor Pierce X", 1),
    ("Escalation X", 1),
    ("Reload X", 1),
    ("Stabilization X", 1),
    ("Bleed X", 1),
    ("Guarantee X", 1),
    ("Reroll", True),
    ("Aggressive Fire", True),
    ("Concealed", True),
    ("Silent", True),
    ("Stun X", 1),
    ("Slow", True),
    ("Dangerous X", 1),
    ("Risk", True),
    ("Penetration X", 1),
    ("Disorienting", True),
    ("Immobilize X", 1),
    ("Accuracy X", 1),
    ("Reach X", 1),
]

# Свойства, влияющие на действия/контроль противника (для damage prevention).
CONTROL_PROPERTIES = {
    "Stun X",
    "Immobilize X",
    "Slow",
    "Disorienting",
}

SELF_DAMAGE_PROPERTIES = {
    "Dangerous X",
    "Risk",
}

# Ключ свойства, которое даёт перебросы.
REROLL_PROPERTY = "Reroll"

# Свойства, которые требуют отдельного “utility”-действия; заполняется в симуляции.
UTILITY_ACTION_PROPERTIES = {}

# Ограничения свойств по типам оружия.
PROPERTY_WEAPON_RESTRICTIONS = {
    "Reload X": {"ranged"},
    "Stabilization X": {"ranged"},
    "Aggressive Fire": {"ranged"},
    "Burst": {"ranged"},
    "Assault": {"ranged"},
    "Reach X": {"melee"},
}

# Свойства, которые реально моделируются в бою (влияют на исход).
SIMULATED_PROPERTIES = {
    "Magical",
    "Splash",
    "Burst",
    "Assault",
    "Armor Pierce X",
    "Escalation X",
    "Reload X",
    "Stabilization X",
    "Bleed X",
    "Guarantee X",
    "Aggressive Fire",
    "Stun X",
    "Slow",
    "Dangerous X",
    "Risk",
    "Penetration X",
    "Disorienting",
    "Immobilize X",
    "Accuracy X",
    "Reach X",
}

# Весовые коэффициенты вероятности встречи противников по типам.
DEFAULT_OPPONENT_TYPE_WEIGHTS = {
    "melee": 0.40,
    "ranged": 0.60,
}

# Набор сценариев (дистанция x множитель), используемых для усреднения.
DEFAULT_SCENARIO_OPTIONS_DEF = [
    {"name": "mm_1x", "matchup": "mm", "distance_mult": 1.0, "weight": 0.33},
    {"name": "mm_2x", "matchup": "mm", "distance_mult": 2.0, "weight": 0.34},
    {"name": "mm_3x", "matchup": "mm", "distance_mult": 3.0, "weight": 0.33},
    {"name": "rr_1x", "matchup": "rr", "distance_mult": 1.0, "weight": 0.33},
    {"name": "rr_2x", "matchup": "rr", "distance_mult": 2.0, "weight": 0.34},
    {"name": "rr_3x", "matchup": "rr", "distance_mult": 3.0, "weight": 0.33},
    {"name": "mr_1x", "matchup": "mr", "distance_mult": 1.0, "weight": 0.33},
    {"name": "mr_2x", "matchup": "mr", "distance_mult": 2.0, "weight": 0.34},
    {"name": "mr_3x", "matchup": "mr", "distance_mult": 3.0, "weight": 0.33},
]

# Базовые эталонные сценарии для “чистых” сравнений ближнего/дальнего боя.
BASELINE_SCENARIO_DEFS = {
    "melee": {"name": "Baseline melee (close)", "initial_distance": 10.0},
    "ranged": {"name": "Baseline ranged (long)", "initial_distance": 30.0},
}
