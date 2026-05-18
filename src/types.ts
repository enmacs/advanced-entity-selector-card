import type { LovelaceCardConfig } from 'custom-card-helpers';

export type HierarchyId =
  | 'floor_area_device'
  | 'domain_class'
  | 'label'
  | 'integration_device';

export interface AdvancedEntitySelectorCardConfig extends LovelaceCardConfig {
  title?: string;
  labels: string[];
  hierarchies?: HierarchyId[];
  default_hierarchy?: HierarchyId;
  show_diagnostic?: boolean;
  show_state?: boolean;
  recents_limit?: number;
}
