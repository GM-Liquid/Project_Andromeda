import weapons_sim as ws


def prompt_action() -> int:
    print()
    print("What do you want to do?")
    print("1) Recalculate base values (damage only)")
    print("2) Recalculate 1-property values")
    print("3) Recalculate 2-property combos")
    print("4) Recalculate everything")
    while True:
        raw = input("Choose 1-4: ").strip().lower()
        if raw in ("1", "2", "3", "4"):
            return int(raw)
        print("Enter 1-4.")


def main():
    ws.configure_console_encoding()
    action = prompt_action()
    task_map = {
        1: ("base",),
        2: ("props",),
        3: ("combos",),
        4: ("base", "props", "combos"),
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

        if "combos" in tasks:
            print()
            print("Property combo simulation not implemented yet.")
            print("property_combos.py left unchanged.")
    finally:
        if pool is not None:
            pool.close()

    input("Press Enter to exit...")


if __name__ == "__main__":
    main()
