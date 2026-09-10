# French Zero — RFI + TCF/TEF

A zero-cost, installable French-learning PWA built for GitHub Pages.

## What it does

- Pulls the official **RFI Journal en français facile** podcast feed into `data/rfi.json` with a GitHub Action.
- Plays the original RFI audio directly from RFI.
- Uses the official RFI episode/transcript link instead of republishing full RFI transcripts.
- Runs a local **Qwen3-1.7B** tutor in the browser using WebLLM, with **Qwen3-0.6B** automatic fallback.
- Includes the learning loop: **Listen → Read → Build → Write → Speak → TCF/TEF**.
- Includes Live Coach with **THEM starts / I start**, **Reverse**, and **Fix last speaker**.
- Includes strict TCF/TEF simulation: no correction until **I'm finished**.
- Stores progress, vocabulary and correction history in browser `localStorage` only.
- No API key, paid hosting, paid database, Apple Developer account, or paid AI API.

## Deploy on GitHub Pages

1. Create a **public** GitHub repository. A public repository is recommended so the scheduled GitHub Actions workflow does not consume private-repository Actions minutes.
2. Upload **all files and folders in this project** to the repository root. Keep the `.github/workflows` folder.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch **main**, folder **/(root)**, then Save.
6. Open **Actions → Update RFI episodes → Run workflow** once. This populates `data/rfi.json` immediately. After that it refreshes automatically on weekdays.
7. Open the GitHub Pages URL in Safari on iPhone.
8. Safari → Share → **Add to Home Screen**.

## AI behavior

The AI model does **not** download at page load. It downloads the first time you press **Wake AI** or use an AI feature. The model is cached by the browser/runtime when supported.

Main model: `Qwen3-1.7B-q4f16_1-MLC`

Automatic fallback: `Qwen3-0.6B-q4f16_1-MLC`

WebLLM is pinned to `0.2.82` because a later 0.2.83/0.2.84 regression was reported to cause GPU failures on some devices with longer prompts.

### Important iPhone limitation

Local browser AI depends on **WebGPU and browser memory**. The app itself, RFI player, lesson flow, speech-to-text (when Safari exposes it), local progress, and exam UI keep working even if the local model cannot load. There is deliberately no paid cloud-AI fallback, preserving the $0 requirement.

## RFI copyright / content design

The app stores only feed metadata supplied by RFI and plays RFI's original audio URL. The **Read** stage links to the official RFI synchronized transcript page. It does not copy RFI's full transcript archive into GitHub Pages.

## Update the RFI feed manually

From GitHub: **Actions → Update RFI episodes → Run workflow**.

Locally, if Python has internet access:

```bash
python scripts/update_rfi.py
```

## Cost

Designed for **$0 operating cost** when hosted as a public GitHub Pages repository and using local browser AI. External providers may change their own policies in the future; the app contains no billing integration and no paid fallback.
