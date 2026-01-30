"""
Weapons Simulator for Andromeda TTRPG
Baseline-vs-baseline scenarios with distance and optional ranged retreat
"""

import random
import math
import concurrent.futures
import locale
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Set, Tuple, Optional
import statistics
import importlib

import base_values
from sim_accel import (
    NUMBA_AVAILABLE,
    PARALLEL_MIN_SIMULATIONS,
    PROP_ACCURACY,
    PROP_AGGRESSIVE,
    PROP_APPLY_SLOW,
    PROP_PENETRATION,
    PROP_BLEED,
    PROP_COUNT,
    PROP_DANGEROUS,
    PROP_DAMAGE,
    PROP_DISORIENT,
    PROP_ESCALATION,
    PROP_GUARANTEE,
    PROP_IMMOBILIZE,
    PROP_RELOAD,
    PROP_REROLLS,
    PROP_RISK,
    PROP_STABILIZATION,
    PROP_STUN,    
    PROP_TYPE,
    PROP_MAGIC,
    BatchTask,
    SimulationPool,
    acquire_executor,
    batch_map,
    build_simulation_chunks,
    fast_matchup_chunk,
    full_matchup_chunk,
)

# ============================================================================
# CONSTANTS
# ============================================================================

RANK_PARAMS = {
    1: {"dice": 6, "skill": 1, "hp": 15, "defense": 5, "speed": 6},
    2: {"dice": 8, "skill": 3, "hp": 20, "defense": 7, "speed": 9},
    3: {"dice": 10, "skill": 6, "hp": 25, "defense": 11, "speed": 12},
    4: {"dice": 12, "skill": 10, "hp": 30, "defense": 15, "speed": 15},
}

BASELINE_DAMAGE_BY_RANK = {
    1: 2,
    2: 3,
    3: 5,
    4: 10,
}

MAX_DAMAGE_BY_RANK = {
    1: 4,
    2: 6,
    3: 10,
    4: 20,
}

EPSILON = 1e-6
TARGET_MARGIN = 0.0025  # +/- 0.25% absolute win-rate error
EXTREME_CONFIDENCE = 0.999999  # "once in 1,000,000 runs" two-sided

BASE_VALUES_PATH = Path(__file__).with_name("base_values.py")
PROPERTY_VALUES_PATH = Path(__file__).with_name("property_values.py")
PROPERTY_COMBOS_PATH = Path(__file__).with_name("property_combos.py")
PROPERTY_MATCHUPS_PATH = Path(__file__).with_name("property_matchups.py")

DEFAULT_MAX_ROUNDS = 100
DEFAULT_MAX_RETREAT_ROUNDS = 5

PROPERTY_DEFS = [
    ("Ближний бой", True),
    ("Магическое", True),
    ("Бронебойность X", 1),
    ("Эскалация X", 1),
    ("Перезарядка X", 1),
    ("Стабилизация X", 1),
    ("Кровотечение X", 1),
    ("Гарант X", 1),
    ("Переброс", True),
    ("Агрессивный обстрел", True),
    ("Ошеломление X", 1),
    ("Замедление", True),
    ("Опасное X", 1),
    ("Риск", True),
    ("Пробивание X", 1),
    ("Дезориентирующее", True),
    ("Обездвиживание X", 1),
    ("Точность X", 1),
    ("Досягаемость X", 1),
]


MELEE_PROPERTY = "Ближний бой"
REROLL_PROPERTY = "Переброс"

UTILITY_ACTION_PROPERTIES = {}

SIMULATED_PROPERTIES = {
    "Ближний бой",
    "Замедление",
    "Бронебойность X",
    "Эскалация X",
    "Перезарядка X",
    "Стабилизация X",
    "Кровотечение X",
    "Гарант X",
    "Агрессивный обстрел",
    "Ошеломление X",
    "Магическое",
    "Опасное X",
    "Риск",
    "Пробивание X",
    "Дезориентирующее",
    "Обездвиживание X",
    "Точность X",
    "Досягаемость X"
}

# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class Weapon:
    """Represents a weapon with properties"""
    name: str
    damage: int
    weapon_type: str  # "melee" or "ranged"
    properties: Dict[str, any] = field(default_factory=dict)
    rank: int = 1
    
    def __post_init__(self):
        """Validate weapon data"""
        assert self.weapon_type in ["melee", "ranged"], "Invalid weapon type"
        assert 1 <= self.rank <= 4, "Invalid rank (1-4)"
    
    def get_range(self) -> float:
        """Get effective range of weapon in meters"""
        base_range = 2.0 if self.weapon_type == "melee" else 100.0
        range_bonus = self.properties.get("Досягаемость X", 0)
        return base_range + range_bonus


@dataclass
class Character:
    """Represents a character in combat"""
    name: str
    rank: int
    weapon: Weapon
    hp: int = None
    max_hp: int = None
    defense: int = None
    dice: int = None
    skill: int = None
    speed: int = None
    position: float = 0.0
    actions_remaining: int = 2
    reaction_remaining: bool = True
    moved_this_round: bool = False
    shots_fired_since_reload: int = 0
    reload_required: bool = False
    aggressive_fire_pending: bool = False
    status_effects: Dict[str, int] = field(default_factory=dict)
    utility_actions_used: Set[str] = field(default_factory=set)
    retreat_rounds_used: int = 0  # how many rounds this character has retreated (ranged only)
    
    def __post_init__(self):
        """Initialize character stats from rank"""
        params = RANK_PARAMS[self.rank]
        self.hp = self.max_hp = params["hp"]
        self.defense = params["defense"]
        self.dice = params["dice"]
        self.skill = params["skill"]
        self.speed = params["speed"]

    def reset_for_combat(self):
        """Reset per-combat state for reuse."""
        self.hp = self.max_hp
        self.actions_remaining = 2
        self.reaction_remaining = True
        self.moved_this_round = False
        self.shots_fired_since_reload = 0
        self.reload_required = False
        self.aggressive_fire_pending = False
        self.status_effects.clear()
        self.utility_actions_used.clear()
        self.retreat_rounds_used = 0
        self.position = 0.0

    def is_alive(self) -> bool:
        """Check if character is still alive"""
        return self.hp > 0
    
    def take_damage(self, damage: int):
        """Apply damage to character"""
        self.hp = max(0, self.hp - damage)
    
    def reset_round(self):
        """Reset round-based resources"""
        self.actions_remaining = 2
        self.reaction_remaining = True
        self.moved_this_round = False
        self.aggressive_fire_pending = False
        self.utility_actions_used.clear()
        
        # Apply ДОТ effects at start of round
        if "Кровотечение" in self.status_effects:
            self.take_damage(1)
    
    def end_round(self):
        """Handle end-of-round status effect ticks"""
        # Decrease remaining durations
        expired = []
        for effect in list(self.status_effects.keys()):
            self.status_effects[effect] -= 1
            if self.status_effects[effect] <= 0:
                expired.append(effect)
        
        for effect in expired:
            del self.status_effects[effect]


# ============================================================================
# COMBAT MECHANICS
# ============================================================================

class CombatSimulator:
    """Handles combat simulation between two characters"""
    
    def __init__(
        self,
        attacker: Character,
        defender: Character,
        max_rounds: int = 100,
        verbose: bool = False,
        initial_distance: float = 25.0,
        allow_ranged_retreat: bool = True,
        max_retreat_rounds: int = 5,
    ):
        self.attacker = attacker
        self.defender = defender
        # Reset per-combat counters
        self.attacker.retreat_rounds_used = 0
        self.defender.retreat_rounds_used = 0
        self.max_rounds = max_rounds
        self.round_count = 0
        self.verbose = verbose
        self.combat_log = []
        self.initial_distance = float(initial_distance)
        self.distance = float(initial_distance)  # meters between characters
        self.allow_ranged_retreat = allow_ranged_retreat
        self.max_retreat_rounds = max_retreat_rounds

    def reset_combat(self):
        """Reset per-combat state so simulator can be reused."""
        self.round_count = 0
        self.combat_log = []
        self.distance = float(self.initial_distance)
        self.attacker.reset_for_combat()
        self.defender.reset_for_combat()
    
    def can_attack(self, attacker: Character, defender: Character) -> bool:
        """Check if attacker can reach defender"""
        weapon_range = attacker.weapon.get_range()
        return self.distance <= weapon_range

    def should_use_utility_action(self, attacker: Character, defender: Character, prop_name: str) -> bool:
        """Decide whether to use a non-damaging utility action instead of a normal attack."""
        if prop_name not in UTILITY_ACTION_PROPERTIES:
            return False
        if attacker.actions_remaining <= 1:
            return False
        if prop_name in attacker.utility_actions_used:
            return False
        if not self.can_attack(attacker, defender):
            return False

        config = UTILITY_ACTION_PROPERTIES[prop_name]
        status = config.get("status")
        if status and status in defender.status_effects:
            return False
        if config.get("requires_target_melee") and defender.weapon.weapon_type != "melee":
            return False
        if status == "Замедлен" and "Обездвижен" in defender.status_effects:
            return False

        return True

    def apply_utility_action(self, attacker: Character, defender: Character, prop_name: str):
        """Apply a utility action effect and mark it as used this round."""
        config = UTILITY_ACTION_PROPERTIES[prop_name]
        status = config.get("status")
        duration = config.get("duration", 1)
        if status:
            defender.status_effects[status] = max(defender.status_effects.get(status, 0), duration)

        if self.verbose:
            log_text = config.get("log", "использует спецдействие")
            self.combat_log.append(
                f"Round {self.round_count}: {attacker.name} {log_text}"
            )

        self.record_shot(attacker)
        attacker.utility_actions_used.add(prop_name)
    
    def handle_movement(self, attacker: Character, defender: Character):
        """
        Handle movement at start of round.
        Movement is symmetric and depends on weapon types, not roles.

        Status effects:
        - "Обездвижен": cannot move
        - "Замедлен": speed reduced by 50%
        """
        def effective_speed(ch: Character) -> float:
            if "Обездвижен" in ch.status_effects:
                return 0.0
            spd = float(ch.speed)
            if "Замедлен" in ch.status_effects:
                spd *= 0.5
            return spd

        attacker_range = attacker.weapon.get_range()
        defender_range = defender.weapon.get_range()

        melee_close = 0.0
        ranged_retreat = 0.0

        # Melee characters close distance if out of range
        if attacker.weapon.weapon_type == "melee" and self.distance > attacker_range:
            movement = effective_speed(attacker)
            if movement > 0:
                attacker.moved_this_round = True
                melee_close += movement

        if defender.weapon.weapon_type == "melee" and self.distance > defender_range:
            movement = effective_speed(defender)
            if movement > 0:
                defender.moved_this_round = True
                melee_close += movement

        # Ranged characters retreat if fighting melee (optional)
        if self.allow_ranged_retreat:
            if attacker.weapon.weapon_type == "ranged" and defender.weapon.weapon_type == "melee":
                if self.distance < attacker_range and attacker.retreat_rounds_used < self.max_retreat_rounds:
                    movement = effective_speed(attacker) / 2.0
                    if movement > 0:
                        attacker.moved_this_round = True
                        ranged_retreat += movement
                        attacker.retreat_rounds_used += 1

            if defender.weapon.weapon_type == "ranged" and attacker.weapon.weapon_type == "melee":
                if self.distance < defender_range and defender.retreat_rounds_used < self.max_retreat_rounds:
                    movement = effective_speed(defender) / 2.0
                    if movement > 0:
                        defender.moved_this_round = True
                        ranged_retreat += movement
                        defender.retreat_rounds_used += 1

        # Apply net distance change (close reduces, retreat increases)
        if melee_close or ranged_retreat:
            self.distance = max(0.0, min(100.0, self.distance - melee_close + ranged_retreat))

    def roll_attack(self, attacker: Character, defender: Character) -> Tuple[int, int, bool]:
        """
        Roll attack and determine hit.
        Returns: (roll_result, damage, hit_bool)
        """
        # Check if in range
        if not self.can_attack(attacker, defender):
            if self.verbose:
                self.combat_log.append(
                    f"Round {self.round_count}: {attacker.name} cannot reach (distance: {self.distance:.1f}m)"
                )
            return 0, 0, False
        
        stabilization_bonus = 0
        if "Стабилизация X" in attacker.weapon.properties and not attacker.moved_this_round:
            stabilization_bonus = attacker.weapon.properties["Стабилизация X"]
        penetration_bonus = 1 if "Пробивание X" in attacker.weapon.properties else 0

        defense_value = float(defender.defense)
        if "Магическое" in attacker.weapon.properties:
            defense_value = round(defense_value / 3.0, 1)

        def evaluate_roll() -> Tuple[int, bool, int]:
            roll_value = random.randint(1, attacker.dice)
            raw_roll = roll_value

            if "Опасное X" in attacker.weapon.properties:
                danger_threshold = attacker.weapon.properties["Опасное X"]
                if raw_roll > danger_threshold:
                    attacker.take_damage(1)

            if "Точность X" in attacker.weapon.properties:
                accuracy_bonus = attacker.weapon.properties["Точность X"]
                roll_value = min(roll_value + accuracy_bonus, attacker.dice)

            if "Гарант X" in attacker.weapon.properties:
                guarantee = attacker.weapon.properties["Гарант X"]
                if roll_value != 1:  # Except 1
                    roll_value = max(roll_value, guarantee)

            total_roll = roll_value + attacker.skill + stabilization_bonus + penetration_bonus
            hit_value = total_roll >= defense_value

            damage_value = 0
            if hit_value:
                margin = total_roll - defense_value
                damage_value = margin + attacker.weapon.damage
                if raw_roll == attacker.dice and "Эскалация X" in attacker.weapon.properties:
                    escalation_value = attacker.weapon.properties["Эскалация X"]
                    damage_value += escalation_value

            return roll_value, hit_value, damage_value

        roll, hit, damage = evaluate_roll()

        if not hit:
            damage = 0
            rerolls = attacker.weapon.properties.get("Переброс", 0)
            if rerolls is True:
                rerolls = 1
            try:
                rerolls = int(rerolls)
            except (TypeError, ValueError):
                rerolls = 0

            for _ in range(rerolls):
                roll, hit, reroll_damage = evaluate_roll()
                if hit:
                    damage = reroll_damage
                    break

            if (not hit) and ("Бронебойность X" in attacker.weapon.properties):
                max_rank = attacker.weapon.properties["Бронебойность X"]
                if defender.rank <= max_rank:
                    damage = max(damage, 1)

        damage = max(1, damage) if hit else damage

        return roll, damage, hit
    
    def record_shot(self, attacker: Character):
        """Track shots for Перезарядка"""
        reload_after = attacker.weapon.properties.get("Перезарядка X")
        if not reload_after:
            return
        attacker.shots_fired_since_reload += 1
        if attacker.shots_fired_since_reload >= reload_after:
            attacker.reload_required = True
    
    def perform_reaction_attack(self, attacker: Character, defender: Character) -> bool:
        """Perform a reaction attack without spending actions."""
        if "Перезарядка X" in attacker.weapon.properties and attacker.reload_required:
            return False
        
        roll, damage, hit = self.roll_attack(attacker, defender)
        shot_fired = roll > 0
        
        if hit:
            defender.take_damage(damage)
            self.apply_status_effects(attacker, defender, hit)
            if self.verbose:
                self.combat_log.append(
                    f"Round {self.round_count}: {attacker.name} реакцией наносит {damage} урона"
                )
        else:
            if self.verbose:
                self.combat_log.append(
                    f"Round {self.round_count}: {attacker.name} реакцией промахивается"
                )
        
        if shot_fired:
            self.record_shot(attacker)
        
        return hit
    
    def apply_status_effects(self, attacker: Character, defender: Character, hit: bool):
        """Apply status effects from weapon properties"""
        if not hit:
            return
        
        # ДОТ effects (apply for X rounds)
        if "Кровотечение X" in attacker.weapon.properties:
            duration = attacker.weapon.properties["Кровотечение X"]
            defender.status_effects["Кровотечение"] = max(
                defender.status_effects.get("Кровотечение", 0),
                duration,
            )
        
        # Замедление (next round speed -50%)
        if "Замедление" in attacker.weapon.properties:
            defender.status_effects["Замедлен"] = max(
                defender.status_effects.get("Замедлен", 0),
                2,
            )
        
        # Дезориентирующее (lose reaction)
        if "Дезориентирующее" in attacker.weapon.properties:
            defender.reaction_remaining = False
        
        # Обездвиживание (can't move for X rounds)
        if "Обездвиживание X" in attacker.weapon.properties:
            max_rank = attacker.weapon.properties["Обездвиживание X"]
            if defender.rank <= max_rank:
                defender.status_effects["Обездвижен"] = max(
                    defender.status_effects.get("Обездвижен", 0),
                    2,
                )
        
        # Ошеломление (lose action)
        if "Ошеломление X" in attacker.weapon.properties:
            max_rank = attacker.weapon.properties["Ошеломление X"]
            if defender.rank <= max_rank:
                defender.actions_remaining = max(0, defender.actions_remaining - 1)
    
    def perform_attack(self, attacker: Character, defender: Character) -> bool:
        """Perform a single attack. Returns True if hit."""
        if attacker.actions_remaining <= 0:
            return False
        
        if "Перезарядка X" in attacker.weapon.properties and attacker.reload_required:
            attacker.actions_remaining -= 1
            attacker.reload_required = False
            attacker.shots_fired_since_reload = 0
            return False
        
        roll, damage, hit = self.roll_attack(attacker, defender)
        shot_fired = roll > 0
        
        if hit:
            defender.take_damage(damage)
            self.apply_status_effects(attacker, defender, hit)
            if self.verbose:
                self.combat_log.append(
                    f"Round {self.round_count}: {attacker.name} hits for {damage} damage"
                )
        else:
            if damage > 0:
                defender.take_damage(damage)
                if self.verbose:
                    self.combat_log.append(
                        f"Round {self.round_count}: {attacker.name} misses, but бронебойность наносит {damage} урона"
                    )
            else:
                if self.verbose:
                    self.combat_log.append(
                        f"Round {self.round_count}: {attacker.name} misses"
                    )
            
            if shot_fired and "Риск" in attacker.weapon.properties:
                if defender.reaction_remaining and self.can_attack(defender, attacker):
                    defender.reaction_remaining = False
                    self.perform_reaction_attack(defender, attacker)
                    if not attacker.is_alive():
                        return False
        
        if shot_fired:
            self.record_shot(attacker)
        
        attacker.actions_remaining -= 1
        return hit

    def simulate_round(self) -> bool:
        """
        Simulate one round of combat.
        Returns True if combat continues, False if one character is dead.
        """
        self.round_count += 1
        
        # Both characters reset for round
        self.attacker.reset_round()
        self.defender.reset_round()
        
        if not self.attacker.is_alive() or not self.defender.is_alive():
            return False
        
        # Handle movement at start of round
        self.handle_movement(self.attacker, self.defender)
        
        # Attacker acts first (up to 2 actions)
        while (
            self.attacker.actions_remaining > 0
            and self.attacker.is_alive()
            and self.defender.is_alive()
        ):
            self.perform_attack(self.attacker, self.defender)

        if not self.defender.is_alive():
            return False

        # Defender acts if alive (up to 2 actions)
        while (
            self.defender.actions_remaining > 0
            and self.attacker.is_alive()
            and self.defender.is_alive()
        ):
            self.perform_attack(self.defender, self.attacker)

        if not self.attacker.is_alive():
            return False

        # Check if anyone is dead
        if not self.attacker.is_alive() or not self.defender.is_alive():
            return False
        
        # End-of-round status effect ticks
        self.attacker.end_round()
        self.defender.end_round()
        
        return True
    
    def run_combat(self) -> Dict:
        """Run full combat simulation until one character dies."""
        while self.round_count < self.max_rounds:
            if not self.simulate_round():
                break
        
        # Determine winner
        attacker_wins = self.defender.hp <= 0
        
        result = {
            "attacker_wins": attacker_wins,
            "rounds": self.round_count,
            "attacker_final_hp": self.attacker.hp,
            "defender_final_hp": self.defender.hp,
        }
        
        return result


# ============================================================================
# SCENARIO TESTING
# ============================================================================

@dataclass(frozen=True)
class Scenario:
    """Defines a distance + movement configuration."""
    name: str
    initial_distance: float
    allow_ranged_retreat: bool


def build_weapons(rank: int, x_value: int, rerolls: int) -> List[Weapon]:
    """Create weapon list for future property tests and baseline extraction."""
    weapons: List[Weapon] = []

    for wtype in ("melee", "ranged"):
        for damage in (1, 2, 3):
            weapon_name = f"{wtype.upper()} | DMG {damage} | NO PROPS"
            weapons.append(
                Weapon(
                    name=weapon_name,
                    damage=damage,
                    weapon_type=wtype,
                    properties={},
                    rank=rank,
                )
            )

    for prop_name, prop_value in PROPERTY_DEFS:
        if prop_name == "Переброс":
            continue
        prop_setting = x_value if isinstance(prop_value, int) else prop_value
        props = {prop_name: prop_setting}
        if rerolls:
            props["Переброс"] = rerolls
        weapon_type = "melee" if prop_name == "Ближний бой" else "ranged"
        weapon_name = f"{weapon_type.upper()} | {prop_name} | DMG 1"
        weapons.append(
            Weapon(
                name=weapon_name,
                damage=1,
                weapon_type=weapon_type,
                properties=props,
                rank=rank,
            )
        )
    return weapons


def pick_baseline_weapons(weapons: List[Weapon]) -> Dict[str, Weapon]:
    """Return baseline weapons (damage 1, no properties) for melee and ranged."""
    baseline: Dict[str, Weapon] = {}
    for weapon in weapons:
        if weapon.damage == 1 and not weapon.properties:
            baseline[weapon.weapon_type] = weapon

    if "melee" not in baseline or "ranged" not in baseline:
        raise ValueError("Baseline weapons not found in list.")
    return baseline


def get_simple_weapon(
    weapons_list: List[Weapon],
    weapon_type: str,
    damage: int,
    rank: int,
) -> Weapon:
    for weapon in weapons_list:
        if (
            weapon.weapon_type == weapon_type
            and weapon.damage == damage
            and not weapon.properties
        ):
            return weapon
    weapon_name = f"{weapon_type.upper()} | DMG {damage} | NO PROPS"
    return Weapon(
        name=weapon_name,
        damage=damage,
        weapon_type=weapon_type,
        properties={},
        rank=rank,
    )


def get_damage_values_for_rank(rank: int) -> List[int]:
    max_damage = MAX_DAMAGE_BY_RANK[rank]
    return list(range(0, max_damage + 1))


def format_property(prop_name: str, prop_value: object) -> str:
    if prop_value is True:
        return prop_name
    return f"{prop_name} {prop_value}"


def format_weapon_description(weapon: Weapon) -> str:
    range_value = weapon.get_range()
    if weapon.properties:
        props = ", ".join(
            format_property(prop_name, prop_value)
            for prop_name, prop_value in weapon.properties.items()
        )
    else:
        props = "none"

    return (
        f"{weapon.weapon_type.upper()} | DMG {weapon.damage} | "
        f"Range {range_value:.1f} | Props: {props}"
    )


def normalize_int(value: object) -> int:
    if value is True:
        return 1
    if value in (None, False):
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def build_weapon_props_array(weapon: Weapon) -> Tuple[List[int], float]:
    props = [0] * PROP_COUNT
    props[PROP_TYPE] = 0 if weapon.weapon_type == "melee" else 1
    props[PROP_DAMAGE] = int(weapon.damage)
    props[PROP_PENETRATION] = 1 if "Пробивание X" in weapon.properties else 0
    props[PROP_ESCALATION] = normalize_int(weapon.properties.get("Эскалация X"))
    props[PROP_RELOAD] = normalize_int(weapon.properties.get("Перезарядка X"))
    props[PROP_STABILIZATION] = normalize_int(
        weapon.properties.get("Стабилизация X")
    )
    props[PROP_ACCURACY] = normalize_int(weapon.properties.get("Точность X"))
    props[PROP_GUARANTEE] = normalize_int(weapon.properties.get("Гарант X"))
    props[PROP_STUN] = normalize_int(weapon.properties.get("Ошеломление X"))
    props[PROP_APPLY_SLOW] = 1 if "Замедление" in weapon.properties else 0
    props[PROP_DANGEROUS] = normalize_int(weapon.properties.get("Опасное X"))
    props[PROP_RISK] = 1 if "Риск" in weapon.properties else 0
    props[PROP_AGGRESSIVE] = 1 if "Агрессивный обстрел" in weapon.properties else 0
    props[PROP_BLEED] = normalize_int(weapon.properties.get("Кровотечение X"))
    props[PROP_DISORIENT] = 1 if "Дезориентирующее" in weapon.properties else 0
    props[PROP_IMMOBILIZE] = normalize_int(
        weapon.properties.get("Обездвиживание X")
    )
    props[PROP_MAGIC] = 1 if "Магическое" in weapon.properties else 0
    props[PROP_REROLLS] = normalize_int(weapon.properties.get("Переброс"))

    return props, weapon.get_range()


def build_matchup_props(
    weapon1: Weapon,
    weapon2: Weapon,
) -> Tuple[List[List[int]], List[float]]:
    props1, range1 = build_weapon_props_array(weapon1)
    props2, range2 = build_weapon_props_array(weapon2)
    return [props1, props2], [range1, range2]


def safe_mean(values: List[int]) -> float:
    return statistics.mean(values) if values else 0.0


def round_to_half_percent(rate: float) -> float:
    return round(rate / 0.005) * 0.005


def format_rate(rate: float) -> str:
    text = f"{rate:.3f}"
    return text.rstrip("0").rstrip(".")


def format_cost(value: float) -> str:
    text = f"{value:.2f}"
    return "0.00" if text == "-0.00" else text


def format_delta(value: Optional[float]) -> str:
    if value is None:
        return "None"
    return format_rate(value)


def normalize_property_entry(entry: object) -> Dict[str, Optional[float]]:
    if isinstance(entry, dict):
        cost_raw = entry.get("cost", 0.0)
        try:
            cost_value = float(cost_raw)
        except (TypeError, ValueError):
            cost_value = 0.0
        delta_raw = entry.get("delta_win_rate")
        if delta_raw is None:
            delta_value = None
        else:
            try:
                delta_value = float(delta_raw)
            except (TypeError, ValueError):
                delta_value = None
        return {"cost": cost_value, "delta_win_rate": delta_value}
    try:
        cost_value = float(entry)
    except (TypeError, ValueError):
        cost_value = 0.0
    return {"cost": cost_value, "delta_win_rate": None}


def clamp_prob(value: float, eps: float = EPSILON) -> float:
    return min(max(value, eps), 1 - eps)


def required_simulations_for_accuracy(
    margin: float = 0.0025,
    confidence: float = 0.99,
    win_rate: float = 0.5,
) -> int:
    """
    Return required simulations for a two-sided binomial proportion CI.
    Uses a normal approximation; win_rate defaults to 0.5 (worst-case variance).
    """
    if not 0 < margin < 1:
        raise ValueError("margin must be between 0 and 1.")
    if not 0 < confidence < 1:
        raise ValueError("confidence must be between 0 and 1.")

    win_rate = clamp_prob(win_rate)
    z = statistics.NormalDist().inv_cdf(1 - (1 - confidence) / 2)
    n = (z * z) * (win_rate * (1 - win_rate)) / (margin * margin)
    return max(1, math.ceil(n))


def error_margin_for_simulations(
    simulations: int,
    confidence: float,
    win_rate: float = 0.5,
) -> float:
    """Estimate absolute error margin for a given simulations count."""
    if simulations <= 0:
        raise ValueError("simulations must be positive.")
    if not 0 < confidence < 1:
        raise ValueError("confidence must be between 0 and 1.")
    win_rate = clamp_prob(win_rate)
    z = statistics.NormalDist().inv_cdf(1 - (1 - confidence) / 2)
    return z * math.sqrt((win_rate * (1 - win_rate)) / simulations)


def logit(value: float) -> float:
    value = clamp_prob(value)
    return math.log(value / (1 - value))


def build_logit_calibration(
    baseline_win_rate: float,
    damage_deltas: Dict[int, float],
    baseline_damage: int,
) -> Dict[int, float]:
    base_logit = logit(baseline_win_rate)
    calibration: Dict[int, float] = {0: 0.0}
    for damage_value, diff_rate in damage_deltas.items():
        try:
            damage_int = int(damage_value)
        except (TypeError, ValueError):
            continue
        w_value = clamp_prob(baseline_win_rate + diff_rate)
        calibration[damage_int - baseline_damage] = logit(w_value) - base_logit
    return calibration


def interpolate_linear(
    k1: float,
    d1: float,
    k2: float,
    d2: float,
    target_delta: float,
) -> float:
    if d2 == d1:
        return float(k1)
    return k1 + (k2 - k1) * (target_delta - d1) / (d2 - d1)


def interpolate_damage_equivalent(
    delta_logit: float,
    calibration: Dict[int, float],
) -> float:
    # calibration: {delta_damage_from_baseline: delta_logit}
    if abs(delta_logit) < 1e-12:
        return 0.0

    points = [(k, d) for k, d in calibration.items()]
    if not points:
        return 0.0

    # ensure (0, 0) exists
    if 0 not in calibration:
        points.append((0, 0.0))

    # sort by delta_logit (d)
    points.sort(key=lambda item: item[1])

    # if target outside, extrapolate using nearest segment
    if delta_logit <= points[0][1]:
        if len(points) == 1:
            return float(points[0][0])
        (k1, d1), (k2, d2) = points[0], points[1]
        return interpolate_linear(k1, d1, k2, d2, delta_logit)

    if delta_logit >= points[-1][1]:
        if len(points) == 1:
            return float(points[-1][0])
        (k1, d1), (k2, d2) = points[-2], points[-1]
        return interpolate_linear(k1, d1, k2, d2, delta_logit)

    # find bracketing interval
    for (k1, d1), (k2, d2) in zip(points, points[1:]):
        if d1 <= delta_logit <= d2:
            return interpolate_linear(k1, d1, k2, d2, delta_logit)

    return float(points[-1][0])


def should_show_progress(simulations: int, show_progress: bool) -> bool:
    return show_progress and simulations >= 2000


def progress_interval(simulations: int, steps: int = 10) -> int:
    return max(simulations // steps, 1)


def print_progress(label: str, current: int, total: int):
    percent = int(current * 100 / total)
    print(f"\r{label} {percent:>3d}% ({current}/{total})", end="")
    if current >= total:
        print()


def load_base_values() -> Dict[int, Dict[str, object]]:
    try:
        importlib.reload(base_values)
        values = getattr(base_values, "BASE_VALUES", {})
        return {int(k): dict(v) for k, v in values.items()}
    except Exception:
        return {}


def write_base_values(values: Dict[int, Dict[str, object]]):
    lines = ["# -*- coding: utf-8 -*-", "BASE_VALUES = {"]
    for rank in sorted(values.keys()):
        rank_values = values[rank]
        rank_field = rank_values.get("rank", rank)
        baseline_rate = format_rate(rank_values["baseline_win_rate"])
        damage_rates = rank_values.get("damage_win_rate", {})

        lines.append(f"    {rank}: {{")
        lines.append(f'        "rank": {rank_field},')
        lines.append(f'        "baseline_win_rate": {baseline_rate},')
        lines.append('        "damage_win_rate": {')
        for damage_key in sorted(damage_rates.keys()):
            rate_text = format_rate(damage_rates[damage_key])
            lines.append(f"            {damage_key}: {rate_text},")
        lines.append("        },")
        lines.append("    },")
    lines.append("}")

    BASE_VALUES_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_property_values() -> Dict[int, Dict[str, object]]:
    try:
        module = importlib.import_module("property_values")
        importlib.reload(module)
        values = getattr(module, "PROPERTY_VALUES", {})
        normalized: Dict[int, Dict[str, object]] = {}
        for key, rank_values in values.items():
            rank = int(key)
            rank_data = dict(rank_values)
            property_costs = rank_data.get("property_costs") or {}
            normalized_costs: Dict[str, Dict[str, Optional[float]]] = {}
            for prop_name, entry in property_costs.items():
                normalized_costs[prop_name] = normalize_property_entry(entry)
            rank_data["property_costs"] = normalized_costs
            normalized[rank] = rank_data
        return normalized
    except Exception:
        return {}


def write_property_values(values: Dict[int, Dict[str, object]]):
    lines = ["# -*- coding: utf-8 -*-", "PROPERTY_VALUES = {"]
    for rank in sorted(values.keys()):
        rank_values = values[rank]
        rank_field = rank_values.get("rank", rank)
        property_costs = rank_values.get("property_costs") or {}

        lines.append(f"    {rank}: {{")
        lines.append(f'        "rank": {rank_field},')
        lines.append('        "property_costs": {')
        ordered_keys: List[str] = []
        property_order = [
            prop_name for prop_name, _ in PROPERTY_DEFS if prop_name != "Переброс"
        ]
        for prop_name in property_order:
            if prop_name in property_costs:
                ordered_keys.append(prop_name)
        for prop_name in sorted(property_costs.keys()):
            if prop_name not in ordered_keys:
                ordered_keys.append(prop_name)
        for prop_name in ordered_keys:
            entry = normalize_property_entry(property_costs[prop_name])
            cost_text = format_cost(entry["cost"] or 0.0)
            delta_text = format_delta(entry["delta_win_rate"])
            escaped_name = prop_name.replace("\\", "\\\\").replace('"', '\\"')
            lines.append(
                f'            "{escaped_name}": '
                f'{{"cost": {cost_text}, "delta_win_rate": {delta_text}}},'
            )
        lines.append("        },")
        lines.append("    },")
    lines.append("}")

    PROPERTY_VALUES_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def escape_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def build_property_weapon(
    prop_name: str,
    property_lookup: Dict[str, object],
    x_value: int,
    baseline_damage: int,
    rank: int,
) -> Weapon:
    prop_value = property_lookup[prop_name]
    prop_setting = x_value if isinstance(prop_value, int) else prop_value
    weapon_type = "melee" if prop_name == MELEE_PROPERTY else "ranged"
    return Weapon(
        name=f"{weapon_type.upper()} | {prop_name} | DMG {baseline_damage}",
        damage=baseline_damage,
        weapon_type=weapon_type,
        properties={prop_name: prop_setting},
        rank=rank,
    )


def load_property_combos() -> Dict[int, Dict[str, object]]:
    try:
        module = importlib.import_module("property_combos")
        importlib.reload(module)
        values = getattr(module, "PROPERTY_COMBOS", {})
        normalized: Dict[int, Dict[str, object]] = {}
        for key, rank_values in values.items():
            normalized[int(key)] = rank_values
        return normalized
    except Exception:
        return {}


def write_property_combos(values: Dict[int, Dict[str, object]]):
    lines = ["# -*- coding: utf-8 -*-", "PROPERTY_COMBOS = {"]
    for rank in sorted(values.keys()):
        rank_values = values[rank]
        pair_costs = rank_values.get("pair_costs") or {}
        lines.append(f"    {rank}: {{")
        for pair_key in sorted(pair_costs.keys()):
            entry = pair_costs[pair_key]
            prop_a, prop_b = pair_key
            lines.append(
                f'        ("{escape_string(prop_a)}", "{escape_string(prop_b)}"): '
                f'{{"winrate": {entry["winrate"]:.5f}, "cost_pair": {entry["cost_pair"]:.2f}, "dop_cost": {entry["dop_cost"]:.2f}}},'
            )
        lines.append("    },")
    lines.append("}")
    PROPERTY_COMBOS_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_property_matchups() -> Dict[int, Dict[str, object]]:
    try:
        module = importlib.import_module("property_matchups")
        importlib.reload(module)
        values = getattr(module, "PROPERTY_MATCHUPS", {})
        normalized: Dict[int, Dict[str, object]] = {}
        for key, rank_values in values.items():
            normalized[int(key)] = rank_values
        return normalized
    except Exception:
        return {}


def write_property_matchups(values: Dict[int, Dict[str, object]]):
    lines = ["# -*- coding: utf-8 -*-", "PROPERTY_MATCHUPS = {"]
    for rank in sorted(values.keys()):
        rank_values = values[rank]
        rank_matchups = rank_values.get("matchups") or {}
        lines.append(f"    {rank}: {{")
        for prop_name in sorted(rank_matchups.keys()):
            opponent_map = rank_matchups[prop_name]
            lines.append(f'        "{escape_string(prop_name)}": {{')
            for opponent in sorted(opponent_map.keys()):
                entry = opponent_map[opponent]
                lines.append(
                    f'            "{escape_string(opponent)}": '
                    f'{{"winrate": {entry["winrate"]:.5f}, "cost_opp": {entry["cost_opp"]:.2f}, "opp_cost": {entry["opp_cost"]:.2f}}},'
                )
            lines.append("        },")
        lines.append("    },")
    lines.append("}")
    PROPERTY_MATCHUPS_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def cost_from_winrate(
    win_rate: float,
    base_logit: float,
    calibration: List[Tuple[int, float]],
) -> float:
    clamped = clamp_prob(win_rate)
    delta_logit = logit(clamped) - base_logit
    return interpolate_damage_equivalent(delta_logit, calibration)


def calculate_property_pairs(
    rank: int,
    x_value: int,
    simulations: int,
    scenario: Scenario,
    baseline_win_rate: float,
    calibration: List[Tuple[int, float]],
    base_logit: float,
    show_progress: bool,
    pool: Optional[SimulationPool],
    property_costs: Dict[str, Dict[str, Optional[float]]],
) -> Dict[Tuple[str, str], Dict[str, float]]:
    property_lookup = {
        prop_name: prop_value
        for prop_name, prop_value in PROPERTY_DEFS
        if prop_name != REROLL_PROPERTY
    }
    property_names = sorted(property_lookup.keys())
    baseline_damage = BASELINE_DAMAGE_BY_RANK[rank]
    baseline_weapon = Weapon(
        name=f"RANGED | DMG {baseline_damage} | BASELINE",
        damage=baseline_damage,
        weapon_type="ranged",
        properties={},
        rank=rank,
    )

    def resolve_cost(prop_name: str) -> float:
        entry = property_costs.get(prop_name, {})
        return normalize_property_entry(entry)["cost"] or 0.0

    pair_results: Dict[Tuple[str, str], Dict[str, float]] = {}
    for i in range(len(property_names)):
        for j in range(i + 1, len(property_names)):
            prop_a = property_names[i]
            prop_b = property_names[j]
            pair_key = tuple(sorted((prop_a, prop_b)))
            props = {}
            for prop_name in (prop_a, prop_b):
                value = property_lookup[prop_name]
                props[prop_name] = x_value if isinstance(value, int) else value
            weapon_type = "melee" if MELEE_PROPERTY in pair_key else "ranged"
            weapon_name = f"{weapon_type.upper()} | {prop_a} + {prop_b} | DMG {baseline_damage}"
            test_weapon = Weapon(
                name=weapon_name,
                damage=baseline_damage,
                weapon_type=weapon_type,
                properties=props,
                rank=rank,
            )
            progress_label = None
            if should_show_progress(simulations, show_progress):
                progress_label = f"{prop_a} + {prop_b}"
            stats = run_matchup(
                test_weapon,
                baseline_weapon,
                rank=rank,
                simulations=simulations,
                scenario=scenario,
                progress_label=progress_label,
                show_progress=show_progress,
                track_rounds=False,
                pool=pool,
            )
            total = max(stats["weapon1_wins"] + stats["weapon2_wins"], 1)
            win_rate = stats["weapon1_wins"] / total
            raw_delta = win_rate - baseline_win_rate
            rounded_delta = round_to_half_percent(raw_delta)
            rounded_win_rate = clamp_prob(baseline_win_rate + rounded_delta)
            delta_logit = logit(rounded_win_rate) - base_logit
            cost_pair = round(interpolate_damage_equivalent(delta_logit, calibration), 2)
            cost_a = resolve_cost(prop_a)
            cost_b = resolve_cost(prop_b)
            dop_cost = round(cost_pair - (cost_a + cost_b), 2)
            pair_results[pair_key] = {
                "winrate": round(win_rate, 5),
                "cost_pair": cost_pair,
                "dop_cost": dop_cost,
            }
    return pair_results


def recalc_property_pairs_for_ranks(
    ranks: List[int],
    x_value: int,
    simulations: int,
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
    base_values_data: Optional[Dict[int, Dict[str, object]]] = None,
    property_values_data: Optional[Dict[int, Dict[str, object]]] = None,
) -> Dict[int, Dict[str, object]]:
    if base_values_data is None:
        base_values_data = load_base_values()
    if property_values_data is None:
        property_values_data = load_property_values()

    property_pairs_data: Dict[int, Dict[str, object]] = {}
    for current_rank in ranks:
        base_data = base_values_data.get(current_rank)
        if not base_data:
            continue
        baseline_win_rate = base_data["baseline_win_rate"]
        damage_deltas = dict(base_data.get("damage_win_rate", {}))
        if not damage_deltas:
            continue
        calibration = build_logit_calibration(
            baseline_win_rate,
            damage_deltas,
            BASELINE_DAMAGE_BY_RANK[current_rank],
        )
        base_logit = logit(baseline_win_rate)
        property_costs = property_values_data.get(current_rank, {}).get("property_costs", {})
        pair_results = calculate_property_pairs(
            rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            scenario=scenario,
            baseline_win_rate=baseline_win_rate,
            calibration=calibration,
            base_logit=base_logit,
            show_progress=show_progress,
            pool=pool,
            property_costs=property_costs,
        )
        property_pairs_data[current_rank] = {
            "rank": current_rank,
            "pair_costs": pair_results,
        }
    return property_pairs_data


def calculate_property_matchups(
    rank: int,
    x_value: int,
    simulations: int,
    scenario: Scenario,
    calibration: List[Tuple[int, float]],
    base_logit: float,
    show_progress: bool,
    pool: Optional[SimulationPool],
    property_costs: Dict[str, Dict[str, Optional[float]]],
) -> Dict[str, Dict[str, Dict[str, float]]]:
    property_lookup = {
        prop_name: prop_value
        for prop_name, prop_value in PROPERTY_DEFS
        if prop_name != REROLL_PROPERTY
    }
    property_names = sorted(property_lookup.keys())
    baseline_damage = BASELINE_DAMAGE_BY_RANK[rank]
    matchups: Dict[str, Dict[str, Dict[str, float]]] = {
        prop_name: {} for prop_name in property_names
    }

    def resolve_cost(name: str) -> float:
        entry = property_costs.get(name, {})
        return normalize_property_entry(entry)["cost"] or 0.0

    for i, prop_a in enumerate(property_names):
        weapon_a = build_property_weapon(
            prop_a,
            property_lookup,
            x_value,
            baseline_damage,
            rank,
        )
        for j in range(i, len(property_names)):
            prop_b = property_names[j]
            weapon_b = build_property_weapon(
                prop_b,
                property_lookup,
                x_value,
                baseline_damage,
                rank,
            )
            progress_label = None
            if should_show_progress(simulations, show_progress):
                progress_label = f"{prop_a} vs {prop_b}"
            stats = run_matchup(
                weapon_a,
                weapon_b,
                rank=rank,
                simulations=simulations,
                scenario=scenario,
                progress_label=progress_label,
                show_progress=show_progress,
                track_rounds=False,
                pool=pool,
            )
            total = max(stats["weapon1_wins"] + stats["weapon2_wins"], 1)
            win_rate_a = stats["weapon1_wins"] / total
            win_rate_b = 1.0 - win_rate_a
            cost_opp_a = round(
                cost_from_winrate(win_rate_a, base_logit, calibration), 2
            )
            cost_opp_b = round(
                cost_from_winrate(win_rate_b, base_logit, calibration), 2
            )
            base_cost_a = resolve_cost(prop_a)
            base_cost_b = resolve_cost(prop_b)
            matchups[prop_a][prop_b] = {
                "winrate": round(win_rate_a, 5),
                "cost_opp": cost_opp_a,
                "opp_cost": round(cost_opp_a - base_cost_a, 2),
            }
            if prop_a == prop_b:
                continue
            matchups[prop_b][prop_a] = {
                "winrate": round(win_rate_b, 5),
                "cost_opp": cost_opp_b,
                "opp_cost": round(cost_opp_b - base_cost_b, 2),
            }

    return matchups


def recalc_property_matchups_for_ranks(
    ranks: List[int],
    x_value: int,
    simulations: int,
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
    base_values_data: Optional[Dict[int, Dict[str, object]]] = None,
    property_values_data: Optional[Dict[int, Dict[str, object]]] = None,
) -> Dict[int, Dict[str, object]]:
    if base_values_data is None:
        base_values_data = load_base_values()
    if property_values_data is None:
        property_values_data = load_property_values()

    property_matchups_data: Dict[int, Dict[str, object]] = {}
    for current_rank in ranks:
        base_data = base_values_data.get(current_rank)
        if not base_data:
            continue
        baseline_win_rate = base_data["baseline_win_rate"]
        damage_deltas = dict(base_data.get("damage_win_rate", {}))
        if not damage_deltas:
            continue
        calibration = build_logit_calibration(
            baseline_win_rate,
            damage_deltas,
            BASELINE_DAMAGE_BY_RANK[current_rank],
        )
        base_logit = logit(baseline_win_rate)
        property_costs = property_values_data.get(current_rank, {}).get(
            "property_costs", {}
        )
        matchup_results = calculate_property_matchups(
            rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            scenario=scenario,
            calibration=calibration,
            base_logit=base_logit,
            show_progress=show_progress,
            pool=pool,
            property_costs=property_costs,
        )
        property_matchups_data[current_rank] = {
            "rank": current_rank,
            "matchups": matchup_results,
        }

    return property_matchups_data


def calculate_property_costs(
    rank: int,
    x_value: int,
    simulations: int,
    baseline_win_rate: float,
    damage_deltas: Dict[int, float],
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
) -> Dict[str, Dict[str, Optional[float]]]:
    baseline_damage = BASELINE_DAMAGE_BY_RANK[rank]
    calibration = build_logit_calibration(
        baseline_win_rate,
        damage_deltas,
        baseline_damage,
    )
    base_logit = logit(baseline_win_rate)
    all_properties = {prop_name for prop_name, _ in PROPERTY_DEFS}
    no_effect_properties = all_properties - SIMULATED_PROPERTIES - {"Переброс"}

    baseline_weapons = {
        "melee": Weapon(
            name=f"MELEE | DMG {baseline_damage} | BASELINE",
            damage=baseline_damage,
            weapon_type="melee",
            properties={},
            rank=rank,
        ),
        "ranged": Weapon(
            name=f"RANGED | DMG {baseline_damage} | BASELINE",
            damage=baseline_damage,
            weapon_type="ranged",
            properties={},
            rank=rank,
        ),
    }

    property_costs: Dict[str, Dict[str, Optional[float]]] = {}
    property_names = [
        prop_name for prop_name, _ in PROPERTY_DEFS if prop_name != REROLL_PROPERTY
    ]
    no_effect_properties = set(property_names) - SIMULATED_PROPERTIES
    for prop_name, prop_value in PROPERTY_DEFS:
        if prop_name == REROLL_PROPERTY:
            continue
        if prop_name in no_effect_properties:
            property_costs[prop_name] = {
                "cost": 0.0,
                "delta_win_rate": 0.0,
            }
            continue
        prop_setting = x_value if isinstance(prop_value, int) else prop_value
        props = {prop_name: prop_setting}
        weapon_type = "melee" if prop_name == MELEE_PROPERTY else "ranged"
        test_weapon = Weapon(
            name=f"{weapon_type.upper()} | {prop_name} | DMG {baseline_damage}",
            damage=baseline_damage,
            weapon_type=weapon_type,
            properties=props,
            rank=rank,
        )
        baseline_weapon = baseline_weapons["ranged"]
        progress_label = None
        if should_show_progress(simulations, show_progress):
            progress_label = f"{prop_name} | {weapon_type.upper()}"
        stats = run_matchup(
            test_weapon,
            baseline_weapon,
            rank=rank,
            simulations=simulations,
            scenario=scenario,
            progress_label=progress_label,
            show_progress=show_progress,
            track_rounds=False,
            pool=pool,
        )
        total = max(stats["weapon1_wins"] + stats["weapon2_wins"], 1)
        win_rate = stats["weapon1_wins"] / total
        raw_delta = win_rate - baseline_win_rate
        rounded_delta = round_to_half_percent(raw_delta)
        rounded_win_rate = clamp_prob(baseline_win_rate + rounded_delta)
        delta_logit = logit(rounded_win_rate) - base_logit
        damage_equivalent = interpolate_damage_equivalent(delta_logit, calibration)
        property_costs[prop_name] = {
            "cost": round(damage_equivalent, 2),
            "delta_win_rate": rounded_delta,
        }
    return property_costs


def print_property_costs(property_costs: Dict[str, object]):
    if not property_costs:
        print("No property costs calculated.")
        return

    print()
    print("Property costs (damage equivalents)")
    header = f"{'Property':<40} {'Cost':>7} {'dWin%':>8}"
    separator = "-" * len(header)
    print(header)
    print(separator)
    for prop_name in sorted(property_costs.keys()):
        entry = property_costs[prop_name]
        normalized = normalize_property_entry(entry)
        cost = normalized["cost"] or 0.0
        delta = normalized["delta_win_rate"]
        if delta is None:
            delta_text = "   n/a"
        else:
            delta_text = f"{delta*100:>7.2f}%"
        print(f"{prop_name:<40} {cost:>7.2f} {delta_text:>8}")


def can_use_fast_matchup(
    weapon1: Weapon,
    weapon2: Weapon,
    scenario: Scenario,
) -> bool:
    """Return True if a simplified combat model is equivalent to full sim."""
    if weapon1.properties or weapon2.properties:
        return False
    if weapon1.weapon_type != weapon2.weapon_type:
        return False
    if scenario.allow_ranged_retreat:
        return False
    min_range = min(weapon1.get_range(), weapon2.get_range())
    if scenario.initial_distance > min_range:
        return False
    return True


def build_damage_table(
    dice: int,
    skill: int,
    defense: int,
    weapon_damage: int,
) -> List[int]:
    """Precompute damage per roll for a simple, property-free attack."""
    table = [0] * (dice + 1)
    for roll_value in range(1, dice + 1):
        total_roll = roll_value + skill
        if total_roll >= defense:
            damage_value = (total_roll - defense) + weapon_damage
            if damage_value < 1:
                damage_value = 1
            table[roll_value] = damage_value
    return table


def run_matchup_fast(
    weapon1: Weapon,
    weapon2: Weapon,
    rank: int,
    simulations: int,
    max_rounds: int = 100,
    progress_label: Optional[str] = None,
    show_progress: bool = False,
    track_rounds: bool = True,
    parallel: bool = True,
    max_workers: Optional[int] = None,
    pool: Optional[SimulationPool] = None,
    use_numba: bool = True,
) -> Dict[str, object]:
    """Fast combat simulation for simple, property-free weapons."""
    if parallel and simulations >= PARALLEL_MIN_SIMULATIONS:
        return run_matchup_fast_parallel(
            weapon1,
            weapon2,
            rank,
            simulations,
            max_rounds=max_rounds,
            progress_label=progress_label,
            show_progress=show_progress,
            track_rounds=track_rounds,
            max_workers=max_workers,
            pool=pool,
            use_numba=use_numba,
        )

    params = RANK_PARAMS[rank]
    base_hp = params["hp"]
    dice = params["dice"]
    skill = params["skill"]
    defense = params["defense"]

    w1_table = build_damage_table(dice, skill, defense, weapon1.damage)
    w2_table = build_damage_table(dice, skill, defense, weapon2.damage)

    if use_numba and not track_rounds:
        (
            w1_wins,
            w2_wins,
            w1_win_rounds,
            w2_win_rounds,
            total_rounds,
        ) = fast_matchup_chunk(
            w1_table,
            w2_table,
            dice,
            base_hp,
            simulations,
            max_rounds,
            0,
            track_rounds=False,
            seed=None,
            use_numba=True,
        )
        avg_rounds = total_rounds / simulations if simulations else 0.0
        return {
            "weapon1_wins": w1_wins,
            "weapon2_wins": w2_wins,
            "weapon1_win_rounds": w1_win_rounds,
            "weapon2_win_rounds": w2_win_rounds,
            "avg_rounds": avg_rounds,
        }

    randrange = random.randrange
    w1_wins = 0
    w2_wins = 0
    total_rounds = 0
    w1_win_rounds: Optional[List[int]] = [] if track_rounds else None
    w2_win_rounds: Optional[List[int]] = [] if track_rounds else None

    progress_active = (
        progress_label is not None and should_show_progress(simulations, show_progress)
    )
    interval = progress_interval(simulations) if progress_active else None

    for i in range(simulations):
        if i % 2 == 0:
            atk_table = w1_table
            def_table = w2_table
            attacker_is_w1 = True
        else:
            atk_table = w2_table
            def_table = w1_table
            attacker_is_w1 = False

        attacker_hp = base_hp
        defender_hp = base_hp
        rounds = 0

        while rounds < max_rounds and attacker_hp > 0 and defender_hp > 0:
            rounds += 1

            defender_hp -= atk_table[randrange(1, dice + 1)]
            if defender_hp <= 0:
                break
            defender_hp -= atk_table[randrange(1, dice + 1)]
            if defender_hp <= 0:
                break

            attacker_hp -= def_table[randrange(1, dice + 1)]
            if attacker_hp <= 0:
                break
            attacker_hp -= def_table[randrange(1, dice + 1)]
            if attacker_hp <= 0:
                break

        total_rounds += rounds
        attacker_wins = defender_hp <= 0

        if attacker_wins:
            if attacker_is_w1:
                w1_wins += 1
                if w1_win_rounds is not None:
                    w1_win_rounds.append(rounds)
            else:
                w2_wins += 1
                if w2_win_rounds is not None:
                    w2_win_rounds.append(rounds)
        else:
            if attacker_is_w1:
                w2_wins += 1
                if w2_win_rounds is not None:
                    w2_win_rounds.append(rounds)
            else:
                w1_wins += 1
                if w1_win_rounds is not None:
                    w1_win_rounds.append(rounds)

        if progress_active and (
            (i + 1) % interval == 0 or i + 1 == simulations
        ):
            print_progress(progress_label, i + 1, simulations)

    avg_rounds = total_rounds / simulations if simulations else 0.0
    if w1_win_rounds is None:
        w1_win_rounds = []
    if w2_win_rounds is None:
        w2_win_rounds = []
    return {
        "weapon1_wins": w1_wins,
        "weapon2_wins": w2_wins,
        "weapon1_win_rounds": w1_win_rounds,
        "weapon2_win_rounds": w2_win_rounds,
        "avg_rounds": avg_rounds,
    }


def run_matchup_fast_parallel(
    weapon1: Weapon,
    weapon2: Weapon,
    rank: int,
    simulations: int,
    max_rounds: int = 100,
    progress_label: Optional[str] = None,
    show_progress: bool = False,
    track_rounds: bool = True,
    max_workers: Optional[int] = None,
    pool: Optional[SimulationPool] = None,
    use_numba: bool = True,
) -> Dict[str, object]:
    executor, workers, owns_executor = acquire_executor(pool, max_workers)
    if executor is None or workers < 2:
        return run_matchup_fast(
            weapon1,
            weapon2,
            rank,
            simulations,
            max_rounds=max_rounds,
            progress_label=progress_label,
            show_progress=show_progress,
            track_rounds=track_rounds,
            parallel=False,
            max_workers=max_workers,
            pool=pool,
            use_numba=use_numba,
        )

    chunks = build_simulation_chunks(simulations, workers)
    if len(chunks) <= 1:
        return run_matchup_fast(
            weapon1,
            weapon2,
            rank,
            simulations,
            max_rounds=max_rounds,
            progress_label=progress_label,
            show_progress=show_progress,
            track_rounds=track_rounds,
            parallel=False,
            max_workers=max_workers,
            pool=pool,
            use_numba=use_numba,
        )

    params = RANK_PARAMS[rank]
    base_hp = params["hp"]
    dice = params["dice"]
    skill = params["skill"]
    defense = params["defense"]

    w1_table = build_damage_table(dice, skill, defense, weapon1.damage)
    w2_table = build_damage_table(dice, skill, defense, weapon2.damage)

    progress_active = (
        progress_label is not None and should_show_progress(simulations, show_progress)
    )

    w1_wins = 0
    w2_wins = 0
    total_rounds = 0
    w1_win_rounds: Optional[List[int]] = [] if track_rounds else None
    w2_win_rounds: Optional[List[int]] = [] if track_rounds else None

    futures: Dict[concurrent.futures.Future, int] = {}
    completed = 0
    try:
        for start_index, chunk_size in chunks:
            seed = random.randrange(1, 2**31)
            future = executor.submit(
                fast_matchup_chunk,
                w1_table,
                w2_table,
                dice,
                base_hp,
                chunk_size,
                max_rounds,
                start_index,
                track_rounds,
                seed,
                use_numba,
            )
            futures[future] = chunk_size

        for future in concurrent.futures.as_completed(futures):
            (
                chunk_w1_wins,
                chunk_w2_wins,
                chunk_w1_rounds,
                chunk_w2_rounds,
                chunk_rounds_sum,
            ) = future.result()
            w1_wins += chunk_w1_wins
            w2_wins += chunk_w2_wins
            total_rounds += chunk_rounds_sum
            if w1_win_rounds is not None:
                w1_win_rounds.extend(chunk_w1_rounds)
            if w2_win_rounds is not None:
                w2_win_rounds.extend(chunk_w2_rounds)

            completed += futures[future]
            if progress_active:
                print_progress(progress_label, min(completed, simulations), simulations)
    finally:
        if owns_executor and executor is not None:
            executor.shutdown(wait=True)

    avg_rounds = total_rounds / simulations if simulations else 0.0
    if w1_win_rounds is None:
        w1_win_rounds = []
    if w2_win_rounds is None:
        w2_win_rounds = []
    return {
        "weapon1_wins": w1_wins,
        "weapon2_wins": w2_wins,
        "weapon1_win_rounds": w1_win_rounds,
        "weapon2_win_rounds": w2_win_rounds,
        "avg_rounds": avg_rounds,
    }


def run_matchup(
    weapon1: Weapon,
    weapon2: Weapon,
    rank: int,
    simulations: int,
    scenario: Scenario,
    progress_label: Optional[str] = None,
    show_progress: bool = False,
    track_rounds: bool = True,
    parallel: bool = True,
    max_workers: Optional[int] = None,
    pool: Optional[SimulationPool] = None,
    use_numba: bool = True,
) -> Dict[str, object]:
    """Run multiple combats for a specific scenario with symmetric roles."""
    if can_use_fast_matchup(weapon1, weapon2, scenario):
        return run_matchup_fast(
            weapon1,
            weapon2,
            rank,
            simulations,
            progress_label=progress_label,
            show_progress=show_progress,
            track_rounds=track_rounds,
            parallel=parallel,
            max_workers=max_workers,
            pool=pool,
            use_numba=use_numba,
        )

    if parallel and simulations >= PARALLEL_MIN_SIMULATIONS:
        return run_matchup_parallel(
            weapon1,
            weapon2,
            rank,
            simulations,
            scenario,
            progress_label=progress_label,
            show_progress=show_progress,
            track_rounds=track_rounds,
            max_workers=max_workers,
            pool=pool,
            use_numba=use_numba,
        )

    if use_numba and NUMBA_AVAILABLE and not track_rounds:
        params = RANK_PARAMS[rank]
        base_hp = params["hp"]
        dice = params["dice"]
        skill = params["skill"]
        defense = params["defense"]
        speed = float(params["speed"])
        weapon_props, weapon_ranges = build_matchup_props(weapon1, weapon2)
        (
            w1_wins,
            w2_wins,
            w1_win_rounds,
            w2_win_rounds,
            total_rounds,
        ) = full_matchup_chunk(
            weapon_props,
            weapon_ranges,
            dice,
            skill,
            defense,
            speed,
            base_hp,
            rank,
            simulations,
            DEFAULT_MAX_ROUNDS,
            0,
            float(scenario.initial_distance),
            scenario.allow_ranged_retreat,
            DEFAULT_MAX_RETREAT_ROUNDS,
            track_rounds,
            None,
            True,
        )
        avg_rounds = total_rounds / simulations if simulations else 0.0
        return {
            "weapon1_wins": w1_wins,
            "weapon2_wins": w2_wins,
            "weapon1_win_rounds": w1_win_rounds,
            "weapon2_win_rounds": w2_win_rounds,
            "avg_rounds": avg_rounds,
        }

    w1_wins = 0
    w2_wins = 0
    total_rounds = 0
    w1_win_rounds: Optional[List[int]] = [] if track_rounds else None
    w2_win_rounds: Optional[List[int]] = [] if track_rounds else None
    char1 = Character(name="Attacker", rank=rank, weapon=weapon1)
    char2 = Character(name="Defender", rank=rank, weapon=weapon2)
    sim = CombatSimulator(
        char1,
        char2,
        verbose=False,
        initial_distance=scenario.initial_distance,
        allow_ranged_retreat=scenario.allow_ranged_retreat,
    )

    progress_active = (
        progress_label is not None and should_show_progress(simulations, show_progress)
    )
    interval = progress_interval(simulations) if progress_active else None

    for i in range(simulations):
        if i % 2 == 0:
            attacker_is_w1 = True
            char1.weapon = weapon1
            char2.weapon = weapon2
        else:
            attacker_is_w1 = False
            char1.weapon = weapon2
            char2.weapon = weapon1

        sim.reset_combat()
        result = sim.run_combat()
        total_rounds += result["rounds"]

        if result["attacker_wins"]:
            if attacker_is_w1:
                w1_wins += 1
                if w1_win_rounds is not None:
                    w1_win_rounds.append(result["rounds"])
            else:
                w2_wins += 1
                if w2_win_rounds is not None:
                    w2_win_rounds.append(result["rounds"])
        else:
            if attacker_is_w1:
                w2_wins += 1
                if w2_win_rounds is not None:
                    w2_win_rounds.append(result["rounds"])
            else:
                w1_wins += 1
                if w1_win_rounds is not None:
                    w1_win_rounds.append(result["rounds"])

        if progress_active and (
            (i + 1) % interval == 0 or i + 1 == simulations
        ):
            print_progress(progress_label, i + 1, simulations)

    avg_rounds = total_rounds / simulations if simulations else 0.0
    if w1_win_rounds is None:
        w1_win_rounds = []
    if w2_win_rounds is None:
        w2_win_rounds = []
    return {
        "weapon1_wins": w1_wins,
        "weapon2_wins": w2_wins,
        "weapon1_win_rounds": w1_win_rounds,
        "weapon2_win_rounds": w2_win_rounds,
        "avg_rounds": avg_rounds,
    }


def run_matchup_batch(
    matchups: List[Tuple[Weapon, Weapon]],
    rank: int,
    simulations: int,
    scenario: Scenario,
    pool: Optional[SimulationPool] = None,
    show_progress: bool = False,
    use_numba: bool = True,
) -> List[Dict[str, object]]:
    tasks = [
        BatchTask(
            args=(weapon1, weapon2, rank, simulations, scenario),
            kwargs={
                "track_rounds": False,
                "parallel": False,
                "pool": None,
                "use_numba": use_numba,
            },
        )
        for weapon1, weapon2 in matchups
    ]
    return batch_map(
        run_matchup,
        tasks,
        pool=pool,
        progress_label="Batch matchups",
        show_progress=show_progress,
    )


def _run_matchup_chunk(
    weapon1: Weapon,
    weapon2: Weapon,
    rank: int,
    simulations: int,
    scenario: Scenario,
    start_index: int,
    track_rounds: bool,
    seed: Optional[int],
) -> Tuple[int, int, List[int], List[int], int]:
    if seed is not None:
        random.seed(seed)

    w1_wins = 0
    w2_wins = 0
    total_rounds = 0
    w1_win_rounds: Optional[List[int]] = [] if track_rounds else None
    w2_win_rounds: Optional[List[int]] = [] if track_rounds else None

    char1 = Character(name="Attacker", rank=rank, weapon=weapon1)
    char2 = Character(name="Defender", rank=rank, weapon=weapon2)
    sim = CombatSimulator(
        char1,
        char2,
        verbose=False,
        initial_distance=scenario.initial_distance,
        allow_ranged_retreat=scenario.allow_ranged_retreat,
    )

    for i in range(simulations):
        if (start_index + i) % 2 == 0:
            attacker_is_w1 = True
            char1.weapon = weapon1
            char2.weapon = weapon2
        else:
            attacker_is_w1 = False
            char1.weapon = weapon2
            char2.weapon = weapon1

        sim.reset_combat()
        result = sim.run_combat()
        total_rounds += result["rounds"]

        if result["attacker_wins"]:
            if attacker_is_w1:
                w1_wins += 1
                if w1_win_rounds is not None:
                    w1_win_rounds.append(result["rounds"])
            else:
                w2_wins += 1
                if w2_win_rounds is not None:
                    w2_win_rounds.append(result["rounds"])
        else:
            if attacker_is_w1:
                w2_wins += 1
                if w2_win_rounds is not None:
                    w2_win_rounds.append(result["rounds"])
            else:
                w1_wins += 1
                if w1_win_rounds is not None:
                    w1_win_rounds.append(result["rounds"])

    if w1_win_rounds is None:
        w1_win_rounds = []
    if w2_win_rounds is None:
        w2_win_rounds = []
    return w1_wins, w2_wins, w1_win_rounds, w2_win_rounds, total_rounds


def run_matchup_parallel(
    weapon1: Weapon,
    weapon2: Weapon,
    rank: int,
    simulations: int,
    scenario: Scenario,
    progress_label: Optional[str] = None,
    show_progress: bool = False,
    track_rounds: bool = True,
    max_workers: Optional[int] = None,
    pool: Optional[SimulationPool] = None,
    use_numba: bool = True,
) -> Dict[str, object]:
    executor, workers, owns_executor = acquire_executor(pool, max_workers)
    if executor is None or workers < 2:
        return run_matchup(
            weapon1,
            weapon2,
            rank,
            simulations,
            scenario,
            progress_label=progress_label,
            show_progress=show_progress,
            track_rounds=track_rounds,
            parallel=False,
            max_workers=max_workers,
            pool=pool,
        )

    chunks = build_simulation_chunks(simulations, workers)
    if len(chunks) <= 1:
        return run_matchup(
            weapon1,
            weapon2,
            rank,
            simulations,
            scenario,
            progress_label=progress_label,
            show_progress=show_progress,
            track_rounds=track_rounds,
            parallel=False,
            max_workers=max_workers,
            pool=pool,
        )

    progress_active = (
        progress_label is not None and should_show_progress(simulations, show_progress)
    )

    w1_wins = 0
    w2_wins = 0
    total_rounds = 0
    w1_win_rounds: Optional[List[int]] = [] if track_rounds else None
    w2_win_rounds: Optional[List[int]] = [] if track_rounds else None

    use_numba_full = use_numba and NUMBA_AVAILABLE and not track_rounds
    params = RANK_PARAMS[rank]
    base_hp = params["hp"]
    dice = params["dice"]
    skill = params["skill"]
    defense = params["defense"]
    speed = float(params["speed"])
    weapon_props = None
    weapon_ranges = None
    if use_numba_full:
        weapon_props, weapon_ranges = build_matchup_props(weapon1, weapon2)

    futures: Dict[concurrent.futures.Future, int] = {}
    completed = 0
    try:
        for start_index, chunk_size in chunks:
            seed = random.randrange(1, 2**31)
            if use_numba_full:
                future = executor.submit(
                    full_matchup_chunk,
                    weapon_props,
                    weapon_ranges,
                    dice,
                    skill,
                    defense,
                    speed,
                    base_hp,
                    rank,
                    chunk_size,
                    DEFAULT_MAX_ROUNDS,
                    start_index,
                    float(scenario.initial_distance),
                    scenario.allow_ranged_retreat,
                    DEFAULT_MAX_RETREAT_ROUNDS,
                    track_rounds,
                    seed,
                    True,
                )
            else:
                future = executor.submit(
                    _run_matchup_chunk,
                    weapon1,
                    weapon2,
                    rank,
                    chunk_size,
                    scenario,
                    start_index,
                    track_rounds,
                    seed,
                )
            futures[future] = chunk_size

        for future in concurrent.futures.as_completed(futures):
            (
                chunk_w1_wins,
                chunk_w2_wins,
                chunk_w1_rounds,
                chunk_w2_rounds,
                chunk_rounds_sum,
            ) = future.result()
            w1_wins += chunk_w1_wins
            w2_wins += chunk_w2_wins
            total_rounds += chunk_rounds_sum
            if w1_win_rounds is not None:
                w1_win_rounds.extend(chunk_w1_rounds)
            if w2_win_rounds is not None:
                w2_win_rounds.extend(chunk_w2_rounds)

            completed += futures[future]
            if progress_active:
                print_progress(progress_label, min(completed, simulations), simulations)
    finally:
        if owns_executor and executor is not None:
            executor.shutdown(wait=True)

    avg_rounds = total_rounds / simulations if simulations else 0.0
    if w1_win_rounds is None:
        w1_win_rounds = []
    if w2_win_rounds is None:
        w2_win_rounds = []
    return {
        "weapon1_wins": w1_wins,
        "weapon2_wins": w2_wins,
        "weapon1_win_rounds": w1_win_rounds,
        "weapon2_win_rounds": w2_win_rounds,
        "avg_rounds": avg_rounds,
    }


def configure_console_encoding():
    if os.name != "nt":
        return

    forced = os.getenv("ANDROMEDA_CONSOLE_ENCODING")
    preferred = locale.getpreferredencoding(False)
    target = forced

    if not target:
        stdout_encoding = (sys.stdout.encoding or "").lower()
        preferred_lower = (preferred or "").lower()
        if stdout_encoding.startswith("utf") and preferred_lower and preferred_lower != stdout_encoding:
            target = preferred

    if not target:
        return

    try:
        sys.stdout.reconfigure(encoding=target, errors="replace")
    except (AttributeError, ValueError):
        pass


def prompt_int(prompt: str, min_value: int = None, max_value: int = None) -> int:
    while True:
        raw = input(prompt).strip()
        try:
            value = int(raw)
        except ValueError:
            print("Enter a number.")
            continue
        if min_value is not None and value < min_value:
            print(f"Minimum: {min_value}.")
            continue
        if max_value is not None and value > max_value:
            print(f"Maximum: {max_value}.")
            continue
        return value


def prompt_yes_no(prompt: str) -> bool:
    while True:
        raw = input(prompt).strip().lower()
        if raw in ("y", "yes"):
            return True
        if raw in ("n", "no"):
            return False
        print("Enter y or n.")


def prompt_rank(prompt: str, allow_all: bool = False):
    while True:
        raw = input(prompt).strip().lower()
        if allow_all and raw in ("all", "a"):
            return "all"
        try:
            value = int(raw)
        except ValueError:
            if allow_all:
                print("Enter 1-4 or all.")
            else:
                print("Enter a number.")
            continue
        if value < 1:
            print("Minimum: 1.")
            continue
        if value > 4:
            print("Maximum: 4.")
            continue
        return value


def prompt_accuracy(prompt: str) -> float:
    while True:
        raw = input(prompt).strip().lower().replace("%", "")
        try:
            value = float(raw)
        except ValueError:
            print("Enter a percentage like 95 or 99.5.")
            continue
        if value <= 0 or value >= 100:
            print("Enter a value between 0 and 100.")
            continue
        return value / 100.0


def expand_ranks(rank_input) -> List[int]:
    if rank_input == "all":
        return sorted(BASELINE_DAMAGE_BY_RANK.keys())
    return [int(rank_input)]


def recalc_base_values_for_rank(
    current_rank: int,
    x_value: int,
    simulations: int,
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
) -> Tuple[float, Dict[int, float]]:
    weapons = build_weapons(current_rank, x_value, rerolls=0)
    baseline_damage = BASELINE_DAMAGE_BY_RANK[current_rank]
    damage_values = get_damage_values_for_rank(current_rank)
    baseline_weapon = get_simple_weapon(weapons, "ranged", baseline_damage, current_rank)

    print()
    print("=" * 80)
    print(f"BASE VALUES (RANGED VS RANGED) | RANK {current_rank}")
    print("=" * 80)
    print()
    print(f"Params: rank {current_rank}, rerolls 0, X {x_value}")
    print(f"Simulations per scenario: {simulations}")
    print("Scenario: 15 m without retreat")
    print(f"Baseline damage: {baseline_damage}")
    print()

    progress_label = None
    if should_show_progress(simulations, show_progress):
        progress_label = f"Rank {current_rank} | Baseline"
    stats = run_matchup(
        baseline_weapon,
        baseline_weapon,
        rank=current_rank,
        simulations=simulations,
        scenario=scenario,
        progress_label=progress_label,
        show_progress=show_progress,
        track_rounds=False,
        pool=pool,
    )
    total = max(stats["weapon1_wins"] + stats["weapon2_wins"], 1)
    baseline_win_rate = stats["weapon1_wins"] / total

    print(f"Baseline win rate: {baseline_win_rate*100:.1f}%")
    print()
    print("Damage vs baseline (ranged)")
    header = f"{'DMG':>4} {'Win%':>7} {'Diff%':>7}"
    separator = "-" * len(header)
    print(header)
    print(separator)

    damage_deltas: Dict[int, float] = {}
    for damage in damage_values:
        if damage == baseline_damage:
            continue
        test_weapon = get_simple_weapon(weapons, "ranged", damage, current_rank)
        progress_label = None
        if should_show_progress(simulations, show_progress):
            progress_label = f"Rank {current_rank} | DMG {damage}"
        stats = run_matchup(
            test_weapon,
            baseline_weapon,
            rank=current_rank,
            simulations=simulations,
            scenario=scenario,
            progress_label=progress_label,
            show_progress=show_progress,
            track_rounds=False,
            pool=pool,
        )
        total = max(stats["weapon1_wins"] + stats["weapon2_wins"], 1)
        win_rate = stats["weapon1_wins"] / total
        diff_rate = win_rate - baseline_win_rate
        damage_deltas[damage] = diff_rate
        print(f"{damage:>4} {win_rate*100:>6.1f}% {diff_rate*100:>+6.1f}%")

    return baseline_win_rate, damage_deltas


def recalc_base_values_for_ranks(
    ranks: List[int],
    x_value: int,
    simulations: int,
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
    base_values_data: Optional[Dict[int, Dict[str, object]]] = None,
) -> Dict[int, Dict[str, object]]:
    if base_values_data is None:
        base_values_data = load_base_values()

    for current_rank in ranks:
        baseline_win_rate, damage_deltas = recalc_base_values_for_rank(
            current_rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            scenario=scenario,
            show_progress=show_progress,
            pool=pool,
        )
        rounded_baseline = round_to_half_percent(baseline_win_rate)
        rounded_damage_deltas = {
            damage: round_to_half_percent(rate)
            for damage, rate in damage_deltas.items()
        }
        base_values_data[current_rank] = {
            "rank": current_rank,
            "baseline_win_rate": rounded_baseline,
            "damage_win_rate": rounded_damage_deltas,
        }

    return base_values_data


def recalc_property_values_for_ranks(
    ranks: List[int],
    x_value: int,
    simulations: int,
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
    base_values_data: Optional[Dict[int, Dict[str, object]]] = None,
    property_values_data: Optional[Dict[int, Dict[str, object]]] = None,
) -> Dict[int, Dict[str, object]]:
    if base_values_data is None:
        base_values_data = load_base_values()
    if property_values_data is None:
        property_values_data = load_property_values()

    for current_rank in ranks:
        if current_rank not in base_values_data:
            print(f"No base values for rank {current_rank}; skipping property costs.")
            continue
        baseline_win_rate = base_values_data[current_rank]["baseline_win_rate"]
        damage_deltas = dict(base_values_data[current_rank].get("damage_win_rate", {}))
        if not damage_deltas:
            print(f"No damage calibration for rank {current_rank}; skipping property costs.")
            continue

        property_costs = calculate_property_costs(
            rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            baseline_win_rate=baseline_win_rate,
            damage_deltas=damage_deltas,
            scenario=scenario,
            show_progress=show_progress,
            pool=pool,
        )
        print()
        print("=" * 80)
        print(f"PROPERTY COSTS | RANK {current_rank}")
        print("=" * 80)
        print_property_costs(property_costs)

        property_values_data[current_rank] = {
            "rank": current_rank,
            "property_costs": property_costs,
        }

    return property_values_data


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    configure_console_encoding()
    recalc_base = prompt_yes_no("Recalculate base values (damage only)? (y/n): ")
    recalc_properties = prompt_yes_no("Recalculate 1-property values? (y/n): ")

    if not recalc_base and not recalc_properties:
        print("Nothing selected.")
        input("Press Enter to exit...")
        raise SystemExit

    rank_input = prompt_rank("Character rank? (1-4 or all): ", allow_all=True)
    x_value = prompt_int("Value of X for properties? ", 1)
    accuracy_confidence = prompt_accuracy("Desired accuracy % (e.g., 95, 99): ")
    rerolls = prompt_int("Number of rerolls? (0+): ", 0)

    simulations_per_scenario = required_simulations_for_accuracy(
        margin=TARGET_MARGIN,
        confidence=accuracy_confidence,
        win_rate=0.5,
    )
    extreme_error = error_margin_for_simulations(
        simulations=simulations_per_scenario,
        confidence=EXTREME_CONFIDENCE,
        win_rate=0.5,
    )

    print(f"Simulations per pair: {simulations_per_scenario:,}.")
    print(
        f"Target accuracy: {accuracy_confidence*100:.3g}% CI, +/- {TARGET_MARGIN*100:.2f}%."
    )
    print(
        "Max deviation (1 in 1,000,000): "
        f"+/- {extreme_error*100:.2f}%."
    )
    if recalc_base:
        print("Base values ignore rerolls; using 0.")
    if recalc_properties:
        print("Property values ignore rerolls; using 0.")

    show_progress = prompt_yes_no("Show simulation progress? (y/n): ")

    pool: Optional[SimulationPool] = None
    if simulations_per_scenario >= PARALLEL_MIN_SIMULATIONS:
        pool = SimulationPool()
        pool.start()

    base_scenario = Scenario(
        name="15m | retreat: N",
        initial_distance=15,
        allow_ranged_retreat=False,
    )

    ranks_to_process = expand_ranks(rank_input)

    base_values_data: Optional[Dict[int, Dict[str, object]]] = None
    if recalc_base:
        print("Recalculating base values.")
        base_values_data = recalc_base_values_for_ranks(
            ranks=ranks_to_process,
            x_value=x_value,
            simulations=simulations_per_scenario,
            scenario=base_scenario,
            show_progress=show_progress,
            pool=pool,
        )
        write_base_values(base_values_data)
        print()
        print("Base values saved to base_values.py (rounded to 0.5%).")

    if recalc_properties:
        if base_values_data is None:
            base_values_data = load_base_values()
        property_values_data = recalc_property_values_for_ranks(
            ranks=ranks_to_process,
            x_value=x_value,
            simulations=simulations_per_scenario,
            scenario=base_scenario,
            show_progress=show_progress,
            pool=pool,
            base_values_data=base_values_data,
        )
        write_property_values(property_values_data)
        print()
        print("Property values saved to property_values.py.")

    if pool is not None:
        pool.close()
    input("Press Enter to exit...")
