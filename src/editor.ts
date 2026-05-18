import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import { EDITOR_TAG } from './const';
import type { AdvancedEntitySelectorCardConfig, HierarchyId } from './types';
import type { HomeAssistant } from './ha';

type HaFormSchema = ReadonlyArray<Record<string, unknown>>;

const HIERARCHY_OPTIONS: ReadonlyArray<{ value: HierarchyId; label: string }> = [
  { value: 'floor_area_device', label: 'Floor · Area · Device' },
  { value: 'domain_class', label: 'Domain · Class' },
  { value: 'label', label: 'Label' },
  { value: 'integration_device', label: 'Integration · Device' },
];

const SCHEMA: HaFormSchema = [
  { name: 'title', selector: { text: {} } },
  { name: 'labels', required: true, selector: { label: { multiple: true } } },
  {
    name: 'hierarchies',
    selector: {
      select: {
        multiple: true,
        mode: 'list',
        options: HIERARCHY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      },
    },
  },
  {
    name: 'default_hierarchy',
    selector: {
      select: {
        mode: 'dropdown',
        options: HIERARCHY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      },
    },
  },
  {
    name: 'recents_limit',
    selector: { number: { min: 0, max: 50, mode: 'box', step: 1 } },
  },
  {
    type: 'grid',
    schema: [
      { name: 'show_state', selector: { boolean: {} } },
      { name: 'show_diagnostic', selector: { boolean: {} } },
    ],
  },
];

const LABELS: Record<string, string> = {
  title: 'Title',
  labels: 'Labels (required)',
  hierarchies: 'Available hierarchies',
  default_hierarchy: 'Default hierarchy',
  recents_limit: 'Recents limit',
  show_state: 'Show entity state',
  show_diagnostic: 'Include diagnostic entities',
};

const HELPERS: Record<string, string> = {
  title: 'Header shown at the top of the card. Defaults to the card name.',
  labels:
    'Only entities tagged with at least one of these Home Assistant labels are shown. Create labels under Settings → Areas, labels & zones.',
  hierarchies:
    'Which grouping views the user can switch between. Leave empty to show all four.',
  default_hierarchy: 'Hierarchy selected when the card first loads.',
  recents_limit: 'How many recently-picked entities to remember per label set (0 disables).',
  show_state: 'Display each entity’s current state next to its name.',
  show_diagnostic: 'Expose a toggle to include diagnostic/config entities in the list.',
};

@customElement(EDITOR_TAG)
export class AdvancedEntitySelectorCardEditor
  extends LitElement
  implements LovelaceCardEditor
{
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: AdvancedEntitySelectorCardConfig;

  public setConfig(config: AdvancedEntitySelectorCardConfig): void {
    this._config = config;
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const data = {
      ...this._config,
      labels: this._config.labels ?? [],
      hierarchies: this._config.hierarchies ?? [],
    };
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: { name: string }): string =>
    LABELS[schema.name] ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined =>
    HELPERS[schema.name];

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config) return;
    const raw = ev.detail.value as AdvancedEntitySelectorCardConfig;
    const next: AdvancedEntitySelectorCardConfig = { ...raw };
    if (Array.isArray(next.hierarchies) && next.hierarchies.length === 0) {
      delete next.hierarchies;
    }
    if (next.title === '') delete next.title;
    fireEvent(this, 'config-changed', { config: next });
  }

  static styles = css`
    ha-form {
      display: block;
    }
  `;
}
