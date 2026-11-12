# THE LAST SIGNAL // NEXUS-09

> *"NEXUS-09 HAS BEEN SILENT FOR 72 HOURS. Trust no transmission without verification."*

**THE LAST SIGNAL** is a first-person 3D psychological sci-fi horror game built with **Three.js**, **TypeScript**, **Vite**, and a 100% procedural **Web Audio API** sound engine for the **Loadout Protocol AI Game Competition** (Release Candidate v1.0).

---

## 1. Overview & Premise

You are **Field Engineer R. Hale**, docked at the deep-space research facility **NEXUS-09** after a 72-hour communication blackout. Guided by the station's operational AI, **ECHO v9.4**, you must:

1. Board the station via **Airlock A-01** (`SECTOR A-01`) and follow the 5-step contextual onboarding tutorial.
2. Locate the **Level-1 Security Access Card** (`SEC_CARD_L1`) in the **Security Hub** (`SECTOR B-02`).
3. Unlock **Crew Habitation** (`SECTOR C-03`), recover **Chief Engineer Vance's Audio Recording**, and obtain the **Level-2 Maintenance Keycard** (`MAINT_KEY_L2`).
4. Navigate the **Central Spine Corridor** (`SECTOR M-00`) to **Auxiliary Reactor** (`SECTOR D-04`) and restore station power—awakening the **Signal Stalker** (`ENTITY-09`).
5. Use stealth, crouching, emergency lockers, and the **Signal Scanner** to enter the **Xeno-Signal Lab** (`SECTOR E-05`), discover **Dr. Aris Thorne's Final Log**, and retrieve the **Level-3 Comms Override Passkey** (`COMMS_OVERRIDE_L3`).
6. Unlock the **Communications Bridge** (`SECTOR F-06`) and make a final irreversible choice:
   - **ENDING 1 — THE CARRIER WAVE (TRUST ECHO)**: Transmit the neural signal to Earth's orbital relay network.
   - **ENDING 2 — SILENCE IN THE VOID (REJECT ECHO)**: Pull the manual Core Purge Breaker, destroy ECHO's core, and jettison in Escape Pod E-02.

---

## 2. Controls & Cross-Device Support

### Desktop & Laptop (Keyboard + Mouse / Trackpad)
| Input | Action |
| :--- | :--- |
| **W / A / S / D** or **Arrow Keys** | Move Forward / Strafe Left / Back / Strafe Right |
| **Mouse / Trackpad** | Look Around (Click viewport to engage Pointer Lock) |
| **E** *(rebindable to F / Enter)* | Interact / Open Doors / Read Terminals / Enter & Exit Lockers |
| **F** *(rebindable to R / T)* | Toggle Suit Torch (Flashlight) |
| **Q** | Ping Signal Scanner (Reveals objective vector & Entity proximity; emits noise) |
| **C** or **Ctrl** | Toggle Crouch (Silent movement; reduces visibility & noise radius) |
| **Shift** | Hold to Sprint (High speed, loud footsteps, faster O2 drain) |
| **J** or **Tab** | Open / Close Mission Journal (Objectives, Keycards & Crew Logs Archive) |
| **ESC** or **P** | Pause Game / Settings / How To Play / Checkpoint Save |

### Tablet & Mobile (Multi-Touch Virtual Controls)
- **Left Virtual Thumbstick**: Smooth 360° analog movement (push to outer rim to sprint).
- **Right Viewport Drag**: Smooth camera look with configurable Touch Sensitivity.
- **Dedicated Action Buttons**: Context-sensitive **USE**, **LIGHT**, **SCAN**, **CROUCH**, **JOURNAL**, and **PAUSE** buttons.
- **Orientation Support**: Landscape mode recommended; includes a non-blocking Portrait Orientation Advisory with a **Continue Anyway** option.

### Gamepad (Standard Mapping)
- **Left Stick**: Move | **Right Stick**: Look
- **A / Cross**: Interact | **X / Square**: Flashlight | **Y / Triangle**: Scanner Ping | **B / Circle**: Crouch | **L3**: Sprint | **Start**: Pause

---

## 3. Quick Start (Local Development & Production Build)

### Prerequisites
- **Node.js** `>= 18.x` and **npm** `>= 9.x`

### Install & Run Development Server
```bash
npm install
npm run dev
```
Open `http://localhost:5173` in any modern desktop or mobile browser.

### Build & Preview Production Release
```bash
npm run build
npm run preview
```
The self-contained static bundle is generated in `dist/` (zero external image, font, or audio network dependencies).

---

## 4. Architecture

- `src/main.ts` — Core game lifecycle, 3-screen onboarding flow, objective state machine, Mission Journal, WebGL context-loss recovery, and ending cinematics.
- `src/input/InputManager.ts` — Unified cross-device input manager (Keyboard/Mouse, Multi-Touch Virtual Joystick & Look Pad, and Gamepad API) with zero stuck-input guarantees on focus loss.
- `src/player/PlayerController.ts` — First-person movement, AABB sliding collision, crouch/sprint/locker stealth, flashlight & oxygen management, and 3D raycast interaction.
- `src/world/StationBuilder.ts` — Procedural 7-sector station geometry, bulkhead status LED bars (Red/Green/Cyan), vertical pickup beacons, flickering fluorescent lighting, and emergency lockers.
- `src/world/ProceduralTextures.ts` — Runtime HTML5 Canvas procedural PBR textures (industrial grating, bulkheads, CRT displays, directional signage).
- `src/enemy/CreatureAI.ts` — 6-state finite-state machine (`PATROL`, `INVESTIGATE`, `SEARCH`, `CHASE`, `LOST_TARGET`, `RETURN_TO_PATROL`) with doorway-threshold navigation and anti-locker-camping patrol selection.
- `src/systems/EchoSystem.ts` — Narrative & contextual AI advisor that reacts to room entry, locked door attempts, low O2, and player hesitation.
- `src/systems/SignalScanner.ts` — Canvas 2D directional radar and carrier-wave oscilloscope.
- `src/systems/TutorialSystem.ts` — Progressive 5-step contextual tutorial system with skip and session persistence.
- `src/systems/SaveManager.ts` — Validated `localStorage` checkpoint and settings persistence.
- `src/audio/SoundManager.ts` — 100% procedural Web Audio API sound engine with automatic node lifecycle cleanup.
