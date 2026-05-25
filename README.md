# Mausritter Character App

Pure HTML/CSS/JavaScript prototype for a Traditional Chinese Mausritter character app.

## Run Locally

```bash
python3 -m http.server 8976
```

Then open:

```text
http://127.0.0.1:8976/index.html
```

## Current Scope

- Character identity, portrait, level, HP, STR/DEX/WIL, money, grit, and notes.
- Equipment and backpack tabs.
- Drag-and-drop item cards with swap behavior.
- Item slot shapes: `1x1`, `1x2`, and `2x1`.
- Equipment placement limits based on part rules:
  - Paw
  - Two paws
  - Body
  - Body + paw
- Backpack ignores body-part restrictions but still obeys shape and available-space rules.
- Money cap starts at 250 and increases by 250 per `錢袋` item.
- Dice bar supports d6, d8, d10, d20, plus a two-dice advantage/disadvantage toggle.
- Local persistence uses `localStorage`.

## Reference Materials

- Google Drive Mausritter folder with rules and sheets.
- Google Sheet `鼠騎士`, especially the `物品表` sheet:
  - `名字`
  - `屬性`
  - `護甲值`
  - `usage`
  - `圖片`
  - `骰子`
  - `占用格數`
  - `格子排法`
  - `部位限定`
- Figma references for:
  - 戰役相關
  - 物品與狀態
  - 說明書

## Notes For Next Codex Session

This app is currently a single-page prototype in `index.html`, `script.js`, and `styles.css`.

Images are temporary SVG drawings in `script.js`; final item images will be provided later.

Important behavior already implemented:

- Items can swap positions when dropped onto occupied slots.
- If a swap cannot fit due to shape, space, or equipment-part restrictions, a toast appears and the move is reverted.
- Displaced items may be moved into backpack space automatically if the backpack has room.

## Suggested Next Work

- Import the Google Sheet item table into structured data instead of hard-coding `itemPresets`.
- Add final item images.
- Add campaign-related pages.
- Add rules/help pages.
- Improve item editing and deletion flows.
