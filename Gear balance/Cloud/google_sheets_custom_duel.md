# Google Sheets Custom Duel

This setup lets a Google Sheets button launch `weapons_sim.py` custom duel simulations.

## 1) Deploy to Google Cloud Run

```powershell
& ".\Gear balance\deploy_custom_duel_cloud_run.ps1" `
  -ProjectId "project-andromeda-485908" `
  -Region "europe-west1 " `
  -ServiceName "andromeda-custom-duel" `
  -ApiKey "597798c2ca6ce89479507b4b5d42501b6b83b15e4b9920b33b11cd69a7117834"
```

After deploy, copy the Cloud Run service URL.
Your Apps Script endpoint must be:

`https://<service-url>/simulate`

## 2) Configure Google Sheet script

1. Open your Google Sheet.
2. `Extensions -> Apps Script`.
3. Paste `Gear balance/google_sheets_custom_duel.gs`.
4. Update:
   - `CONFIG.endpointUrl`
   - `CONFIG.apiKey`
   - `CONFIG.sheetName`
   - A1 addresses in `CONFIG.input` and `CONFIG.output`.
5. Save and run once to grant permissions.
6. Add a drawing/button and assign script `runCustomDuelSimulation`.

## 3) Input format for properties

Each non-empty row in the configured properties ranges is one property, for example:

- `Bleed 1`
- `Reach 2`
- `Armor Pierce`
- `Stun`

You can also put multiple properties in one cell separated by comma or semicolon.

Notes:
- Apps Script now sends only rank + two weapons.
- Simulation count is auto-derived from `CONFIG.confidence`.
- Distance is sampled by simulator scenario pool (custom duel style), no sheet distance cell needed.

## 4) Response written back to sheet

- Weapon 1 win rate (as decimal for percent-formatted cell)
- Weapon 2 win rate
- Average rounds
- Simulations used
- Status (`Running...`, `Done`, or error message)
