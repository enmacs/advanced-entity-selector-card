# Eine neue Home-Assistant-Karte für alle, die viele Entitäten verwalten

Home Assistant glänzt darin, eine wachsende Zahl an Entitäten einzusammeln — aber sobald man fünfzig, hundert oder mehr davon im Alltag verwendet, fängt die UI an, im Weg zu stehen. Die Developer Tools sind ein Such-Werkzeug für Einzelfälle, nicht für kuratiertes Arbeiten an einer Teilmenge. Genau diese Lücke schließt unsere **Advanced Entity Selector Card**: Man definiert eine Arbeitsmenge über Home-Assistant-Labels (z.B. *küchen-relevant*, *gäste-modus*, *wichtig*) und bekommt eine fokussierte Browser-Oberfläche auf dem Dashboard — mit Breadcrumb-Navigation, Volltextsuche über Name, ID, Bereich, Stockwerk, Gerät und Label, und vier umschaltbaren Gruppierungen über demselben Datensatz.

![Hierarchische Ansicht: Stockwerk- und Bereichs-Navigation mit Breadcrumb, Suchfeld und Bulk-Copy-Footer](docs/screenshot.png)

Der Auslöser für die Entwicklung war ein konkretes Reibungsmoment beim Dashboard-Bau: Entitäts-IDs für `entities:`-Blöcke zusammenzustellen, ohne ständig zwischen Tabs zu wechseln. Die Karte beantwortet das mit einer Mehrfachauswahl, die direkt in CSV, YAML-Liste oder JSON-Array kopiert. Daraus ergaben sich weitere Workflows fast von selbst — Bulk-Tagging einer Auswahl mit einem bestehenden Label, eine Recents-Liste pro Label-Set, ein visueller Editor für die Konfiguration. Die Karte verfügt über keine Schreibrechte außerhalb von Labels; alle Entitäts- und Geräteinformationen kommen über die offizielle Home-Assistant-WebSocket-API.

![Mehrfachauswahl mit ausgewählten Entitäten, ausgewähltem Format "YAML list" und Copy-Button bereit zum Übernehmen in den Dashboard-YAML](docs/screenshot-multiselect.png)

Die Karte ist als TypeScript/Lit-Komponente gebaut, kompiliert zu einer einzelnen JS-Datei und wird über HACS verteilt (`enmacs/advanced-entity-selector-card`, Kategorie *Dashboard*). UI in Deutsch und Englisch, automatisch nach HA-Locale. Quellcode unter MIT-Lizenz auf GitHub — Issues und Pull Requests willkommen.
