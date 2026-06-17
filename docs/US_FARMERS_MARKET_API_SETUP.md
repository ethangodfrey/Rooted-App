# US Farmers Market API — Local Setup (Windows + Rooted)

Third-party service: [tylerpporter/usfarmersmarketapi](https://github.com/tylerpporter/usfarmersmarketapi) — Ruby on Rails GraphQL API with USDA farmers market data in PostgreSQL.

**Runs separately from Rooted** (mobile + NestJS backend). Typical layout:

```
Desktop/
├── Rooted/                    ← your Expo + Supabase app (this repo)
└── usfarmersmarketapi/        ← clone the Rails API here (sibling folder)
```

GraphiQL: `http://localhost:3000/graphiql`

---

## Prerequisites (install once)

Ruby **2.5.3** and Rails **5.2.4** are old (2020). On **Windows**, use **WSL2 (Ubuntu)** — native Windows Ruby for 2.5.3 is unreliable.

### Option A — WSL2 (recommended on Windows)

1. **Enable WSL2** (PowerShell as Administrator):
   ```powershell
   wsl --install
   ```
   Reboot if prompted. Open **Ubuntu** from Start.

2. **Inside Ubuntu**, install build tools + PostgreSQL:
   ```bash
   sudo apt update
   sudo apt install -y build-essential libpq-dev postgresql postgresql-contrib git curl libssl-dev libreadline-dev zlib1g-dev
   sudo service postgresql start
   ```

3. **Install rbenv + Ruby 2.5.3**:
   ```bash
   curl -fsSL https://github.com/rbenv/rbenv-installer/raw/HEAD/bin/rbenv-installer | bash
   echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
   echo 'eval "$(rbenv init -)"' >> ~/.bashrc
   source ~/.bashrc
   rbenv install 2.5.3
   rbenv global 2.5.3
   ruby -v   # should show 2.5.3
   gem install bundler -v 2.3.26
   gem install rails -v 5.2.4
   ```

4. **PostgreSQL user** (Ubuntu default):
   ```bash
   sudo -u postgres createuser -s "$USER" 2>/dev/null || true
   ```

### Option B — macOS (if you switch machines)

```bash
brew install postgresql@14 rbenv
brew services start postgresql@14
rbenv install 2.5.3
rbenv global 2.5.3
gem install bundler rails -v 5.2.4
```

---

## Step-by-step: run the API

Do these in **WSL Ubuntu** (or Mac terminal), not necessarily inside `Rooted/`.

### Step 1 — Clone the repo

```bash
cd ~
git clone https://github.com/tylerpporter/usfarmersmarketapi.git
cd usfarmersmarketapi
```

If clone fails (404/private), get the repo URL from whoever shared the guide or use your fork.

### Step 2 — Open in Cursor

From Windows:

```powershell
cursor "\\wsl$\Ubuntu\home\<your-username>\usfarmersmarketapi"
```

Or in WSL:

```bash
cd ~/usfarmersmarketapi
cursor .
```

(`cursor` CLI must be on PATH — install from Cursor → Command Palette → “Shell Command: Install 'cursor' command”.)

### Step 3 — Install Ruby gems

In Cursor terminal (WSL):

```bash
cd ~/usfarmersmarketapi
bundle install
```

**If `pg` gem fails:** `sudo apt install libpq-dev` and retry.

**If Bundler version errors:**

```bash
gem install bundler -v "$(grep -A1 'BUNDLED WITH' Gemfile.lock | tail -1 | tr -d ' ')"
bundle install
```

### Step 4 — Create and migrate the database

```bash
rails db:create
rails db:migrate
```

**If `database does not exist`:** ensure PostgreSQL is running:

```bash
sudo service postgresql start
```

Check `config/database.yml` — default is often local PostgreSQL with your Linux username and no password.

### Step 5 — Seed USDA market data (several minutes)

```bash
rake db:seed:from_csv
```

This imports CSV market files. Wait until it finishes — thousands of rows is normal.

### Step 6 — Start the server

```bash
rails s
```

Server listens on **port 3000**.

### Step 7 — Test in GraphiQL

On your Windows browser:

**http://localhost:3000/graphiql**

Example query:

```graphql
{
  marketsByCity(city: "Denver") {
    id
    marketName
    street
    city
    state
    zip
  }
}
```

Click the play button. You should see Denver-area markets.

### Step 8 — Run tests (optional)

```bash
bundle exec rspec
```

---

## Quick reference: GraphQL queries

| Query | Description |
|-------|-------------|
| `allMarkets` | All farmers markets |
| `market` | Single market by ID |
| `marketsByCoords` | Filter by latitude/longitude |
| `marketsByCity` | Filter by city name |
| `marketsByDate` | Filter by operating date |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ruby: command not found` | Run `rbenv global 2.5.3` and `source ~/.bashrc` |
| Wrong Ruby version | `cd` into project; check `.ruby-version` file |
| `pg` gem won't compile | `sudo apt install libpq-dev postgresql-server-dev-all` |
| `database does not exist` | `rails db:create` then `rails db:migrate` |
| Seed runs forever | Normal for full CSV import |
| Port 3000 in use | `rails s -p 3001` and use `http://localhost:3001/graphiql` |
| Modern Ruby/Rails breaks app | Stay on 2.5.3 / 5.2.4 per `.ruby-version` and Gemfile |

---

## How this relates to Rooted

| Piece | Role |
|-------|------|
| **usfarmersmarketapi** (port 3000) | GraphQL source for USDA market listings |
| **Rooted mobile** | Reads events from **Supabase**, not Rails directly |
| **scripts/seedMarkets.ts** | Alternative: USDA REST API → `market-seed-data.json` (uses `USDA_API_KEY`) |

**Today:** Rooted uses Supabase `events` (see `docs/supabase/phase5_seed_all_states_events.sql` for placeholder data).

**Later:** You can add a sync job that queries `marketsByCity` / `marketsByCoords` from this Rails API and upserts into Supabase `events` — or use `seedMarkets.ts` + import JSON. Pick one data pipeline to avoid duplication.

---

## Daily dev workflow

Terminal 1 — Farmers Market API (WSL):

```bash
cd ~/usfarmersmarketapi
sudo service postgresql start
rails s
```

Terminal 2 — Rooted mobile:

```powershell
cd C:\Users\ethan\OneDrive\Desktop\Rooted\mobile
npx expo start
```

Terminal 3 — Rooted backend (if needed for POS):

```powershell
cd C:\Users\ethan\OneDrive\Desktop\Rooted\backend
npm run start:dev
```

---

## USDA API key (Rooted script — separate path)

If you use Rooted’s **REST** seed instead of the Rails app, put the key in:

`C:\Users\ethan\OneDrive\Desktop\Rooted\.env`

```env
USDA_API_KEY=your_key_here
```

Then:

```powershell
cd C:\Users\ethan\OneDrive\Desktop\Rooted
$env:USDA_API_KEY="your_key_here"
npx tsx scripts/seedMarkets.ts
```

That path does **not** require Ruby/Rails.
