# 💰 Budget For Dummies (Technical Deep Dive)

> "A serverless, dual-AI pipeline for high-precision expense tracking on the edge."

**Budget For Dummies** is a high-performance Telegram bot built on **Cloudflare Workers** that ingests natural language messages, rigorously sanitizes and validates them, and employs a multi-stage AI pipeline to extract structured expense data. It leverages **Google Gemini 2.5 Flash Lite** for semantic classification and **Meta Llama 3.2 1B** (running on Cloudflare Workers AI) for entity extraction, ensuring strict separation of personal specific expenses from general chatter.

---

## 🏗 System Architecture

The system operates as a stateless event-driven architecture triggered by Telegram webhooks.

```mermaid
graph TD
    User[User (Telegram)] -->|POST Payload| Gateway[Cloudflare Worker]
    Gateway -->|Auth & Validation| Sanitizer[Sanitization Layer]
    Sanitizer -->|Heuristic Regex| Signal[Signal Detector]
    Signal -->|Prompt Engineering| Gemini[Gemini 2.5 Flash Lite\n(Sentiment/Classification)]
    Gemini -->|JSON Schema| Llama[Llama 3.2 1B Instruct\n(Entity Extraction)]
    Llama -->|SQL| D1[(Cloudflare D1 Database)]
    D1 -->|Confirmation| User
```

---

## 🔧 Technical Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) (V8 Isolate)
- **Language**: TypeScript throughout
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless SQLite)
- **AI Model 1 (Classification)**: `gemini-2.5-flash-lite` (via `@google/genai` SDK)
- **AI Model 2 (Extraction)**: `@cf/meta/llama-3.2-1b-instruct` (via Workers AI Binding)
- **Time/Date**: `moment.js` for locale-aware parsing
- **Package Manager**: NPM / Wrangler

---

## ⚙️ Processing Pipeline

### 1. Security & Validation Layer
Incoming webhooks undergo strict verification before processing:
- **Method Check**: Only `POST` allowed.
- **Replay Attack Prevention**: Rejects requests older than 5 minutes via `x-custom-request-sent-time`.
- **Identity Verification**:
  - `x-custom-client-id` vs `GATEWAY_SERVICE_CALL_TOKEN` (Shared Secret).
  - `message.from.id` vs `TELEGRAM_VALID_FROM_ID` (User Whitelist).
- **Constant-Time Comparison**: Uses `crypto.timingSafeEqual` (via wrapper) to prevent timing attacks on token validation.

### 2. Input Sanitization
Raw text is normalized to prevent injection and reduce noise:
- **Length Constraints**: 10 - 300 characters.
- **Word Limit**: Max 25 words (prevents "trauma dumps" or irrelevant stories).
- **Character Set**: Must contain mixed alphanumeric chars.
- **Blacklist**: HTML tags and dangerous special characters are rejected.

### 3. Heuristic Signal Detection (Pre-filter)
To save AI inference costs, a Regex-based engine filters out obvious non-expenses. It scans for:
- **Currency Symbols/Codes**: `₹`, `$`, `INR`, `USD`, `Rs.`
- **Amounts**: Numeric values with optional decimal precision.
- **Expense Verbs**: `spent`, `paid`, `bought`, `ordered`, etc.
- **Temporal Markers**: ISO dates or natural language time formats.
- **Merchants**: Capitalized patterns after prepositions (`at`, `from`, `via`).

**Exit Condition**: If specific combinations (e.g., No Number AND No Currency) are missing, the pipeline aborts early with a guidance message.

### 4. Semantic Classification (Gemini 2.5)
Confirmed signals are sent to **Gemini 2.5 Flash Lite** with a temperature of `0.0`.
- **Goal**: Determinate if the expense is **PERSONAL** vs. Third-Party/Income/General Fact.
- **Prompt**: Uses "Journal Assumption" logic (implied first-person).
- **Threshold**: Scores below `SENTIMENT_CONFIDENT_THRESHOLD` (default 0.90) are rejected.

### 5. Entity Extraction (Llama 3.2)
Valid personal expenses are processed by **Llama 3.2 1B Instruct** using Few-Shot Learning.
- **Output**: JSON Object.
- **Schema**:
  ```typescript
  {
    amount: number;       // Extracted amount
    category: string;     // Normalized (e.g., 'food', 'transport')
    description: string;  // Inferred context
    date: string;         // YYYY-MM-DD (Defaults to Today)
    time: string;         // HH:MM (Defaults to Now)
    merchant: string;     // Extracted vendor name
  }
  ```
- **Context injection**: The system prompt is dynamically injected with the current Date (`moment().format('ll')`), Time, and allowed Categories.

---

## 🗄️ Database Schema (D1)

Data is persisted in a strictly typed SQLite table `expenses`.

```sql
CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    description TEXT,
    date TEXT,
    time TEXT,
    merchant TEXT,
    platform TEXT DEFAULT 'Telegram',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## � Setup & Configuration

### Prerequisites
- Node.js v18+
- Wrangler CLI (`npm i -g wrangler`)
- A Cloudflare account with Workers and D1 enabled.
- Google AI Studio API Key.

### Environment Variables (`.dev.vars`)
Create a `.dev.vars` file for local testing (never commit):

```ini
# Authentication
GATEWAY_SERVICE_CALL_TOKEN="<your_secret_token>"
TELEGRAM_VALID_FROM_ID="<your_telegram_user_id>"

# AI Configuration
GOOGLE_GEMINI_API_KEY="<your_gemini_key>"
SENTIMENT_CONFIDENT_THRESHOLD="0.90"

# Business Logic
EXPENSE_CATEGORIES="food,travel,bills,shopping,entertainment,health,misc"
```

### Wrangler Config (`wrangler.jsonc`)
Ensure your bindings match the code:

```jsonc
{
  "name": "budget-for-dummies",
  "d1_databases": [
    {
      "binding": "budget_db",
      "database_name": "budget-db",
      "database_id": "<ID>"
    }
  ],
  "ai": {
    "binding": "AI"
  }
}
```

### Database Migration
Initialize the schema locally or in production:

```bash
# Local
npx wrangler d1 execute budget-db --local --file=./src/db/schema.sql

# Remote
npx wrangler d1 execute budget-db --remote --file=./src/db/schema.sql
```

---

## 🧪 Development

### Run Locally
Starts the worker on `localhost:8787`.

```bash
npm run dev
```

### Deployment
Deploys to the Cloudflare network.

```bash
npm run deploy
```

---

## � License
MIT © 2024
