import type { EntityRegistryEntry, HomeAssistant } from './ha';

export function computeWorkingSet(
  hass: HomeAssistant,
  labels: string[],
  showDiagnostic: boolean,
  showAll = false,
): string[] {
  if (!hass.entities) return [];
  const labelSet = new Set(labels);
  const result: string[] = [];

  for (const entityId in hass.entities) {
    const entity = hass.entities[entityId];
    if (entity.disabled_by || entity.hidden_by) continue;
    if (
      !showDiagnostic &&
      (entity.entity_category === 'diagnostic' || entity.entity_category === 'config')
    ) {
      continue;
    }
    if (showAll || matchesLabel(entity, hass, labelSet)) {
      result.push(entityId);
    }
  }

  return result;
}

function matchesLabel(
  entity: EntityRegistryEntry,
  hass: HomeAssistant,
  labels: Set<string>,
): boolean {
  if (entity.labels?.some((l) => labels.has(l))) return true;

  const device = entity.device_id ? hass.devices?.[entity.device_id] : undefined;
  if (device?.labels?.some((l) => labels.has(l))) return true;

  const areaId = entity.area_id ?? device?.area_id ?? null;
  if (!areaId) return false;

  const area = hass.areas?.[areaId];
  if (area?.labels?.some((l) => labels.has(l))) return true;

  if (area?.floor_id) {
    const floor = hass.floors?.[area.floor_id];
    if (floor?.labels?.some((l) => labels.has(l))) return true;
  }

  return false;
}
