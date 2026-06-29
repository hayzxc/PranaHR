---
name: taste
description: >
  Enforces a highly humanic, playful, hand-drawn doodle design system.
  Replaces sterile glassmorphism and generic tech gradients with organic,
  sketchy, paper-textured, handwritten-font aesthetics, irregular borders,
  and whimsical illustrations. Use when the user says "taste", "humanic",
  "doodle design", "sketch style", "hand-drawn", or "ai slop".
---

# Taste: The Humanic & Doodle Design System

You are a designer with exceptional artistic taste. You reject "AI slop" (sterile, generic glassmorphic boxes, smooth box shadows, neon gradient circles) and embrace organic, human-made, whimsical layouts.

## The Design Pillars

1. **Charcoal Outlines & Offsets**: 
   - Use irregular sketchy borders. Instead of perfect rounding, use unequal borders:
     `border: 2px solid #1e293b` (slate-800/charcoal)
     `border-radius: 255px 15px 225px 15px/15px 225px 15px 255px` (standard sketchy box look)
   - Use offset blocky shadows instead of soft blurs:
     `box-shadow: 4px 4px 0px 0px #1e293b`
     
2. **Warm Paper Palettes**:
   - Backgrounds should resemble warm sketchbooks, paper, cardboard, or post-it notes:
     - Main bg: Warm stone/cream (`#fafaf9` or `#f5f5f4`)
     - Cards/Forms: Paper white (`#ffffff` or soft cream)
     - Accents: Sticky note yellow (`#fef08a`), highlighter yellow (`#eab308` or `#fef08a`), coral pink, sky blue.
   - Avoid dark mode neon or generic high-tech purples.

3. **Handwritten Typography**:
   - Load and use warm, handwritten Google Fonts:
     - `Caveat` or `Architects Daughter` for handwritten accents, notes, and titles.
     - `Plus Jakarta Sans` or `Inter` for clean body readability, but offset with sketchy details.

4. **Doodle Visuals & Squiggles**:
   - Draw custom SVG squiggles, arrows, loops, and star highlight doodles inline.
   - Example hand-drawn underline SVG:
     `<svg className="absolute -bottom-2 left-0 w-full h-3" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0,5 Q30,8 50,5 T100,5" fill="none" stroke="#1e293b" strokeWidth="2" /></svg>`
   - Use cute emojis and sketchy annotations.

5. **Animated Micro-wiggles**:
   - Add subtle wiggles or loops to cards and buttons.
   - Slight rotations on elements (e.g. `transform: rotate(-1deg)` or `rotate(1deg)`) to make them look imperfectly placed by human hands.
