# Google Sheets Sync MVP

This MVP treats world `Item` documents as the source of truth.

Flow:

1. Open `Settings -> System Settings -> Google Sheets Item Sync`.
2. Paste the deployed Google Apps Script Web App URL and shared token.
3. Use `Export to Sheets` to push all world items into Google Sheets.
4. Edit the rows in Google Sheets.
5. Use `Preview Import` to see what will be created, updated, skipped, or rejected.
6. Use `Apply Import` to update world items in place.

Apps Script note:

- The Foundry client sends the request body as JSON with the `Content-Type` header set to `text/plain`.
- This is intentional. Google Apps Script web apps answer `POST` correctly, but they reject browser `OPTIONS` preflight requests with HTTP 405.
- Using `text/plain` keeps the browser request in the simple-CORS category so the request reaches `doPost(e)` without a preflight.
- The Apps Script template clears only sheet contents during export. Cell formatting such as alignment, wrapping, colors, widths, and hidden columns stays in place between exports.

Why links stay intact:

- The import updates existing world items instead of deleting and recreating them.
- The existing library sync then updates linked actor items from those world items.
- Actor-local fields such as `quantity` and `equipped` remain local because the existing library sync already preserves them.

Important MVP rules:

- Only the primary active GM should run import/export.
- New actor-linked library items are not created from Google Sheets.
- Changing an existing item's `type` is blocked during import.
- `syncId` remains only as a hidden technical column so imports can safely update existing items in place.
- The spreadsheet now exposes only the content-facing columns. Technical columns from older versions remain import-compatible but are no longer exported.
- Advanced fields such as `sort`, `system.rules`, `system.traits`, and `system.details` stay inside Foundry data for now. If they become part of the regular workflow later, they can be restored as dedicated visible columns.

Sheets created by export:

- `weapons`
- `armor`
- `equipment`
- `traits`
- `environment`

Common visible columns on every sheet:

- localized `Type`
- localized `Name`
- localized `Owned By`

Visible per-sheet columns:

- `weapons`: localized `Rank`, `Skill`, `Damage`, `Description`
- `armor`: localized `Rank`, `Physical Protection`, `Magical Protection`, `Mental Protection`, `Power Shield`, `Speed Bonus`, `Description`
- `equipment`: localized `Rank`, `Skill`, `Damage`, `Description`
- `traits`: localized `Usage Frequency`, `Activation`, `Range`, `Skill`, `Description`
- `environment`: localized `Quantity`, `Description`

Notes:

- `Owned By` is informational only and is ignored by import.
- `Type` and `Skill` export in the current UI language, and import accepts both localized labels and technical keys.
- `folderName`, `systemJson`, `system.requiresRoll`, and legacy service columns are no longer exported.
- Older sheets that still contain legacy columns continue to import.

Recommended workflow:

- Export first and use the generated sheet structure as your editing template.
- Leave the hidden `syncId` column untouched for existing items.
- Use `Preview Import` before `Apply Import`, especially after adding rows manually.
- If you update the Apps Script template in this repository, paste the new code into your deployed Apps Script project and redeploy the web app before testing again.
