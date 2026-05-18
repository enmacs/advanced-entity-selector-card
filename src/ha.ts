import type { HomeAssistant as BaseHomeAssistant } from 'custom-card-helpers';

export interface HassEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    unit_of_measurement?: string;
  };
}

export interface EntityRegistryEntry {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
  labels: string[];
  name: string | null;
  original_name: string | null;
  entity_category: 'config' | 'diagnostic' | null;
  hidden_by: string | null;
  disabled_by: string | null;
  platform: string;
  config_entry_id: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
  area_id: string | null;
  labels: string[];
  name: string | null;
  name_by_user: string | null;
}

export interface AreaRegistryEntry {
  area_id: string;
  name: string;
  floor_id: string | null;
  labels: string[];
}

export interface FloorRegistryEntry {
  floor_id: string;
  name: string;
  labels: string[];
}

export interface HomeAssistant extends BaseHomeAssistant {
  entities: Record<string, EntityRegistryEntry>;
  devices: Record<string, DeviceRegistryEntry>;
  areas: Record<string, AreaRegistryEntry>;
  floors: Record<string, FloorRegistryEntry>;
}
