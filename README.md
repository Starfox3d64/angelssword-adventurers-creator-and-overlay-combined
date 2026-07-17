# ⚔️ AS Adventurer — Combined Edition

**Reactive Overlay + VTuber Creator** in one program

**Made by TheDonOfEverything aka Paul Conforti**  
Python port of the original JavaScript version by **Leaflit**  
Angel's Sword Studios • Version 1.0 • July 2026

> Everything runs 100% locally on your PC. No Node.js required.

## What’s Inside

One unified Python application containing:

- **🎮 Overlay** — Real-time reactive streaming overlay with face tracking, expression detection, and emotes
- **🎨 Creator** — Full VTuber asset creation pipeline (Sprite Prep → AI Video Generation → Video Prep → Export)

## Quick Start (Windows)

1. Extract the folder
2. Double-click **`Start AS Adventurer.bat`**
3. Your browser will open to the main menu
4. Choose:
   - **Overlay Control Panel**
   - **Creator Pipeline**

Everything runs **locally on your PC**.

## Access Points

| Tool          | URL                              |
|---------------|----------------------------------|
| Main Menu     | http://localhost:3000            |
| Overlay       | http://localhost:3000/overlay    |
| Creator       | http://localhost:3000/creator    |

## Features

### Overlay
- VTube Studio + iFacialMocap face tracking
- Smart expression detection (Happy, Sad, Surprised, Eyes Closed)
- Full emote system with nested sub-animations
- Multiple character models
- OBS Browser Source ready

### Creator
- Sprite Prep (upload or AI generate)
- AI Video Generation (Gemini) (Support for Grok and Chatgbt untested)
- Video Preparation (loops, concat, crossfade)
- Model Exporter (chroma key + transparent WebM/GIF)

## Requirements

- Python 3.10+
- The `.bat` file will automatically install: `flask`, `websockets`, `numpy`, `requests`

## Final Notes

- The program includes automatic browser opening and no-cache headers so you always see the latest files.
- Folder existence checks are included for easier troubleshooting.
- All credit goes to TheDonOfEverything aka Paul Conforti and Leaflit.

God bless your streams. ⚔️

---
