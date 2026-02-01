import weapons_sim as ws
from datetime import datetime
from typing import Dict


def prompt_action() -> int:
    print()
    print("What do you want to do?")
    print("1) Recalculate base values (damage only)")
    print("2) Recalculate 1-property values")
    print("3) Recalculate 2-property combos")
    print("4) Recalculate property matchups")
    print("5) Recalculate everything")
    print("6) Recalculate 3-property triples")
    print("7) Run custom duel simulation")
    while True:
        raw = input("Choose 1-7: ").strip().lower()
        if raw in ("1", "2", "3", "4", "5", "6", "7"):
            return int(raw)
        print("Enter 1-7.")


def prompt_weapon_class(label: str) -> str:
    while True:
        raw = input(f"{label} weapon class (melee/ranged): ").strip().lower()
        if raw in ("melee", "m"):
            return "melee"
        if raw in ("ranged", "r"):
            return "ranged"
        print("Enter melee or ranged.")


def prompt_weapon_damage(label: str) -> int:
    while True:
        raw = input(f"{label} weapon damage (integer): ").strip()
        try:
            value = int(raw)
        except ValueError:
            print("Enter a whole number.")
            continue
        if value <= 0:
            print("Must be positive.")
            continue
        return value


def prompt_weapon_properties(weapon_type: str) -> Dict[str, object]:
    properties: Dict[str, object] = {}
    while True:
        raw = input("Property (blank to finish): ").strip()
        if not raw:
            break
        try:
            prop_name, prop_value = ws.parse_property_input(raw)
        except ValueError as exc:
            print(exc)
            continue
        if not ws.property_allows_weapon_type(prop_name, weapon_type):
            print(f"{prop_name} cannot be used on {weapon_type} weapons.")
            continue
        properties[prop_name] = prop_value
    return properties


def main():
    ws.configure_console_encoding()
    action = prompt_action()
    task_map = {
        1: ("base",),
        2: ("props",),
        3: ("pairs",),
        4: ("matchups",),
        5: ("base", "props", "pairs", "matchups", "triples"),
        6: ("triples",),
        7: ("custom",),
    }
    tasks = task_map[action]

    rank_input = ws.prompt_rank("Character rank? (1-4 or all): ", allow_all=True)
    x_value = ws.prompt_int("Value of X for properties? ", 1)
    accuracy_confidence = ws.prompt_accuracy("Desired accuracy % (e.g., 95, 99): ")
    rerolls = ws.prompt_int("Number of rerolls? (0+): ", 0)

    simulations_per_scenario = ws.required_simulations_for_accuracy(
        margin=ws.TARGET_MARGIN,
        confidence=accuracy_confidence,
        win_rate=0.5,
    )
    extreme_error = ws.error_margin_for_simulations(
        simulations=simulations_per_scenario,
        confidence=ws.EXTREME_CONFIDENCE,
        win_rate=0.5,
    )

    print(f"Simulations per pair: {simulations_per_scenario:,}.")
    print(
        f"Target accuracy: {accuracy_confidence*100:.3g}% CI, +/- {ws.TARGET_MARGIN*100:.2f}%."
    )
    print(
        "Max deviation (1 in 1,000,000): "
        f"+/- {extreme_error*100:.2f}%."
    )
    if "base" in tasks:
        print("Base values ignore rerolls; using 0.")
    if "props" in tasks:
        print("Property values ignore rerolls; using 0.")

    show_progress = ws.prompt_yes_no("Show simulation progress? (y/n): ")

    pool = None
    if simulations_per_scenario >= ws.PARALLEL_MIN_SIMULATIONS:
        pool = ws.SimulationPool()
        pool.start()

    base_scenario = ws.Scenario(
        name="15m | retreat: N",
        initial_distance=15,
    )

    ranks_to_process = ws.expand_ranks(rank_input)

    try:
        base_values_data = None
        property_values_data = None
        if "base" in tasks:
            print("Recalculating base values.")
            base_values_data = ws.recalc_base_values_for_ranks(
                ranks=ranks_to_process,
                x_value=x_value,
                simulations=simulations_per_scenario,
                scenario=base_scenario,
                show_progress=show_progress,
                pool=pool,
            )
            ws.write_base_values(base_values_data)
            print()
            print("Base values saved to base_values.py (rounded to 0.5%).")

        if "props" in tasks:
            if base_values_data is None:
                base_values_data = ws.load_base_values()
            property_values_data = ws.recalc_property_values_for_ranks(
                ranks=ranks_to_process,
                x_value=x_value,
                simulations=simulations_per_scenario,
                scenario=base_scenario,
                show_progress=show_progress,
                pool=pool,
                base_values_data=base_values_data,
            )
            ws.write_property_values(property_values_data)
            print()
            print("Property values saved to property_values.py.")

        if "pairs" in tasks:
            if base_values_data is None:
                base_values_data = ws.load_base_values()
            if property_values_data is None:
                property_values_data = ws.load_property_values()
            pair_data = ws.recalc_property_pairs_for_ranks(
                ranks=ranks_to_process,
                x_value=x_value,
                simulations=simulations_per_scenario,
                scenario=base_scenario,
                show_progress=show_progress,
                pool=pool,
                base_values_data=base_values_data,
                property_values_data=property_values_data,
            )
            ws.write_property_combos(pair_data)
            print()
            print("Property pair costs saved to property_combos.py.")

        if "matchups" in tasks:
            if base_values_data is None:
                base_values_data = ws.load_base_values()
            if property_values_data is None:
                property_values_data = ws.load_property_values()
            matchup_data = ws.recalc_property_matchups_for_ranks(
                ranks=ranks_to_process,
                x_value=x_value,
                simulations=simulations_per_scenario,
                scenario=base_scenario,
                show_progress=show_progress,
                pool=pool,
                base_values_data=base_values_data,
                property_values_data=property_values_data,
            )
            ws.write_property_matchups(matchup_data)
            print()
            print("Property matchup data saved to property_matchups.py.")

        if "triples" in tasks:
            if base_values_data is None:
                base_values_data = ws.load_base_values()
            if property_values_data is None:
                property_values_data = ws.load_property_values()
            triple_data = ws.recalc_property_triples_for_ranks(
                ranks=ranks_to_process,
                x_value=x_value,
                simulations=simulations_per_scenario,
                scenario=base_scenario,
                show_progress=show_progress,
                pool=pool,
                base_values_data=base_values_data,
                property_values_data=property_values_data,
            )
            ws.write_property_triples(triple_data)
            print()
            print("Property triple costs saved to property_triples.py.")

        if "custom" in tasks:
            print()
            print("Custom duel simulation")
            custom_rank = rank_input
            if custom_rank == "all":
                custom_rank = ws.prompt_rank("Custom duel rank? (1-4): ")
            custom_rank = int(custom_rank)
            weapon1_type = prompt_weapon_class("First")
            weapon1_damage = prompt_weapon_damage("First")
            weapon1_props = prompt_weapon_properties(weapon1_type)
            weapon1 = ws.Weapon(
                name="Custom Weapon 1",
                damage=weapon1_damage,
                weapon_type=weapon1_type,
                properties=weapon1_props,
                rank=custom_rank,
            )
            weapon2_type = prompt_weapon_class("Second")
            weapon2_damage = prompt_weapon_damage("Second")
            weapon2_props = prompt_weapon_properties(weapon2_type)
            weapon2 = ws.Weapon(
                name="Custom Weapon 2",
                damage=weapon2_damage,
                weapon_type=weapon2_type,
                properties=weapon2_props,
                rank=custom_rank,
            )
            stats = ws.simulate_custom_duel(
                weapon1,
                weapon2,
                rank=custom_rank,
                simulations=simulations_per_scenario,
                scenario=base_scenario,
                show_progress=show_progress,
                pool=pool,
            )
            print()
            print("Custom duel results:")
            print(f"Weapon 1 win rate: {stats['weapon1_win_rate']*100:.2f}%")
            print(f"Weapon 2 win rate: {stats['weapon2_win_rate']*100:.2f}%")
            print(f"Average rounds: {stats['avg_rounds']:.2f}")
            entry = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "rank": custom_rank,
                "scenario": base_scenario.name,
                "scenario_distance": base_scenario.initial_distance,
                "simulations": simulations_per_scenario,
                "weapon1": ws.summarize_weapon_for_dump(weapon1),
                "weapon2": ws.summarize_weapon_for_dump(weapon2),
                "avg_rounds": stats["avg_rounds"],
                "weapon1_win_rate": stats["weapon1_win_rate"],
                "weapon2_win_rate": stats["weapon2_win_rate"],
            }
            ws.append_custom_simulation(entry)
            print()
            print(
                f"Custom duel data appended to {ws.CUSTOM_SIMULATIONS_PATH.name}."
            )
    finally:
        if pool is not None:
            pool.close()

    input("Press Enter to exit...")


if __name__ == "__main__":
    main()
