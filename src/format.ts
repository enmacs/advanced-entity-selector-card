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

export const FORMAT_LABELS: Record<CopyFormat, string> = {
  csv: 'Plain',
  yaml: 'YAML list',
  json: 'JSON array',
};
