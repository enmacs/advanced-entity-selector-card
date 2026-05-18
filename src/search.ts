import type { HomeAssistant } from './ha';
import type { TreeNode } from './hierarchy';

export function matchesQuery(
  entityId: string,
  query: string,
  hass: HomeAssistant,
): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;

  if (entityId.toLowerCase().includes(q)) return true;

  const entity = hass.entities?.[entityId];
  const stateObj = hass.states[entityId];
  const friendly = stateObj?.attributes?.friendly_name as string | undefined;
  const name = (
    entity?.name ||
    entity?.original_name ||
    friendly ||
    ''
  ).toLowerCase();
  if (name.includes(q)) return true;

  if (entity?.labels?.some((l) => l.toLowerCase().includes(q))) return true;

  const device = entity?.device_id
    ? hass.devices?.[entity.device_id]
    : undefined;
  const areaId = entity?.area_id ?? device?.area_id ?? null;

  if (areaId) {
    const area = hass.areas?.[areaId];
    if (area?.name?.toLowerCase().includes(q)) return true;
    if (area?.floor_id) {
      const floor = hass.floors?.[area.floor_id];
      if (floor?.name?.toLowerCase().includes(q)) return true;
    }
  }

  if (device) {
    const deviceName = (device.name_by_user || device.name || '').toLowerCase();
    if (deviceName.includes(q)) return true;
  }

  return false;
}

export function collectEntities(node: TreeNode): TreeNode[] {
  if (node.kind === 'entity') return [node];
  const out: TreeNode[] = [];
  for (const child of node.children) {
    if (child.kind === 'entity') out.push(child);
    else out.push(...collectEntities(child));
  }
  return out;
}

export function entityContext(
  entityId: string,
  hass: HomeAssistant,
): string {
  const entity = hass.entities?.[entityId];
  if (!entity) return '';
  const device = entity.device_id
    ? hass.devices?.[entity.device_id]
    : undefined;
  const areaId = entity.area_id ?? device?.area_id ?? null;
  const area = areaId ? hass.areas?.[areaId] : undefined;
  const floor = area?.floor_id ? hass.floors?.[area.floor_id] : undefined;

  const parts: string[] = [];
  if (floor) parts.push(floor.name);
  if (area) parts.push(area.name);
  return parts.join(' · ');
}
