# DeBridge UI (Next.js Application)

This package contains the monitoring dashboard interface, featuring transaction data visualization using ECharts.

## 🚀 Quick Start

### 1. Environment Variables
Create a `.env` file in the root of this directory (`packages/ui/.env`):

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"
```

### 2. Installation & Client Generation

Ensure the Prisma client is generated to provide proper typing and database access:

```bash
# From the monorepo root
cd packages/shared
yarn run prisma-gen

```

### 3. Development Mode

```bash
# inside ui folder
yarn run dev

```

The application will be available at [http://localhost:3000](http://localhost:3000).

---

## 🏗 Production Build

To deploy the application, you must first build the optimized production bundle:

```bash
# 1. Build the project
yarn run build

# 2. Start the production server
yarn run start

```

## 🛠 Tech Stack

* **Framework:** Next.js (App Router)
* **Visualization:** Apache ECharts (via `echarts-for-react`)
* **Database:** Prisma ORM
* **Validation:** Zod (for URL search parameters)
* **Styling:** Tailwind CSS

---

## 📈 Chart Implementation Details

To ensure accurate visualization when dealing with high-variance data (e.g., Source volume = 60 vs. Destination volume = 0.0002), this application utilizes:

* **Dual Y-Axis:** Independent scales for Source and Destination to prevent small values from appearing as flat lines.
* **Scale Optimization:** The `scale: true` property is enabled on Y-axes to focus on data ranges rather than starting from zero.
* **Force Dynamic Rendering:** The main dashboard uses `export const dynamic = 'force-dynamic'` to ensure data is fetched fresh from the database on every request, bypassing static caching.

## 🔍 Linting & Type Checking

To verify code quality and TypeScript integrity before deployment, run:

```bash
yarn run lint

```

This ensures all ESLint rules are followed and no "implicit any" types exist in the codebase.

### Key Tips included:

* **Dual Y-Axis info:** Explains why the chart doesn't look flat.
* **Force Dynamic:** Explains why the dashboard updates in real-time.
* **Database URL:** Highlights the importance of the `.env` file for the Prisma client.
