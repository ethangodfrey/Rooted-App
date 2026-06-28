# Agent workflow

## Priority order (each run)

1. Broken UX — map pins, market links, auth spinners, role routing
2. Data quality — schedules, dead links, market classification
3. TypeScript / build gates — `web`: `npm run build`, `mobile`: `npx tsc --noEmit`, `backend`: `npm run build`
4. Small safe improvements — performance, copy, null checks

## Code change rules

- Match existing style; **minimal diffs**
- No force-push, no amend of pushed commits, **no secrets in git**
- Only create commits when the user explicitly asks
- End every run with: what you checked, what changed, commands run, what to do next

## Verification commands

```powershell
# Web
cd web; npm run build

# Mobile
cd mobile; npx tsc --noEmit

# Backend
cd backend; npm run build

# Market data (repo root)
npm run markets:dedupe
npm run markets:classify -- --limit 5
```
