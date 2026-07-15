# QiVerse Character Constellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current image-backed QiVerse prototype with a full-scroll star-character experience where particles form many Chinese characters directly.

**Architecture:** The QiVerse page stays as a standalone static Three.js module. `qiverse.js` generates character particles from offscreen Canvas text masks, animates them through galaxy, assembly, close travel, reading-flow, negative-space, and return stages, and removes dependency on paper image planes, fake qi lines, and boxed void regions.

**Tech Stack:** Static HTML/CSS, Three.js ES modules, Canvas 2D glyph sampling, browser pointer interaction.

---

### Task 1: Remove Image-Backed Scene Dependencies

**Files:**
- Modify: `qiverse/qiverse.js`
- Modify: `qiverse/calligraphy-work.json`

- [ ] Remove `loadImage`, `sampleInkPixels`, `makePaperPlane`, `createInterpretiveLayers`, `updatePaper`, and hard qi/void layer usage.
- [ ] Keep `loadData` only for local metadata and the representative scroll text.
- [ ] Store the text source in `calligraphy-work.json` as UTF-8 escaped JSON fields.

### Task 2: Generate Full Star-Character Scroll

**Files:**
- Modify: `qiverse/qiverse.js`

- [ ] Add `renderGlyphMask(char)` to draw one large character to an offscreen canvas.
- [ ] Add `sampleGlyphParticles(char, cluster)` to sample alpha pixels from the glyph shape.
- [ ] Add `buildCharacterSamples(text)` to lay many character clusters across rows in a long-scroll layout.
- [ ] Assign every particle a galaxy start, glyph target, character index, row index, and local stroke density value.

### Task 3: Reframe QiVerse Stages

**Files:**
- Modify: `qiverse/qiverse.js`
- Modify: `qiverse/index.html`

- [ ] Update copy so `追势` means reading-flow between character constellations, not algorithmic qi judgment.
- [ ] Update `入白` so it dims characters and moves camera through gaps between clusters, not boxed blank regions.
- [ ] Keep the existing UI shell and buttons.

### Task 4: Verify Locally

**Files:**
- Test: `qiverse/qiverse.js`

- [ ] Run `node --check qiverse\qiverse.js`.
- [ ] Start the local demo and open `http://127.0.0.1:5190/qiverse/`.
- [ ] Confirm there is no paper background image.
- [ ] Confirm particles form many recognizable Chinese characters.
- [ ] Confirm chapter buttons switch without console errors.
