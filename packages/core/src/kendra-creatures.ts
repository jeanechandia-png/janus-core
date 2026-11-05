/** Child-safe avatar preferences; actual 3D models must be explicitly approved assets. */
export type CreatureId = string;
export interface ApprovedCreature {
  readonly id: CreatureId;
  readonly assetId: string;
  readonly allowedColors: readonly string[];
  readonly allowedOutfits: readonly string[];
  readonly allowedAccessories: readonly string[];
  readonly allowedFeatures: readonly string[];
}
export interface CreatureSelection {
  readonly creatureId: CreatureId;
  readonly color: string;
  readonly outfit: string;
  readonly accessory: string;
  readonly feature: string;
}
export const KENDRA_CREATURE_STORAGE_KEY = "janus.dashboard-2.creature.v1";
export const creatureVisualRequirements = Object.freeze({
  approvedModelsOnly: true,
  realThreeDimensionalActor: true,
  physicallyBasedMaterials: true,
  cinematicLighting: true,
  environmentReflections: true,
  facialExpressions: true,
  animatedSpeech: true,
  neverReplaceApprovedRobot: true,
});
/** No fabricated creatures or assets. Empty until approved catalog is supplied. */
export const approvedCreatureCatalog: readonly ApprovedCreature[] = [];
export function validateCreatureSelection(
  selection: CreatureSelection,
  catalog: readonly ApprovedCreature[] = approvedCreatureCatalog,
): boolean {
  const creature = catalog.find(item => item.id === selection.creatureId);
  return !!creature && !!creature.assetId &&
    creature.allowedColors.includes(selection.color) &&
    creature.allowedOutfits.includes(selection.outfit) &&
    creature.allowedAccessories.includes(selection.accessory) &&
    creature.allowedFeatures.includes(selection.feature);
}
