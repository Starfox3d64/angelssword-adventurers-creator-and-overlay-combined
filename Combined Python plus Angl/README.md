# ⚔️ AS Adventurer — Combined Edition

**Reactive Overlay + VTuber Creator** in one program

**Made by TheDonOfEverything aka Paul Conforti**  
Original JavaScript version by **Leaflit**  
Angular improvements (v0.3.0) by **OOzeClues**  
Python Port • Version 1.1 • July 2026

> Everything runs 100% locally on your PC. No Node.js required.

## What’s Inside

One unified Python application containing:

- **🎮 Overlay** — Real-time reactive streaming overlay with face tracking, expression detection, and emotes
- **🎨 Creator** — Full VTuber asset creation pipeline (Sprite Prep → AI Video Generation → Video Prep → Export)

## Supported AI Providers

| Feature             | Providers                                      |
|---------------------|------------------------------------------------|
| Sprite generation   | OpenAI • Gemini • Grok (xAI) • Local ComfyUI   |
| Video generation    | Gemini Omni Flash • Grok Imagine Video • Local ComfyUI |
| Video Prep + Export | Fully offline                                  |

## Quick Start (Windows)

1. Extract the folder
2. Double-click **`Start AS Adventurer.bat`**
3. Your browser will open to the main menu
4. Choose **Overlay** or **Creator**

## Access Points

| Tool          | URL                              |
|---------------|----------------------------------|
| Main Menu     | http://localhost:3000            |
| Overlay       | http://localhost:3000/overlay    |
| Creator       | http://localhost:3000/creator    |

## ComfyUI Support

If you have **ComfyUI** running locally on port `8188`:

1. Start ComfyUI first
2. In the Creator, select **Local ComfyUI** as the generation source
3. The Python server will proxy requests to `http://127.0.0.1:8188`

You can check status at: `http://localhost:3000/api/comfyui/status`

## Credits

- **TheDonOfEverything aka Paul Conforti** — Python Combined Edition
- **Leaflit** — Original JavaScript version
- **OOzeClues** — Angular improvements (v0.3.0) and advanced features

God bless your streams. ⚔️
