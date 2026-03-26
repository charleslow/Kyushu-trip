# Change Request: Migrate App to JSON-based Itinerary

## Context

The itinerary data is currently hardcoded in `client/src/lib/itineraryData.ts` (~830 lines). We now have a structured `data/itinerary.json` parsed from the raw itinerary, organized by day and period (morning, midday, afternoon, evening) with places, options, and notes.

The goal is to make the app driven by `itinerary.json` instead of the hardcoded TypeScript data.

## Schema Overview (`data/itinerary_schema.json`)

```
days[]
  ├── day, date, dayOfWeek
  └── periods[] (morning | midday | afternoon | evening)
        ├── items[] (place or option)
        │     place: { name, description }
        │     option: { options: [{ name, description }] }
        └── notes[] (strings, displayed together)
```

## What Needs to Change

### 1. Enrich the JSON schema with map data

Each **place** needs:
- `lat`, `lng` — required for map markers
- `category` — one of: `nature | culture | food | kids | transport | accommodation | hike`
  - Used for marker color, emoji, and category filtering

Each **day** needs:
- `title` — e.g. "Arrival at Kansai"
- `subtitle` — e.g. "Landing & settling in at Rinku Town"
- `region` — e.g. "Osaka / Rinku Town"
- `mapCenter` — `{ lat, lng }` for the default map view
- `mapZoom` — default zoom level

**Consideration:** These could live in the JSON itself (simpler) or in a separate enrichment file (more maintainable if the itinerary text changes often). Recommend putting it all in one JSON for now since this is a personal trip planner, not a production system.

### 2. Update the data layer

- `client/src/lib/itineraryData.ts` currently exports hardcoded data + types + category constants
- Should be refactored to:
  - Import from `itinerary.json` (or a bundled copy)
  - Export updated TypeScript types matching the new schema
  - Keep exporting `categoryColors`, `categoryLabels`, `categoryEmoji` (these are display constants, not data)

### 3. Update the UI to show periods

Currently `Home.tsx` renders a **flat list of locations** per day. Needs to change to:

- **Group by period** (morning, midday, afternoon, evening) with period headers
- **Render places** as clickable items (same as today — tap to see on map)
- **Render options** as a grouped choice (e.g. "Soba Dojo OR Hachoume Shokudou") — each option should still be a mappable place
- **Render notes** together at the bottom of each period (e.g. in a subtle callout or list)

### 4. Handle empty periods

Some periods have no items and no notes (e.g. Day 4 free morning). Options:
- Skip rendering empty periods entirely
- Show them with a "Free time" indicator

Recommend skipping empty periods to keep the UI clean.

### 5. Day-level content

Currently each day has `tips` and `highlights[]` shown in the UI. Options:
- Add these to the JSON schema
- Generate them from the period data
- Remove them (they were LLM-generated filler anyway)

Recommend removing `tips` and `highlights` for now — the period-based view with notes gives enough context.

## Migration Steps

1. Extend `itinerary_schema.json` with the additional fields (lat/lng, category, day metadata)
2. Enrich `itinerary.json` with coordinates, categories, and day metadata (can use LLM + manual verification)
3. Update TypeScript types in `itineraryData.ts`
4. Update `Home.tsx` to render periods instead of flat location list
5. Remove the old hardcoded itinerary data
6. Test on mobile and desktop layouts
