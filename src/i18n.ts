import type { HomeAssistant } from './ha';

type Subs = Record<string, string | number>;

const EN = {
  // Editor field labels
  'editor.label.title': 'Title',
  'editor.label.labels': 'Labels (required)',
  'editor.label.hierarchies': 'Available hierarchies',
  'editor.label.default_hierarchy': 'Default hierarchy',
  'editor.label.recents_limit': 'Recents limit',
  'editor.label.show_state': 'Show entity state',
  'editor.label.show_diagnostic': 'Include diagnostic entities',
  'editor.label.show_entity_labels': 'Show entity labels',

  // Editor helpers
  'editor.helper.title': 'Header shown at the top of the card. Defaults to the card name.',
  'editor.helper.labels':
    'Only entities tagged with at least one of these Home Assistant labels are shown. Create labels under Settings → Areas, labels & zones.',
  'editor.helper.hierarchies':
    'Which grouping views the user can switch between. Leave empty to show all four.',
  'editor.helper.default_hierarchy': 'Hierarchy selected when the card first loads.',
  'editor.helper.recents_limit':
    'How many recently-picked entities to remember per label set (0 disables).',
  'editor.helper.show_state': 'Display each entity’s current state next to its name.',
  'editor.helper.show_diagnostic':
    'Expose a toggle to include diagnostic/config entities in the list.',
  'editor.helper.show_entity_labels':
    'Default state for the toggle that displays each entity’s labels as chips under its ID.',

  // Hierarchy names
  'hierarchy.floor_area_device': 'Floor · Area · Device',
  'hierarchy.domain_class': 'Domain · Class',
  'hierarchy.label': 'Label',
  'hierarchy.integration_device': 'Integration · Device',

  // Card header & controls
  'card.mode.all': 'All',
  'card.mode.selecting': 'Selecting',
  'card.btn.select': '⊕ Select',
  'card.btn.done': '✕ Done',
  'card.btn.select_all': 'Select all',
  'card.btn.clear': 'Clear',
  'card.btn.copy': 'Copy',
  'card.toggle.all_entities': 'All entities',
  'card.toggle.show_diagnostic': 'Show diagnostic',
  'card.toggle.show_entity_labels': 'Show labels',
  'card.search_placeholder': 'Search…',
  'card.breadcrumb.home': 'Home',
  'card.recents': 'RECENTS',
  'card.matches.one': 'MATCH',
  'card.matches.other': 'MATCHES',
  'card.empty.no_matches': 'No matches.',
  'card.empty.nothing_here': 'Nothing here.',
  'card.empty.no_entities': 'No entities found for label(s): {labels}',
  'card.bottom.format': 'Format:',
  'card.bottom.selected': '{n} selected',
  'card.copy.label': 'Copy entity ID',
  'card.copy.copied': 'Copied',
  'card.copy.failed': 'Copy failed',
  'card.copy.success.one': 'Copied {n} entity as {format}',
  'card.copy.success.other': 'Copied {n} entities as {format}',

  // Quick-tag (multi-select bulk label apply)
  'card.tag.placeholder': 'Add label…',
  'card.tag.no_labels': 'No labels defined in Home Assistant',
  'card.tag.success.one': 'Added “{label}” to 1 entity',
  'card.tag.success.other': 'Added “{label}” to {n} entities',
  'card.tag.skipped': 'All selected entities already had “{label}”',
  'card.tag.failed': 'Failed to add label',

  // Section labels (rendered uppercase)
  'section.floors': 'FLOORS',
  'section.areas': 'AREAS',
  'section.devices': 'DEVICES',
  'section.domains': 'DOMAINS',
  'section.device_classes': 'DEVICE CLASSES',
  'section.labels': 'LABELS',
  'section.integrations': 'INTEGRATIONS',
  'section.entities': 'ENTITIES',

  // Count phrases ({n} substitution; .one for singular, .other for plural)
  'count.floor.one': '1 floor',
  'count.floor.other': '{n} floors',
  'count.area.one': '1 area',
  'count.area.other': '{n} areas',
  'count.device.one': '1 device',
  'count.device.other': '{n} devices',
  'count.domain.one': '1 domain',
  'count.domain.other': '{n} domains',
  'count.class.one': '1 class',
  'count.class.other': '{n} classes',
  'count.label.one': '1 label',
  'count.label.other': '{n} labels',
  'count.integration.one': '1 integration',
  'count.integration.other': '{n} integrations',
  'count.entity.one': '1 entity',
  'count.entity.other': '{n} entities',

  // Copy formats
  'format.csv': 'Plain',
  'format.yaml': 'YAML list',
  'format.json': 'JSON array',
} as const;

export type I18nKey = keyof typeof EN;

const DE: Partial<Record<I18nKey, string>> = {
  'editor.label.title': 'Titel',
  'editor.label.labels': 'Labels (erforderlich)',
  'editor.label.hierarchies': 'Verfügbare Hierarchien',
  'editor.label.default_hierarchy': 'Standard-Hierarchie',
  'editor.label.recents_limit': 'Anzahl zuletzt verwendet',
  'editor.label.show_state': 'Entitätsstatus anzeigen',
  'editor.label.show_diagnostic': 'Diagnose-Entitäten einbeziehen',
  'editor.label.show_entity_labels': 'Labels der Entitäten anzeigen',

  'editor.helper.title': 'Überschrift oben auf der Karte. Standard ist der Kartenname.',
  'editor.helper.labels':
    'Es werden nur Entitäten angezeigt, die mit mindestens einem dieser Home-Assistant-Labels markiert sind. Labels lassen sich unter Einstellungen → Bereiche, Labels & Zonen anlegen.',
  'editor.helper.hierarchies':
    'Welche Gruppierungsansichten der Benutzer wechseln kann. Leer lassen, um alle vier zu zeigen.',
  'editor.helper.default_hierarchy': 'Hierarchie, die beim Laden der Karte aktiv ist.',
  'editor.helper.recents_limit':
    'Wie viele zuletzt ausgewählte Entitäten pro Label-Satz gemerkt werden (0 deaktiviert).',
  'editor.helper.show_state':
    'Den aktuellen Status jeder Entität neben dem Namen anzeigen.',
  'editor.helper.show_diagnostic':
    'Einen Schalter einblenden, mit dem Diagnose- und Konfigurationsentitäten in die Liste aufgenommen werden.',
  'editor.helper.show_entity_labels':
    'Voreinstellung für den Schalter, der die Labels jeder Entität als Chips unter der ID anzeigt.',

  'hierarchy.floor_area_device': 'Etage · Bereich · Gerät',
  'hierarchy.domain_class': 'Domain · Klasse',
  'hierarchy.label': 'Label',
  'hierarchy.integration_device': 'Integration · Gerät',

  'card.mode.all': 'Alle',
  'card.mode.selecting': 'Auswahl',
  'card.btn.select': '⊕ Auswählen',
  'card.btn.done': '✕ Fertig',
  'card.btn.select_all': 'Alle auswählen',
  'card.btn.clear': 'Leeren',
  'card.btn.copy': 'Kopieren',
  'card.toggle.all_entities': 'Alle Entitäten',
  'card.toggle.show_diagnostic': 'Diagnose anzeigen',
  'card.toggle.show_entity_labels': 'Labels anzeigen',
  'card.search_placeholder': 'Suchen…',
  'card.breadcrumb.home': 'Start',
  'card.recents': 'ZULETZT',
  'card.matches.one': 'TREFFER',
  'card.matches.other': 'TREFFER',
  'card.empty.no_matches': 'Keine Treffer.',
  'card.empty.nothing_here': 'Nichts hier.',
  'card.empty.no_entities': 'Keine Entitäten für Label(s): {labels}',
  'card.bottom.format': 'Format:',
  'card.bottom.selected': '{n} ausgewählt',
  'card.copy.label': 'Entitäts-ID kopieren',
  'card.copy.copied': 'Kopiert',
  'card.copy.failed': 'Kopieren fehlgeschlagen',
  'card.copy.success.one': '{n} Entität als {format} kopiert',
  'card.copy.success.other': '{n} Entitäten als {format} kopiert',

  'card.tag.placeholder': 'Label hinzufügen…',
  'card.tag.no_labels': 'In Home Assistant sind keine Labels definiert',
  'card.tag.success.one': '„{label}" zu 1 Entität hinzugefügt',
  'card.tag.success.other': '„{label}" zu {n} Entitäten hinzugefügt',
  'card.tag.skipped': 'Alle ausgewählten Entitäten hatten bereits „{label}"',
  'card.tag.failed': 'Label konnte nicht hinzugefügt werden',

  'section.floors': 'ETAGEN',
  'section.areas': 'BEREICHE',
  'section.devices': 'GERÄTE',
  'section.domains': 'DOMAINS',
  'section.device_classes': 'GERÄTEKLASSEN',
  'section.labels': 'LABELS',
  'section.integrations': 'INTEGRATIONEN',
  'section.entities': 'ENTITÄTEN',

  'count.floor.one': '1 Etage',
  'count.floor.other': '{n} Etagen',
  'count.area.one': '1 Bereich',
  'count.area.other': '{n} Bereiche',
  'count.device.one': '1 Gerät',
  'count.device.other': '{n} Geräte',
  'count.domain.one': '1 Domain',
  'count.domain.other': '{n} Domains',
  'count.class.one': '1 Klasse',
  'count.class.other': '{n} Klassen',
  'count.label.one': '1 Label',
  'count.label.other': '{n} Labels',
  'count.integration.one': '1 Integration',
  'count.integration.other': '{n} Integrationen',
  'count.entity.one': '1 Entität',
  'count.entity.other': '{n} Entitäten',

  'format.csv': 'Einfach',
  'format.yaml': 'YAML-Liste',
  'format.json': 'JSON-Array',
};

const STRINGS: Record<string, Partial<Record<I18nKey, string>>> = {
  en: EN,
  de: DE,
};

function pickLang(hass: HomeAssistant | undefined): string {
  const raw =
    (hass?.locale && (hass.locale as { language?: string }).language) ||
    (hass as { language?: string } | undefined)?.language ||
    'en';
  return raw.split('-')[0].toLowerCase();
}

export function t(
  hass: HomeAssistant | undefined,
  key: I18nKey,
  subs?: Subs,
): string {
  const lang = pickLang(hass);
  const raw = STRINGS[lang]?.[key] ?? EN[key] ?? key;
  if (!subs) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) =>
    subs[k] != null ? String(subs[k]) : '',
  );
}

export function tn(
  hass: HomeAssistant | undefined,
  base: string,
  n: number,
  extra?: Subs,
): string {
  const variant = n === 1 ? 'one' : 'other';
  return t(hass, `${base}.${variant}` as I18nKey, { n, ...extra });
}
