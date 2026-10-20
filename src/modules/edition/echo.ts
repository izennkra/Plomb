/** Words that don't identify a subject on their own. */
const STOP_WORDS = new Set(["the", "le", "la", "les", "l", "de", "du", "des", "company", "group", "groupe", "inc", "ltd", "sa"]);
/** Subjects too vague to say two articles tell the same story. */
const GENERIC_SUBJECTS = new Set([
  "design", "branding", "identite", "identite visuelle", "typographie", "packaging", "ia", "intelligence artificielle",
  "logo", "rebranding", "marque", "studio", "agence", "graphisme", "illustration", "photographie", "exposition",
]);

/** "The Coca-Cola Company" → "coca cola"; null when too short or too vague to group on. */
export function subjectKey(subject: string | null | undefined): string | null {
  const key = (subject ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !STOP_WORDS.has(word))
    .join(" ");
  if (key.length < 3 || GENERIC_SUBJECTS.has(key)) return null;
  return key;
}

/** Same story: same key, or one name contained in the other as whole words ("coca cola" / "coca cola zero"). */
export function sameSubject(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && ` ${long} `.includes(` ${short} `);
}

type Story<T> = { item: T; subject: string | null; source: string };

/**
 * Groups articles telling the same story from different sources. Returns one entry per story: the chosen article
 * (the best, according to `better`) and the other media that covered it. Articles of the same source are never merged.
 */
export function groupEchoes<T>(
  stories: Story<T>[],
  better: (a: T, b: T) => boolean,
): { item: T; coveredBy: string[] }[] {
  const groups: { key: string | null; members: Story<T>[] }[] = [];
  for (const story of stories) {
    const key = subjectKey(story.subject);
    const group =
      key === null
        ? undefined
        : groups.find(
            (candidate) =>
              candidate.key !== null &&
              sameSubject(candidate.key, key) &&
              candidate.members.every((member) => member.source !== story.source),
          );
    if (group) group.members.push(story);
    else groups.push({ key, members: [story] });
  }

  return groups.map(({ members }) => {
    const best = members.reduce((chosen, member) => (better(member.item, chosen.item) ? member : chosen));
    return { item: best.item, coveredBy: members.filter((member) => member !== best).map((member) => member.source) };
  });
}
