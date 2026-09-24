# MERCHNOW RECOVERY MANIFEST

**Recovery date:** 2026-09-23  
**Recovery tool:** Hermes Agent (vSolar Pro4)  
**Recovery machine:** macOS 15.6.1, user `arams` (home `/Users/arams`)

---

## Recovery Sources Specified in Directive

| Source Path | Status |
|---|---|
| `/Users/aramsoghomonian/merchnow-ai` (canonical target) | NOT FOUND — wrong user. Created at `/Users/arams/merchnow-ai` instead. |
| `/Users/aramsoghomonian/Documents/ShelfyApp` (primary recovery) | NOT FOUND |
| `/Users/aramsoghomonian/Downloads/ShelfyApp.zip` (archive) | NOT FOUND |
| `/Users/aramsoghomonian/Downloads/ShelfyApp_Modular` | NOT FOUND |
| `/Users/aramsoghomonian/Downloads/ShelfyAppFixed` | NOT FOUND |
| `/Users/aramsoghomonian/Downloads/ShelfyApp_Cleaned` | NOT FOUND |
| `/Users/aramsoghomonian/Downloads/ShelfyApp1` | NOT FOUND |
| `/Users/aramsoghomonian/Desktop/DESKTOP FOLDERS/merchintel-app` | NOT FOUND |
| `/Users/aramsoghomonian/Downloads/MerchIntel-main` | NOT FOUND |

The directive referenced user `aramsoghomonian`, but this machine's login is `arams` (home `/Users/arams`). A recursive search of `/Users/arams/Documents`, `/Users/arams/Downloads`, `/Users/arams/Desktop`, and the full `/Users/arams` tree (excluding Library/Caches) found **no ShelfyApp, Shelfy, MerchIntel, or ShelfyApp.zip files or directories**.

---

## What Was Found

### KASH Platform MerchNow Stubs

The KASH intelligence platform has placeholder MerchNow integrations that confirm KASH treats MerchNow as an external product with no live connector:

- `apps/merchnow/adapter.ts` — empty placeholder adapter
- `src/companies/merchnow/` — types, config, README stubs
- `src/intelligence/merchnow/` — intelligence contract stubs

These are **reference only** for the KASH integration contract (Phase 12). They are not the MerchNow product.

### Historical Implementation Concepts (from directive)

The directive documented these Shelfy concepts as already discovered:

- Expo / React Native
- TaskScreen, UploadScreen, LoginScreen
- Firebase, Supabase
- Photo/image functionality
- Authentication
- Task-oriented field execution

No source code containing these was located. These will be reimplemented properly.

---

## SHA256 Evidence

No recovery source files were found to hash. This manifest serves as the record that the prescribed search was performed and the sources are absent.

---

## Decisions Made

1. **User discrepancy:** `/Users/aramsoghomonian/` → `/Users/arams/`. Canonical repo created at `/Users/arams/merchnow-ai`.
2. **No recovery sources:** Building MerchNow from scratch with modern architecture. Shelfy concepts (TaskScreen, UploadScreen, LoginScreen, Expo, photo capture) will be reimplemented correctly.
3. **Data architecture:** Consolidating on a single coherent stack. Firebase and Supabase both existed historically per the directive — will choose one and document the decision (Phase 7).
4. **KASH integration:** MerchNow will be independent. KASH integration contract defined but KASH not modified.

---

## Canonical Repository

- **Path:** `/Users/arams/merchnow-ai`
- **Status:** Git initialized, empty working tree
- **GitHub destination:** `smpas83/merchnow-ai` (not pushed — git rules require coherence first)

---

## Immediate Next Steps

1. Architecture decision: choose backend stack
2. Initialize product stack
3. Begin building surfaces
