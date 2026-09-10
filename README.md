# French Zero — copyright-safer RFI build

French Zero is an independent, zero-cost French learning PWA for personal study.

## RFI integration

This build intentionally uses **RFI only as an external source**.

The GitHub Action reads RFI's public podcast feed only to discover:
- episode title
- publication date
- duration
- official RFI episode URL

French Zero **does not copy, rehost, cache, or redistribute**:
- RFI audio
- full transcripts
- episode descriptions
- RFI images/logos
- RFI lesson material

The Listen and Read steps open the **official RFI episode page**. The learner then returns to French Zero for notes, writing, speaking, AI correction, reusable structures, and TCF/TEF practice.

French Zero is not affiliated with, endorsed by, or sponsored by RFI or France Médias Monde.

> This design is a conservative technical approach to reduce copyright/republication risk; it is not legal advice.

## Cost

Designed for $0 operation:
- GitHub Pages hosting
- GitHub Actions metadata refresh
- browser-local AI
- browser/localStorage learning progress
- no paid API
- no paid database
- no Apple Developer membership

## GitHub Pages

1. Upload the contents of this folder to the repository root.
2. Settings → Pages → Deploy from branch → `main` → `/ (root)`.
3. Actions → **Update RFI episodes** → **Run workflow** once.
4. Refresh the app after the workflow finishes.

## Updating an existing French Zero repository

Replace the existing files with the files in this package, commit them, then run **Update RFI episodes** once. The new `rfi.json` contains metadata only.
