"""
Weapons Simulator for Andromeda TTRPG
Baseline-vs-baseline scenarios with distance and optional ranged retreat
"""

import random
import math
import concurrent.futures
import locale
import os
import re
import sys
import json
from dataclasses import dataclass, field
from pathlib import Path
from collections import Counter
from itertools import combinations
from typing import List, Dict, Set, Tuple, Optional
import statistics
from sim_rules import (
    ACTIONS_PER_ROUND,
    ARMOR_PIERCE_MIN_DAMAGE,
    BASELINE_DAMAGE_BY_RANK,
    BASELINE_SCENARIO_DEFS,
    BLEED_DAMAGE_PER_ROUND,
    DANGEROUS_SELF_DAMAGE,
    DEFAULT_INITIAL_DISTANCE,
    DEFAULT_MAX_ROUNDS,
    DEFAULT_OPPONENT_TYPE_WEIGHTS,
    DEFAULT_SCENARIO_OPTIONS_DEF,
    DISTANCE_MAX,
    DISTANCE_MIN,
    EPSILON,
    EXTREME_CONFIDENCE,
    CONTROL_PROPERTIES,
    IMMOBILIZE_DURATION_ROUNDS,
    MAGICAL_DEFENSE_DIVISOR,
    MAX_DAMAGE_BY_RANK,
    MELEE_BASE_RANGE,
    MELEE_COVER_BONUS,
    MIN_HIT_DAMAGE,
    OPPORTUNITY_LEAVE_CHANCE,
    PENETRATION_BONUS,
    PROPERTY_DEFS,
    PROPERTY_WEAPON_RESTRICTIONS,
    RANGED_BASE_RANGE,
    RANGED_RETREAT_SPEED_MULT,
    RANK_PARAMS,
    REACTION_AVAILABLE_DEFAULT,
    REROLL_PROPERTY,
    SIMULATED_PROPERTIES,
    SLOW_DURATION_ROUNDS,
    SLOW_SPEED_MULT,
    STUN_ACTION_LOSS,
    TARGET_MARGIN,
    UTILITY_ACTION_PROPERTIES,
    WEAPON_TYPES,
)
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
    PROP_ARMORPIERCE,
    BatchTask,
    SimulationPool,
    acquire_executor,
    batch_map,
    build_simulation_chunks,
    multinomial_counts,
    fast_matchup_chunk,
    full_matchup_chunk,
)

# ============================================================================
# CONSTANTS
# ============================================================================

BASE_VALUES_PATH = Path(__file__).with_name("base_values.json")
PROPERTY_VALUES_PATH = Path(__file__).with_name("property_values.json")
PROPERTY_COMBOS_PATH = Path(__file__).with_name("property_combos.json")
PROPERTY_MATCHUPS_PATH = Path(__file__).with_name("property_matchups.json")
PROPERTY_TRIPLES_PATH = Path(__file__).with_name("property_triples.json")

DEFAULT_WEAPON_TYPE_SET = set(WEAPON_TYPES)
MAX_CHARACTER_RANK = max(RANK_PARAMS.keys())
RANK_LIMITED_PROPERTIES = {
    "Armor Pierce X",
    "Immobilize X",
    "Stun X",
    "Penetration X",
}
REQUIRE_NUMBA = True


def require_numba(context: str = "simulation") -> None:
    if REQUIRE_NUMBA and not NUMBA_AVAILABLE:
        raise RuntimeError(
            "Numba is required for accelerated simulations, "
            f"but it is not available ({context}). Install numba and retry."
        )


def should_skip_property_for_x(prop_name: str, x_value: int) -> bool:
    return prop_name in RANK_LIMITED_PROPERTIES and x_value > MAX_CHARACTER_RANK


def allowed_weapon_types_for(prop_name: str) -> Set[str]:
    return set(PROPERTY_WEAPON_RESTRICTIONS.get(prop_name, DEFAULT_WEAPON_TYPE_SET))


def property_label(prop_name: str, prop_value: object) -> str:
    if isinstance(prop_value, bool):
        return prop_name if prop_value else prop_name
    if prop_name.endswith(" X"):
        base_name = prop_name[:-2].strip()
        return f"{base_name} {prop_value}"
    if prop_value in (None, False):
        return prop_name
    return f"{prop_name} {prop_value}"


def property_label_sort_key(label: str) -> Tuple[str, int, int]:
    text = str(label)
    match = re.match(r"^(.*?)(?:\s+(-?\d+))$", text)
    if match:
        base = match.group(1).strip().lower()
        return (base, 0, int(match.group(2)))
    return (text.lower(), 1, 0)


def tuple_label_sort_key(labels: Tuple[str, ...]) -> Tuple[Tuple[str, int, int], ...]:
    return tuple(property_label_sort_key(label) for label in labels)


def properties_for_weapon_type(weapon_type: str) -> List[str]:
    return [
        prop_name
        for prop_name, _ in PROPERTY_DEFS
        if weapon_type in allowed_weapon_types_for(prop_name)
    ]


def resolve_property_cost(
    prop_label: str,
    weapon_type: str,
    property_costs: Dict[str, Dict[str, Optional[float]]],
) -> float:
    entry = property_costs.get(weapon_type, {}).get(prop_label, {})
    return normalize_property_entry(entry)["cost"] or 0.0


def parse_property_input(raw: str) -> Tuple[str, object]:
    candidate = raw.strip()
    if not candidate:
        raise ValueError("Property input cannot be empty.")
    candidate = candidate.replace(":", " ").replace("=", " ").strip()
    lower_candidate = candidate.lower()
    for prop_name, prop_value in PROPERTY_DEFS:
        if prop_name.endswith(" X"):
            base_name = prop_name[:-2].strip().lower()
            if lower_candidate.startswith(base_name):
                suffix = candidate[len(base_name) :].strip()
                if not suffix:
                    continue
                suffix = suffix.lstrip(":=").strip()
                if not suffix:
                    continue
                try:
                    value = int(suffix.split()[0])
                    return prop_name, value
                except ValueError:
                    continue
        else:
            if lower_candidate == prop_name.lower():
                return prop_name, True
    raise ValueError(f"Unknown property '{raw}'.")


def property_allows_weapon_type(prop_name: str, weapon_type: str) -> bool:
    return weapon_type in allowed_weapon_types_for(prop_name)

# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class Weapon:
    """Represents a weapon with properties"""
    name: str
    damage: float
    weapon_type: str  # "melee" or "ranged"
    properties: Dict[str, any] = field(default_factory=dict)
    rank: int = 1
    
    def __post_init__(self):
        """Validate weapon data"""
        assert self.weapon_type in ["melee", "ranged"], "Invalid weapon type"
        assert 1 <= self.rank <= 4, "Invalid rank (1-4)"
    
    def get_range(self) -> float:
        """Get effective range of weapon in meters"""
        base_range = MELEE_BASE_RANGE if self.weapon_type == "melee" else RANGED_BASE_RANGE
        range_bonus = self.properties.get("Reach X", 0)
        return base_range + range_bonus


@dataclass
class Character:
    """Represents a character in combat"""
    name: str
    rank: int
    weapon: Weapon
    hp: float = None
    max_hp: float = None
    defense: float = None
    dice: int = None
    skill: int = None
    speed: float = None
    position: float = 0.0
    actions_remaining: int = ACTIONS_PER_ROUND
    reaction_remaining: bool = REACTION_AVAILABLE_DEFAULT
    moved_this_round: bool = False
    shots_fired_since_reload: int = 0
    reload_required: bool = False
    aggressive_fire_pending: bool = False
    status_effects: Dict[str, int] = field(default_factory=dict)
    utility_actions_used: Set[str] = field(default_factory=set)
    rerolls_remaining: int = 0
    action_damage_dealt: float = 0.0
    actions_spent: int = 0
    
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
        self.actions_remaining = ACTIONS_PER_ROUND
        self.reaction_remaining = REACTION_AVAILABLE_DEFAULT
        self.moved_this_round = False
        self.shots_fired_since_reload = 0
        self.reload_required = False
        self.aggressive_fire_pending = False
        self.status_effects.clear()
        self.utility_actions_used.clear()
        self.position = 0.0
        self.rerolls_remaining = normalize_int(
            self.weapon.properties.get(REROLL_PROPERTY)
        )
        self.action_damage_dealt = 0.0
        self.actions_spent = 0

    def is_alive(self) -> bool:
        """Check if character is still alive"""
        return self.hp > 0.0
    
    def take_damage(self, damage: float):
        """Apply damage to character"""
        self.hp = max(0.0, self.hp - damage)
    
    def reset_round(self) -> float:
        """Reset round-based resources"""
        self.actions_remaining = ACTIONS_PER_ROUND
        self.reaction_remaining = REACTION_AVAILABLE_DEFAULT
        self.moved_this_round = False
        self.aggressive_fire_pending = False
        self.utility_actions_used.clear()
        bleed_damage = 0.0
        
        # Apply ДОТ effects at start of round
        if "Bleeding" in self.status_effects:
            self.take_damage(BLEED_DAMAGE_PER_ROUND)
            bleed_damage = BLEED_DAMAGE_PER_ROUND
    
        return bleed_damage

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
        max_rounds: int = DEFAULT_MAX_ROUNDS,
        verbose: bool = False,
        initial_distance: float = DEFAULT_INITIAL_DISTANCE,
    ):
        self.attacker = attacker
        self.defender = defender
        self.max_rounds = max_rounds
        self.round_count = 0
        self.verbose = verbose
        self.combat_log = []
        self.initial_distance = float(initial_distance)
        self.distance = float(initial_distance)  # meters between characters

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
        if status == "Slowed" and "Immobilized" in defender.status_effects:
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
        - "Immobilized": cannot move
        - "Slowed": speed reduced by 50%
        """
        prev_distance = self.distance

        def effective_speed(ch: Character) -> float:
            if "Immobilized" in ch.status_effects:
                return 0.0
            spd = float(ch.speed)
            if "Slowed" in ch.status_effects:
                spd *= SLOW_SPEED_MULT
            return spd

        attacker_range = attacker.weapon.get_range()
        defender_range = defender.weapon.get_range()
        attacker_type = attacker.weapon.weapon_type
        defender_type = defender.weapon.weapon_type

        melee_close = 0.0
        ranged_retreat = 0.0

        if attacker_type == "melee" and self.distance > attacker_range:
            movement = effective_speed(attacker)
            if movement > 0:
                attacker.moved_this_round = True
                melee_close += movement

        if defender_type == "melee" and self.distance > defender_range:
            movement = effective_speed(defender)
            if movement > 0:
                defender.moved_this_round = True
                melee_close += movement

        if (
            attacker_type == "ranged"
            and defender_type == "melee"
            and self.distance < attacker_range
        ):
            movement = effective_speed(attacker) * RANGED_RETREAT_SPEED_MULT
            if movement > 0:
                attacker.moved_this_round = True
                ranged_retreat += movement

        if (
            defender_type == "ranged"
            and attacker_type == "melee"
            and self.distance < defender_range
        ):
            movement = effective_speed(defender) * RANGED_RETREAT_SPEED_MULT
            if movement > 0:
                defender.moved_this_round = True
                ranged_retreat += movement

        if melee_close != 0.0 or ranged_retreat != 0.0:
            self.distance = self.distance - melee_close + ranged_retreat
            if self.distance < DISTANCE_MIN:
                self.distance = DISTANCE_MIN
            elif self.distance > DISTANCE_MAX:
                self.distance = DISTANCE_MAX

        dash_close = 0.0
        for ch, ch_type, ch_range in (
            (attacker, attacker_type, attacker_range),
            (defender, defender_type, defender_range),
        ):
            if ch_type != "melee":
                continue
            if ch.actions_remaining <= 0 or self.distance <= ch_range:
                continue
            speed = effective_speed(ch)
            if speed <= 0:
                continue
            gap = self.distance - ch_range
            dash_actions = min(ch.actions_remaining, math.ceil(gap / speed))
            if dash_actions <= 0:
                continue
            ch.actions_remaining -= dash_actions
            ch.actions_spent += dash_actions
            ch.moved_this_round = True
            dash_close += speed * dash_actions

        if dash_close != 0.0:
            self.distance -= dash_close
            if self.distance < DISTANCE_MIN:
                self.distance = DISTANCE_MIN
            elif self.distance > DISTANCE_MAX:
                self.distance = DISTANCE_MAX

        if attacker_type != defender_type:
            melee = attacker if attacker_type == "melee" else defender
            ranged = defender if melee is attacker else attacker
            melee_range = melee.weapon.get_range()
            if prev_distance <= melee_range and self.distance > melee_range:
                if (
                    melee.reaction_remaining
                    and melee.is_alive()
                    and ranged.is_alive()
                    and random.random() < OPPORTUNITY_LEAVE_CHANCE
                ):
                    melee.reaction_remaining = False
                    current_distance = self.distance
                    self.distance = prev_distance
                    self.perform_reaction_attack(melee, ranged)
                    self.distance = current_distance

    def roll_attack(
        self,
        attacker: Character,
        defender: Character,
    ) -> Tuple[int, float, bool]:
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
            return 0, 0.0, False
        
        stabilization_bonus = 0
        if "Stabilization X" in attacker.weapon.properties and not attacker.moved_this_round:
            stabilization_bonus = attacker.weapon.properties["Stabilization X"]
        def melee_has_cover(character: Character) -> bool:
            return (
                character.weapon.weapon_type == "melee"
                and self.distance > character.weapon.get_range()
            )

        defender_melee_cover = melee_has_cover(defender)

        penetration_bonus = 0
        penetration_threshold = attacker.weapon.properties.get("Penetration X")
        if penetration_threshold and not defender_melee_cover:
            try:
                threshold_value = int(penetration_threshold)
            except (TypeError, ValueError):
                threshold_value = 0
            if defender.rank <= threshold_value:
                penetration_bonus = PENETRATION_BONUS

        defense_value = float(defender.defense)
        if "Magical" in attacker.weapon.properties:
            defense_value = round(defense_value / MAGICAL_DEFENSE_DIVISOR, 1)
        if defender_melee_cover:
            defense_value += MELEE_COVER_BONUS

        def evaluate_roll() -> Tuple[int, bool, float]:
            roll_value = random.randint(1, attacker.dice)
            raw_roll = roll_value

            if "Dangerous X" in attacker.weapon.properties:
                danger_threshold = attacker.weapon.properties["Dangerous X"]
                if raw_roll > danger_threshold:
                    attacker.take_damage(DANGEROUS_SELF_DAMAGE)

            if "Accuracy X" in attacker.weapon.properties:
                accuracy_bonus = attacker.weapon.properties["Accuracy X"]
                roll_value = min(roll_value + accuracy_bonus, attacker.dice)

            if "Guarantee X" in attacker.weapon.properties:
                guarantee = attacker.weapon.properties["Guarantee X"]
                if roll_value != 1:  # Except 1
                    roll_value = max(roll_value, guarantee)

            total_roll = roll_value + attacker.skill + stabilization_bonus + penetration_bonus
            hit_value = total_roll >= defense_value

            damage_value = 0.0
            if hit_value:
                margin = total_roll - defense_value
                damage_value = margin + attacker.weapon.damage
                if raw_roll == attacker.dice and "Escalation X" in attacker.weapon.properties:
                    escalation_value = attacker.weapon.properties["Escalation X"]
                    damage_value += escalation_value

            return roll_value, hit_value, damage_value

        roll, hit, damage = evaluate_roll()

        if not hit:
            damage = 0.0
            while attacker.rerolls_remaining > 0:
                attacker.rerolls_remaining -= 1
                roll, hit, reroll_damage = evaluate_roll()
                if hit:
                    damage = reroll_damage
                    break

            if (not hit) and ("Armor Pierce X" in attacker.weapon.properties):
                max_rank = attacker.weapon.properties["Armor Pierce X"]
                if defender.rank <= max_rank:
                    damage = max(damage, ARMOR_PIERCE_MIN_DAMAGE)

        damage = max(MIN_HIT_DAMAGE, damage) if hit else damage

        return roll, damage, hit
    
    def record_shot(self, attacker: Character):
        """Track shots for Перезарядка"""
        reload_after = attacker.weapon.properties.get("Reload X")
        if not reload_after:
            return
        attacker.shots_fired_since_reload += 1
        if attacker.shots_fired_since_reload >= reload_after:
            attacker.reload_required = True
    
    def perform_reaction_attack(self, attacker: Character, defender: Character) -> bool:
        """Perform a reaction attack without spending actions."""
        if "Reload X" in attacker.weapon.properties and attacker.reload_required:
            return False
        
        roll, damage, hit = self.roll_attack(attacker, defender)
        shot_fired = roll > 0
        action_damage = 0.0
        
        if hit:
            defender.take_damage(damage)
            action_damage = damage
            self.apply_status_effects(attacker, defender, hit)
            if self.verbose:
                self.combat_log.append(
                    f"Round {self.round_count}: {attacker.name} реакцией наносит {damage} урона"
                )
        elif damage > 0:
            defender.take_damage(damage)
            action_damage = damage
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
            attacker.action_damage_dealt += action_damage
        
        return hit

    def apply_status_effects(self, attacker: Character, defender: Character, hit: bool):
        """Apply status effects from weapon properties"""
        if not hit:
            return
        
        # ДОТ effects (apply for X rounds)
        if "Bleed X" in attacker.weapon.properties:
            duration = attacker.weapon.properties["Bleed X"]
            defender.status_effects["Bleeding"] = max(
                defender.status_effects.get("Bleeding", 0),
                duration,
            )
        
        # Slow (next round speed -50%)
        if "Slow" in attacker.weapon.properties:
            defender.status_effects["Slowed"] = max(
                defender.status_effects.get("Slowed", 0),
                SLOW_DURATION_ROUNDS,
            )
        
        # Disorienting (lose reaction)
        if "Disorienting" in attacker.weapon.properties:
            defender.reaction_remaining = False
        
        # Обездвиживание (can't move for X rounds)
        if "Immobilize X" in attacker.weapon.properties:
            max_rank = attacker.weapon.properties["Immobilize X"]
            if defender.rank <= max_rank:
                defender.status_effects["Immobilized"] = max(
                    defender.status_effects.get("Immobilized", 0),
                    IMMOBILIZE_DURATION_ROUNDS,
                )
        
        # Ошеломление (lose action)
        if "Stun X" in attacker.weapon.properties:
            max_rank = attacker.weapon.properties["Stun X"]
            if defender.rank <= max_rank:
                defender.actions_remaining = max(
                    0,
                    defender.actions_remaining - STUN_ACTION_LOSS,
                )
    
    def perform_attack(self, attacker: Character, defender: Character) -> bool:
        """Perform a single attack. Returns True if hit."""
        if attacker.actions_remaining <= 0:
            return False
        
        if "Reload X" in attacker.weapon.properties and attacker.reload_required:
            attacker.actions_remaining -= 1
            attacker.actions_spent += 1
            attacker.reload_required = False
            attacker.shots_fired_since_reload = 0
            return False
        
        attacker.actions_remaining -= 1
        attacker.actions_spent += 1

        roll, damage, hit = self.roll_attack(attacker, defender)
        shot_fired = roll > 0
        action_damage = 0.0
        
        if hit:
            defender.take_damage(damage)
            action_damage = damage
            self.apply_status_effects(attacker, defender, hit)
            if self.verbose:
                self.combat_log.append(
                    f"Round {self.round_count}: {attacker.name} hits for {damage} damage"
                )
        else:
            if damage > 0:
                defender.take_damage(damage)
                action_damage = damage
                if self.verbose:
                    self.combat_log.append(
                        f"Round {self.round_count}: {attacker.name} misses, but бронебойность наносит {damage} урона"
                    )
                if not defender.is_alive():
                    if shot_fired:
                        self.record_shot(attacker)
                    if shot_fired:
                        attacker.action_damage_dealt += action_damage
                    return False

            else:
                if self.verbose:
                    self.combat_log.append(
                        f"Round {self.round_count}: {attacker.name} misses"
                    )
            
            if shot_fired and "Risk" in attacker.weapon.properties:
                if defender.reaction_remaining and self.can_attack(defender, attacker):
                    defender.reaction_remaining = False
                    self.perform_reaction_attack(defender, attacker)
                    if not attacker.is_alive():
                        return False
        
        if shot_fired:
            self.record_shot(attacker)

        if (
            shot_fired
            and attacker.weapon.weapon_type == "ranged"
            and defender.weapon.weapon_type == "melee"
            and defender.reaction_remaining
            and defender.is_alive()
            and self.distance <= defender.weapon.get_range()
        ):
            defender.reaction_remaining = False
            self.perform_reaction_attack(defender, attacker)
            if not attacker.is_alive():
                return False
        
        if shot_fired:
            attacker.action_damage_dealt += action_damage
        return hit

    def simulate_round(self) -> bool:
        """
        Simulate one round of combat.
        Returns True if combat continues, False if one character is dead.
        """
        self.round_count += 1
        
        # Both characters reset for round
        attacker_bleed = self.attacker.reset_round()
        defender_bleed = self.defender.reset_round()

        if attacker_bleed > 0:
            self.defender.action_damage_dealt += attacker_bleed
        if defender_bleed > 0:
            self.attacker.action_damage_dealt += defender_bleed
        
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

        if (
            self.attacker.is_alive()
            and self.defender.is_alive()
            and "Aggressive Fire" in self.attacker.weapon.properties
            and self.attacker.reaction_remaining
            and self.can_attack(self.attacker, self.defender)
        ):
            self.attacker.reaction_remaining = False
            self.perform_reaction_attack(self.attacker, self.defender)

        # Defender acts if alive (up to 2 actions)

        if not self.defender.is_alive():
            return False

        while (
            self.defender.actions_remaining > 0
            and self.attacker.is_alive()
            and self.defender.is_alive()
        ):
            self.perform_attack(self.defender, self.attacker)

        if not self.attacker.is_alive():
            return False
        
        if (
            self.attacker.is_alive()
            and self.defender.is_alive()
            and "Aggressive Fire" in self.defender.weapon.properties
            and self.defender.reaction_remaining
            and self.can_attack(self.defender, self.attacker)
        ):
            self.defender.reaction_remaining = False
            self.perform_reaction_attack(self.defender, self.attacker)

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


@dataclass(frozen=True)
class ScenarioOption:
    """Defines per-battle matchup context."""
    name: str
    matchup: str  # "mm", "rr", or "mr" (melee-melee, ranged-ranged, mixed)
    distance_mult: float
    weight: float


DEFAULT_SCENARIO_OPTIONS = [
    ScenarioOption(**entry) for entry in DEFAULT_SCENARIO_OPTIONS_DEF
]


def matchup_key(type_a: str, type_b: str) -> str:
    if type_a == "melee" and type_b == "melee":
        return "mm"
    if type_a == "ranged" and type_b == "ranged":
        return "rr"
    return "mr"


MELEE_BASELINE_SCENARIO = Scenario(**BASELINE_SCENARIO_DEFS["melee"])
RANGED_BASELINE_SCENARIO = Scenario(**BASELINE_SCENARIO_DEFS["ranged"])
DEFAULT_BASELINE_SCENARIOS = {
    "melee": MELEE_BASELINE_SCENARIO,
    "ranged": RANGED_BASELINE_SCENARIO,
}


def build_scenario_sampler(
    matchup: str,
    scenarios: Optional[List[ScenarioOption]] = None,
) -> Tuple[List[ScenarioOption], List[float]]:
    pool = DEFAULT_SCENARIO_OPTIONS if scenarios is None else scenarios
    matches = [entry for entry in pool if entry.matchup == matchup]
    if not matches:
        matches = pool
    weights = [entry.weight for entry in matches]
    if all(weight <= 0 for weight in weights):
        weights = [1.0 for _ in matches]
    return matches, weights


def build_weapons(rank: int, x_value: int, rerolls: int) -> List[Weapon]:
    """Create weapon list for future property tests and baseline extraction."""
    weapons: List[Weapon] = []

    for wtype in WEAPON_TYPES:
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
        if prop_name == REROLL_PROPERTY:
            continue
        prop_setting = x_value if isinstance(prop_value, int) else prop_value
        props = {prop_name: prop_setting}
        if rerolls:
            props[REROLL_PROPERTY] = rerolls
        allowed_types = allowed_weapon_types_for(prop_name)
        weapon_type = "melee" if "melee" in allowed_types else "ranged"
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
    # Keep enough headroom in base calibration so high-value properties
    # are mapped against simulated points, not pure tail extrapolation.
    max_damage = max(
        MAX_DAMAGE_BY_RANK[rank],
        BASELINE_DAMAGE_BY_RANK[rank] + 10,
    )
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


def build_weapon_props_array(weapon: Weapon) -> Tuple[List[float], float]:
    props = [0.0] * PROP_COUNT
    props[PROP_TYPE] = 0 if weapon.weapon_type == "melee" else 1
    props[PROP_DAMAGE] = float(weapon.damage)
    props[PROP_PENETRATION] = normalize_int(
        weapon.properties.get("Penetration X")
    )
    props[PROP_ESCALATION] = normalize_int(weapon.properties.get("Escalation X"))
    props[PROP_RELOAD] = normalize_int(weapon.properties.get("Reload X"))
    props[PROP_STABILIZATION] = normalize_int(
        weapon.properties.get("Stabilization X")
    )
    props[PROP_ACCURACY] = normalize_int(weapon.properties.get("Accuracy X"))
    props[PROP_GUARANTEE] = normalize_int(weapon.properties.get("Guarantee X"))
    props[PROP_STUN] = normalize_int(weapon.properties.get("Stun X"))
    props[PROP_APPLY_SLOW] = 1.0 if "Slow" in weapon.properties else 0.0
    props[PROP_DANGEROUS] = normalize_int(weapon.properties.get("Dangerous X"))
    props[PROP_RISK] = 1.0 if "Risk" in weapon.properties else 0.0
    props[PROP_AGGRESSIVE] = 1.0 if "Aggressive Fire" in weapon.properties else 0.0
    props[PROP_ARMORPIERCE] = normalize_int(weapon.properties.get("Armor Pierce X"))
    props[PROP_BLEED] = normalize_int(weapon.properties.get("Bleed X"))
    props[PROP_DISORIENT] = 1.0 if "Disorienting" in weapon.properties else 0.0
    props[PROP_IMMOBILIZE] = normalize_int(
        weapon.properties.get("Immobilize X")
    )
    props[PROP_MAGIC] = 1.0 if "Magical" in weapon.properties else 0.0
    props[PROP_REROLLS] = normalize_int(weapon.properties.get(REROLL_PROPERTY))

    return props, weapon.get_range()


def build_matchup_props(
    weapon1: Weapon,
    weapon2: Weapon,
) -> Tuple[List[List[float]], List[float]]:
    props1, range1 = build_weapon_props_array(weapon1)
    props2, range2 = build_weapon_props_array(weapon2)
    return [props1, props2], [range1, range2]


def safe_mean(values: List[float]) -> float:
    return statistics.mean(values) if values else 0.0


def round_to_half_percent(rate: float) -> float:
    # Deadzone: treat tiny deltas as zero to avoid ±0.5% noise around 0.
    if abs(rate) < 0.005:
        return 0.0
    return round(rate / 0.005) * 0.005


def _load_json(path: Path) -> object:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_json(path: Path, payload: object):
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _encode_tuple_key(key: Tuple[str, ...]) -> str:
    return json.dumps(list(key), ensure_ascii=False)


def _decode_tuple_key(raw_key: object, expected_len: Optional[int]) -> Tuple[str, ...]:
    if isinstance(raw_key, (list, tuple)):
        return tuple(str(part) for part in raw_key)
    if not isinstance(raw_key, str):
        return (str(raw_key),)
    try:
        decoded = json.loads(raw_key)
    except Exception:
        return (raw_key,)
    if isinstance(decoded, list):
        if expected_len is None or len(decoded) == expected_len:
            return tuple(str(part) for part in decoded)
    return (raw_key,)


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


def normalize_property_v2_entry(entry: object) -> Dict[str, float]:
    if isinstance(entry, dict):
        avg_raw = entry.get("average_action_damage", 0.0)
        cost_raw = entry.get("cost", 0.0)
        prevention_raw = entry.get("damage_prevention", 0.0)
        try:
            avg_value = float(avg_raw)
        except (TypeError, ValueError):
            avg_value = 0.0
        try:
            cost_value = float(cost_raw)
        except (TypeError, ValueError):
            cost_value = 0.0
        try:
            prevention_value = float(prevention_raw)
        except (TypeError, ValueError):
            prevention_value = 0.0
        return {
            "average_action_damage": avg_value,
            "cost": cost_value,
            "damage_prevention": prevention_value,
        }
    try:
        avg_value = float(entry)
    except (TypeError, ValueError):
        avg_value = 0.0
    return {"average_action_damage": avg_value, "cost": 0.0, "damage_prevention": 0.0}


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
    return enforce_monotonic_calibration(calibration)


def enforce_monotonic_calibration(calibration: Dict[int, float]) -> Dict[int, float]:
    """Ensure delta_logit is non-decreasing as damage delta increases."""
    if not calibration:
        return {}
    ordered = sorted(calibration.items(), key=lambda item: item[0])
    adjusted: Dict[int, float] = {}
    prev = None
    for k, d in ordered:
        if prev is None:
            prev = d
        else:
            if d < prev:
                d = prev
            prev = d
        adjusted[k] = d
    return adjusted


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

    # if target outside, extrapolate using nearest segment (prefer distinct deltas)
    if delta_logit <= points[0][1]:
        if len(points) == 1:
            return float(points[0][0])
        (k1, d1) = points[0]
        k2, d2 = points[1]
        for k_next, d_next in points[1:]:
            k2, d2 = k_next, d_next
            if d2 != d1:
                break
        return interpolate_linear(k1, d1, k2, d2, delta_logit)

    if delta_logit >= points[-1][1]:
        if len(points) == 1:
            return float(points[-1][0])
        (k2, d2) = points[-1]
        k1, d1 = points[-2]
        for k_prev, d_prev in reversed(points[:-1]):
            k1, d1 = k_prev, d_prev
            if d1 != d2:
                break
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
    raw = _load_json(BASE_VALUES_PATH)
    if not isinstance(raw, dict):
        return {}
    normalized: Dict[int, Dict[str, object]] = {}
    for key, rank_values in raw.items():
        try:
            rank = int(key)
        except (TypeError, ValueError):
            continue
        rank_data = dict(rank_values or {})
        baselines: Dict[str, Dict[str, object]] = {}
        for weapon_type, baseline_stats in (rank_data.get("baselines") or {}).items():
            stats = dict(baseline_stats or {})
            avg_rounds = stats.get("avg_rounds", stats.get("initial_distance", 0.0))
            stats["avg_rounds"] = float(avg_rounds)
            stats["baseline_win_rate"] = float(stats.get("baseline_win_rate", 0.5))
            stats["average_action_damage"] = float(
                stats.get("average_action_damage", 0.0)
            )
            damage_action = stats.get("damage_action_damage", {})
            stats["damage_action_damage"] = {
                int(damage_key): float(value)
                for damage_key, value in (damage_action or {}).items()
            }
            baselines[weapon_type] = stats
        rank_data["baselines"] = baselines
        normalized[rank] = rank_data
    return normalized


def write_base_values(values: Dict[int, Dict[str, object]]):
    payload: Dict[str, Dict[str, object]] = {}
    for rank in sorted(values.keys()):
        rank_values = values[rank]
        rank_field = rank_values.get("rank", rank)
        baselines = rank_values.get("baselines", {})
        baseline_payload: Dict[str, Dict[str, object]] = {}
        for weapon_type in sorted(baselines.keys()):
            baseline = baselines[weapon_type]
            avg_rounds = baseline.get("avg_rounds", baseline.get("initial_distance", 0.0))
            baseline_rate = float(baseline.get("baseline_win_rate", 0.5))
            damage_action = baseline.get("damage_action_damage", {})
            baseline_payload[weapon_type] = {
                "avg_rounds": round(float(avg_rounds), 2),
                "baseline_win_rate": baseline_rate,
                "average_action_damage": round(
                    float(baseline.get("average_action_damage", 0.0)), 2
                ),
                "damage_action_damage": {
                    str(damage_key): round(float(damage_action[damage_key]), 2)
                    for damage_key in sorted(damage_action.keys())
                },
            }
        payload[str(rank)] = {
            "rank": rank_field,
            "baselines": baseline_payload,
        }

    _write_json(BASE_VALUES_PATH, payload)


def load_property_values() -> Dict[int, Dict[str, object]]:
    raw = _load_json(PROPERTY_VALUES_PATH)
    if not isinstance(raw, dict):
        return {}
    normalized: Dict[int, Dict[str, object]] = {}
    for key, rank_values in raw.items():
        try:
            rank = int(key)
        except (TypeError, ValueError):
            continue
        rank_data = dict(rank_values or {})
        property_costs = rank_data.get("property_costs") or {}
        normalized_costs: Dict[str, Dict[str, Dict[str, float]]] = {}
        sample = next(iter(property_costs.values()), None)
        if sample and isinstance(sample, dict) and (
            "average_action_damage" in sample
            or "cost" in sample
            or "delta_win_rate" in sample
        ):
            normalized_costs["ranged"] = {
                prop_name: normalize_property_v2_entry(entry)
                for prop_name, entry in property_costs.items()
            }
        else:
            for weapon_type, type_costs in property_costs.items():
                normalized_costs[weapon_type] = {
                    prop_name: normalize_property_v2_entry(entry)
                    for prop_name, entry in (type_costs or {}).items()
                }
        rank_data["property_costs"] = normalized_costs
        normalized[rank] = rank_data
    return normalized


def write_property_values(values: Dict[int, Dict[str, object]]):
    payload: Dict[str, Dict[str, object]] = {}
    for rank in sorted(values.keys()):
        rank_values = values[rank]
        rank_field = rank_values.get("rank", rank)
        property_costs = rank_values.get("property_costs") or {}
        costs_payload: Dict[str, Dict[str, object]] = {}
        for weapon_type in sorted(property_costs.keys()):
            type_costs = property_costs[weapon_type] or {}
            costs_payload[weapon_type] = {
                prop_name: normalize_property_v2_entry(type_costs[prop_name])
                for prop_name in sorted(type_costs.keys(), key=property_label_sort_key)
            }
        payload[str(rank)] = {
            "rank": rank_field,
            "property_costs": costs_payload,
        }

    _write_json(PROPERTY_VALUES_PATH, payload)


def load_property_values_v2() -> Dict[int, Dict[str, object]]:
    return load_property_values()


def write_property_values_v2(values: Dict[int, Dict[str, object]]):
    write_property_values(values)


def build_property_weapon(
    prop_name: str,
    property_lookup: Dict[str, object],
    x_value: int,
    baseline_damage: int,
    rank: int,
    weapon_type: str,
) -> Weapon:
    prop_value = property_lookup[prop_name]
    prop_setting = x_value if isinstance(prop_value, int) else prop_value
    return Weapon(
        name=f"{weapon_type.upper()} | {prop_name} | DMG {baseline_damage}",
        damage=baseline_damage,
        weapon_type=weapon_type,
        properties={prop_name: prop_setting},
        rank=rank,
    )


def load_property_combos() -> Dict[int, Dict[str, object]]:
    raw = _load_json(PROPERTY_COMBOS_PATH)
    if not isinstance(raw, dict):
        return {}
    normalized: Dict[int, Dict[str, object]] = {}
    for key, rank_values in raw.items():
        try:
            rank = int(key)
        except (TypeError, ValueError):
            continue
        rank_data = dict(rank_values or {})
        pair_costs = rank_data.get("pair_costs")
        if pair_costs is None:
            pair_costs = {
                key: value for key, value in rank_data.items() if key != "rank"
            }
        normalized_pairs: Dict[str, Dict[Tuple[str, str], Dict[str, float]]] = {}
        sample = next(iter(pair_costs.values()), None)
        if sample and isinstance(sample, dict):
            for weapon_type, type_pairs in pair_costs.items():
                normalized_pairs[weapon_type] = {
                    _decode_tuple_key(pair_key, 2): dict(entry or {})
                    for pair_key, entry in (type_pairs or {}).items()
                }
        else:
            normalized_pairs["ranged"] = {
                _decode_tuple_key(pair_key, 2): dict(entry or {})
                for pair_key, entry in (pair_costs or {}).items()
            }
        rank_data["pair_costs"] = normalized_pairs
        normalized[rank] = rank_data
    return normalized


def write_property_combos(values: Dict[int, Dict[str, object]]):
    payload: Dict[str, Dict[str, object]] = {}
    for rank in sorted(values.keys()):
        rank_values = values[rank]
        pair_costs = rank_values.get("pair_costs") or {}
        pair_payload: Dict[str, Dict[str, object]] = {}
        for weapon_type in sorted(pair_costs.keys()):
            type_pairs = pair_costs[weapon_type] or {}
            pair_payload[weapon_type] = {
                _encode_tuple_key(pair_key): dict(entry or {})
                for pair_key, entry in sorted(
                    type_pairs.items(), key=lambda item: tuple_label_sort_key(item[0])
                )
            }
        payload[str(rank)] = {"pair_costs": pair_payload}
    _write_json(PROPERTY_COMBOS_PATH, payload)


def load_property_matchups() -> Dict[int, Dict[str, object]]:
    raw = _load_json(PROPERTY_MATCHUPS_PATH)
    if not isinstance(raw, dict):
        return {}
    normalized: Dict[int, Dict[str, object]] = {}
    for key, rank_values in raw.items():
        try:
            rank = int(key)
        except (TypeError, ValueError):
            continue
        rank_data = dict(rank_values or {})
        matchups = rank_data.get("matchups")
        if matchups is None:
            matchups = {
                key: value for key, value in rank_data.items() if key != "rank"
            }
        normalized_matchups: Dict[str, Dict[str, Dict[str, float]]] = {}
        sample = next(iter(matchups.values()), None)
        if sample and isinstance(sample, dict):
            normalized_matchups = {
                weapon_type: {
                    prop_name: dict(opponents or {})
                    for prop_name, opponents in (type_matchups or {}).items()
                }
                for weapon_type, type_matchups in matchups.items()
            }
        else:
            normalized_matchups["ranged"] = dict(matchups)
        rank_data["matchups"] = normalized_matchups
        normalized[rank] = rank_data
    return normalized


def write_property_matchups(values: Dict[int, Dict[str, object]]):
    payload: Dict[str, Dict[str, object]] = {}
    for rank in sorted(values.keys()):
        rank_values = values[rank]
        rank_matchups = rank_values.get("matchups") or {}
        matchups_payload: Dict[str, Dict[str, Dict[str, object]]] = {}
        for weapon_type in sorted(rank_matchups.keys()):
            type_matchups = rank_matchups[weapon_type] or {}
            matchups_payload[weapon_type] = {
                prop_name: {
                    opponent: dict(opponents[opponent] or {})
                    for opponent in sorted(
                        (opponents or {}).keys(), key=property_label_sort_key
                    )
                }
                for prop_name, opponents in sorted(
                    type_matchups.items(), key=lambda item: property_label_sort_key(item[0])
                )
            }
        payload[str(rank)] = {"matchups": matchups_payload}
    _write_json(PROPERTY_MATCHUPS_PATH, payload)


def load_property_triples() -> Dict[int, Dict[str, object]]:
    raw = _load_json(PROPERTY_TRIPLES_PATH)
    if not isinstance(raw, dict):
        return {}
    normalized: Dict[int, Dict[str, object]] = {}
    for key, rank_values in raw.items():
        try:
            rank = int(key)
        except (TypeError, ValueError):
            continue
        rank_data = dict(rank_values or {})
        triple_costs = rank_data.get("triple_costs")
        if triple_costs is None:
            triple_costs = {
                key: value for key, value in rank_data.items() if key != "rank"
            }
        normalized_triples: Dict[str, Dict[Tuple[str, str, str], Dict[str, float]]] = {}
        sample = next(iter(triple_costs.values()), None)
        if sample and isinstance(sample, dict):
            for weapon_type, type_triples in triple_costs.items():
                normalized_triples[weapon_type] = {
                    _decode_tuple_key(triple_key, 3): dict(entry or {})
                    for triple_key, entry in (type_triples or {}).items()
                }
        else:
            normalized_triples["ranged"] = {
                _decode_tuple_key(triple_key, 3): dict(entry or {})
                for triple_key, entry in (triple_costs or {}).items()
            }
        rank_data["triple_costs"] = normalized_triples
        normalized[rank] = rank_data
    return normalized


def write_property_triples(values: Dict[int, Dict[str, object]]):
    payload: Dict[str, Dict[str, object]] = {}
    for rank in sorted(values.keys()):
        rank_values = values[rank]
        triple_costs = rank_values.get("triple_costs") or {}
        triple_payload: Dict[str, Dict[str, object]] = {}
        for weapon_type in sorted(triple_costs.keys()):
            type_triples = triple_costs[weapon_type] or {}
            triple_payload[weapon_type] = {
                _encode_tuple_key(triple_key): dict(entry or {})
                for triple_key, entry in sorted(
                    type_triples.items(), key=lambda item: tuple_label_sort_key(item[0])
                )
            }
        payload[str(rank)] = {"triple_costs": triple_payload}
    _write_json(PROPERTY_TRIPLES_PATH, payload)


def cost_from_winrate(
    win_rate: float,
    base_logit: float,
    calibration: List[Tuple[int, float]],
) -> float:
    clamped = clamp_prob(win_rate)
    delta_logit = logit(clamped) - base_logit
    return interpolate_damage_equivalent(delta_logit, calibration)


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
        baseline_map = base_data.get("baselines", {})
        if not baseline_map:
            continue
        property_costs_map = property_values_data.get(current_rank, {}).get(
            "property_costs", {}
        )
        pair_results = calculate_property_pairs(
            rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            scenario=scenario,
            baseline_stats=baseline_map,
            property_costs=property_costs_map,
            show_progress=show_progress,
            pool=pool,
        )
        property_pairs_data[current_rank] = {
            "rank": current_rank,
            "pair_costs": pair_results,
        }
    return property_pairs_data


def calculate_property_pairs(
    rank: int,
    x_value: int,
    simulations: int,
    scenario: Scenario,
    baseline_stats: Dict[str, Dict[str, object]],
    property_costs: Dict[str, Dict[str, Optional[float]]],
    show_progress: bool,
    pool: Optional[SimulationPool],
) -> Dict[str, Dict[Tuple[str, str], Dict[str, float]]]:
    property_lookup = {
        prop_name: prop_value
        for prop_name, prop_value in PROPERTY_DEFS
        if prop_name != REROLL_PROPERTY
    }
    baseline_damage = BASELINE_DAMAGE_BY_RANK[rank]
    base_melee = Weapon(
        name=f"MELEE | DMG {baseline_damage} | BASELINE",
        damage=baseline_damage,
        weapon_type="melee",
        properties={},
        rank=rank,
    )
    base_ranged = Weapon(
        name=f"RANGED | DMG {baseline_damage} | BASELINE",
        damage=baseline_damage,
        weapon_type="ranged",
        properties={},
        rank=rank,
    )
    results: Dict[str, Dict[Tuple[str, str], Dict[str, float]]] = {}
    for weapon_type in WEAPON_TYPES:
        stats = baseline_stats.get(weapon_type)
        if not stats:
            continue
        baseline_action_damage = float(stats.get("average_action_damage", 0.0))

        type_results: Dict[Tuple[str, str], Dict[str, float]] = {}
        property_names = properties_for_weapon_type(weapon_type)
        test_weapons: List[Weapon] = []
        pair_weapons: Dict[Tuple[str, str], Weapon] = {}
        for prop_a, prop_b in combinations(property_names, 2):
            props: Dict[str, object] = {}
            labels = []
            for prop_name in (prop_a, prop_b):
                prop_value = property_lookup[prop_name]
                prop_setting = x_value if isinstance(prop_value, int) else prop_value
                props[prop_name] = prop_setting
                labels.append(property_label(prop_name, prop_setting))
            pair_key = tuple(sorted(labels, key=property_label_sort_key))
            test_weapon = Weapon(
                name=f"{weapon_type.upper()} | {labels[0]} + {labels[1]} | DMG {baseline_damage}",
                damage=baseline_damage,
                weapon_type=weapon_type,
                properties=props,
                rank=rank,
            )
            test_weapons.append(test_weapon)
            pair_weapons[pair_key] = test_weapon

        action_damage_map = {}
        if test_weapons:
            progress_label = None
            if should_show_progress(simulations, show_progress):
                progress_label = f"{weapon_type.title()} pairs"
            action_damage_map = run_vs_world_batch_action_damage(
                test_weapons,
                base_melee,
                base_ranged,
                rank,
                simulations,
                pool,
                show_progress,
                progress_label or f"Rank {rank} {weapon_type.title()} pairs",
            )

        for pair_key, test_weapon in pair_weapons.items():
            avg_action_damage = action_damage_map.get(test_weapon.name, 0.0)
            cost_pair = round(avg_action_damage - baseline_action_damage, 2)
            label_a, label_b = pair_key
            cost_a = resolve_property_cost(label_a, weapon_type, property_costs)
            cost_b = resolve_property_cost(label_b, weapon_type, property_costs)
            dop_cost = round(cost_pair - (cost_a + cost_b), 2)

            type_results[pair_key] = {
                "average_action_damage": round(avg_action_damage, 2),
                "cost_pair": cost_pair,
                "dop_cost": dop_cost,
            }
        results[weapon_type] = type_results
    return results

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
        baseline_map = base_data.get("baselines", {})
        if not baseline_map:
            continue
        property_costs_map = property_values_data.get(current_rank, {}).get(
            "property_costs", {}
        )
        matchup_results = calculate_property_matchups(
            rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            scenario=scenario,
            baseline_stats=baseline_map,
            property_costs=property_costs_map,
            show_progress=show_progress,
            pool=pool,
        )
        property_matchups_data[current_rank] = {
            "rank": current_rank,
            "matchups": matchup_results,
        }
    return property_matchups_data


def calculate_property_triples(
    rank: int,
    x_value: int,
    simulations: int,
    scenario: Scenario,
    baseline_stats: Dict[str, Dict[str, object]],
    property_costs: Dict[str, Dict[str, Optional[float]]],
    show_progress: bool,
    pool: Optional[SimulationPool],
) -> Dict[str, Dict[Tuple[str, str, str], Dict[str, float]]]:
    property_lookup = {
        prop_name: prop_value
        for prop_name, prop_value in PROPERTY_DEFS
        if prop_name != REROLL_PROPERTY
    }
    baseline_damage = BASELINE_DAMAGE_BY_RANK[rank]
    base_melee = Weapon(
        name=f"MELEE | DMG {baseline_damage} | BASELINE",
        damage=baseline_damage,
        weapon_type="melee",
        properties={},
        rank=rank,
    )
    base_ranged = Weapon(
        name=f"RANGED | DMG {baseline_damage} | BASELINE",
        damage=baseline_damage,
        weapon_type="ranged",
        properties={},
        rank=rank,
    )
    results: Dict[str, Dict[Tuple[str, str, str], Dict[str, float]]] = {}
    for weapon_type in WEAPON_TYPES:
        stats = baseline_stats.get(weapon_type)
        if not stats:
            continue
        baseline_action_damage = float(stats.get("average_action_damage", 0.0))

        type_results: Dict[Tuple[str, str, str], Dict[str, float]] = {}
        property_names = properties_for_weapon_type(weapon_type)
        test_weapons: List[Weapon] = []
        triple_weapons: Dict[Tuple[str, str, str], Weapon] = {}
        for combo in combinations(property_names, 3):
            props: Dict[str, object] = {}
            labels = []
            for prop_name in combo:
                prop_value = property_lookup[prop_name]
                prop_setting = x_value if isinstance(prop_value, int) else prop_value
                props[prop_name] = prop_setting
                labels.append(property_label(prop_name, prop_setting))
            triple_key = tuple(sorted(labels, key=property_label_sort_key))
            test_weapon = Weapon(
                name=f"{weapon_type.upper()} | {' + '.join(labels)} | DMG {baseline_damage}",
                damage=baseline_damage,
                weapon_type=weapon_type,
                properties=props,
                rank=rank,
            )
            test_weapons.append(test_weapon)
            triple_weapons[triple_key] = test_weapon

        action_damage_map = {}
        if test_weapons:
            progress_label = None
            if should_show_progress(simulations, show_progress):
                progress_label = f"{weapon_type.title()} triples"
            action_damage_map = run_vs_world_batch_action_damage(
                test_weapons,
                base_melee,
                base_ranged,
                rank,
                simulations,
                pool,
                show_progress,
                progress_label or f"Rank {rank} {weapon_type.title()} triples",
            )

        for triple_key, test_weapon in triple_weapons.items():
            avg_action_damage = action_damage_map.get(test_weapon.name, 0.0)
            cost_triple = round(avg_action_damage - baseline_action_damage, 2)
            base_cost_sum = sum(
                resolve_property_cost(label, weapon_type, property_costs)
                for label in triple_key
            )
            dop_cost = round(cost_triple - base_cost_sum, 2)

            type_results[triple_key] = {
                "average_action_damage": round(avg_action_damage, 2),
                "cost_triple": cost_triple,
                "dop_cost": dop_cost,
            }
        results[weapon_type] = type_results
    return results

def recalc_property_triples_for_ranks(
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

    property_triples_data: Dict[int, Dict[str, object]] = {}
    for current_rank in ranks:
        base_data = base_values_data.get(current_rank)
        if not base_data:
            continue
        baseline_map = base_data.get("baselines", {})
        if not baseline_map:
            continue
        property_costs_map = property_values_data.get(current_rank, {}).get(
            "property_costs", {}
        )
        triple_results = calculate_property_triples(
            rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            scenario=scenario,
            baseline_stats=baseline_map,
            property_costs=property_costs_map,
            show_progress=show_progress,
            pool=pool,
        )
        property_triples_data[current_rank] = {
            "rank": current_rank,
            "triple_costs": triple_results,
        }
    return property_triples_data

def calculate_property_matchups(
    rank: int,
    x_value: int,
    simulations: int,
    scenario: Scenario,
    baseline_stats: Dict[str, Dict[str, object]],
    property_costs: Dict[str, Dict[str, Optional[float]]],
    show_progress: bool,
    pool: Optional[SimulationPool],
) -> Dict[str, Dict[str, Dict[str, Dict[str, float]]]]:
    property_lookup = {
        prop_name: prop_value
        for prop_name, prop_value in PROPERTY_DEFS
        if prop_name != REROLL_PROPERTY
    }
    baseline_damage = BASELINE_DAMAGE_BY_RANK[rank]
    results: Dict[str, Dict[str, Dict[str, Dict[str, float]]]] = {}
    for weapon_type in WEAPON_TYPES:
        stats = baseline_stats.get(weapon_type)
        if not stats:
            continue
        baseline_action_damage = float(stats.get("average_action_damage", 0.0))
        property_names = properties_for_weapon_type(weapon_type)
        matchups: Dict[str, Dict[str, Dict[str, float]]] = {}
        for i, prop_a in enumerate(property_names):
            prop_a_value = property_lookup[prop_a]
            prop_a_setting = x_value if isinstance(prop_a_value, int) else prop_a_value
            label_a = property_label(prop_a, prop_a_setting)
            weapon_a = build_property_weapon(
                prop_a,
                property_lookup,
                x_value,
                baseline_damage,
                rank,
                weapon_type,
            )
            matchups.setdefault(label_a, {})
            for prop_b in property_names[i:]:
                prop_b_value = property_lookup[prop_b]
                prop_b_setting = x_value if isinstance(prop_b_value, int) else prop_b_value
                label_b = property_label(prop_b, prop_b_setting)
                weapon_b = build_property_weapon(
                    prop_b,
                    property_lookup,
                    x_value,
                    baseline_damage,
                    rank,
                    weapon_type,
                )

                progress_label = None
                if should_show_progress(simulations, show_progress):
                    progress_label = f"{weapon_type.title()} | {label_a} vs {label_b}"
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
                    track_action_damage=True,
                )
                total = max(stats["weapon1_wins"] + stats["weapon2_wins"], 1)
                win_rate_a = stats["weapon1_wins"] / total
                win_rate_b = 1.0 - win_rate_a
                avg_action_a = (
                    stats["weapon1_action_damage"] / stats["weapon1_actions"]
                    if stats["weapon1_actions"] > 0
                    else 0.0
                )
                avg_action_b = (
                    stats["weapon2_action_damage"] / stats["weapon2_actions"]
                    if stats["weapon2_actions"] > 0
                    else 0.0
                )
                cost_opp_a = round(avg_action_a - baseline_action_damage, 2)
                cost_opp_b = round(avg_action_b - baseline_action_damage, 2)
                base_cost_a = resolve_property_cost(label_a, weapon_type, property_costs)
                base_cost_b = resolve_property_cost(label_b, weapon_type, property_costs)
                matchups[label_a][label_b] = {
                    "winrate": round(win_rate_a, 5),
                    "average_action_damage": round(avg_action_a, 2),
                    "cost_opp": cost_opp_a,
                    "opp_cost": round(cost_opp_a - base_cost_a, 2),
                }
                if prop_a == prop_b:
                    continue
                matchups.setdefault(label_b, {})
                matchups[label_b][label_a] = {
                    "winrate": round(win_rate_b, 5),
                    "average_action_damage": round(avg_action_b, 2),
                    "cost_opp": cost_opp_b,
                    "opp_cost": round(cost_opp_b - base_cost_b, 2),
                }
        results[weapon_type] = matchups
    return results

def calculate_property_costs(
    rank: int,
    x_value: int,
    simulations: int,
    baseline_stats: Dict[str, Dict[str, object]],
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
    progress_label: Optional[str] = None,
) -> Dict[str, Dict[str, Optional[float]]]:
    baseline_action_damage = {}
    for weapon_type, stats in baseline_stats.items():
        avg_value = stats.get("average_action_damage")
        if avg_value is not None:
            baseline_action_damage[weapon_type] = float(avg_value)

    return calculate_property_action_damage(
        rank=rank,
        x_value=x_value,
        simulations=simulations,
        scenario=scenario,
        show_progress=show_progress,
        pool=pool,
        progress_label=progress_label,
        baseline_action_damage=baseline_action_damage,
    )


def calculate_property_action_damage(
    rank: int,
    x_value: int,
    simulations: int,
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
    progress_label: Optional[str] = None,
    baseline_action_damage: Optional[Dict[str, float]] = None,
    baseline_opponent_damage: Optional[Dict[str, float]] = None,
) -> Dict[str, Dict[str, Dict[str, float]]]:
    baseline_damage = BASELINE_DAMAGE_BY_RANK[rank]
    property_lookup = {prop_name: prop_value for prop_name, prop_value in PROPERTY_DEFS}
    no_effect_props = {
        prop_name
        for prop_name, _ in PROPERTY_DEFS
        if prop_name not in SIMULATED_PROPERTIES and prop_name != REROLL_PROPERTY
    }

    base_melee = Weapon(
        name=f"MELEE | DMG {baseline_damage} | BASELINE",
        damage=baseline_damage,
        weapon_type="melee",
        properties={},
        rank=rank,
    )
    base_ranged = Weapon(
        name=f"RANGED | DMG {baseline_damage} | BASELINE",
        damage=baseline_damage,
        weapon_type="ranged",
        properties={},
        rank=rank,
    )

    resolved_baseline = {}
    resolved_opponent = {}
    if baseline_action_damage:
        for weapon_type in WEAPON_TYPES:
            value = baseline_action_damage.get(weapon_type)
            if value is not None:
                resolved_baseline[weapon_type] = float(value)
    if baseline_opponent_damage:
        for weapon_type in WEAPON_TYPES:
            value = baseline_opponent_damage.get(weapon_type)
            if value is not None:
                resolved_opponent[weapon_type] = float(value)

    missing_types = [
        weapon_type
        for weapon_type in WEAPON_TYPES
        if (
            resolved_baseline.get(weapon_type, 0.0) <= 0.0
            or resolved_opponent.get(weapon_type, 0.0) <= 0.0
        )
    ]
    if missing_types:
        baseline_avg_map, baseline_opp_map = run_vs_world_batch_action_metrics(
            [base_melee, base_ranged],
            base_melee,
            base_ranged,
            rank,
            simulations,
            pool,
            show_progress,
            progress_label or f"Rank {rank} Baseline Action Damage",
        )
        baseline_avg = {
            "melee": baseline_avg_map.get(base_melee.name, 0.0),
            "ranged": baseline_avg_map.get(base_ranged.name, 0.0),
        }
        baseline_opp = {
            "melee": baseline_opp_map.get(base_melee.name, 0.0),
            "ranged": baseline_opp_map.get(base_ranged.name, 0.0),
        }
        for weapon_type in missing_types:
            if resolved_baseline.get(weapon_type, 0.0) <= 0.0:
                resolved_baseline[weapon_type] = baseline_avg.get(weapon_type, 0.0)
            if resolved_opponent.get(weapon_type, 0.0) <= 0.0:
                resolved_opponent[weapon_type] = baseline_opp.get(weapon_type, 0.0)

    baseline_avg = resolved_baseline
    baseline_opp = resolved_opponent

    test_weapons_map = {}
    all_test_weapons = []
    property_costs: Dict[str, Dict[str, Dict[str, float]]] = {}
    control_keys: Set[Tuple[str, str]] = set()

    for weapon_type in WEAPON_TYPES:
        type_costs: Dict[str, Dict[str, float]] = {}
        for prop_name in properties_for_weapon_type(weapon_type):
            if prop_name == REROLL_PROPERTY:
                continue
            prop_value = property_lookup.get(prop_name)
            if isinstance(prop_value, int) and should_skip_property_for_x(prop_name, x_value):
                continue
            prop_setting = x_value if isinstance(prop_value, int) else prop_value
            prop_key = property_label(prop_name, prop_setting)
            if prop_name in CONTROL_PROPERTIES:
                control_keys.add((weapon_type, prop_key))

            if prop_name in no_effect_props:
                baseline_value = baseline_avg.get(weapon_type, 0.0)
                avg_damage = baseline_value
                type_costs[prop_key] = {
                    "average_action_damage": round(avg_damage, 2),
                    "cost": round(avg_damage - baseline_value, 2),
                    "damage_prevention": 0.0,
                }
                continue

            type_costs[prop_key] = {
                "average_action_damage": 0.0,
                "cost": 0.0,
                "damage_prevention": 0.0,
            }
            test_weapon = Weapon(
                name=f"{weapon_type.upper()} | {prop_key} | DMG {baseline_damage}",
                damage=baseline_damage,
                weapon_type=weapon_type,
                properties={prop_name: prop_setting},
                rank=rank,
            )
            test_weapons_map[(weapon_type, prop_key)] = test_weapon
            all_test_weapons.append(test_weapon)

        property_costs[weapon_type] = type_costs

    if all_test_weapons:
        avg_action_damage, avg_opponent_damage = run_vs_world_batch_action_metrics(
            all_test_weapons,
            base_melee,
            base_ranged,
            rank,
            simulations,
            pool,
            show_progress,
            progress_label or f"Rank {rank} Action Damage (X {x_value})",
        )
    else:
        avg_action_damage = {}
        avg_opponent_damage = {}

    for weapon_type in WEAPON_TYPES:
        type_costs = property_costs.get(weapon_type) or {}
        for prop_key, entry in type_costs.items():
            weapon = test_weapons_map.get((weapon_type, prop_key))
            if weapon is None:
                continue
            avg_damage = avg_action_damage.get(weapon.name, 0.0)
            baseline_value = baseline_avg.get(weapon_type, 0.0)
            damage_prevention = 0.0
            if (weapon_type, prop_key) in control_keys:
                baseline_incoming = baseline_opp.get(weapon_type, 0.0)
                opp_damage = avg_opponent_damage.get(weapon.name, 0.0)
                damage_prevention = round(baseline_incoming - opp_damage, 2)
            type_costs[prop_key] = {
                "average_action_damage": round(avg_damage, 2),
                "cost": round(avg_damage - baseline_value, 2),
                "damage_prevention": damage_prevention,
            }

    return property_costs


def recalc_property_values_v2_for_ranks(
    ranks: List[int],
    x_value: int,
    simulations: int,
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
    property_values_data: Optional[Dict[int, Dict[str, object]]] = None,
    base_values_data: Optional[Dict[int, Dict[str, object]]] = None,
) -> Dict[int, Dict[str, object]]:
    if property_values_data is None:
        property_values_data = load_property_values_v2()
    if base_values_data is None:
        base_values_data = load_base_values()

    for current_rank in ranks:
        baseline_action_damage = {}
        baselines = base_values_data.get(current_rank, {}).get("baselines", {})
        for weapon_type, stats in (baselines or {}).items():
            avg_value = stats.get("average_action_damage")
            if avg_value is not None:
                baseline_action_damage[weapon_type] = float(avg_value)
        property_costs = calculate_property_action_damage(
            rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            scenario=scenario,
            show_progress=show_progress,
            pool=pool,
            progress_label=f"Rank {current_rank} Action Damage (X {x_value})",
            baseline_action_damage=baseline_action_damage,
        )
        property_values_data[current_rank] = {
            "rank": current_rank,
            "property_costs": property_costs,
        }

    return property_values_data


def recalc_property_values_v2_for_ranks_multi_x(
    ranks: List[int],
    x_values: List[int],
    simulations: int,
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
    property_values_data: Optional[Dict[int, Dict[str, object]]] = None,
    base_values_data: Optional[Dict[int, Dict[str, object]]] = None,
) -> Dict[int, Dict[str, object]]:
    if property_values_data is None:
        property_values_data = load_property_values_v2()
    if base_values_data is None:
        base_values_data = load_base_values()

    for current_rank in ranks:
        baseline_action_damage = {}
        baselines = base_values_data.get(current_rank, {}).get("baselines", {})
        for weapon_type, stats in (baselines or {}).items():
            avg_value = stats.get("average_action_damage")
            if avg_value is not None:
                baseline_action_damage[weapon_type] = float(avg_value)
        merged_costs: Dict[str, Dict[str, Dict[str, float]]] = {}
        existing_costs = property_values_data.get(current_rank, {}).get(
            "property_costs",
            {},
        )
        for weapon_type, type_costs in existing_costs.items():
            merged_costs[weapon_type] = dict(type_costs or {})

        for x_value in x_values:
            property_costs = calculate_property_action_damage(
                rank=current_rank,
                x_value=x_value,
                simulations=simulations,
                scenario=scenario,
                show_progress=show_progress,
                pool=pool,
                progress_label=f"Rank {current_rank} Action Damage (X {x_value})",
                baseline_action_damage=baseline_action_damage,
            )
            for weapon_type, type_costs in property_costs.items():
                merged_costs.setdefault(weapon_type, {})
                merged_costs[weapon_type].update(type_costs)

        property_values_data[current_rank] = {
            "rank": current_rank,
            "property_costs": merged_costs,
        }

    return property_values_data


def print_property_costs(property_costs: Dict[str, object]):
    if not property_costs:
        print("No property costs calculated.")
        return

    per_type: Dict[str, Dict[str, object]] = {}
    sample_values = list(property_costs.values())
    if sample_values and isinstance(sample_values[0], dict) and (
        "cost" in sample_values[0] or "delta_win_rate" in sample_values[0]
    ):
        per_type["ranged"] = property_costs  # fallback for old format
    else:
        for weapon_type, type_costs in property_costs.items():
            per_type[weapon_type] = type_costs or {}

    for weapon_type in sorted(per_type.keys()):
        type_costs = per_type[weapon_type]
        if not type_costs:
            continue

        print()
        print(f"{weapon_type.title()} property costs (damage equivalents)")
        sample_entry = next(iter(type_costs.values()), {})
        use_action_damage = (
            isinstance(sample_entry, dict)
            and "average_action_damage" in sample_entry
        )
        if use_action_damage:
            header = f"{'Property':<40} {'Cost':>7} {'ActDmg':>8}"
        else:
            header = f"{'Property':<40} {'Cost':>7} {'dWin%':>8}"
        separator = "-" * len(header)
        print(header)
        print(separator)
        for prop_name in sorted(type_costs.keys(), key=property_label_sort_key):
            entry = type_costs[prop_name]
            if use_action_damage:
                normalized = normalize_property_v2_entry(entry)
                cost = normalized["cost"] or 0.0
                avg_action = normalized["average_action_damage"] or 0.0
                print(f"{prop_name:<40} {cost:>7.2f} {avg_action:>8.2f}")
            else:
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
    return False


def build_damage_table(
    dice: int,
    skill: int,
    defense: float,
    weapon_damage: float,
) -> List[float]:
    """Precompute damage per roll for a simple, property-free attack."""
    table = [0.0] * (dice + 1)
    for roll_value in range(1, dice + 1):
        total_roll = roll_value + skill
        if total_roll >= defense:
            damage_value = (total_roll - defense) + weapon_damage
            if damage_value < 1.0:
                damage_value = 1.0
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
    w1_action_damage = 0.0
    w2_action_damage = 0.0
    w1_actions = 0
    w2_actions = 0
    w1_action_damage = 0.0
    w2_action_damage = 0.0
    w1_actions = 0
    w2_actions = 0
    w1_action_damage = 0.0
    w2_action_damage = 0.0
    w1_actions = 0
    w2_actions = 0
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
        "weapon1_action_damage": w1_action_damage,
        "weapon2_action_damage": w2_action_damage,
        "weapon1_actions": w1_actions,
        "weapon2_actions": w2_actions,
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
    w1_action_damage = 0.0
    w2_action_damage = 0.0
    w1_actions = 0
    w2_actions = 0
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
        "weapon1_action_damage": w1_action_damage,
        "weapon2_action_damage": w2_action_damage,
        "weapon1_actions": w1_actions,
        "weapon2_actions": w2_actions,
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
    scenario_pool: Optional[List[ScenarioOption]] = None,
    track_action_damage: bool = False,
) -> Dict[str, object]:
    if REQUIRE_NUMBA:
        require_numba("run_matchup")
        use_numba = True
        if track_rounds:
            raise RuntimeError(
                "Numba-only mode does not support track_rounds=True. "
                "Run with track_rounds=False."
            )
    if scenario_pool is None:
        scenario_pool = DEFAULT_SCENARIO_OPTIONS

    use_pool = bool(scenario_pool)

    if use_pool:
        key = matchup_key(weapon1.weapon_type, weapon2.weapon_type)
        scenario_candidates, scenario_weights = build_scenario_sampler(key, scenario_pool)
    else:
        scenario_candidates, scenario_weights = [], []


    params = RANK_PARAMS[rank]
    speed = float(params["speed"])

    if use_numba and NUMBA_AVAILABLE and not track_rounds:
        base_hp = params["hp"]
        dice = params["dice"]
        skill = params["skill"]
        defense = params["defense"]
        weapon_props, weapon_ranges = build_matchup_props(weapon1, weapon2)
        w1_wins = 0
        w2_wins = 0
        total_rounds = 0
        w1_action_damage = 0.0
        w2_action_damage = 0.0
        w1_actions = 0
        w2_actions = 0
        start_index = 0

        # If no pool: run all sims at the explicit scenario distance.
        if not use_pool:
            (
                chunk_w1,
                chunk_w2,
                _,
                _,
                chunk_rounds,
                chunk_w1_damage,
                chunk_w2_damage,
                chunk_w1_actions,
                chunk_w2_actions,
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
                False,
                None,
                True,
                track_action_damage=track_action_damage,
            )
            avg_rounds = chunk_rounds / simulations if simulations else 0.0
            return {
                "weapon1_wins": chunk_w1,
                "weapon2_wins": chunk_w2,
                "weapon1_win_rounds": [],
                "weapon2_win_rounds": [],
                "avg_rounds": avg_rounds,
                "weapon1_action_damage": chunk_w1_damage,
                "weapon2_action_damage": chunk_w2_damage,
                "weapon1_actions": chunk_w1_actions,
                "weapon2_actions": chunk_w2_actions,
            }

        # Pool enabled: sample counts without building a length-N scenario list.
        counts = multinomial_counts(simulations, scenario_weights)

        for scenario_option, count in zip(scenario_candidates, counts):
            if count <= 0:
                continue
            (
                chunk_w1,
                chunk_w2,
                _,
                _,
                chunk_rounds,
                chunk_w1_damage,
                chunk_w2_damage,
                chunk_w1_actions,
                chunk_w2_actions,
            ) = full_matchup_chunk(
                weapon_props,
                weapon_ranges,
                dice,
                skill,
                defense,
                speed,
                base_hp,
                rank,
                int(count),
                DEFAULT_MAX_ROUNDS,
                start_index,
                float(scenario_option.distance_mult) * speed,
                False,
                None,
                True,
                track_action_damage=track_action_damage,
            )
            start_index += int(count)
            w1_wins += chunk_w1
            w2_wins += chunk_w2
            total_rounds += chunk_rounds
            w1_action_damage += chunk_w1_damage
            w2_action_damage += chunk_w2_damage
            w1_actions += chunk_w1_actions
            w2_actions += chunk_w2_actions

        avg_rounds = total_rounds / simulations if simulations else 0.0
        return {
            "weapon1_wins": w1_wins,
            "weapon2_wins": w2_wins,
            "weapon1_win_rounds": [],
            "weapon2_win_rounds": [],
            "avg_rounds": avg_rounds,
            "weapon1_action_damage": w1_action_damage,
            "weapon2_action_damage": w2_action_damage,
            "weapon1_actions": w1_actions,
            "weapon2_actions": w2_actions,
        }
        
    w1_wins = 0
    w2_wins = 0
    total_rounds = 0
    w1_action_damage = 0.0
    w2_action_damage = 0.0
    w1_actions = 0
    w2_actions = 0
    w1_win_rounds: Optional[List[int]] = [] if track_rounds else None
    w2_win_rounds: Optional[List[int]] = [] if track_rounds else None
    char1 = Character(name="Attacker", rank=rank, weapon=weapon1)
    char2 = Character(name="Defender", rank=rank, weapon=weapon2)

    sim = CombatSimulator(
        char1,
        char2,
        verbose=False,
        initial_distance=float(scenario.initial_distance),
    )

    progress_active = (
        progress_label is not None and should_show_progress(simulations, show_progress)
    )
    interval = progress_interval(simulations) if progress_active else None

    for i in range(simulations):
        attacker_is_w1 = i % 2 == 0
        if attacker_is_w1:
            char1.weapon = weapon1
            char2.weapon = weapon2
        else:
            char1.weapon = weapon2
            char2.weapon = weapon1

        if use_pool:
            scenario_choice = random.choices(
                scenario_candidates, weights=scenario_weights, k=1
            )[0]
            sim.initial_distance = float(scenario_choice.distance_mult) * speed
        else:
            sim.initial_distance = scenario.initial_distance

        sim.reset_combat()
        result = sim.run_combat()
        total_rounds += result["rounds"]
        if track_action_damage:
            if attacker_is_w1:
                w1_action_damage += char1.action_damage_dealt
                w1_actions += char1.actions_spent
                w2_action_damage += char2.action_damage_dealt
                w2_actions += char2.actions_spent
            else:
                w1_action_damage += char2.action_damage_dealt
                w1_actions += char2.actions_spent
                w2_action_damage += char1.action_damage_dealt
                w2_actions += char1.actions_spent

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

        if progress_active and interval is not None and (
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
        "weapon1_action_damage": w1_action_damage,
        "weapon2_action_damage": w2_action_damage,
        "weapon1_actions": w1_actions,
        "weapon2_actions": w2_actions,
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


def _normalized_opponent_weights() -> Tuple[float, float]:
    """Return (p_melee, p_ranged) normalized from DEFAULT_OPPONENT_TYPE_WEIGHTS."""
    w_m = float(DEFAULT_OPPONENT_TYPE_WEIGHTS.get("melee", 0.0))
    w_r = float(DEFAULT_OPPONENT_TYPE_WEIGHTS.get("ranged", 0.0))
    total = w_m + w_r
    if total <= 0.0:
        return 0.5, 0.5
    return w_m / total, w_r / total


def run_vs_world_batch(
    test_weapons: List[Weapon],
    baseline_melee: Weapon,
    baseline_ranged: Weapon,
    rank: int,
    simulations: int,
    pool: Optional[SimulationPool],
    show_progress: bool,
    progress_label: str,
) -> Dict[str, float]:
    """
    Runs a batch of simulations for multiple weapons against the 'World' (weighted mix of opponents).
    Returns a dictionary mapping weapon.name -> win_rate.
    """
    p_melee, p_ranged = _normalized_opponent_weights()
    sims_m = int(round(simulations * p_melee))
    sims_r = max(simulations - sims_m, 0)
    
    # We use a dummy Scenario for the required argument; pooled runs sample from DEFAULT_SCENARIO_OPTIONS.
    dummy_scenario = MELEE_BASELINE_SCENARIO

    tasks = []
    # For each test weapon, we schedule two matchups: vs Melee Baseline and vs Ranged Baseline
    for wp in test_weapons:
        # Task 0: vs Melee
        if sims_m > 0:
            tasks.append(BatchTask(
                args=(wp, baseline_melee, rank, sims_m, dummy_scenario),
                kwargs={"track_rounds": False, "parallel": False, "pool": None}
            ))
        # Task 1: vs Ranged
        if sims_r > 0:
            tasks.append(BatchTask(
                args=(wp, baseline_ranged, rank, sims_r, dummy_scenario),
                kwargs={"track_rounds": False, "parallel": False, "pool": None}
            ))

    results = batch_map(run_matchup, tasks, pool=pool, progress_label=progress_label, show_progress=show_progress)
    
    # Aggregate results
    win_rates = {}
    idx = 0
    for wp in test_weapons:
        wins = 0
        total = 0
        if sims_m > 0:
            res = results[idx]
            wins += res["weapon1_wins"]
            total += (res["weapon1_wins"] + res["weapon2_wins"])
            idx += 1
        if sims_r > 0:
            res = results[idx]
            wins += res["weapon1_wins"]
            total += (res["weapon1_wins"] + res["weapon2_wins"])
            idx += 1
        
        win_rates[wp.name] = wins / max(total, 1)
        
    return win_rates


def run_vs_world_batch_action_metrics(
    test_weapons: List[Weapon],
    baseline_melee: Weapon,
    baseline_ranged: Weapon,
    rank: int,
    simulations: int,
    pool: Optional[SimulationPool],
    show_progress: bool,
    progress_label: str,
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    Runs a batch of simulations for multiple weapons against the 'World' (weighted mix).
    Returns two dictionaries:
      - weapon.name -> average action damage (per action spent)
      - weapon.name -> opponent damage per action spent by the weapon
    """
    p_melee, p_ranged = _normalized_opponent_weights()
    sims_m = int(round(simulations * p_melee))
    sims_r = max(simulations - sims_m, 0)

    dummy_scenario = MELEE_BASELINE_SCENARIO

    tasks = []
    for wp in test_weapons:
        if sims_m > 0:
            tasks.append(
                BatchTask(
                    args=(wp, baseline_melee, rank, sims_m, dummy_scenario),
                    kwargs={
                        "track_rounds": False,
                        "parallel": False,
                        "pool": None,
                        "track_action_damage": True,
                    },
                )
            )
        if sims_r > 0:
            tasks.append(
                BatchTask(
                    args=(wp, baseline_ranged, rank, sims_r, dummy_scenario),
                    kwargs={
                        "track_rounds": False,
                        "parallel": False,
                        "pool": None,
                        "track_action_damage": True,
                    },
                )
            )

    results = batch_map(
        run_matchup,
        tasks,
        pool=pool,
        progress_label=progress_label,
        show_progress=show_progress,
    )

    avg_action_damage = {}
    avg_opponent_damage = {}
    idx = 0
    for wp in test_weapons:
        total_damage = 0.0
        total_actions = 0
        total_opp_damage = 0.0
        if sims_m > 0:
            res = results[idx]
            total_damage += res.get("weapon1_action_damage", 0.0)
            total_actions += res.get("weapon1_actions", 0)
            total_opp_damage += res.get("weapon2_action_damage", 0.0)
            idx += 1
        if sims_r > 0:
            res = results[idx]
            total_damage += res.get("weapon1_action_damage", 0.0)
            total_actions += res.get("weapon1_actions", 0)
            total_opp_damage += res.get("weapon2_action_damage", 0.0)
            idx += 1
        avg_action_damage[wp.name] = (
            total_damage / total_actions if total_actions > 0 else 0.0
        )
        avg_opponent_damage[wp.name] = (
            total_opp_damage / total_actions if total_actions > 0 else 0.0
        )

    return avg_action_damage, avg_opponent_damage


def run_vs_world_batch_action_damage(
    test_weapons: List[Weapon],
    baseline_melee: Weapon,
    baseline_ranged: Weapon,
    rank: int,
    simulations: int,
    pool: Optional[SimulationPool],
    show_progress: bool,
    progress_label: str,
) -> Dict[str, float]:
    """
    Runs a batch of simulations for multiple weapons against the 'World' (weighted mix).
    Returns a dictionary mapping weapon.name -> average action damage (per action spent).
    """
    avg_action_damage, _ = run_vs_world_batch_action_metrics(
        test_weapons,
        baseline_melee,
        baseline_ranged,
        rank,
        simulations,
        pool,
        show_progress,
        progress_label,
    )
    return avg_action_damage


def run_vs_world_avg_rounds(
    weapon: Weapon,
    baseline_melee: Weapon,
    baseline_ranged: Weapon,
    rank: int,
    simulations: int,
    pool: Optional[SimulationPool],
    show_progress: bool,
    progress_label: str,
) -> float:
    p_melee, p_ranged = _normalized_opponent_weights()
    sims_m = int(round(simulations * p_melee))
    sims_r = max(simulations - sims_m, 0)

    if sims_m <= 0 and sims_r <= 0:
        return 0.0

    dummy_scenario = MELEE_BASELINE_SCENARIO
    tasks = []
    if sims_m > 0:
        tasks.append(
            BatchTask(
                args=(weapon, baseline_melee, rank, sims_m, dummy_scenario),
                kwargs={"track_rounds": False, "parallel": False, "pool": None},
            )
        )
    if sims_r > 0:
        tasks.append(
            BatchTask(
                args=(weapon, baseline_ranged, rank, sims_r, dummy_scenario),
                kwargs={"track_rounds": False, "parallel": False, "pool": None},
            )
        )

    results = batch_map(
        run_matchup,
        tasks,
        pool=pool,
        progress_label=progress_label,
        show_progress=show_progress,
    )

    idx = 0
    total_rounds = 0.0
    total_sims = 0
    if sims_m > 0:
        total_rounds += results[idx]["avg_rounds"] * sims_m
        total_sims += sims_m
        idx += 1
    if sims_r > 0:
        total_rounds += results[idx]["avg_rounds"] * sims_r
        total_sims += sims_r

    return total_rounds / max(total_sims, 1)


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
        use_numba=use_numba,
    )


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
    baseline_scenarios: Optional[Dict[str, Scenario]] = None,
) -> Dict[str, Dict[str, object]]:
    weapons = build_weapons(current_rank, x_value, rerolls=0)
    baseline_damage = BASELINE_DAMAGE_BY_RANK[current_rank]
    damage_values = get_damage_values_for_rank(current_rank)
    scenarios = baseline_scenarios or DEFAULT_BASELINE_SCENARIOS

    print()
    print("=" * 80)
    print(f"BASE VALUES (CLOSE + LONG) | RANK {current_rank}")
    print("=" * 80)
    print()
    print(f"Params: rank {current_rank}, rerolls 0, X {x_value}")
    print(f"Simulations per scenario: {simulations}")
    print(f"Baseline damage: {baseline_damage}")
    print()
    print("Opponent Pool: Weighted mix of Melee and Ranged scenarios.")
    
    # Prepare baseline weapons
    base_melee = get_simple_weapon(weapons, "melee", baseline_damage, current_rank)
    base_ranged = get_simple_weapon(weapons, "ranged", baseline_damage, current_rank)
    
    # Prepare all test weapons (for all damage values and types)
    all_test_weapons = []
    for weapon_type in WEAPON_TYPES:
        # Baseline for this type
        all_test_weapons.append(get_simple_weapon(weapons, weapon_type, baseline_damage, current_rank))
        # Damage variants
        for damage in damage_values:
            if damage == baseline_damage:
                continue
            all_test_weapons.append(get_simple_weapon(weapons, weapon_type, damage, current_rank))

    baseline_win_rates = run_vs_world_batch(
        [base_melee, base_ranged],
        base_melee,
        base_ranged,
        current_rank,
        simulations,
        pool,
        show_progress,
        f"Rank {current_rank} Baseline Win Rates",
    )

    action_damage_map = run_vs_world_batch_action_damage(
        all_test_weapons,
        base_melee,
        base_ranged,
        current_rank,
        simulations,
        pool,
        show_progress,
        f"Rank {current_rank} Action Damage",
    )
    baseline_action_damage = {
        "melee": action_damage_map.get(base_melee.name, 0.0),
        "ranged": action_damage_map.get(base_ranged.name, 0.0),
    }

    results: Dict[str, Dict[str, object]] = {}
    for weapon_type in WEAPON_TYPES:
        base_w_name = get_simple_weapon(weapons, weapon_type, baseline_damage, current_rank).name
        baseline_win_rate = baseline_win_rates.get(base_w_name, 0.5)
        baseline_avg_action = baseline_action_damage.get(weapon_type, 0.0)

        print(f"Baseline action damage ({weapon_type}): {baseline_avg_action:.2f}")
        print()
        print(f"Damage vs baseline ({weapon_type})")
        header = f"{'DMG':>4} {'ActDmg':>8} {'Diff':>7}"
        separator = "-" * len(header)
        print(header)
        print(separator)

        damage_action_damage: Dict[int, float] = {}
        for damage in damage_values:
            w_name = get_simple_weapon(weapons, weapon_type, damage, current_rank).name
            avg_action_damage = action_damage_map.get(w_name, 0.0)
            damage_action_damage[damage] = avg_action_damage
            diff_value = avg_action_damage - baseline_avg_action
            print(
                f"{damage:>4} {avg_action_damage:>8.2f} {diff_value:>+7.2f}"
            )
        print()

        avg_rounds = run_vs_world_avg_rounds(
            base_melee if weapon_type == "melee" else base_ranged,
            base_melee,
            base_ranged,
            current_rank,
            simulations,
            pool,
            show_progress,
            f"Rank {current_rank} {weapon_type.title()} Avg Rounds",
        )

        results[weapon_type] = {
            "avg_rounds": avg_rounds,
            "baseline_win_rate": baseline_win_rate,
            "average_action_damage": round(
                baseline_action_damage.get(weapon_type, 0.0), 2
            ),
            "damage_action_damage": damage_action_damage,
        }

    return results


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
        baseline_map = recalc_base_values_for_rank(
            current_rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            scenario=scenario,
            show_progress=show_progress,
            pool=pool,
        )
        if not baseline_map:
            continue
        rounded_baselines: Dict[str, Dict[str, object]] = {}
        for weapon_type, stats in baseline_map.items():
            rounded_baselines[weapon_type] = {
                "avg_rounds": round(stats.get("avg_rounds", 0.0), 2),
                "baseline_win_rate": round_to_half_percent(
                    stats.get("baseline_win_rate", 0.5)
                ),
                "average_action_damage": round(
                    float(stats.get("average_action_damage", 0.0)), 2
                ),
                "damage_action_damage": {
                    damage: round(float(value), 2)
                    for damage, value in stats.get(
                        "damage_action_damage", {}
                    ).items()
                },
            }
        base_values_data[current_rank] = {
            "rank": current_rank,
            "baselines": rounded_baselines,
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
        baseline_map = base_values_data[current_rank].get("baselines", {})
        if not baseline_map:
            print(f"No baseline scenarios for rank {current_rank}; skipping property costs.")
            continue

        property_costs = calculate_property_costs(
            rank=current_rank,
            x_value=x_value,
            simulations=simulations,
            baseline_stats=baseline_map,
            scenario=scenario,
            show_progress=show_progress,
            pool=pool,
            progress_label=f"Rank {current_rank} Properties (X {x_value})",
        )
        print()
        print("=" * 80)
        print(f"PROPERTY COSTS | RANK {current_rank} | X {x_value}")
        print("=" * 80)
        print_property_costs(property_costs)

        property_values_data[current_rank] = {
            "rank": current_rank,
            "property_costs": property_costs,
        }

    return property_values_data


def recalc_property_values_for_ranks_multi_x(
    ranks: List[int],
    x_values: List[int],
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
        baseline_map = base_values_data[current_rank].get("baselines", {})
        if not baseline_map:
            print(f"No baseline scenarios for rank {current_rank}; skipping property costs.")
            continue

        merged_costs: Dict[str, Dict[str, Optional[float]]] = {}
        existing_costs = property_values_data.get(current_rank, {}).get(
            "property_costs",
            {},
        )
        for weapon_type, type_costs in existing_costs.items():
            merged_costs[weapon_type] = dict(type_costs or {})

        for x_value in x_values:
            property_costs = calculate_property_costs(
                rank=current_rank,
                x_value=x_value,
                simulations=simulations,
                baseline_stats=baseline_map,
                scenario=scenario,
                show_progress=show_progress,
                pool=pool,
                progress_label=f"Rank {current_rank} Properties (X {x_value})",
            )
            print()
            print("=" * 80)
            print(f"PROPERTY COSTS | RANK {current_rank} | X {x_value}")
            print("=" * 80)
            print_property_costs(property_costs)
            for weapon_type, type_costs in property_costs.items():
                merged_costs.setdefault(weapon_type, {})
                merged_costs[weapon_type].update(type_costs)

        property_values_data[current_rank] = {
            "rank": current_rank,
            "property_costs": merged_costs,
        }

    return property_values_data


def simulate_custom_duel(
    weapon1: Weapon,
    weapon2: Weapon,
    rank: int,
    simulations: int,
    scenario: Scenario,
    show_progress: bool = False,
    pool: Optional[SimulationPool] = None,
) -> Dict[str, object]:
    stats = run_matchup(
        weapon1,
        weapon2,
        rank=rank,
        simulations=simulations,
        scenario=scenario,
        progress_label=None,
        show_progress=show_progress,
        track_rounds=False,
        pool=pool,
    )
    total = max(stats["weapon1_wins"] + stats["weapon2_wins"], 1)
    weapon1_win_rate = stats["weapon1_wins"] / total
    return {
        "weapon1_wins": stats["weapon1_wins"],
        "weapon2_wins": stats["weapon2_wins"],
        "avg_rounds": stats["avg_rounds"],
        "weapon1_win_rate": weapon1_win_rate,
        "weapon2_win_rate": 1.0 - weapon1_win_rate,
        "scenario_distance": scenario.initial_distance,
    }


def summarize_weapon_for_dump(weapon: Weapon) -> Dict[str, object]:
    return {
        "weapon_type": weapon.weapon_type,
        "damage": weapon.damage,
        "properties": {
            property_label(name, value): value for name, value in weapon.properties.items()
        },
        "rank": weapon.rank,
    }


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
        print(
            f"Base values saved to {BASE_VALUES_PATH.name} (rounded to 0.5%)."
        )

    if recalc_properties:
        property_values_data = recalc_property_values_v2_for_ranks(
            ranks=ranks_to_process,
            x_value=x_value,
            simulations=simulations_per_scenario,
            scenario=base_scenario,
            show_progress=show_progress,
            pool=pool,
        )
        write_property_values(property_values_data)
        print()
        print(f"Property values saved to {PROPERTY_VALUES_PATH.name}.")

    if pool is not None:
        pool.close()
    input("Press Enter to exit...")


