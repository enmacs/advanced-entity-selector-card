import type { HomeAssistant } from './ha';
import { t, type I18nKey } from './i18n';

export type CopyFormat = 'csv' | 'yaml' | 'json';

export function formatEntities(ids: string[], format: CopyFormat): string {
  switch (format) {
    case 'csv':
      return ids.join(', ');
    case 'yaml':
      return ids.map((id) => `- ${id}`).join('\n');
    case 'json':
      return JSON.stringify(ids);
  }
}

export function formatLabel(hass: HomeAssistant | undefined, fmt: CopyFormat): string {
  return t(hass, `format.${fmt}` as I18nKey);
}
