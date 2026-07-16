import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard } from 'custom-card-helpers';

import { CARD_NAME, CARD_TAG, EDITOR_TAG, VERSION } from './const';
import './editor';
import type { HierarchyId, AdvancedEntitySelectorCardConfig } from './types';
import type { HassEntityState, HomeAssistant, LabelRegistryEntry } from './ha';
import { computeWorkingSet } from './working-set';
import { copyText } from './clipboard';
import {
  buildTree,
  childKindLabel,
  navigate,
  sectionLabel,
  type TreeNode,
} from './hierarchy';
import { collectEntities, entityContext, matchesQuery } from './search';
import { formatEntities, formatLabel, type CopyFormat } from './format';
import { t, tn } from './i18n';

const DEFAULT_HIERARCHIES: HierarchyId[] = [
  'floor_area_device',
  'domain_class',
  'class_unit',
  'label',
  'integration_device',
];


const COPY_FEEDBACK_MS = 1200;
const TOAST_MS = 1800;
const RECENTS_STORAGE_PREFIX = 'advanced-entity-selector:recents:';
const RECENTS_COLLAPSED_STORAGE_PREFIX = 'advanced-entity-selector:recents-collapsed:';

interface LovelaceLayoutOptions {
  grid_columns?: number | 'full';
  grid_rows?: number | 'auto';
  grid_min_columns?: number;
  grid_max_columns?: number;
  grid_min_rows?: number;
  grid_max_rows?: number;
}

@customElement(CARD_TAG)
export class AdvancedEntitySelectorCard extends LitElement implements LovelaceCard {
  public static async getConfigElement(): Promise<HTMLElement> {
    return document.createElement(EDITOR_TAG);
  }

  public static getStubConfig(): Partial<AdvancedEntitySelectorCardConfig> {
    return {
      labels: ['advanced-entity-selector'],
      default_hierarchy: 'floor_area_device',
      show_state: true,
      recents_limit: 10,
    };
  }

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: AdvancedEntitySelectorCardConfig;
  @state() private _copiedId: string | null = null;
  @state() private _path: string[] = [];
  @state() private _search = '';
  @state() private _showDiagnostic = false;
  @state() private _showAll = false;
  @state() private _showEntityLabels = false;
  @state() private _hierarchy: HierarchyId = 'floor_area_device';
  @state() private _selectMode = false;
  @state() private _selected: Set<string> = new Set();
  @state() private _format: CopyFormat = 'yaml';
  @state() private _recents: string[] = [];
  @state() private _recentsCollapsed = true;
  @state() private _toast: string | null = null;
  @state() private _labelRegistry: LabelRegistryEntry[] | null = null;
  private _labelSub?: () => void;

  public setConfig(config: AdvancedEntitySelectorCardConfig): void {
    if (!config.labels || config.labels.length === 0) {
      throw new Error('At least one label is required in `labels`.');
    }
    this._config = {
      hierarchies: DEFAULT_HIERARCHIES,
      default_hierarchy: 'floor_area_device',
      show_diagnostic: false,
      show_state: true,
      show_entity_labels: false,
      recents_limit: 10,
      ...config,
    };
    this._path = [];
    this._search = '';
    this._showDiagnostic = !!this._config.show_diagnostic;
    this._showAll = false;
    this._showEntityLabels = !!this._config.show_entity_labels;
    this._hierarchy = this._enabledHierarchies().includes(
      this._config.default_hierarchy!,
    )
      ? this._config.default_hierarchy!
      : this._enabledHierarchies()[0];
    this._selectMode = false;
    this._selected = new Set();
    this._recents = this._loadRecents();
    this._recentsCollapsed = this._loadRecentsCollapsed();
  }

  public getCardSize(): number {
    return 6;
  }

  public getLayoutOptions(): LovelaceLayoutOptions {
    return {
      grid_columns: 4,
      grid_rows: 'auto',
      grid_min_columns: 2,
      grid_max_columns: 4,
      grid_min_rows: 3,
    };
  }

  public getGridOptions(): LovelaceLayoutOptions {
    return this.getLayoutOptions();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('hass') && this.hass && this._labelRegistry === null) {
      void this._fetchLabels();
    }
    if (!this._config || !this.hass || this._path.length === 0) return;
    const tree = this._buildTree();
    const { validPath } = navigate(tree, this._path);
    if (validPath.length !== this._path.length) {
      this._path = validPath;
    }
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._labelSub?.();
    this._labelSub = undefined;
  }

  private async _fetchLabels(): Promise<void> {
    if (!this.hass) return;
    try {
      const list = await this.hass.callWS<LabelRegistryEntry[]>({
        type: 'config/label_registry/list',
      });
      this._labelRegistry = list ?? [];
    } catch {
      this._labelRegistry = [];
    }
    if (!this._labelSub && this.hass.connection) {
      const conn = this.hass.connection as {
        subscribeEvents?: (
          cb: () => void,
          eventType: string,
        ) => Promise<() => void>;
      };
      try {
        const unsub = await conn.subscribeEvents?.(
          () => void this._fetchLabels(),
          'label_registry_updated',
        );
        if (unsub) this._labelSub = unsub;
      } catch {
        // ignore
      }
    }
  }

  private _labels(): LabelRegistryEntry[] {
    if (this._labelRegistry && this._labelRegistry.length > 0) {
      return this._labelRegistry;
    }
    return Object.values(this.hass?.labels ?? {});
  }

  protected render(): TemplateResult {
    if (!this._config || !this.hass) return html``;

    const tree = this._buildTree();
    const { node: current, validPath } = navigate(tree, this._path);
    const isSearching = this._search.trim().length > 0;
    const atRoot = validPath.length === 0;
    const headerCount = atRoot ? tree.totalCount : current.totalCount;
    const showRecents =
      atRoot && !isSearching && this._recents.length > 0;

    return html`
      <ha-card>
        <div class="header">
          <span class="title">
            ${this._config.title ?? CARD_NAME}${this._showAll
              ? html`<span class="title-mode"> · ${t(this.hass, 'card.mode.all')}</span>`
              : nothing}${this._selectMode
              ? html`<span class="selecting"> · ${t(this.hass, 'card.mode.selecting')}</span>`
              : nothing}
          </span>
          <span class="count">${headerCount}</span>
          <span class="header-actions">
            ${this._selectMode
              ? html`<button class="hbtn" @click=${this._exitSelectMode}>
                  ${t(this.hass, 'card.btn.done')}
                </button>`
              : html`<button class="hbtn" @click=${this._enterSelectMode}>
                  ${t(this.hass, 'card.btn.select')}
                </button>`}
          </span>
        </div>
        ${this._renderHierarchySwitcher()}
        ${this._renderFilterRow()}
        ${this._renderBreadcrumb(tree, validPath)}
        ${showRecents ? this._renderRecents() : nothing}
        ${isSearching
          ? this._renderSearchResults(current)
          : current.children.length === 0
            ? html`<div class="empty">
                ${tree.totalCount === 0
                  ? t(this.hass, 'card.empty.no_entities', {
                      labels: this._config.labels.join(', '),
                    })
                  : t(this.hass, 'card.empty.nothing_here')}
              </div>`
            : this._renderChildren(current)}
        ${this._selectMode ? this._renderBottomBar() : nothing}
        ${this._toast
          ? html`<div class="toast">${this._toast}</div>`
          : nothing}
      </ha-card>
    `;
  }

  private _buildTree(): TreeNode {
    const workingSet = computeWorkingSet(
      this.hass,
      this._config.labels,
      this._showDiagnostic,
      this._showAll,
    );
    return buildTree(
      this._hierarchy,
      workingSet,
      this.hass,
      this._showAll ? [] : this._config.labels,
    );
  }

  private _enabledHierarchies(): HierarchyId[] {
    return this._config.hierarchies && this._config.hierarchies.length > 0
      ? this._config.hierarchies
      : DEFAULT_HIERARCHIES;
  }

  private _renderHierarchySwitcher(): TemplateResult | typeof nothing {
    const enabled = this._enabledHierarchies();
    if (enabled.length <= 1) return nothing;
    return html`
      <div class="hierarchy-tabs" role="tablist">
        ${enabled.map(
          (h) => html`
            <button
              role="tab"
              class="htab ${this._hierarchy === h ? 'htab-active' : ''}"
              ?aria-selected=${this._hierarchy === h}
              @click=${() => this._switchHierarchy(h)}
            >
              ${t(this.hass, `hierarchy.${h}` as const)}
            </button>
          `,
        )}
      </div>
      <select
        class="hierarchy-select"
        .value=${this._hierarchy}
        @change=${this._onHierarchyChange}
      >
        ${enabled.map(
          (h) => html`<option value=${h} ?selected=${this._hierarchy === h}>
            ${t(this.hass, `hierarchy.${h}` as const)}
          </option>`,
        )}
      </select>
    `;
  }

  private _renderFilterRow(): TemplateResult {
    return html`
      <div class="filter-row">
        <input
          class="search"
          type="search"
          placeholder=${t(this.hass, 'card.search_placeholder')}
          .value=${this._search}
          @input=${this._onSearch}
        />
        <label class="diag-toggle">
          <input
            type="checkbox"
            .checked=${this._showAll}
            @change=${this._onAllToggle}
          />
          <span>${t(this.hass, 'card.toggle.all_entities')}</span>
        </label>
        <label class="diag-toggle">
          <input
            type="checkbox"
            .checked=${this._showDiagnostic}
            @change=${this._onDiagToggle}
          />
          <span>${t(this.hass, 'card.toggle.show_diagnostic')}</span>
        </label>
        <label class="diag-toggle">
          <input
            type="checkbox"
            .checked=${this._showEntityLabels}
            @change=${this._onEntityLabelsToggle}
          />
          <span>${t(this.hass, 'card.toggle.show_entity_labels')}</span>
        </label>
      </div>
    `;
  }

  private _renderBreadcrumb(
    tree: TreeNode,
    validPath: string[],
  ): TemplateResult | typeof nothing {
    if (validPath.length === 0) return nothing;
    const segments: { label: string; depth: number }[] = [
      { label: t(this.hass, 'card.breadcrumb.home'), depth: 0 },
    ];
    let current = tree;
    for (let i = 0; i < validPath.length; i++) {
      const next = current.children.find((c) => c.id === validPath[i]);
      if (!next) break;
      segments.push({ label: next.name, depth: i + 1 });
      current = next;
    }
    return html`
      <div class="breadcrumb">
        ${segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return html`
            ${i > 0 ? html`<span class="sep">›</span>` : nothing}
            ${isLast
              ? html`<span class="crumb crumb-current">${seg.label}</span>`
              : html`<button
                  class="crumb"
                  @click=${() =>
                    this._navigateTo(validPath.slice(0, seg.depth))}
                >
                  ${seg.label}
                </button>`}
          `;
        })}
      </div>
    `;
  }

  private _renderRecents(): TemplateResult {
    const validRecents = this._recents.filter(
      (id) => this.hass.entities?.[id] || this.hass.states[id],
    );
    if (validRecents.length === 0) return html``;
    const collapsed = this._recentsCollapsed;
    return html`
      <div class="recents-block">
        <div
          class="section-label recents-header"
          role="button"
          tabindex="0"
          aria-expanded=${collapsed ? 'false' : 'true'}
          @click=${this._toggleRecentsCollapsed}
          @keydown=${this._onRecentsHeaderKey}
        >
          <span class="recents-title">
            <ha-icon icon="mdi:history"></ha-icon>
            ${t(this.hass, 'card.recents')} (${validRecents.length})
          </span>
          <ha-icon
            class="recents-chevron ${collapsed ? '' : 'expanded'}"
            icon="mdi:chevron-down"
          ></ha-icon>
        </div>
        ${collapsed
          ? nothing
          : html`<div class="list">
              ${validRecents.map((id) => {
                const node: TreeNode = {
                  id,
                  name: this._displayName(id),
                  kind: 'entity',
                  children: [],
                  entityId: id,
                  totalCount: 1,
                };
                return this._renderEntityRow(node);
              })}
            </div>`}
      </div>
    `;
  }

  private _toggleRecentsCollapsed = (): void => {
    this._recentsCollapsed = !this._recentsCollapsed;
    this._saveRecentsCollapsed(this._recentsCollapsed);
  };

  private _onRecentsHeaderKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._toggleRecentsCollapsed();
    }
  };

  private _recentsCollapsedKey(): string {
    return (
      RECENTS_COLLAPSED_STORAGE_PREFIX +
      [...this._config.labels].sort().join(',')
    );
  }

  private _loadRecentsCollapsed(): boolean {
    try {
      const raw = localStorage.getItem(this._recentsCollapsedKey());
      if (raw === 'false') return false;
      if (raw === 'true') return true;
    } catch {
      // ignore
    }
    return true;
  }

  private _saveRecentsCollapsed(v: boolean): void {
    try {
      localStorage.setItem(this._recentsCollapsedKey(), String(v));
    } catch {
      // ignore
    }
  }

  private _renderChildren(node: TreeNode): TemplateResult {
    const isLeafLevel = node.children[0]?.kind === 'entity';
    return html`
      <div class="section-label">
        <span>${sectionLabel(node, this.hass)}</span>
        ${this._selectMode && isLeafLevel
          ? html`<span class="actions">
              <button class="link-btn" @click=${() => this._selectAll(node)}>
                ${t(this.hass, 'card.btn.select_all')}
              </button>
              <button class="link-btn" @click=${this._clearSelection}>
                ${t(this.hass, 'card.btn.clear')}
              </button>
            </span>`
          : nothing}
      </div>
      <div class="list">
        ${node.children.map((c) =>
          isLeafLevel ? this._renderEntityRow(c) : this._renderGroupRow(c),
        )}
      </div>
    `;
  }

  private _renderGroupRow(node: TreeNode): TemplateResult {
    const labelChips = this._nodeLabelChips(node);
    return html`
      <div
        class="row group"
        role="button"
        tabindex="0"
        @click=${() => this._enterGroup(node.id)}
        @keydown=${(e: KeyboardEvent) => this._onGroupKey(e, node.id)}
      >
        <div class="row-main">
          <div class="row-name">${node.name}</div>
          <div class="row-id">${childKindLabel(node, this.hass)}</div>
          ${this._renderLabelChips(labelChips)}
        </div>
        <ha-icon class="chevron" icon="mdi:chevron-right"></ha-icon>
      </div>
    `;
  }

  private _renderEntityRow(
    node: TreeNode,
    contextLabel?: string,
  ): TemplateResult {
    const id = node.entityId!;
    const stateObj = this.hass.states[id];
    const stateText =
      this._config.show_state && stateObj ? this._formatState(stateObj) : '';
    const copied = this._copiedId === id;
    const subline = contextLabel ? `${contextLabel} · ${id}` : id;
    const selected = this._selected.has(id);
    const labelChips = this._nodeLabelChips(node);

    return html`
      <div
        class="row ${selected ? 'row-selected' : ''}"
        role="button"
        tabindex="0"
        @click=${() => this._onEntityClick(id)}
        @keydown=${(e: KeyboardEvent) => this._onRowKey(e, id)}
      >
        ${this._selectMode
          ? html`<input
              type="checkbox"
              class="row-check"
              .checked=${selected}
              @click=${(e: Event) => e.stopPropagation()}
              @change=${() => this._toggleSelect(id)}
            />`
          : nothing}
        <div class="row-main">
          <div class="row-name">${node.name}</div>
          <div class="row-id">${subline}</div>
          ${this._renderLabelChips(labelChips)}
        </div>
        ${stateText ? html`<div class="row-state">${stateText}</div>` : nothing}
        <ha-icon-button
          class="copy"
          .label=${copied ? t(this.hass, 'card.copy.copied') : t(this.hass, 'card.copy.label')}
          @click=${(e: Event) => this._copy(e, id)}
        >
          <ha-icon
            .icon=${copied ? 'mdi:check' : 'mdi:content-copy'}
          ></ha-icon>
        </ha-icon-button>
      </div>
    `;
  }

  private _renderSearchResults(scope: TreeNode): TemplateResult {
    const all = collectEntities(scope);
    const matches = all
      .filter((n) => matchesQuery(n.entityId!, this._search, this.hass))
      .sort((a, b) => a.name.localeCompare(b.name));

    return html`
      <div class="section-label">
        <span>${matches.length} ${tn(this.hass, 'card.matches', matches.length)}</span>
        ${this._selectMode && matches.length > 0
          ? html`<span class="actions">
              <button
                class="link-btn"
                @click=${() => this._selectIds(matches.map((n) => n.entityId!))}
              >
                ${t(this.hass, 'card.btn.select_all')}
              </button>
              <button class="link-btn" @click=${this._clearSelection}>
                ${t(this.hass, 'card.btn.clear')}
              </button>
            </span>`
          : nothing}
      </div>
      ${matches.length === 0
        ? html`<div class="empty">${t(this.hass, 'card.empty.no_matches')}</div>`
        : html`<div class="list">
            ${matches.map((n) =>
              this._renderEntityRow(n, entityContext(n.entityId!, this.hass)),
            )}
          </div>`}
    `;
  }

  private _renderBottomBar(): TemplateResult {
    const n = this._selected.size;
    return html`
      <div class="bottom-bar">
        <span class="count-summary">${t(this.hass, 'card.bottom.selected', { n })}</span>
        ${this._renderTagPicker(n === 0)}
        <label class="format-pick">
          ${t(this.hass, 'card.bottom.format')}
          <select .value=${this._format} @change=${this._onFormatChange}>
            ${(['csv', 'yaml', 'json'] as CopyFormat[]).map(
              (f) => html`<option value=${f} ?selected=${this._format === f}>
                ${formatLabel(this.hass, f)}
              </option>`,
            )}
          </select>
        </label>
        <button
          class="copy-btn"
          ?disabled=${n === 0}
          @click=${this._bulkCopy}
        >
          ${t(this.hass, 'card.btn.copy')}
        </button>
      </div>
    `;
  }

  private _onEntityClick(id: string): void {
    if (this._selectMode) {
      this._toggleSelect(id);
    } else {
      this._openMoreInfo(id);
      this._trackRecent(id);
    }
  }

  private _toggleSelect(id: string): void {
    const next = new Set(this._selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._selected = next;
  }

  private _selectIds(ids: string[]): void {
    const next = new Set(this._selected);
    for (const id of ids) next.add(id);
    this._selected = next;
  }

  private _selectAll(node: TreeNode): void {
    const ids = collectEntities(node).map((n) => n.entityId!);
    this._selectIds(ids);
  }

  private _clearSelection = (): void => {
    this._selected = new Set();
  };

  private _enterSelectMode = (): void => {
    this._selectMode = true;
  };

  private _exitSelectMode = (): void => {
    this._selectMode = false;
    this._selected = new Set();
  };

  private _switchHierarchy(h: HierarchyId): void {
    this._hierarchy = h;
    this._path = [];
  }

  private _onHierarchyChange = (e: Event): void => {
    this._switchHierarchy((e.target as HTMLSelectElement).value as HierarchyId);
  };

  private _onFormatChange = (e: Event): void => {
    this._format = (e.target as HTMLSelectElement).value as CopyFormat;
  };

  private _renderTagPicker(disabled: boolean): TemplateResult | typeof nothing {
    const labels = [...this._labels()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    if (labels.length === 0) return nothing;
    return html`
      <label class="format-pick">
        <select
          class="tag-pick"
          ?disabled=${disabled}
          @change=${this._onTagPickChange}
        >
          <option value="" selected>${t(this.hass, 'card.tag.placeholder')}</option>
          ${labels.map(
            (l) => html`<option value=${l.label_id}>${l.name}</option>`,
          )}
        </select>
      </label>
    `;
  }

  private _onTagPickChange = (e: Event): void => {
    const sel = e.target as HTMLSelectElement;
    const labelId = sel.value;
    sel.value = '';
    if (!labelId) return;
    void this._tagSelectionWithLabel(labelId);
  };

  private async _tagSelectionWithLabel(labelId: string): Promise<void> {
    const ids = [...this._selected];
    if (ids.length === 0) return;
    const labelName =
      this._labels().find((l) => l.label_id === labelId)?.name ?? labelId;
    let updated = 0;
    let failed = 0;
    await Promise.all(
      ids.map(async (entityId) => {
        const reg = this.hass.entities?.[entityId];
        if (!reg) {
          failed++;
          return;
        }
        const existing = reg.labels ?? [];
        if (existing.includes(labelId)) return;
        const nextLabels = [...existing, labelId];
        try {
          await this.hass.callWS({
            type: 'config/entity_registry/update',
            entity_id: entityId,
            labels: nextLabels,
          });
          updated++;
        } catch {
          failed++;
        }
      }),
    );
    if (failed > 0 && updated === 0) {
      this._showToast(t(this.hass, 'card.tag.failed'));
      return;
    }
    if (updated === 0) {
      this._showToast(t(this.hass, 'card.tag.skipped', { label: labelName }));
      return;
    }
    this._showToast(
      tn(this.hass, 'card.tag.success', updated, { label: labelName }),
    );
  }

  private async _bulkCopy(): Promise<void> {
    const ids = [...this._selected].sort();
    if (ids.length === 0) return;
    const text = formatEntities(ids, this._format);
    const ok = await copyText(text);
    if (!ok) {
      this._showToast(t(this.hass, 'card.copy.failed'));
      return;
    }
    this._showToast(
      tn(this.hass, 'card.copy.success', ids.length, {
        format: formatLabel(this.hass, this._format),
      }),
    );
  }

  private _enterGroup(id: string): void {
    this._path = [...this._path, id];
  }

  private _navigateTo(path: string[]): void {
    this._path = path;
  }

  private _onGroupKey(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._enterGroup(id);
    }
  }

  private _onSearch = (e: Event): void => {
    this._search = (e.target as HTMLInputElement).value;
  };

  private _onDiagToggle = (e: Event): void => {
    this._showDiagnostic = (e.target as HTMLInputElement).checked;
  };

  private _onAllToggle = (e: Event): void => {
    this._showAll = (e.target as HTMLInputElement).checked;
    this._path = [];
  };

  private _onEntityLabelsToggle = (e: Event): void => {
    this._showEntityLabels = (e.target as HTMLInputElement).checked;
  };

  private _nodeLabelIds(node: TreeNode): string[] | undefined {
    switch (node.kind) {
      case 'entity':
        return this.hass.entities?.[node.entityId!]?.labels;
      case 'device':
        return this.hass.devices?.[node.id]?.labels;
      case 'area':
        return this.hass.areas?.[node.id]?.labels;
      case 'floor':
        return this.hass.floors?.[node.id]?.labels;
      default:
        return undefined;
    }
  }

  private _resolveLabels(ids: string[] | undefined): LabelRegistryEntry[] {
    if (!ids || ids.length === 0) return [];
    const registry = this._labels();
    const byId = new Map(registry.map((l) => [l.label_id, l]));
    return ids.map(
      (id) => byId.get(id) ?? { label_id: id, name: id },
    );
  }

  private _nodeLabelChips(node: TreeNode): LabelRegistryEntry[] {
    if (!this._showEntityLabels) return [];
    if (this._hierarchy === 'label') return [];
    return this._resolveLabels(this._nodeLabelIds(node));
  }

  private _renderLabelChips(
    chips: LabelRegistryEntry[],
  ): TemplateResult | typeof nothing {
    if (chips.length === 0) return nothing;
    return html`<div class="row-labels">
      ${chips.map(
        (l) => html`<span
          class="entity-label-chip"
          style=${l.color
            ? `background: var(--label-color-${l.color}, var(--${l.color}-color, var(--secondary-background-color)));`
            : ''}
        >
          ${l.icon
            ? html`<ha-icon
                class="entity-label-icon"
                .icon=${l.icon}
              ></ha-icon>`
            : nothing}
          ${l.name}
        </span>`,
      )}
    </div>`;
  }

  private _displayName(id: string): string {
    const entity = this.hass.entities?.[id];
    const stateObj = this.hass.states[id];
    const friendly = stateObj?.attributes?.friendly_name as string | undefined;
    return entity?.name || entity?.original_name || friendly || id;
  }

  private _formatState(stateObj: HassEntityState): string {
    const value = stateObj.state;
    if (value === 'unavailable' || value === 'unknown') return value;
    const unit = stateObj.attributes?.unit_of_measurement;
    return unit ? `${value} ${unit}` : value;
  }

  private _openMoreInfo(entityId: string): void {
    fireEvent(this, 'hass-more-info', { entityId });
  }

  private _onRowKey(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._onEntityClick(id);
    }
  }

  private async _copy(e: Event, id: string): Promise<void> {
    e.stopPropagation();
    const ok = await copyText(id);
    if (!ok) {
      this._showToast('Copy failed');
      return;
    }
    this._copiedId = id;
    this._showToast(`Copied ${id}`);
    this._trackRecent(id);
    window.setTimeout(() => {
      if (this._copiedId === id) this._copiedId = null;
    }, COPY_FEEDBACK_MS);
  }

  private _showToast(msg: string): void {
    this._toast = msg;
    window.setTimeout(() => {
      if (this._toast === msg) this._toast = null;
    }, TOAST_MS);
  }

  private _trackRecent(id: string): void {
    const limit = this._config.recents_limit ?? 10;
    if (limit <= 0) return;
    const next = [id, ...this._recents.filter((x) => x !== id)].slice(0, limit);
    this._recents = next;
    this._saveRecents(next);
  }

  private _recentsKey(): string {
    return (
      RECENTS_STORAGE_PREFIX +
      [...this._config.labels].sort().join(',')
    );
  }

  private _loadRecents(): string[] {
    try {
      const raw = localStorage.getItem(this._recentsKey());
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (Array.isArray(arr))
        return arr.filter((x) => typeof x === 'string');
    } catch {
      // ignore
    }
    return [];
  }

  private _saveRecents(list: string[]): void {
    try {
      localStorage.setItem(this._recentsKey(), JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  static styles = css`
    :host {
      display: block;
    }
    ha-card {
      position: relative;
    }
    .header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 12px 16px 8px;
    }
    .title {
      font-weight: 500;
      font-size: 1.05rem;
      flex: 0 0 auto;
    }
    .selecting {
      color: var(--primary-color);
      font-weight: 400;
    }
    .title-mode {
      color: var(--secondary-text-color);
      font-weight: 400;
    }
    .count {
      color: var(--secondary-text-color);
      font-size: 0.85rem;
      flex: 1 1 auto;
    }
    .header-actions {
      flex: 0 0 auto;
    }
    .hbtn {
      background: none;
      border: 1px solid var(--divider-color);
      color: var(--primary-text-color);
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font: inherit;
      font-size: 0.85rem;
    }
    .hbtn:hover {
      background: var(--secondary-background-color);
    }

    .hierarchy-tabs {
      display: flex;
      gap: 4px;
      padding: 0 16px 8px;
      border-bottom: 1px solid var(--divider-color);
      overflow-x: auto;
    }
    .htab {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--secondary-text-color);
      padding: 6px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 0.85rem;
      white-space: nowrap;
    }
    .htab:hover {
      color: var(--primary-text-color);
    }
    .htab-active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }
    .hierarchy-select {
      display: none;
      margin: 0 16px 8px;
      padding: 6px 8px;
      background: var(--secondary-background-color);
      color: var(--primary-text-color);
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      font: inherit;
    }
    @media (max-width: 480px) {
      .hierarchy-tabs {
        display: none;
      }
      .hierarchy-select {
        display: block;
      }
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px 8px;
    }
    .search {
      flex: 1 1 auto;
      min-width: 0;
      background: var(--secondary-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      padding: 6px 10px;
      color: var(--primary-text-color);
      font: inherit;
    }
    .search:focus {
      outline: none;
      border-color: var(--primary-color);
    }
    .diag-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      font-size: 0.85rem;
      color: var(--secondary-text-color);
      cursor: pointer;
      user-select: none;
    }
    .diag-toggle input {
      accent-color: var(--primary-color);
    }
    @media (max-width: 480px) {
      .filter-row {
        flex-direction: column;
        align-items: stretch;
      }
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      padding: 4px 16px 8px;
      font-size: 0.85rem;
      color: var(--secondary-text-color);
    }
    .crumb {
      background: none;
      border: none;
      padding: 2px 4px;
      color: var(--primary-color);
      cursor: pointer;
      font: inherit;
      border-radius: 3px;
    }
    .crumb:hover {
      background: var(--secondary-background-color);
    }
    .crumb-current {
      color: var(--primary-text-color);
      cursor: default;
    }
    .crumb-current:hover {
      background: none;
    }
    .sep {
      color: var(--secondary-text-color);
    }

    .section-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px 4px;
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      color: var(--secondary-text-color);
    }

    .recents-block {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.06);
      border-bottom: 2px solid var(--divider-color);
    }
    .recents-header {
      color: var(--primary-color);
      cursor: pointer;
      user-select: none;
    }
    .recents-header:hover {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.08);
    }
    .recents-header:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: -2px;
    }
    .recents-chevron {
      --mdc-icon-size: 18px;
      transition: transform 0.15s ease;
      color: var(--primary-color);
    }
    .recents-chevron.expanded {
      transform: rotate(180deg);
    }
    .recents-title {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .recents-title ha-icon {
      --mdc-icon-size: 14px;
    }
    .recents-block .row:hover {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.14);
    }
    .recents-block .row {
      border-top-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12);
    }
    .section-label .actions {
      display: flex;
      gap: 8px;
      letter-spacing: 0;
    }
    .link-btn {
      background: none;
      border: none;
      color: var(--primary-color);
      cursor: pointer;
      font: inherit;
      font-size: 0.78rem;
      padding: 0;
      letter-spacing: 0;
    }
    .link-btn:hover {
      text-decoration: underline;
    }

    .empty {
      padding: 16px;
      color: var(--secondary-text-color);
    }
    .list {
      display: flex;
      flex-direction: column;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 8px 8px 16px;
      border-top: 1px solid var(--divider-color);
      cursor: pointer;
    }
    .row:hover {
      background: var(--secondary-background-color);
    }
    .row:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: -2px;
    }
    .row-selected {
      background: rgba(3, 169, 244, 0.08);
    }
    .row-check {
      flex: 0 0 auto;
      accent-color: var(--primary-color);
    }
    .row-main {
      flex: 1 1 auto;
      min-width: 0;
    }
    .row-name {
      color: var(--primary-text-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row-id {
      color: var(--secondary-text-color);
      font-size: 0.78rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row-labels {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .entity-label-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--secondary-background-color);
      color: var(--primary-text-color);
      border: 1px solid var(--divider-color);
      border-radius: 10px;
      padding: 1px 8px;
      font-size: 0.72rem;
      line-height: 1.4;
    }
    .entity-label-icon {
      --mdc-icon-size: 12px;
    }
    .row-state {
      flex: 0 0 auto;
      color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums;
    }
    .copy {
      flex: 0 0 auto;
      --mdc-icon-button-size: 36px;
      --mdc-icon-size: 20px;
      color: var(--secondary-text-color);
    }
    .chevron {
      flex: 0 0 auto;
      --mdc-icon-size: 20px;
      color: var(--secondary-text-color);
      margin-right: 8px;
    }

    .bottom-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-top: 1px solid var(--divider-color);
      background: var(--secondary-background-color);
    }
    .count-summary {
      flex: 1 1 auto;
      color: var(--secondary-text-color);
      font-size: 0.9rem;
    }
    .format-pick {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: var(--secondary-text-color);
    }
    .format-pick select {
      background: var(--card-background-color);
      color: var(--primary-text-color);
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      padding: 4px 6px;
      font: inherit;
    }
    .copy-btn {
      background: var(--primary-color);
      color: var(--text-primary-color, white);
      border: none;
      border-radius: 4px;
      padding: 6px 14px;
      cursor: pointer;
      font: inherit;
      font-size: 0.9rem;
    }
    .copy-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .toast {
      position: absolute;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      background: var(--primary-text-color);
      color: var(--card-background-color);
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.85rem;
      box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.2));
      pointer-events: none;
      animation: toast-in 0.15s ease-out;
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
}

(window as unknown as { customCards?: unknown[] }).customCards =
  (window as unknown as { customCards?: unknown[] }).customCards || [];
(window as unknown as { customCards: unknown[] }).customCards.push({
  type: CARD_TAG,
  name: CARD_NAME,
  description: 'Browse and pick entities by label, with switchable hierarchies and bulk copy.',
  preview: true,
  documentationURL: 'https://github.com/x-ian/advanced-entity-selector-card',
});

console.info(
  `%c ${CARD_NAME} %c ${VERSION} `,
  'color:white;background:#3f51b5;padding:2px 6px;border-radius:3px 0 0 3px;',
  'color:white;background:#555;padding:2px 6px;border-radius:0 3px 3px 0;',
);
