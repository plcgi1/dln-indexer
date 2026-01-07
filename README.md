# deBridge DLN Indexer & Monitoring Dashboard

This project is a high-performance monorepo designed to index, process, and visualize **deBridge DLN** (Destination Liquidity Network) cross-chain transactions on Solana. It tracks `CreateOrder` (Source) and `FulfillOrder` (Destination) events, calculates financial data, and exposes real-time metrics for monitoring.

---

## 🏗 Architecture Overview

The system is built as a **Yarn Workspaces** monorepo running on **Node.js 22**:

* **`packages/shared`**: The core domain layer containing the Prisma schema, shared TypeScript types, and database utilities.
* **`packages/indexer`**:
* **Indexer Service**: Scans the Solana blockchain for specific DLN contract interactions and saves raw transaction data.
* **Processor Service**: Extracts trade details from raw logs and calculates USD volume.


* **`packages/ui`**: A **Next.js 15+** dashboard for visualizing processed data and system health.

---

## 💰 USD Pricing & Caching Strategy

The `PriceService` handles the conversion of transaction amounts into USD using a robust caching mechanism to ensure performance and stay within API limits:

* **Database Cache**: Before calling external APIs, the service checks the `tokenPrice` table for an existing entry for the specific token.
* **15-Minute TTL**: Cached prices are considered valid if they were updated within the last **15 minutes**.
* **Jupiter V3 API**: If the cache is missing or expired, the service fetches the latest price from the **Jupiter V3 API** using a secure API key.
* **Automatic Updates**: New prices are automatically saved back to the database with a fresh timestamp.

---

## 📦 Local Development Commands

### `packages/shared`

* `yarn run prisma-gen`: Generates the Prisma Client.
* `yarn run prisma-push`: Syncs the DB structure without migrations.
* `yarn build`: Compiles the shared package.

### `packages/indexer`

* `yarn run indexer`: Launches the Solana blockchain scanner.
* `yarn run processor`: Launches the data extraction and pricing service.
* `yarn build`: Compiles using `tsc-alias` to resolve path mappings.
* `yarn test`: Runs the test suite (clears the `prom-client` registry before each test).

### `packages/ui`

* `yarn run dev`: Starts Next.js in development mode.
* `yarn run build && yarn run start`: Production build and launch.

---

## 📊 Monitoring

* **Prometheus**: Scrapes metrics from the Indexer and Processor (e.g., `processor_processed_tasks_total`, `indexer_last_slot`)

## вариант от ИИ

# DLN Order Indexer (Solana)

Производственное решение для индексации и агрегации событий DLN (deBridge Liquidity Network).

## 🚀 Архитектурные решения



### 3. Обработка кроссчейн данных

Поскольку DLN — межсетевой протокол, парсер учитывает:


## 🛠 Технологический стек

* **Runtime:** Node.js / TypeScript
* **Parser:** Borsh, js-sha256, keccak256
* **Database:** [Твой выбор]
* **Dashboard:** [React / Grafana / Next.js]

## 📋 Инструкция по запуску

1. `npm install`
2. Настройка окружения в `.env` (RPC URL, DB_URL)
3. `npm run migrate` — создание таблиц
4. `npm run index` — запуск процесса сбора 50,000 ордеров
5. `npm run dashboard` — запуск визуализации

---

### Почему это решение "Ideal"?

1. **Separation of Concerns:** Парсинг, хранение и визуализация разделены на независимые модули.
2. **Restart-safe:** Индексатор сохраняет `last_signature` и продолжает работу с места остановки при перезапуске.
3. **Reproducible:** При наличии того же RPC и IDL, любой разработчик получит идентичный набор данных.

---

### Советы по "Improvement list" (Опционально):

В конце README добавь раздел *"Что бы я улучшил, будь у меня больше времени"*:

* Использование **Geyser Plugin** для прямой трансляции данных из Solana Node в БД (минуя RPC).
* Добавление **OpenTelemetry** для мониторинга здоровья индексатора.
* Покрытие парсера **Property-based тестами** для проверки экстремально больших сумм и редких типов адресов.

С такой структурой ты показываешь, что не просто "сделал задачу", а спроектировал систему. Готов переходить к реализации дашборда или агрегации цен?

## накачка базы в 25000 для OrderCreated и FullfillOrder

```
npm run fill-ordercreated    
npm run fill-orderfullfilled    
```

## Local setup

1. database postgres

    https://github.com/snowplow/snowplow/wiki/Setting-up-PostgreSQL#ec2

    connect to DB
    ```
        -- init.sql
        CREATE USER indexer WITH PASSWORD '123test';
        ALTER USER indexer WITH SUPERUSER;
        ALTER ROLE indexer CREATEROLE CREATEDB;
        
        CREATE DATABASE indexer_db;
        GRANT ALL PRIVILEGES ON DATABASE indexer_db to indexer;
        ...
        
        psql -U posgres postgres < ./init.sql 
    ```
    
```
src/
├── common/
│   ├── db/
│   │   ├── database.ts
│   │   └── models/          # Или schema.prisma, если используешь Prisma
│   ├── abis/                # Файлы IDL (JSON) для deBridge программ
│   │   └── dln_solana.json
│   ├── types/               # Общие интерфейсы для ордеров и эвентов
│   └── utils/
│       └── borsh-parser.ts  # Вынесенная логика низкоуровневого декодирования
│
├── indexer/
│   ├── transport/           # Логика работы с RPC/Helius (ретраи, пагинация)
│   └── indexer.ts           # Координатор: Fetch -> Save raw
│
├── processor/
│   ├── decoders/            # Специфичные парсеры для OrderCreated/OrderFulfilled
│   └── processor.ts         # Координатор: Load raw -> Decode -> Upsert
│
├── volumer/                 # (Новый воркер) Расчет цен и агрегация
│   ├── price-provider/      # Интеграция с внешними API (CoinGecko/Birdeye)
│   └── volumer.ts
│
├── ui/                 # NestJS App

```

### подсказки для объяснения

Для контракта solana хранит 100000 записей - иначе нужно использовать специализированные сервсиы