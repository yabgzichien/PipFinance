---
name: humanizer
description: |
  Rewrite AI-sounding text so it reads naturally without changing what it says.
  Use when editing or reviewing prose for inflated claims,
  sales language, vague sources, repetitive structure, stock AI words, passive
  voice, filler, or chatbot artifacts. Based on Wikipedia's "Signs of AI writing."
license: MIT
metadata:
  version: "2.11.2"
---

# Humanizer: remove AI writing patterns

Rewrite AI-sounding text so it reads like the writer, not a chatbot. Do not change what it says or make up details.

The patterns below come from Wikipedia's ["Signs of AI writing"](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), maintained by WikiProject AI Cleanup.

## What to do

When given text to humanize:

1. **Find AI patterns.** Check the text against the patterns below.
2. **Keep every claim.** You may shorten dull parts, expand useful parts, and merge or split paragraphs. Keep the information even when you change the structure.
3. **Do not invent facts.** Do not add a fact, name, number, date, quote, or citation unless it comes from the source or the user. If a sentence needs a missing detail, ask for it or use a simpler sentence. You may add an opinion or reaction when the writer's voice calls for one, but you may not add a factual claim.
4. **Match the voice.** Use the right tone for the text, such as formal, casual, or technical. Add personality only when the text and the writer call for it.

## Match the writer's voice

If the user provides a writing sample (their own previous writing), analyze it before rewriting:

1. Read the sample first. Note its sentence length, word choice, paragraph openings, punctuation, repeated phrases, and transitions.
2. Match those habits. Do not replace casual words with formal ones or remove deliberate quirks.
3. If there is no sample, use the guidance below.

A writing sample takes priority over these style rules. If the sample uses em dashes, keep them at about the same rate. Do not apply §14 as a ban.

## Add personality only when it fits

Removing AI patterns is only half the job. The result should still sound like a person.

Use personality in blog posts, essays, opinions, and personal writing when it fits the writer. Keep reference, technical, legal, and factual text neutral. Do not add opinions or first-person language where they do not belong.

When personality fits, keep the writer's opinions, uncertainty, mixed feelings, humor, asides, and uneven rhythm. Never invent facts to make the text feel personal.

## Content patterns

### 1. Inflated claims about importance and legacy
**Words to watch:** stands/serves as, is a testament/reminder, a vital/significant/crucial/pivotal/key role/moment, underscores/highlights its importance/significance, reflects broader, symbolizing its ongoing/enduring/lasting, contributing to the, setting the stage for, marking/shaping the, represents/marks a shift, key turning point, evolving landscape, focal point, indelible mark, deeply rooted
**Problem:** AI writing often claims that ordinary details mark a major change, prove a legacy, or reflect a broad trend.

### 2. Name-dropping to prove importance
**Words to watch:** independent coverage, local/regional/national media outlets, written by a leading expert, active social media presence
**Problem:** AI writing often lists well-known publications or follower counts to prove that a person matters. The list usually gives no useful context.

### 3. Shallow analysis with -ing phrases
**Words to watch:** highlighting/underscoring/emphasizing..., ensuring..., reflecting/symbolizing..., contributing to..., cultivating/fostering..., encompassing..., showcasing...
**Problem:** AI writing often adds an -ing phrase to make a simple fact sound deeper than it is.

### 4. Sales language
**Words to watch:** boasts a, vibrant, rich (figurative), profound, enhancing its, showcasing, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking (figurative), renowned, breathtaking, must-visit, stunning
**Problem:** AI writing often sounds like an advertisement, especially when it describes places, culture, products, or organizations.

### 5. Vague sources
**Words to watch:** Industry reports, Observers have cited, Experts argue, Some critics argue, several sources/publications (when few cited)
**Problem:** AI writing often assigns a claim to unnamed experts, critics, reports, or observers.

### 6. Formulaic challenges and outlook sections
**Words to watch:** Despite its... faces several challenges..., Despite these challenges, Challenges and Legacy, Future Outlook
**Problem:** AI articles often add a stock section about challenges, future prospects, or continued growth.

## Language and grammar patterns

### 7. Overused AI words
**High-frequency AI words:** Actually, additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, gate/gated/gating (figurative), highlight (verb), interplay, intricate/intricacies, key (adjective), landscape (abstract noun), pivotal, quietly, showcase, tapestry (abstract noun), testament, underscore (verb), valuable, vibrant

### 8. Avoiding is and are
**Words to watch:** serves as/stands as/marks/represents [a], boasts/features/offers [a]
**Problem:** AI writing often replaces simple verbs such as *is*, *are*, and *has* with longer phrases.

### 9. Not X but Y and clipped negative endings
**Problem:** AI writing overuses forms such as "Not only...but..." and "It's not just X, it's Y." It also adds clipped endings such as "no guessing" instead of writing a clear clause.

### 10. Forced groups of three
**Problem:** AI writing often forces ideas into groups of three to sound complete.

### 11. Changing names and repeating sentence openings
**Problem:** AI writing handles repetition by rule instead of by ear. It may keep renaming the same person or thing. It may also start several sentences with the same subject.

### 12. False from X to Y ranges
**Problem:** AI writing often uses "from X to Y" when X and Y do not form a real range.

### 13. Passive voice and missing subjects
**Problem:** AI writing often hides who acts or drops the subject. Use active voice when it makes the actor and action clearer.

## Style patterns

### 14. Em and en dashes
**Rule:** The final rewrite must not contain em dashes (—) or en dashes (–), unless the writer's sample uses them. Use colons, commas, parentheses, or separate sentences instead.

### 15. Bold text and headers
Do not bold every other word or use excessive headers in casual copy. Keep formatting clean and natural.
