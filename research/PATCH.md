# Patch files: `research/patch_<name>.jsonl`

One JSON object per line: `{"slug": "<slug from the todo file>", ...only the fields you are setting}`.
Fields and meanings are the same as in SPEC.md (outcome, value_usd, value_kind, value_year, acquirer, became,
pitch_then, source, confidence). The build applies patches on top of the research rows.

Rules
- Every value_usd you set must come from a WebSearch result in this session, with that URL in `source`.
  WebFetch is blocked for many news sites; search-result snippets are acceptable evidence.
- confidence "high" = two independent outlets (or a primary source: company/acquirer release, SEC filing) agree;
  "medium" = one reputable outlet.
- If a number can't be confirmed, write `{"slug": "...", "value_usd": null, "value_kind": null, "confidence": "medium"}`
  rather than leaving an unsourced number.
- If the outcome changed (shut down, acquired, went public), set outcome, became (<= 16 words, with year) and source.
- Write a row only for companies you checked. Append as you go (Write the whole file each time, or in chunks)
  so nothing is lost if you stop early.
- Respect your search cap. Stop when you reach it and report how far you got.
