// safeParseJSON — used by every route that parses model output.
//
// Models occasionally wrap JSON in markdown fences or add a stray sentence.
// This strips ``` fences, takes the substring from the first `{` to the last
// `}`, and parses. On failure it throws an error that includes the raw text so
// the caller can see what the model actually returned.

export function safeParseJSON<T = unknown>(raw: string): T {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("safeParseJSON: model returned an empty response");
  }

  let text = raw.trim();

  // Strip a leading ```json / ``` fence and a trailing ``` fence if present.
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(
      `safeParseJSON: could not parse model output as JSON (${
        (err as Error).message
      }).\n--- raw model output ---\n${raw}\n--- end ---`
    );
  }
}
