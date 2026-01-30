"""
Shared acceleration helpers for Gear balance simulations.
"""

from __future__ import annotations

import concurrent.futures
import os
import random
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

PARALLEL_MIN_SIMULATIONS = 20_000
PARALLEL_CHUNKS_PER_WORKER = 4
PARALLEL_MIN_CHUNK_SIZE = 1_000

PROP_TYPE = 0
PROP_DAMAGE = 1
PROP_ARMOR_PIERCE = 2
PROP_ESCALATION = 3
PROP_RELOAD = 4
PROP_STABILIZATION = 5
PROP_ACCURACY = 6
PROP_GUARANTEE = 7
PROP_STUN = 8
PROP_APPLY_SLOW = 9
PROP_DANGEROUS = 10
PROP_RISK = 11
PROP_AGGRESSIVE = 12
PROP_BLEED = 13
PROP_DISORIENT = 14
PROP_IMMOBILIZE = 15
PROP_SUPPRESSION = 16
PROP_REROLLS = 17
PROP_COUNT = 18

try:
    import numpy as np
    from numba import njit

    NUMBA_AVAILABLE = True
except Exception:
    np = None

    def njit(*_args, **_kwargs):
        def wrapper(func):
            return func

        return wrapper

    NUMBA_AVAILABLE = False


def resolve_worker_count(max_workers: Optional[int]) -> int:
    if max_workers is not None:
        try:
            return max(1, int(max_workers))
        except (TypeError, ValueError):
            pass
    return max(1, os.cpu_count() or 1)


def build_simulation_chunks(
    simulations: int,
    workers: int,
    chunks_per_worker: int = PARALLEL_CHUNKS_PER_WORKER,
    min_chunk_size: int = PARALLEL_MIN_CHUNK_SIZE,
) -> List[Tuple[int, int]]:
    if simulations <= 0:
        return []
    target_chunks = max(1, workers * chunks_per_worker)
    chunk_size = max(simulations // target_chunks, 1)
    if simulations >= min_chunk_size and chunk_size < min_chunk_size:
        chunk_size = min_chunk_size

    chunks: List[Tuple[int, int]] = []
    start_index = 0
    while start_index < simulations:
        size = min(chunk_size, simulations - start_index)
        chunks.append((start_index, size))
        start_index += size
    return chunks


@dataclass
class SimulationPool:
    max_workers: Optional[int] = None
    executor: Optional[concurrent.futures.ProcessPoolExecutor] = None
    workers: int = 0

    def start(self) -> "SimulationPool":
        if self.executor is None:
            self.workers = resolve_worker_count(self.max_workers)
            self.executor = concurrent.futures.ProcessPoolExecutor(
                max_workers=self.workers
            )
        return self

    def close(self) -> None:
        if self.executor is not None:
            self.executor.shutdown(wait=True)
            self.executor = None
            self.workers = 0

    def __enter__(self) -> "SimulationPool":
        return self.start()

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()


@dataclass(frozen=True)
class BatchTask:
    args: Tuple[Any, ...]
    kwargs: Dict[str, Any]


def acquire_executor(
    pool: Optional[SimulationPool],
    max_workers: Optional[int],
) -> Tuple[Optional[concurrent.futures.ProcessPoolExecutor], int, bool]:
    if pool is not None:
        pool.start()
        return pool.executor, pool.workers, False
    workers = resolve_worker_count(max_workers)
    if workers < 2:
        return None, workers, False
    executor = concurrent.futures.ProcessPoolExecutor(max_workers=workers)
    return executor, workers, True


def batch_map(
    func,
    tasks: List[BatchTask],
    pool: Optional[SimulationPool] = None,
    max_workers: Optional[int] = None,
    progress_label: Optional[str] = None,
    show_progress: bool = False,
) -> List[Any]:
    if not tasks:
        return []

    executor, workers, owns_executor = acquire_executor(pool, max_workers)
    if executor is None or workers < 2:
        return [func(*task.args, **task.kwargs) for task in tasks]

    results: List[Any] = [None] * len(tasks)
    futures: Dict[concurrent.futures.Future, int] = {}
    completed = 0
    try:
        for idx, task in enumerate(tasks):
            future = executor.submit(func, *task.args, **task.kwargs)
            futures[future] = idx

        for future in concurrent.futures.as_completed(futures):
            idx = futures[future]
            results[idx] = future.result()
            completed += 1
            if show_progress and progress_label is not None:
                percent = int(completed * 100 / len(tasks))
                print(f"\r{progress_label} {percent:>3d}% ({completed}/{len(tasks)})", end="")
        if show_progress and progress_label is not None:
            print()
    finally:
        if owns_executor and executor is not None:
            executor.shutdown(wait=True)

    return results


if NUMBA_AVAILABLE:

    @njit(cache=True)
    def _fast_matchup_numba(
        w1_table,
        w2_table,
        dice: int,
        base_hp: int,
        simulations: int,
        max_rounds: int,
        start_index: int,
        seed: int,
    ) -> Tuple[int, int, int]:
        np.random.seed(seed)
        w1_wins = 0
        w2_wins = 0
        total_rounds = 0
        for i in range(simulations):
            if (start_index + i) % 2 == 0:
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

                defender_hp -= atk_table[np.random.randint(1, dice + 1)]
                if defender_hp <= 0:
                    break
                defender_hp -= atk_table[np.random.randint(1, dice + 1)]
                if defender_hp <= 0:
                    break

                attacker_hp -= def_table[np.random.randint(1, dice + 1)]
                if attacker_hp <= 0:
                    break
                attacker_hp -= def_table[np.random.randint(1, dice + 1)]
                if attacker_hp <= 0:
                    break

            total_rounds += rounds
            attacker_wins = defender_hp <= 0

            if attacker_wins:
                if attacker_is_w1:
                    w1_wins += 1
                else:
                    w2_wins += 1
            else:
                if attacker_is_w1:
                    w2_wins += 1
                else:
                    w1_wins += 1

        return w1_wins, w2_wins, total_rounds

else:

    def _fast_matchup_numba(
        w1_table,
        w2_table,
        dice: int,
        base_hp: int,
        simulations: int,
        max_rounds: int,
        start_index: int,
        seed: int,
    ) -> Tuple[int, int, int]:
        raise RuntimeError("Numba is not available.")


def fast_matchup_chunk(
    w1_table: List[int],
    w2_table: List[int],
    dice: int,
    base_hp: int,
    simulations: int,
    max_rounds: int,
    start_index: int,
    track_rounds: bool,
    seed: Optional[int],
    use_numba: bool = True,
) -> Tuple[int, int, List[int], List[int], int]:
    if use_numba and NUMBA_AVAILABLE and not track_rounds:
        if seed is None:
            seed = random.randrange(1, 2**31)
        w1_arr = np.asarray(w1_table, dtype=np.int32)
        w2_arr = np.asarray(w2_table, dtype=np.int32)
        w1_wins, w2_wins, total_rounds = _fast_matchup_numba(
            w1_arr,
            w2_arr,
            dice,
            base_hp,
            simulations,
            max_rounds,
            start_index,
            seed,
        )
        return w1_wins, w2_wins, [], [], total_rounds

    if seed is not None:
        random.seed(seed)

    randrange = random.randrange
    w1_wins = 0
    w2_wins = 0
    total_rounds = 0
    w1_win_rounds: Optional[List[int]] = [] if track_rounds else None
    w2_win_rounds: Optional[List[int]] = [] if track_rounds else None

    for i in range(simulations):
        if (start_index + i) % 2 == 0:
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

    if w1_win_rounds is None:
        w1_win_rounds = []
    if w2_win_rounds is None:
        w2_win_rounds = []
    return w1_wins, w2_wins, w1_win_rounds, w2_win_rounds, total_rounds


if NUMBA_AVAILABLE:

    @njit(cache=True)
    def _record_shot(att, shots, reload_required, w_props, weapon_idx):
        reload_after = w_props[weapon_idx[att], PROP_RELOAD]
        if reload_after > 0:
            shots[att] += 1
            if shots[att] >= reload_after:
                reload_required[att] = 1


    @njit(cache=True)
    def _apply_status_on_hit(att, target, actions, reaction, bleed, slow, immobile, w_props, weapon_idx, rank):
        w_idx = weapon_idx[att]
        bleed_value = w_props[w_idx, PROP_BLEED]
        if bleed_value > 0:
            duration = bleed_value
            if duration > bleed[target]:
                bleed[target] = duration
        if w_props[w_idx, PROP_APPLY_SLOW] > 0:
            if slow[target] < 2:
                slow[target] = 2
        if w_props[w_idx, PROP_DISORIENT] > 0:
            reaction[target] = 0
        immobile_rank = w_props[w_idx, PROP_IMMOBILIZE]
        if immobile_rank > 0 and rank <= immobile_rank:
            if immobile[target] < 2:
                immobile[target] = 2
        stun_rank = w_props[w_idx, PROP_STUN]
        if stun_rank > 0 and rank <= stun_rank:
            if actions[target] > 0:
                actions[target] -= 1
            if actions[target] < 0:
                actions[target] = 0


    @njit(cache=True)
    def _evaluate_roll(att, hp, w_props, w_idx, dice, skill, defense, stabilization):
        roll_value = np.random.randint(1, dice + 1)
        raw_roll = roll_value
        danger = w_props[w_idx, PROP_DANGEROUS]
        if danger > 0 and raw_roll > danger:
            hp[att] -= 1
        accuracy = w_props[w_idx, PROP_ACCURACY]
        if accuracy > 0:
            roll_value = min(roll_value + accuracy, dice)
        guarantee = w_props[w_idx, PROP_GUARANTEE]
        if guarantee > 0 and roll_value != 1 and roll_value < guarantee:
            roll_value = guarantee
        total_roll = roll_value + skill + stabilization
        hit = 1 if total_roll >= defense else 0
        damage = 0
        if hit == 1:
            margin = total_roll - defense
            damage = margin + w_props[w_idx, PROP_DAMAGE]
            if roll_value == dice:
                escalation = w_props[w_idx, PROP_ESCALATION]
                if escalation > 0:
                    damage += escalation
        return roll_value, hit, damage


    @njit(cache=True)
    def _roll_attack(att, target, hp, moved, w_props, w_range, weapon_idx, distance, dice, skill, defense, rank):
        w_idx = weapon_idx[att]
        if distance > w_range[w_idx]:
            return 0, 0, 0

        stabilization = 0
        if w_props[w_idx, PROP_STABILIZATION] > 0 and moved[att] == 0:
            stabilization = w_props[w_idx, PROP_STABILIZATION]

        _, hit, damage = _evaluate_roll(att, hp, w_props, w_idx, dice, skill, defense, stabilization)

        if hit == 0:
            damage = 0
            armor_pierce = w_props[w_idx, PROP_ARMOR_PIERCE]
            if armor_pierce > 0 and rank <= armor_pierce:
                damage = 1
            rerolls = w_props[w_idx, PROP_REROLLS]
            for _ in range(rerolls):
                _, hit, reroll_damage = _evaluate_roll(
                    att, hp, w_props, w_idx, dice, skill, defense, stabilization
                )
                if hit == 1:
                    damage = reroll_damage
                    break

        if hit == 1 and damage < 1:
            damage = 1

        return hit, damage, 1


    @njit(cache=True)
    def _perform_reaction_attack(
        att,
        target,
        hp,
        moved,
        actions,
        reaction,
        bleed,
        slow,
        immobile,
        shots,
        reload_required,
        w_props,
        w_range,
        weapon_idx,
        distance,
        dice,
        skill,
        defense,
        rank,
    ):
        w_idx = weapon_idx[att]
        if w_props[w_idx, PROP_RELOAD] > 0 and reload_required[att] == 1:
            return

        hit, damage, shot_fired = _roll_attack(
            att,
            target,
            hp,
            moved,
            w_props,
            w_range,
            weapon_idx,
            distance,
            dice,
            skill,
            defense,
            rank,
        )

        if hit == 1:
            hp[target] -= damage
            _apply_status_on_hit(
                att,
                target,
                actions,
                reaction,
                bleed,
                slow,
                immobile,
                w_props,
                weapon_idx,
                rank,
            )

        if shot_fired == 1:
            _record_shot(att, shots, reload_required, w_props, weapon_idx)

    @njit(cache=True)
    def _perform_aggressive_reaction(
        att,
        target,
        hp,
        moved,
        actions,
        reaction,
        bleed,
        slow,
        immobile,
        shots,
        reload_required,
        w_props,
        w_range,
        weapon_idx,
        distance,
        dice,
        skill,
        defense,
        rank,
    ):
        w_idx = weapon_idx[att]
        if w_props[w_idx, PROP_AGGRESSIVE] <= 0:
            return
        if reaction[att] == 0:
            return
        if distance > w_range[w_idx]:
            return
        reaction[att] = 0
        _perform_reaction_attack(
            att,
            target,
            hp,
            moved,
            actions,
            reaction,
            bleed,
            slow,
            immobile,
            shots,
            reload_required,
            w_props,
            w_range,
            weapon_idx,
            distance,
            dice,
            skill,
            defense,
            rank,
        )

    @njit(cache=True)
    def _should_use_suppression(
        att,
        target,
        actions,
        suppression_used,
        slow,
        immobile,
        w_props,
        w_range,
        weapon_idx,
        distance,
    ):
        if actions[att] <= 1:
            return False
        if suppression_used[att] == 1:
            return False
        if distance > w_range[weapon_idx[att]]:
            return False
        if w_props[weapon_idx[target], PROP_TYPE] != 0:
            return False
        if slow[target] > 0:
            return False
        if immobile[target] > 0:
            return False
        return True


    @njit(cache=True)
    def _perform_attack(
        att,
        target,
        hp,
        actions,
        reaction,
        moved,
        shots,
        reload_required,
        suppression_used,
        bleed,
        slow,
        immobile,
        w_props,
        w_range,
        weapon_idx,
        distance,
        dice,
        skill,
        defense,
        rank,
    ):
        if actions[att] <= 0:
            return

        w_idx = weapon_idx[att]

        if w_props[w_idx, PROP_RELOAD] > 0 and reload_required[att] == 1:
            actions[att] -= 1
            reload_required[att] = 0
            shots[att] = 0
            return

        if w_props[w_idx, PROP_SUPPRESSION] > 0:
            if _should_use_suppression(
                att,
                target,
                actions,
                suppression_used,
                slow,
                immobile,
                w_props,
                w_range,
                weapon_idx,
                distance,
            ):
                if slow[target] < 2:
                    slow[target] = 2
                suppression_used[att] = 1
                _record_shot(att, shots, reload_required, w_props, weapon_idx)
                actions[att] -= 1
                return

        hit, damage, shot_fired = _roll_attack(
            att,
            target,
            hp,
            moved,
            w_props,
            w_range,
            weapon_idx,
            distance,
            dice,
            skill,
            defense,
            rank,
        )

        if hit == 1:
            hp[target] -= damage
            _apply_status_on_hit(
                att,
                target,
                actions,
                reaction,
                bleed,
                slow,
                immobile,
                w_props,
                weapon_idx,
                rank,
            )
        else:
            if shot_fired == 1 and w_props[w_idx, PROP_RISK] > 0:
                if reaction[target] == 1 and distance <= w_range[weapon_idx[target]]:
                    reaction[target] = 0
                    _perform_reaction_attack(
                        target,
                        att,
                        hp,
                        moved,
                        actions,
                        reaction,
                        bleed,
                        slow,
                        immobile,
                        shots,
                        reload_required,
                        w_props,
                        w_range,
                        weapon_idx,
                        distance,
                        dice,
                        skill,
                        defense,
                        rank,
                    )
                    if hp[att] <= 0:
                        return

        if shot_fired == 1:
            _record_shot(att, shots, reload_required, w_props, weapon_idx)

        actions[att] -= 1


    @njit(cache=True)
    def _full_matchup_numba(
        w_props,
        w_range,
        dice: int,
        skill: int,
        defense: int,
        speed: float,
        base_hp: int,
        rank: int,
        simulations: int,
        max_rounds: int,
        start_index: int,
        initial_distance: float,
        allow_ranged_retreat: int,
        max_retreat_rounds: int,
        seed: int,
    ) -> Tuple[int, int, int]:
        np.random.seed(seed)
        w1_wins = 0
        w2_wins = 0
        total_rounds = 0

        hp = np.empty(2, dtype=np.int32)
        actions = np.empty(2, dtype=np.int32)
        reaction = np.empty(2, dtype=np.int32)
        moved = np.empty(2, dtype=np.int32)
        shots = np.empty(2, dtype=np.int32)
        reload_required = np.empty(2, dtype=np.int32)
        retreat_rounds = np.empty(2, dtype=np.int32)
        bleed = np.empty(2, dtype=np.int32)
        slow = np.empty(2, dtype=np.int32)
        immobile = np.empty(2, dtype=np.int32)
        suppression_used = np.empty(2, dtype=np.int32)
        weapon_idx = np.empty(2, dtype=np.int32)

        for sim_i in range(simulations):
            if (start_index + sim_i) % 2 == 0:
                weapon_idx[0] = 0
                weapon_idx[1] = 1
                attacker_is_w1 = True
            else:
                weapon_idx[0] = 1
                weapon_idx[1] = 0
                attacker_is_w1 = False

            hp[0] = base_hp
            hp[1] = base_hp
            actions[0] = 2
            actions[1] = 2
            reaction[0] = 1
            reaction[1] = 1
            moved[0] = 0
            moved[1] = 0
            shots[0] = 0
            shots[1] = 0
            reload_required[0] = 0
            reload_required[1] = 0
            retreat_rounds[0] = 0
            retreat_rounds[1] = 0
            bleed[0] = 0
            bleed[1] = 0
            slow[0] = 0
            slow[1] = 0
            immobile[0] = 0
            immobile[1] = 0
            suppression_used[0] = 0
            suppression_used[1] = 0

            distance = initial_distance
            rounds = 0

            while rounds < max_rounds:
                rounds += 1

                actions[0] = 2
                actions[1] = 2
                reaction[0] = 1
                reaction[1] = 1
                moved[0] = 0
                moved[1] = 0
                suppression_used[0] = 0
                suppression_used[1] = 0

                if bleed[0] > 0:
                    hp[0] -= 1
                if bleed[1] > 0:
                    hp[1] -= 1

                if hp[0] <= 0 or hp[1] <= 0:
                    break

                eff_speed_0 = 0.0 if immobile[0] > 0 else speed
                eff_speed_1 = 0.0 if immobile[1] > 0 else speed
                if slow[0] > 0:
                    eff_speed_0 *= 0.5
                if slow[1] > 0:
                    eff_speed_1 *= 0.5

                melee_close = 0.0
                ranged_retreat = 0.0

                att_range = w_range[weapon_idx[0]]
                def_range = w_range[weapon_idx[1]]
                att_type = w_props[weapon_idx[0], PROP_TYPE]
                def_type = w_props[weapon_idx[1], PROP_TYPE]

                if att_type == 0 and distance > att_range:
                    if eff_speed_0 > 0:
                        moved[0] = 1
                        melee_close += eff_speed_0

                if def_type == 0 and distance > def_range:
                    if eff_speed_1 > 0:
                        moved[1] = 1
                        melee_close += eff_speed_1

                if allow_ranged_retreat == 1:
                    if att_type == 1 and def_type == 0:
                        if distance < att_range and retreat_rounds[0] < max_retreat_rounds:
                            movement = eff_speed_0 / 2.0
                            if movement > 0:
                                moved[0] = 1
                                ranged_retreat += movement
                                retreat_rounds[0] += 1

                    if def_type == 1 and att_type == 0:
                        if distance < def_range and retreat_rounds[1] < max_retreat_rounds:
                            movement = eff_speed_1 / 2.0
                            if movement > 0:
                                moved[1] = 1
                                ranged_retreat += movement
                                retreat_rounds[1] += 1

                if melee_close != 0.0 or ranged_retreat != 0.0:
                    distance = distance - melee_close + ranged_retreat
                    if distance < 0.0:
                        distance = 0.0
                    elif distance > 100.0:
                        distance = 100.0

                while actions[0] > 0 and hp[0] > 0 and hp[1] > 0:
                    _perform_attack(
                        0,
                        1,
                        hp,
                        actions,
                        reaction,
                        moved,
                        shots,
                        reload_required,
                        suppression_used,
                        bleed,
                        slow,
                        immobile,
                        w_props,
                        w_range,
                        weapon_idx,
                        distance,
                        dice,
                        skill,
                        defense,
                        rank,
                    )

                if hp[0] > 0 and hp[1] > 0:
                    _perform_aggressive_reaction(
                        0,
                        1,
                        hp,
                        moved,
                        actions,
                        reaction,
                        bleed,
                        slow,
                        immobile,
                        shots,
                        reload_required,
                        w_props,
                        w_range,
                        weapon_idx,
                        distance,
                        dice,
                        skill,
                        defense,
                        rank,
                    )

                while actions[1] > 0 and hp[0] > 0 and hp[1] > 0:
                    _perform_attack(
                        1,
                        0,
                        hp,
                        actions,
                        reaction,
                        moved,
                        shots,
                        reload_required,
                        suppression_used,
                        bleed,
                        slow,
                        immobile,
                        w_props,
                        w_range,
                        weapon_idx,
                        distance,
                        dice,
                        skill,
                        defense,
                        rank,
                    )

                if hp[0] > 0 and hp[1] > 0:
                    _perform_aggressive_reaction(
                        1,
                        0,
                        hp,
                        moved,
                        actions,
                        reaction,
                        bleed,
                        slow,
                        immobile,
                        shots,
                        reload_required,
                        w_props,
                        w_range,
                        weapon_idx,
                        distance,
                        dice,
                        skill,
                        defense,
                        rank,
                    )

                if hp[0] <= 0 or hp[1] <= 0:
                    break

                if bleed[0] > 0:
                    bleed[0] -= 1
                if bleed[1] > 0:
                    bleed[1] -= 1
                if slow[0] > 0:
                    slow[0] -= 1
                if slow[1] > 0:
                    slow[1] -= 1
                if immobile[0] > 0:
                    immobile[0] -= 1
                if immobile[1] > 0:
                    immobile[1] -= 1

            total_rounds += rounds
            attacker_wins = hp[1] <= 0

            if attacker_wins:
                if attacker_is_w1:
                    w1_wins += 1
                else:
                    w2_wins += 1
            else:
                if attacker_is_w1:
                    w2_wins += 1
                else:
                    w1_wins += 1

        return w1_wins, w2_wins, total_rounds

else:

    def _full_matchup_numba(
        w_props,
        w_range,
        dice: int,
        skill: int,
        defense: int,
        speed: float,
        base_hp: int,
        rank: int,
        simulations: int,
        max_rounds: int,
        start_index: int,
        initial_distance: float,
        allow_ranged_retreat: int,
        max_retreat_rounds: int,
        seed: int,
    ) -> Tuple[int, int, int]:
        raise RuntimeError("Numba is not available.")


def full_matchup_chunk(
    weapon_props: List[List[int]],
    weapon_range: List[float],
    dice: int,
    skill: int,
    defense: int,
    speed: float,
    base_hp: int,
    rank: int,
    simulations: int,
    max_rounds: int,
    start_index: int,
    initial_distance: float,
    allow_ranged_retreat: bool,
    max_retreat_rounds: int,
    track_rounds: bool,
    seed: Optional[int],
    use_numba: bool = True,
) -> Tuple[int, int, List[int], List[int], int]:
    if use_numba and NUMBA_AVAILABLE and not track_rounds:
        if seed is None:
            seed = random.randrange(1, 2**31)
        w_props = np.asarray(weapon_props, dtype=np.int32)
        w_range = np.asarray(weapon_range, dtype=np.float64)
        w1_wins, w2_wins, total_rounds = _full_matchup_numba(
            w_props,
            w_range,
            dice,
            skill,
            defense,
            speed,
            base_hp,
            rank,
            simulations,
            max_rounds,
            start_index,
            initial_distance,
            1 if allow_ranged_retreat else 0,
            max_retreat_rounds,
            seed,
        )
        return w1_wins, w2_wins, [], [], total_rounds

    raise RuntimeError("Full matchup requires Numba and track_rounds=False.")
