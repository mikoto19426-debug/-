---
name: scroll-story
description: Build a beautiful scroll-driven interactive story page (scroll to move through a scene, "walk into a painting", product fly-through) from a story idea. Use when the user wants an interactive website where scrolling or tapping moves a camera through a world, or asks to turn AI-generated videos/images into a scroll experience. Covers storyboard, choosing the technique, writing prompts for image/video AIs, turning videos into scroll frames, building the page, checking it, and recording lessons.
---

# Scroll Story

Make a page where the viewer scrolls and a story plays out as one continuous camera move. The user talks in Japanese and works from a Galaxy Tab (Android, landscape); reply in casual Japanese.

Before starting, read `references/lessons.md`. It is the memory of past projects. Follow it over anything below when they conflict.

## 1. Story first (never skip)

Write a storyboard before any code or prompt. Each row: scroll range, what the camera does, what the viewer sees, the caption.

- One continuous camera path. Every move needs a reason in the story ("I turn left because I hear voices"). No cuts or teleports between places.
- First person ("きみ"/"you") makes it feel like entering the world.
- 6–10 beats. Captions are short narration, one per beat, placed where the camera rests.
- Show the storyboard to the user and get a yes before building.

## 2. Pick the technique

| Want | Technique | Notes |
|---|---|---|
| Beautiful, painterly, people and faces that look right | **AI video → frames → scroll scrub** (default) | User makes clips in Kling/Veo from start/end keyframes; Claude extracts frames and builds the page |
| Free camera, walk anywhere, real depth | three.js world built for 3D | Looks like a stage set; people and faces are the weak spot |
| A real photo/painting turned into a walkable space | Gaussian splat (World Labs Marble → Spark) | Check export availability and price first |

Default to AI video unless the user needs free movement.

## 3. Prompts for the user's AI tools

Use `references/prompts.md`. For each beat give:
- a **start keyframe** image prompt and an **end keyframe** image prompt (same style words every time)
- a **video** prompt describing only the camera move between them
- The end keyframe of beat N is the start keyframe of beat N+1, so clips join without a jump.

Tell the user which free tier to use and to export MP4. Ask them to send clips one at a time; build as they arrive.

## 4. Turn videos into frames

```bash
bash .claude/skills/scroll-story/scripts/extract_frames.sh clip1.mp4 clip2.mp4 ... OUT_DIR
```
Joins clips in order, writes `OUT_DIR/f0001.webp…` at 1600px wide (about 24 fps), and prints the frame count. Aim for 150–400 frames total; lower the fps if the total runs higher.

## 5. Build the page

Copy `templates/scroll-frames.html` into the project folder next to the frames and edit only the CONFIG block: frame count, folder, captions (scroll ranges 0–1), final title. It already handles preloading, smooth catch-up, captions, a progress rail, and the landscape hint.

Publish with the Artifact tool. Pass the frames through `files` (max 255 files per publish; publish in batches to the same URL if more).

## 6. Check once, then ship

Serve the folder locally and take screenshots at 6–8 scroll positions with Playwright (see `references/lessons.md` for the harness tricks). Check: no console errors, captions don't cover faces, every beat flows into the next. Then publish, commit and push.

## 7. Learn

After the user reacts, add what went wrong or right to `references/lessons.md` as a short dated bullet: what the user said, what it means for next time. This file is how the agent grows.
