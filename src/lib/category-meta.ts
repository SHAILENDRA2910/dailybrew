export interface CategoryTheme {
  key: string;
  hex: string;
  soft: string;
  deep: string;
}

const THEMES: Record<string, CategoryTheme> = {
  tea: { key: "tea", hex: "#78866B", soft: "#EDF1E8", deep: "#5C6851" },
  coffee: { key: "coffee", hex: "#70452F", soft: "#F2E6DC", deep: "#59382A" },
  snacks: { key: "snacks", hex: "#C58B52", soft: "#F7EAD9", deep: "#8B5C31" },
  food: { key: "food", hex: "#B86B4B", soft: "#F8E4DC", deep: "#8E4C33" },
  other: { key: "other", hex: "#88796D", soft: "#F1EBE3", deep: "#6B5E53" },
};

const FALLBACK_KEYS = ["caramel", "sage", "terracotta", "coffee", "snacks", "other"] as const;

/** Unknown user-created categories get a stable palette slot based on name. */
export function categoryTheme(name: string | undefined | null): CategoryTheme {
  const normalized = (name ?? "").trim().toLowerCase();
  const direct = THEMES[normalized];
  if (direct) return direct;
  if (normalized.includes("tea")) return THEMES.tea;
  if (normalized.includes("coffee") || normalized.includes("brew")) return THEMES.coffee;
  if (
    normalized.includes("snack") ||
    normalized.includes("biscuit") ||
    normalized.includes("bakery")
  ) {
    return THEMES.snacks;
  }
  if (
    normalized.includes("food") ||
    normalized.includes("meal") ||
    normalized.includes("lunch")
  ) {
    return THEMES.food;
  }
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash + normalized.charCodeAt(index) * (index + 5)) % 997;
  }
  const key = FALLBACK_KEYS[hash % FALLBACK_KEYS.length] ?? "other";
  if (key === "caramel") {
    return { key, hex: "#C58B52", soft: "#F7EAD9", deep: "#8B5C31" };
  }
  if (key === "sage") return THEMES.tea;
  if (key === "terracotta") return THEMES.food;
  if (key === "coffee") return THEMES.coffee;
  if (key === "snacks") return THEMES.snacks;
  return THEMES.other;
}

export function categoryDots(categories: string[]): Record<string, string> {
  return Object.fromEntries(categories.map((name) => [name, categoryTheme(name).hex]));
}
