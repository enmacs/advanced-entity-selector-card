import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import { EDITOR_TAG } from './const';
import type { AdvancedEntitySelectorCardConfig, HierarchyId } from './types';
import type { HomeAssistant } from './ha';
import { t, type I18nKey } from './i18n';

type HaFormSchema = ReadonlyArray<Record<string, unknown>>;

const HIERARCHY_IDS: ReadonlyArray<HierarchyId> = [
  'floor_area_device',
  'domain_class',
  'class_unit',
  'class_unit_device',
  'label',
  'integration_device',
];

const FIELD_NAMES = [
  'title',
  'labels',
  'hierarchies',
  'default_hierarchy',
  'recents_limit',
  'show_state',
  'show_diagnostic',
  'show_entity_labels',
] as const;
type FieldName = (typeof FIELD_NAMES)[number];

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
        .schema=${this._schema()}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _schema(): HaFormSchema {
    const hierarchyOptions = HIERARCHY_IDS.map((id) => ({
      value: id,
      label: t(this.hass, `hierarchy.${id}` as I18nKey),
    }));
    return [
      { name: 'title', selector: { text: {} } },
      { name: 'labels', required: true, selector: { label: { multiple: true } } },
      {
        name: 'hierarchies',
        selector: {
          select: { multiple: true, mode: 'list', options: hierarchyOptions },
        },
      },
      {
        name: 'default_hierarchy',
        selector: {
          select: { mode: 'dropdown', options: hierarchyOptions },
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
          { name: 'show_entity_labels', selector: { boolean: {} } },
        ],
      },
    ];
  }

  private _computeLabel = (schema: { name: string }): string => {
    if ((FIELD_NAMES as readonly string[]).includes(schema.name)) {
      return t(this.hass, `editor.label.${schema.name as FieldName}` as I18nKey);
    }
    return schema.name;
  };

  private _computeHelper = (schema: { name: string }): string | undefined => {
    if ((FIELD_NAMES as readonly string[]).includes(schema.name)) {
      return t(this.hass, `editor.helper.${schema.name as FieldName}` as I18nKey);
    }
    return undefined;
  };

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
