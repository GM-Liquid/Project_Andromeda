import weapons_sim as ws


def prompt_action() -> int:
    print()
    print("What do you want to do?")
    print("1) Recalculate base values (damage only)")
    print("2) Recalculate 1-property values")
    print("3) Recalculate 2-property combos")
    print("4) Recalculate property matchups")
    print("5) Recalculate everything")
    while True:
        raw = input("Choose 1-5: ").strip().lower()
        if raw in ("1", "2", "3", "4", "5"):
            return int(raw)
        print("Enter 1-5.")


def main():
    ws.configure_console_encoding()
    action = prompt_action()
    task_map = {
        1: ("base",),
        2: ("props",),
        3: ("pairs",),
        4: ("matchups",),
        5: ("base", "props", "pairs", "matchups"),
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
        allow_ranged_retreat=False,
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
    finally:
        if pool is not None:
            pool.close()

    input("Press Enter to exit...")


if __name__ == "__main__":
    main()
