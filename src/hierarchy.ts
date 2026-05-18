import type { DeviceRegistryEntry, HomeAssistant } from './ha';
import type { HierarchyId } from './types';
import { t, tn, type I18nKey } from './i18n';

export type NodeKind =
  | 'root'
  | 'floor'
  | 'area'
  | 'device'
  | 'domain'
  | 'device-class'
  | 'label'
  | 'integration'
  | 'missing-floor'
  | 'missing-area'
  | 'missing-device'
  | 'missing-class'
  | 'missing-label'
  | 'entity';

export interface TreeNode {
  id: string;
  name: string;
  kind: NodeKind;
  children: TreeNode[];
  entityId?: string;
  totalCount: number;
}

export function buildTree(
  hierarchy: HierarchyId,
  workingSet: string[],
  hass: HomeAssistant,
  configLabels: string[],
): TreeNode {
  switch (hierarchy) {
    case 'floor_area_device':
      return buildSpatialTree(workingSet, hass);
    case 'domain_class':
      return buildDomainTree(workingSet, hass);
    case 'label':
      return buildLabelTree(workingSet, hass, configLabels);
    case 'integration_device':
      return buildIntegrationTree(workingSet, hass);
  }
}

function buildSpatialTree(workingSet: string[], hass: HomeAssistant): TreeNode {
  const floors = new Map<
    string | null,
    Map<string | null, Map<string | null, string[]>>
  >();

  for (const entityId of workingSet) {
    const entity = hass.entities?.[entityId];
    if (!entity) continue;
    const device = entity.device_id
      ? hass.devices?.[entity.device_id]
      : undefined;
    const areaId = entity.area_id ?? device?.area_id ?? null;
    const area = areaId ? hass.areas?.[areaId] : undefined;
    const floorId = area?.floor_id ?? null;
    const deviceId = entity.device_id ?? null;

    let areas = floors.get(floorId);
    if (!areas) {
      areas = new Map();
      floors.set(floorId, areas);
    }
    let devices = areas.get(areaId);
    if (!devices) {
      devices = new Map();
      areas.set(areaId, devices);
    }
    let entities = devices.get(deviceId);
    if (!entities) {
      entities = [];
      devices.set(deviceId, entities);
    }
    entities.push(entityId);
  }

  const floorNodes: TreeNode[] = [];
  for (const [floorId, areas] of floors) {
    const areaNodes: TreeNode[] = [];
    for (const [areaId, devices] of areas) {
      const deviceNodes: TreeNode[] = [];
      for (const [deviceId, entityIds] of devices) {
        const entityChildren = entityIds.map((id) => entityNode(id, hass));
        sortNodes(entityChildren);
        if (deviceId === null) {
          deviceNodes.push({
            id: '__no_device__',
            name: 'Device not available',
            kind: 'missing-device',
            children: entityChildren,
            totalCount: entityChildren.length,
          });
        } else {
          deviceNodes.push({
            id: deviceId,
            name: deviceDisplayName(hass.devices?.[deviceId], deviceId),
            kind: 'device',
            children: entityChildren,
            totalCount: entityChildren.length,
          });
        }
      }
      sortNodes(deviceNodes);
      if (areaId === null) {
        areaNodes.push({
          id: '__no_area__',
          name: 'Area not assigned',
          kind: 'missing-area',
          children: deviceNodes,
          totalCount: countAll(deviceNodes),
        });
      } else {
        const area = hass.areas?.[areaId];
        areaNodes.push({
          id: areaId,
          name: area?.name ?? areaId,
          kind: 'area',
          children: deviceNodes,
          totalCount: countAll(deviceNodes),
        });
      }
    }
    sortNodes(areaNodes);
    if (floorId === null) {
      floorNodes.push({
        id: '__no_floor__',
        name: 'Floor not assigned',
        kind: 'missing-floor',
        children: areaNodes,
        totalCount: countAll(areaNodes),
      });
    } else {
      const floor = hass.floors?.[floorId];
      floorNodes.push({
        id: floorId,
        name: floor?.name ?? floorId,
        kind: 'floor',
        children: areaNodes,
        totalCount: countAll(areaNodes),
      });
    }
  }
  sortNodes(floorNodes);

  return rootNode(floorNodes, workingSet.length);
}

function buildDomainTree(workingSet: string[], hass: HomeAssistant): TreeNode {
  const domains = new Map<string, Map<string | null, string[]>>();

  for (const id of workingSet) {
    const domain = id.split('.')[0];
    const stateObj = hass.states[id];
    const cls =
      (stateObj?.attributes?.device_class as string | undefined) ?? null;

    let classes = domains.get(domain);
    if (!classes) {
      classes = new Map();
      domains.set(domain, classes);
    }
    let entities = classes.get(cls);
    if (!entities) {
      entities = [];
      classes.set(cls, entities);
    }
    entities.push(id);
  }

  const domainNodes: TreeNode[] = [];
  for (const [domain, classes] of domains) {
    const onlyNullClass = classes.size === 1 && classes.has(null);
    if (onlyNullClass) {
      const entityIds = classes.get(null)!;
      const entityChildren = entityIds.map((id) => entityNode(id, hass));
      sortNodes(entityChildren);
      domainNodes.push({
        id: domain,
        name: titleize(domain),
        kind: 'domain',
        children: entityChildren,
        totalCount: entityChildren.length,
      });
    } else {
      const classNodes: TreeNode[] = [];
      for (const [cls, entityIds] of classes) {
        const entityChildren = entityIds.map((id) => entityNode(id, hass));
        sortNodes(entityChildren);
        if (cls === null) {
          classNodes.push({
            id: '__no_class__',
            name: 'No class',
            kind: 'missing-class',
            children: entityChildren,
            totalCount: entityChildren.length,
          });
        } else {
          classNodes.push({
            id: cls,
            name: titleize(cls),
            kind: 'device-class',
            children: entityChildren,
            totalCount: entityChildren.length,
          });
        }
      }
      sortNodes(classNodes);
      domainNodes.push({
        id: domain,
        name: titleize(domain),
        kind: 'domain',
        children: classNodes,
        totalCount: countAll(classNodes),
      });
    }
  }
  sortNodes(domainNodes);

  return rootNode(domainNodes, workingSet.length);
}

function buildLabelTree(
  workingSet: string[],
  hass: HomeAssistant,
  configLabels: string[],
): TreeNode {
  const exclude = new Set(configLabels);
  const buckets = new Map<string, string[]>();
  const noLabels: string[] = [];

  for (const id of workingSet) {
    const labels = effectiveLabels(id, hass);
    for (const l of exclude) labels.delete(l);
    if (labels.size === 0) {
      noLabels.push(id);
      continue;
    }
    for (const label of labels) {
      let arr = buckets.get(label);
      if (!arr) {
        arr = [];
        buckets.set(label, arr);
      }
      arr.push(id);
    }
  }

  const labelNodes: TreeNode[] = [];
  for (const [label, entityIds] of buckets) {
    const entityChildren = entityIds.map((id) => entityNode(id, hass));
    sortNodes(entityChildren);
    labelNodes.push({
      id: label,
      name: label,
      kind: 'label',
      children: entityChildren,
      totalCount: entityChildren.length,
    });
  }
  if (noLabels.length > 0) {
    const entityChildren = noLabels.map((id) => entityNode(id, hass));
    sortNodes(entityChildren);
    labelNodes.push({
      id: '__no_other_labels__',
      name: 'No other labels',
      kind: 'missing-label',
      children: entityChildren,
      totalCount: entityChildren.length,
    });
  }
  sortNodes(labelNodes);

  return rootNode(labelNodes, workingSet.length);
}

function buildIntegrationTree(
  workingSet: string[],
  hass: HomeAssistant,
): TreeNode {
  const platforms = new Map<string, Map<string | null, string[]>>();

  for (const id of workingSet) {
    const entity = hass.entities?.[id];
    const platform = entity?.platform ?? 'unknown';
    const deviceId = entity?.device_id ?? null;

    let devices = platforms.get(platform);
    if (!devices) {
      devices = new Map();
      platforms.set(platform, devices);
    }
    let entities = devices.get(deviceId);
    if (!entities) {
      entities = [];
      devices.set(deviceId, entities);
    }
    entities.push(id);
  }

  const platformNodes: TreeNode[] = [];
  for (const [platform, devices] of platforms) {
    const deviceNodes: TreeNode[] = [];
    for (const [deviceId, entityIds] of devices) {
      const entityChildren = entityIds.map((id) => entityNode(id, hass));
      sortNodes(entityChildren);
      if (deviceId === null) {
        deviceNodes.push({
          id: '__no_device__',
          name: 'Device not available',
          kind: 'missing-device',
          children: entityChildren,
          totalCount: entityChildren.length,
        });
      } else {
        deviceNodes.push({
          id: deviceId,
          name: deviceDisplayName(hass.devices?.[deviceId], deviceId),
          kind: 'device',
          children: entityChildren,
          totalCount: entityChildren.length,
        });
      }
    }
    sortNodes(deviceNodes);
    platformNodes.push({
      id: platform,
      name: titleize(platform),
      kind: 'integration',
      children: deviceNodes,
      totalCount: countAll(deviceNodes),
    });
  }
  sortNodes(platformNodes);

  return rootNode(platformNodes, workingSet.length);
}

function rootNode(children: TreeNode[], uniqueCount: number): TreeNode {
  return {
    id: '__root__',
    name: '',
    kind: 'root',
    children,
    totalCount: uniqueCount,
  };
}

function entityNode(entityId: string, hass: HomeAssistant): TreeNode {
  const entity = hass.entities?.[entityId];
  const stateObj = hass.states[entityId];
  const friendly = stateObj?.attributes?.friendly_name as string | undefined;
  const name =
    entity?.name || entity?.original_name || friendly || entityId;
  return {
    id: entityId,
    name,
    kind: 'entity',
    children: [],
    entityId,
    totalCount: 1,
  };
}

function deviceDisplayName(
  device: DeviceRegistryEntry | undefined,
  fallback: string,
): string {
  if (!device) return fallback;
  return device.name_by_user || device.name || fallback;
}

function effectiveLabels(
  entityId: string,
  hass: HomeAssistant,
): Set<string> {
  const set = new Set<string>();
  const entity = hass.entities?.[entityId];
  if (!entity) return set;

  entity.labels?.forEach((l) => set.add(l));
  const device = entity.device_id
    ? hass.devices?.[entity.device_id]
    : undefined;
  device?.labels?.forEach((l) => set.add(l));

  const areaId = entity.area_id ?? device?.area_id ?? null;
  const area = areaId ? hass.areas?.[areaId] : undefined;
  area?.labels?.forEach((l) => set.add(l));

  if (area?.floor_id) {
    const floor = hass.floors?.[area.floor_id];
    floor?.labels?.forEach((l) => set.add(l));
  }
  return set;
}

function titleize(s: string): string {
  return s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    const aMissing = a.kind.startsWith('missing-');
    const bMissing = b.kind.startsWith('missing-');
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

function countAll(nodes: TreeNode[]): number {
  return nodes.reduce((sum, n) => sum + n.totalCount, 0);
}

export function navigate(
  root: TreeNode,
  path: string[],
): { node: TreeNode; validPath: string[] } {
  let current = root;
  const valid: string[] = [];
  for (const seg of path) {
    const next = current.children.find((c) => c.id === seg);
    if (!next) break;
    current = next;
    valid.push(seg);
  }
  return { node: current, validPath: valid };
}

type CountBase =
  | 'count.floor'
  | 'count.area'
  | 'count.device'
  | 'count.domain'
  | 'count.class'
  | 'count.label'
  | 'count.integration'
  | 'count.entity';

function countBaseForKind(kind: NodeKind): CountBase | null {
  switch (kind) {
    case 'floor':
      return 'count.floor';
    case 'area':
    case 'missing-area':
      return 'count.area';
    case 'device':
    case 'missing-device':
      return 'count.device';
    case 'domain':
      return 'count.domain';
    case 'device-class':
    case 'missing-class':
      return 'count.class';
    case 'label':
    case 'missing-label':
      return 'count.label';
    case 'integration':
      return 'count.integration';
    case 'entity':
      return 'count.entity';
    default:
      return null;
  }
}

function sectionKeyForKind(kind: NodeKind): I18nKey | null {
  switch (kind) {
    case 'floor':
      return 'section.floors';
    case 'area':
    case 'missing-area':
      return 'section.areas';
    case 'device':
    case 'missing-device':
      return 'section.devices';
    case 'domain':
      return 'section.domains';
    case 'device-class':
    case 'missing-class':
      return 'section.device_classes';
    case 'label':
    case 'missing-label':
      return 'section.labels';
    case 'integration':
      return 'section.integrations';
    case 'entity':
      return 'section.entities';
    default:
      return null;
  }
}

export function childKindLabel(node: TreeNode, hass?: HomeAssistant): string {
  if (node.children.length === 0) return '';
  const sample =
    node.children.find((c) => !c.kind.startsWith('missing-')) ??
    node.children[0];
  const n = node.children.length;
  const base = countBaseForKind(sample.kind);
  if (!base) return `${n}`;
  return tn(hass, base, n);
}

export function sectionLabel(node: TreeNode, hass?: HomeAssistant): string {
  if (node.children.length === 0) return '';
  const sample =
    node.children.find((c) => !c.kind.startsWith('missing-')) ??
    node.children[0];
  const key = sectionKeyForKind(sample.kind);
  return key ? t(hass, key) : '';
}
