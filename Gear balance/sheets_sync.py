import json
import os
import re
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from sim_rules import CONTROL_PROPERTIES, SELF_DAMAGE_PROPERTIES


def load_config():
    config_path = Path(__file__).with_name("sheets_sync_config.json")
    with config_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_property_values(path_str):
    path = Path(path_str)
    if not path.is_absolute():
        path = Path(__file__).parent / path
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def col_to_a1(col_number):
    col = col_number
    letters = []
    while col > 0:
        col, remainder = divmod(col - 1, 26)
        letters.append(chr(65 + remainder))
    return "".join(reversed(letters))


def a1_range(sheet, start_row, start_col, end_row, end_col):
    start = f"{col_to_a1(start_col)}{start_row}"
    end = f"{col_to_a1(end_col)}{end_row}"
    return f"{sheet}!{start}:{end}"


def build_property_rows(data, rank_order, types, order_mode):
    seen = set()
    properties = []
    if order_mode == "sorted":
        all_props = set()
        for rank in rank_order:
            rank_data = data.get(str(rank), {}).get("property_costs", {})
            for prop_type in types:
                all_props.update(rank_data.get(prop_type, {}).keys())
        properties = sorted(all_props, key=property_label_sort_key)
    else:
        for rank in rank_order:
            rank_data = data.get(str(rank), {}).get("property_costs", {})
            for prop_type in types:
                for prop_name in rank_data.get(prop_type, {}).keys():
                    if prop_name in seen:
                        continue
                    seen.add(prop_name)
                    properties.append(prop_name)
    damage_properties = []
    self_damage_properties = []
    control_properties = []
    for name in properties:
        if is_control_property_label(name):
            control_properties.append(name)
        else:
            dual_category = is_dual_category_property_label(name)
            if dual_category or not is_self_damage_property_label(name):
                damage_properties.append(name)
            if dual_category or is_self_damage_property_label(name):
                self_damage_properties.append(name)

    total_cols = 1 + (len(rank_order) * len(types))
    rows = []

    for prop_name in damage_properties:
        row = [prop_name]
        for rank in rank_order:
            rank_data = data.get(str(rank), {}).get("property_costs", {})
            for prop_type in types:
                cost_entry = rank_data.get(prop_type, {}).get(prop_name)
                row.append(get_property_value(cost_entry, value_mode="cost"))
        rows.append(row)

    if self_damage_properties:
        if rows:
            rows.append([""] * total_cols)
        for prop_name in self_damage_properties:
            row = [prop_name]
            for rank in rank_order:
                rank_data = data.get(str(rank), {}).get("property_costs", {})
                for prop_type in types:
                    cost_entry = rank_data.get(prop_type, {}).get(prop_name)
                    row.append(get_property_value(cost_entry, value_mode="received"))
            rows.append(row)

    if control_properties:
        if rows:
            rows.append([""] * total_cols)

    for prop_name in control_properties:
        row = [prop_name]
        for rank in rank_order:
            rank_data = data.get(str(rank), {}).get("property_costs", {})
            for prop_type in types:
                cost_entry = rank_data.get(prop_type, {}).get(prop_name)
                row.append(get_property_value(cost_entry, value_mode="prevention"))
        rows.append(row)

    return rows


def property_label_sort_key(label):
    text = str(label)
    match = re.match(r"^(.*?)(?:\s+(-?\d+))$", text)
    if match:
        base = match.group(1).strip().lower()
        return (base, 0, int(match.group(2)))
    return (text.lower(), 1, 0)


CONTROL_PROPERTY_LABELS = {
    name[:-2] if name.endswith(" X") else name for name in CONTROL_PROPERTIES
}

SELF_DAMAGE_PROPERTY_LABELS = {
    name[:-2] if name.endswith(" X") else name for name in SELF_DAMAGE_PROPERTIES
}

DUAL_CATEGORY_PROPERTY_LABELS = {
    "Assault",
}


def is_control_property_label(label):
    text = str(label).strip()
    match = re.match(r"^(.*?)(?:\s+(-?\d+))$", text)
    base = match.group(1).strip() if match else text
    return base in CONTROL_PROPERTY_LABELS


def is_self_damage_property_label(label):
    text = str(label).strip()
    match = re.match(r"^(.*?)(?:\s+(-?\d+))$", text)
    base = match.group(1).strip() if match else text
    return base in SELF_DAMAGE_PROPERTY_LABELS


def is_dual_category_property_label(label):
    text = str(label).strip()
    match = re.match(r"^(.*?)(?:\s+(-?\d+))$", text)
    base = match.group(1).strip() if match else text
    return base in DUAL_CATEGORY_PROPERTY_LABELS


def get_property_value(cost_entry, value_mode):
    if cost_entry is None:
        return ""
    if isinstance(cost_entry, dict):
        if value_mode == "prevention":
            key = "damage_prevention"
        elif value_mode == "received":
            if "damage_received_delta" in cost_entry:
                key = "damage_received_delta"
            else:
                key = "average_damage_received"
        else:
            key = "cost"
        value = cost_entry.get(key)
        return "" if value is None else value
    if value_mode != "cost":
        return ""
    return cost_entry


def load_dotenv(paths):
    for path in paths:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                if key.startswith("\ufeff"):
                    key = key.lstrip("\ufeff")
                value = value.strip().strip('"').strip("'")
                if not key:
                    continue
                current = os.environ.get(key)
                if current is None or current == "":
                    os.environ[key] = value


def read_dotenv_value(paths, key_name):
    for path in paths:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                if key.startswith("\ufeff"):
                    key = key.lstrip("\ufeff")
                if key != key_name:
                    continue
                return value.strip().strip('"').strip("'")
    return None


def get_credentials():
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    repo_root = Path(__file__).resolve().parent.parent
    dotenv_paths = [
        Path(__file__).with_name(".env"),
        repo_root / ".env",
    ]
    if creds_path and not Path(creds_path).exists():
        dotenv_value = read_dotenv_value(
            dotenv_paths, "GOOGLE_APPLICATION_CREDENTIALS"
        )
        if dotenv_value and Path(dotenv_value).exists():
            creds_path = dotenv_value
        else:
            load_dotenv(dotenv_paths)
            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path:
        load_dotenv(dotenv_paths)
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path:
        raise RuntimeError(
            "Missing GOOGLE_APPLICATION_CREDENTIALS. "
            "Set it to your service account JSON path."
        )
    if not Path(creds_path).exists():
        raise RuntimeError(
            "GOOGLE_APPLICATION_CREDENTIALS points to a missing file: "
            f"{creds_path}"
        )
    return service_account.Credentials.from_service_account_file(
        creds_path, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )


def write_property_values(config):
    pv_config = config["property_values"]
    data = load_property_values(pv_config["property_values_path"])
    rank_order = pv_config.get("rank_order") or sorted(int(k) for k in data.keys())
    types = pv_config.get("types", ["melee", "ranged"])
    order_mode = pv_config.get("property_name_order", "first-seen")

    rows = build_property_rows(data, rank_order, types, order_mode)
    if not rows:
        raise RuntimeError("No property rows generated. Check input data.")

    start_row = pv_config["start_row"]
    start_col = pv_config["name_col"]
    end_row = start_row + len(rows) - 1
    end_col = pv_config["first_cost_col"] + (len(rank_order) * len(types)) - 1

    target_range = a1_range(config["worksheet"], start_row, start_col, end_row, end_col)

    credentials = get_credentials()
    service = build("sheets", "v4", credentials=credentials)
    service.spreadsheets().values().update(
        spreadsheetId=config["sheet_id"],
        range=target_range,
        valueInputOption="RAW",
        body={"values": rows},
    ).execute()


def main():
    config = load_config()
    write_property_values(config)
    print("Property values written.")


if __name__ == "__main__":
    main()
