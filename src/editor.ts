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
  show_diagnostic: 'Show diagnostic toggle',
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
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: { name: string }): string =>
    LABELS[schema.name] ?? schema.name;

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config) return;
    const next = ev.detail.value as AdvancedEntitySelectorCardConfig;
    fireEvent(this, 'config-changed', { config: next });
  }

  static styles = css`
    ha-form {
      display: block;
    }
  `;
}
