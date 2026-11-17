/** Decorative preferences only. Never affect authorization, avatar identity or user data. */
export const KENDRA_THEME_STORAGE_KEY = "janus.dashboard-2.theme.v1";
export const kendraThemes = [
  { id: "pink-hearts", label: { es: "Corazones rosas", nl: "Roze hartjes" }, background: "#FFE0F0", accent: "#D94691", pattern: "hearts" },
  { id: "flowers", label: { es: "Jardín de flores", nl: "Bloementuin" }, background: "#FBE7FF", accent: "#A855C1", pattern: "flowers" },
  { id: "teddies", label: { es: "Ositos", nl: "Beertjes" }, background: "#FFF0D7", accent: "#B56A43", pattern: "teddies" },
  { id: "rainbow", label: { es: "Arcoíris", nl: "Regenboog" }, background: "#E2F5FF", accent: "#4877CC", pattern: "rainbow" },
  { id: "lavender-stars", label: { es: "Estrellas lilas", nl: "Lila sterren" }, background: "#EEE5FF", accent: "#8157C7", pattern: "stars" },
  { id: "mint", label: { es: "Menta alegre", nl: "Vrolijke munt" }, background: "#DDF9E9", accent: "#27836E", pattern: "bubbles" },
] as const;
export type KendraThemeId = (typeof kendraThemes)[number]["id"];
export const KENDRA_DEFAULT_THEME: KendraThemeId = "pink-hearts";
export function resolveKendraTheme(value: unknown): KendraThemeId {
  return kendraThemes.find(theme => theme.id === value)?.id ?? KENDRA_DEFAULT_THEME;
}
export function getKendraTheme(value: unknown) {
  return kendraThemes.find(theme => theme.id === resolveKendraTheme(value))!;
}
