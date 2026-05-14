---
title: Model Performance Notes
tags: [models, performance]
updated: 2026-05-13
---

# Model Performance Notes

| model | role | strengths | weaknesses | cost-tier |
|-------|------|-----------|-----------|-----------|
| openrouter/deepseek/deepseek-chat-v3.1 | Lead Agent, Builder | Fast, cheap, good at following structured templates and writing code file-by-file | Weaker at deep architectural reasoning than r1 | low |
| openrouter/deepseek/deepseek-r1 | Architect | Deep reasoning, thorough planning, catches edge cases before implementation | Slow (reasoning tokens), expensive compared to chat models, verbose | high |
| openrouter/google/gemini-2.5-flash-preview | Reviewer | Large context window (good for reviewing diffs), different model family from Builder (reduces blind spots), fast | Less precise on TypeScript specifics than deepseek | medium |
| openrouter/deepseek/deepseek-r1 | Spec Writer | Same strengths as Architect role — suitable for standalone PRD/spec work | Same weaknesses — only use when deep spec reasoning is needed | high |
