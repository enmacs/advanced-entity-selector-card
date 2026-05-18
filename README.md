# Advanced Entity Selector Card

Custom Lovelace card for Home Assistant. Browses entities tagged with one or more labels via switchable hierarchies (Floor·Area·Device, Domain·Class, Label, Integration·Device). Supports drill-down navigation, multi-select with bulk copy, and per-entity copy-to-clipboard.

## Status

Early development.

## Build

```shell
npm install
npm run build
```

Output: `dist/advanced-entity-selector.js`.

## Card config

```yaml
type: custom:advanced-entity-selector
title: Advanced Entity Selector
labels: [advanced-entity-selector]
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
