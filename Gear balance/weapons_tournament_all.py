"""
Weapons Simulator for Andromeda TTRPG
Tests all weapons against each other (round-robin tournament)
WITH DISTANCE AND MOVEMENT MECHANICS
"""

import random
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Set
from collections import defaultdict
import statistics

# ============================================================================
# CONSTANTS
# ============================================================================

RANK_PARAMS = {
    1: {"dice": 6, "skill": 1, "hp": 15, "defense": 5, "speed": 6},
    2: {"dice": 8, "skill": 3, "hp": 20, "defense": 7, "speed": 9},
    3: {"dice": 10, "skill": 6, "hp": 25, "defense": 11, "speed": 12},
    4: {"dice": 12, "skill": 10, "hp": 30, "defense": 15, "speed": 15},
}

PROPERTY_DEFS = [
    ("Огонь на подавление", True),
    ("Магическое", True),
    ("Бронебойность Х", 1),
    ("Бесшумное", True),
    ("Эскалация Х", 1),
    ("Сплеш Х", 1),
    ("Перезарядка Х", 1),
    ("Стабилизация X", 1),
    ("Досягаемость Х", 1),
    ("Скрытное Х", 1),
    ("Легкое", True),
    ("Точность Х", 1),
    ("Гарант Х", 1),
    ("Переброс", True),
    ("Агрессивный обстрел", True),
    ("Ошеломление X", 1),
    ("А-фактор", True),
    ("Замедление", True),
    ("Опасное Х", 1),
    ("Риск", True),
    ("Точное X", 1),
    ("Пробитие X", 1),
    ("Кровотечение Х", 1),
    ("Дезориентирующее", True),
    ("Обездвиживание Х", 1),
]

PROPERTY_COMPATIBILITY = {
    "Огонь на подавление": ("ranged",),
    "Агрессивный обстрел": ("ranged",),
    "Перезарядка Х": ("ranged",),
    "Досягаемость Х": ("melee",),
    "Стабилизация X": ("ranged",),
    "Точное X": ("ranged",),
    "Пробитие X": ("ranged",),
}

UTILITY_ACTION_PROPERTIES = {
    "Огонь на подавление": {
        "status": "Замедлен",
        "duration": 2,
        "requires_target_melee": True,
        "log": "подавляет огнем",
    },
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
        range_bonus = self.properties.get("Досягаемость Х", 0)
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
    
    def __init__(self, attacker: Character, defender: Character, max_rounds: int = 100, verbose: bool = False):
        self.attacker = attacker
        self.defender = defender
        # Reset per-combat counters
        self.attacker.retreat_rounds_used = 0
        self.defender.retreat_rounds_used = 0
        self.max_rounds = max_rounds
        self.round_count = 0
        self.verbose = verbose
        self.combat_log = []
        self.distance = 25.0  # meters between characters
    
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
        Melee characters try to close distance, ranged try to maintain it.

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

        # Attacker's strategy: get into range
        if self.distance > attacker_range:
            movement = effective_speed(attacker)
            if movement > 0:
                attacker.moved_this_round = True
            self.distance = max(0.0, self.distance - movement)

        # Defender's strategy: maintain distance or escape
        if defender.weapon.weapon_type == "ranged":
            # Limit ranged retreating to a maximum number of rounds per combat
            if self.distance < defender_range and defender.retreat_rounds_used < 5:
                movement = effective_speed(defender) / 2.0
                if movement > 0:
                    defender.moved_this_round = True
                    self.distance = min(100.0, self.distance + movement)
                    defender.retreat_rounds_used += 1

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

        def evaluate_roll() -> Tuple[int, bool, int]:
            roll_value = random.randint(1, attacker.dice)
            raw_roll = roll_value

            if "Опасное Х" in attacker.weapon.properties:
                danger_threshold = attacker.weapon.properties["Опасное Х"]
                if raw_roll > danger_threshold:
                    attacker.take_damage(1)

            if "Точность Х" in attacker.weapon.properties:
                accuracy_bonus = attacker.weapon.properties["Точность Х"]
                roll_value = min(roll_value + accuracy_bonus, attacker.dice)

            if "Гарант Х" in attacker.weapon.properties:
                guarantee = attacker.weapon.properties["Гарант Х"]
                if roll_value != 1:  # Except 1
                    roll_value = max(roll_value, guarantee)

            total_roll = roll_value + attacker.skill + stabilization_bonus
            hit_value = total_roll >= defender.defense

            damage_value = 0
            if hit_value:
                margin = total_roll - defender.defense
                damage_value = margin + attacker.weapon.damage
                if roll_value == attacker.dice and "Эскалация Х" in attacker.weapon.properties:
                    escalation_value = attacker.weapon.properties["Эскалация Х"]
                    damage_value += escalation_value

            return roll_value, hit_value, damage_value

        roll, hit, damage = evaluate_roll()

        if not hit:
            damage = 0
            if "Бронебойность Х" in attacker.weapon.properties:
                max_rank = attacker.weapon.properties["Бронебойность Х"]
                if defender.rank <= max_rank:
                    damage = 1

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

        damage = max(1, damage) if hit else damage

        return roll, damage, hit
    
    def record_shot(self, attacker: Character):
        """Track shots for Перезарядка."""
        reload_after = attacker.weapon.properties.get("Перезарядка Х")
        if not reload_after:
            return
        attacker.shots_fired_since_reload += 1
        if attacker.shots_fired_since_reload >= reload_after:
            attacker.reload_required = True
    
    def perform_reaction_attack(self, attacker: Character, defender: Character) -> bool:
        """Perform a reaction attack without spending actions."""
        if "Перезарядка Х" in attacker.weapon.properties and attacker.reload_required:
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
        if "Кровотечение Х" in attacker.weapon.properties:
            duration = attacker.weapon.properties["Кровотечение Х"] + 1
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
        if "Обездвиживание Х" in attacker.weapon.properties:
            max_rank = attacker.weapon.properties["Обездвиживание Х"]
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
        
        if attacker.aggressive_fire_pending:
            attacker.aggressive_fire_pending = False
            if defender.reaction_remaining and self.can_attack(defender, attacker):
                defender.reaction_remaining = False
                self.perform_reaction_attack(defender, attacker)
                if not attacker.is_alive():
                    return False
        
        if "Перезарядка Х" in attacker.weapon.properties and attacker.reload_required:
            attacker.actions_remaining -= 1
            attacker.reload_required = False
            attacker.shots_fired_since_reload = 0
            return False
        
        if "Огонь на подавление" in attacker.weapon.properties:
            if self.should_use_utility_action(attacker, defender, "Огонь на подавление"):
                self.apply_utility_action(attacker, defender, "Огонь на подавление")
                attacker.actions_remaining -= 1
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
            if "Агрессивный обстрел" in attacker.weapon.properties and defender.is_alive():
                defender.aggressive_fire_pending = True
        
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
        
        # Defender acts if alive (up to 2 actions)
        while (
            self.defender.actions_remaining > 0
            and self.attacker.is_alive()
            and self.defender.is_alive()
        ):
            self.perform_attack(self.defender, self.attacker)
        
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
# TOURNAMENT TESTING
# ============================================================================

class WeaponTournament:
    """Run round-robin tournament of weapons"""
    
    def __init__(self, rank: int = 1, simulations_per_matchup: int = 100):
        self.rank = rank
        self.simulations_per_matchup = simulations_per_matchup
        self.matchup_stats = defaultdict(lambda: {
            "wins": 0,
            "losses": 0,
            "rounds_on_win": [],
        })
    
    def run_matchup(self, weapon1: Weapon, weapon2: Weapon) -> Tuple[int, int, List[int], List[int]]:
        """
        Run multiple combats: weapon1 vs weapon2
        Returns: (wins_w1, wins_w2, rounds_when_w1_won, rounds_when_w2_won)
        """
        w1_wins = 0
        w2_wins = 0
        w1_win_rounds = []
        w2_win_rounds = []
        
        for _ in range(self.simulations_per_matchup):
            # Create characters
            char1 = Character(
                name="Attacker",
                rank=self.rank,
                weapon=weapon1,
            )
            
            char2 = Character(
                name="Defender",
                rank=self.rank,
                weapon=weapon2,
            )
            
            # Run combat
            sim = CombatSimulator(char1, char2, verbose=False)
            result = sim.run_combat()
            
            if result["attacker_wins"]:
                w1_wins += 1
                w1_win_rounds.append(result["rounds"])
            else:
                w2_wins += 1
                w2_win_rounds.append(result["rounds"])
        
        return w1_wins, w2_wins, w1_win_rounds, w2_win_rounds
    
    def run_tournament(self, weapons: List[Weapon]) -> Dict:
        """Run full round-robin tournament"""
        results = defaultdict(lambda: {
            "wins": 0,
            "losses": 0,
            "win_rate": 0.0,
            "avg_rounds_on_win": 0.0,
            "total_fights": 0,
        })
        
        all_rounds_on_win = defaultdict(list)
        
        # Run all matchups
        for i, weapon1 in enumerate(weapons):
            for j, weapon2 in enumerate(weapons):
                if i >= j:  # Skip reverse matchups and self-matchups
                    continue
                
                w1_wins, w2_wins, w1_rounds, w2_rounds = self.run_matchup(weapon1, weapon2)
                
                # Record results
                results[weapon1.name]["wins"] += w1_wins
                results[weapon1.name]["losses"] += w2_wins
                results[weapon1.name]["total_fights"] += self.simulations_per_matchup
                all_rounds_on_win[weapon1.name].extend(w1_rounds)
                
                results[weapon2.name]["wins"] += w2_wins
                all_rounds_on_win[weapon2.name].extend(w2_rounds)

                results[weapon2.name]["losses"] += w1_wins
                results[weapon2.name]["total_fights"] += self.simulations_per_matchup
        
        # Calculate final statistics
        for weapon_name in results:
            total = results[weapon_name]["total_fights"]
            wins = results[weapon_name]["wins"]
            results[weapon_name]["win_rate"] = wins / total if total > 0 else 0
            
            if weapon_name in all_rounds_on_win and all_rounds_on_win[weapon_name]:
                avg_rounds = statistics.mean(all_rounds_on_win[weapon_name])
                results[weapon_name]["avg_rounds_on_win"] = avg_rounds
            else:
                results[weapon_name]["avg_rounds_on_win"] = 0.0
        
        return dict(results)


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    def prompt_int(prompt: str, min_value: int = None, max_value: int = None) -> int:
        while True:
            raw = input(prompt).strip()
            try:
                value = int(raw)
            except ValueError:
                print("Введите число.")
                continue
            if min_value is not None and value < min_value:
                print(f"Минимум: {min_value}.")
                continue
            if max_value is not None and value > max_value:
                print(f"Максимум: {max_value}.")
                continue
            return value

    rank = prompt_int("Какого ранга должны драться персонажи? (1-4): ", 1, 4)
    x_value = prompt_int("Какое значение X нужно принять в свойствах? ", 1)
    rerolls = 1

    # Create weapons: for each property -> 1 melee and/or 1 ranged variant; all have rerolls.
    property_defs = PROPERTY_DEFS

    test_weapons = []
    for prop_name, prop_value in property_defs:
        if prop_name == "Переброс":
            continue
        for wtype in PROPERTY_COMPATIBILITY.get(prop_name, ("melee", "ranged")):
            prop_setting = x_value if type(prop_value) is int else prop_value
            props = {prop_name: prop_setting, "Переброс": rerolls}
            weapon_name = f"{wtype.upper()} | {prop_name}"
            test_weapons.append(Weapon(name=weapon_name, damage=3, weapon_type=wtype, properties=props, rank=rank))
    # Run tournament
    tournament = WeaponTournament(rank=rank, simulations_per_matchup=1000)
    results = tournament.run_tournament(test_weapons)
    
    # Print results
    print(f"\n{'='*80}")
    print("FINAL RESULTS")
    print(f"{'='*80}\n")
    print(f"Параметры: ранг {rank}, перебросов {rerolls}, X {x_value}\n")
    
    print(f"{'Weapon':<35} {'Win Rate':<12} {'Avg Rounds on Win':<20}")
    print("-" * 80)
    
    # Sort by win rate
    sorted_results = sorted(results.items(), key=lambda x: x[1]["win_rate"], reverse=True)
    
    for weapon_name, stats in sorted_results:
        print(
            f"{weapon_name:<35} {stats['win_rate']:>10.1%}  "
            f"{stats['avg_rounds_on_win']:>17.1f}"
        )
    
    print(f"\n{'='*80}\n")
    
    # Keep console open
    input("\nПресс Enter для выхода...")
