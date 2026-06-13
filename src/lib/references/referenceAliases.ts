export type ReferenceAliasKind = "image" | "video" | "audio" | "media" | string;

export type ReferenceAliasItem = {
  alias?: unknown;
  description?: unknown;
  kind?: unknown;
  mimeType?: unknown;
  title?: unknown;
};

function cleanAliasToken(value: string): string {
  return value
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42);
}

function aliasPrefixForKind(kind: ReferenceAliasKind): string {
  if (kind === "image" || kind === "video" || kind === "audio") return kind;
  return "media";
}

export function normalizeReferenceAlias(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const token = cleanAliasToken(value);
  return token ? `@${token}` : undefined;
}

export function nextReferenceAlias(
  kind: ReferenceAliasKind,
  usedAliases: Iterable<string>
): string {
  const used = new Set([...usedAliases].map((alias) => alias.toLowerCase()));
  const prefix = aliasPrefixForKind(kind);
  let index = 1;

  while (used.has(`@${prefix}${index}`.toLowerCase())) {
    index += 1;
  }

  return `@${prefix}${index}`;
}

export function assignReferenceAliases<T extends ReferenceAliasItem>(
  references: T[],
  fallbackKind: ReferenceAliasKind = "media"
): Array<T & { alias: string }> {
  const usedAliases = new Set<string>();

  return references.map((reference) => {
    const normalizedAlias = normalizeReferenceAlias(reference.alias);
    const alias =
      normalizedAlias && !usedAliases.has(normalizedAlias.toLowerCase())
        ? normalizedAlias
        : nextReferenceAlias(
            typeof reference.kind === "string" ? reference.kind : fallbackKind,
            usedAliases
          );

    usedAliases.add(alias.toLowerCase());
    return { ...reference, alias };
  });
}

function referenceKindLabel(reference: ReferenceAliasItem, fallbackKind: ReferenceAliasKind) {
  if (typeof reference.kind === "string" && reference.kind.trim()) return reference.kind.trim();
  if (typeof reference.mimeType === "string" && reference.mimeType.includes("/")) {
    return reference.mimeType.split("/")[0];
  }
  return fallbackKind;
}

function referenceTitle(reference: ReferenceAliasItem): string | undefined {
  if (typeof reference.title === "string" && reference.title.trim()) {
    return reference.title.trim();
  }
  if (typeof reference.description === "string" && reference.description.trim()) {
    return reference.description.trim();
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ordinalReferenceLabel(index: number): string {
  switch (index) {
    case 0:
      return "first";
    case 1:
      return "second";
    case 2:
      return "third";
    case 3:
      return "fourth";
    default:
      return `${index + 1}th`;
  }
}

function providerSafeReferenceLabel(
  reference: ReferenceAliasItem,
  index: number,
  fallbackKind: ReferenceAliasKind
): string {
  const title = referenceTitle(reference);
  const kind = referenceKindLabel(reference, fallbackKind);
  const label = `the ${ordinalReferenceLabel(index)} ${kind} reference`;
  return title ? `${label} (${title})` : label;
}

export function referenceManifestLines(
  references: ReferenceAliasItem[],
  fallbackKind: ReferenceAliasKind = "media"
): string[] {
  return assignReferenceAliases(references, fallbackKind).map((reference) => {
    const title = referenceTitle(reference);
    const kind = referenceKindLabel(reference, fallbackKind);
    return `- ${reference.alias}: ${kind}${title ? `, ${title}` : ""}.`;
  });
}

export function promptWithReferenceManifest(
  prompt: string,
  references: ReferenceAliasItem[],
  fallbackKind: ReferenceAliasKind = "media"
): string {
  const cleanPrompt = prompt.trim();
  const lines = referenceManifestLines(references, fallbackKind);
  if (!lines.length) return cleanPrompt;

  return [
    "Reference media:",
    ...lines,
    "",
    "Use the aliases above exactly when following the user prompt.",
    "",
    "User prompt:",
    cleanPrompt,
  ].join("\n");
}

export function promptWithProviderSafeReferenceAliases(
  prompt: string,
  references: ReferenceAliasItem[],
  fallbackKind: ReferenceAliasKind = "media"
): string {
  let cleanPrompt = prompt.trim();
  if (!cleanPrompt || !references.length) return cleanPrompt;

  const aliasedReferences = assignReferenceAliases(references, fallbackKind);
  for (const [index, reference] of aliasedReferences.entries()) {
    cleanPrompt = cleanPrompt.replace(
      new RegExp(escapeRegExp(reference.alias), "gi"),
      providerSafeReferenceLabel(reference, index, fallbackKind)
    );
  }

  return cleanPrompt;
}

export function referenceDescriptionWithAlias(
  reference: ReferenceAliasItem,
  fallbackKind: ReferenceAliasKind = "media"
): string | undefined {
  const aliasedReference = assignReferenceAliases([reference], fallbackKind)[0];
  const title = referenceTitle(reference);
  return title ? `${aliasedReference.alias}: ${title}` : aliasedReference.alias;
}
