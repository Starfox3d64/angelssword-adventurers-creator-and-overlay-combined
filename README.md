# ⚔️ AS Adventurer — Combined Edition

**Reactive Overlay + VTuber Creator** in one program

**Made by TheDonOfEverything aka Paul Conforti**  
Original JavaScript version by **Leaflit**  
Angular improvements (v0.3.0) by **OOzeClues**  
Python Port • Version 1.3 • July 2026

> Everything runs 100% locally on your PC. No Node.js required.

## What’s Inside

| Tool | Features |
|------|----------|
| **🎮 Overlay** | Face-tracking control panel, models, emotes, WebSocket relay |
| **🎨 Creator** | Sprite Prep → AI Video → Video Prep → Transparent Export |

## AI Providers

| Feature | Providers |
|---------|-----------|
| Sprite generation | OpenAI • Gemini • Grok • Local ComfyUI |
| Video generation | Gemini Omni Flash • Grok Imagine Video • Local ComfyUI |
| Export | Offline chroma key + **ffmpeg true-alpha WebM** or browser MediaRecorder |

## Quick Start (Windows)

1. Extract the folder  
2. Double-click **`Start AS Adventurer.bat`**  
3. Browser opens to the main menu  

## Access Points

| Page | URL |
|------|-----|
| Main Menu | http://localhost:3000 |
| Overlay | http://localhost:3000/overlay |
| Creator | http://localhost:3000/creator |
| Health | http://localhost:3000/health |

## ComfyUI

1. Start ComfyUI (default `http://127.0.0.1:8188`)  
2. Settings → Local ComfyUI → Connect / Refresh models  
3. Select **Local ComfyUI** in Sprite Prep or Generate Video  

## ffmpeg (transparent WebM)

On first run (Windows), the server can auto-download a small essentials build into:

```
creator_public/bin/ffmpeg.exe
```

Or place your own binary there. Export uses ffmpeg when available (true alpha); otherwise falls back to MediaRecorder.

## Overlay Models

Put character folders in:

```
overlay_public/assets/models/YourCharacter/
```

## Credits

- **TheDonOfEverything aka Paul Conforti** — Python Combined Edition  
- **Leaflit** — Original JavaScript version  
- **OOzeClues** — Angular improvements (v0.3.0)  

God bless your streams. ⚔️
