# Markets data quality

## Source of truth

Markets/events live in Supabase `events` table — seeded via USDA/OSM pipelines in `scripts/` and enriched by backend agents.

## Dedupe rule

Dedupe by **normalized name + city + state**. Use `npm run markets:dedupe` (backend script via root package.json).

## Enrichment and classification

```powershell
npm run markets:links          # fix dead links
npm run markets:classify -- --limit 5
npm run markets:enrich --prefix backend
npm run markets:fix-times --prefix backend
```

Backend agents (`MARKETS_AGENT_ENABLED`, OpenAI) are off by default in production unless explicitly enabled.

## Schedules

Market hours/timezones: `backend/src/modules/markets/market-schedule.util.ts`. Calendar UI must filter by date (`event-day-filter.ts` on web).

## Images

Prefer free sources (Commons, website og:image). Google Places is optional fallback — costs money. Vision verification via OpenAI when enabled.
