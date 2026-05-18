# Advanced Entity Selector Card

Browse entities tagged with one or more labels through switchable hierarchies — Floor·Area·Device, Domain·Class, Label, or Integration·Device. Drill down with a breadcrumb, search across the full working set, copy single entity IDs, or multi-select and bulk-copy as CSV, YAML list, or JSON array.

## Features

- Switchable hierarchies over the same label-scoped entity set
- Drill-down with breadcrumb navigation
- Search across the working set (name, entity_id, area, floor, device, labels)
- Multi-select with bulk copy (CSV / YAML list / JSON array)
- Per-entity copy-to-clipboard
- Recents shortcut, persisted per label set

## Minimal config

```yaml
type: custom:advanced-entity-selector
labels: [my-label]
```

## Full config

```yaml
type: custom:advanced-entity-selector
title: Advanced Entity Selector
labels: [my-label]
hierarchies:
  - floor_area_device
  - domain_class
  - label
  - integration_device
default_hierarchy: floor_area_device
show_diagnostic: false
show_state: true
recents_limit: 10
```

## Status

Early development.
