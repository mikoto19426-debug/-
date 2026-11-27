# Prompt templates

Write prompts in English (the AIs follow it better) and give the user a one-line Japanese summary of each.

## Style block (paste at the end of every image and video prompt in one project)

Pick once per project and never change it mid-project, or clips won't match.

```
Style: Vincent van Gogh oil painting, thick impasto brushstrokes, swirling sky, cobalt blue and chrome yellow, painterly, no photorealism, no text, no watermark. 16:9.
```

## Keyframe image (start / end of a beat)

```
[Where the camera stands and looks], [what is in frame from near to far], [light and time of day], [mood].
<Style block>
```
Example: `First-person view standing on a cobblestone street in Arles at night, a café terrace glowing yellow on the left under a big awning, small round tables and people talking, starry swirling sky above the rooftops, warm gaslight, quiet wonder. <Style block>`

## Video between two keyframes (Kling: "start & end frame"; Veo: first/last frame)

Describe only the camera and what moves. Keep it slow.
```
Smooth slow camera [dolly forward / turn left / pan up / walk past ...], [what moves in the scene: people walking, stars twinkling, lamp flickering], continuous single shot, no cuts, steady, 24fps.
<Style block>
```

## Characters who must stay the same (e.g. the painter)

Describe them identically in every prompt: `a slim man in his thirties with a short red-orange beard, wide yellow straw hat, loose cobalt-blue work jacket`.

## Free tiers to suggest (check before recommending; they change)

- Kling (video, start+end frame, free daily credits, watermark/720p on free)
- Hailuo / MiniMax (video, free credits)
- Meshy (text/image → 3D GLB, free credits, auto-rig + walk animation)
