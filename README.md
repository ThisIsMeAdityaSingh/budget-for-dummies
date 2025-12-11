# 💰 Budget For Dummies

> "Because spending money is easy, but remembering where it went is hard."

A robust, AI-powered expense tracking bot built on **Cloudflare Workers**. It intercepts natural language messages from Telegram, validates them using multi-stage AI pipelines, and securely stores structured expense data in a **Cloudflare D1** database.

---

## ✨ Features

### 🛡️ Security & Validation
- **Time-Safe Authentication**: Protects the webhook endpoint using `crypto.timingSafeEqual` with a shared secret token.
- **Request Validation**: Enforces strict timestamp checks (replay attack prevention) and verifies Telegram user identity.
- **Sanitization**: Inputs are heavily sanitized to prevent injection attacks and ensure data integrity.

### 🧠 Intelligent Processing
- **Signal Detection**: Heuristic algorithms instantly filter out non-expense messages (e.g., "Hi", "Good morning") to save AI costs.
- **Sentiment Analysis v2.5**: Powered by **Google Gemini 2.5 Flash Lite**. It uses a principle-based prompt to strictly classify personal expenses, filtering out third-party spending, income, or general facts.
- **LLM Extraction**: Uses **Meta Llama 3.2 1B Instruct** (via Cloudflare Workers AI) to extract structured data:
  - `amount` (Number)
  - `category` (String - normalized)
  - `description` (String - inferred)
  - `merchant` (String - branding detection)
  - `date` & `time` (ISO formats)

### 💾 Persistence & Feedback
- **D1 Database**: Serverless SQL storage for high-performance and low latency.
- **Instant Feedback**: Sends formatted confirmations back to Telegram using Markdown V2.
- **Error Handling**: Graceful error messages guide the user (e.g., "Try: Lunch 150 at Dominos").

---

## 🏗️ Architecture Flow

1. **Telegram Webhook**: User sends "Spent 121 buying milk from flipkart".
2. **Gateway**: Worker receives POST request, validates headers & token.
3. **Signal Detector**: Checks for money/currency patterns and expense verbs.
4. **Sentiment Analysis**: Gemini assesses if it's a *personal* expense (Score > 0.85).
5. **Extraction**: Llama 3.2 extracts `{ amount: 121, merchant: "flipkart", ... }`.
6. **Database**: SQL `INSERT` into `expenses` table.
7. **Response**: User gets "✅ Logged 121 (groceries) for milk...".

---

## 📦 Prerequisites

- **Node.js**: v18.x or later
- **Cloudflare Account**: With Workers and D1 active
- **Telegram Bot**: Created via BotFather
- **Google AI Studio Key**: For Gemini models
- **Wrangler CLI**: `npm install -g wrangler`

---

## 🛠️ Configuration

Create a `.dev.vars` file for local development (do not commit this):

```ini
# Security
GATEWAY_SERVICE_CALL_TOKEN=your-super-secret-token

# AI Services
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
SENTIMENT_CONFIDENT_THRESHOLD=0.85

# Telegram
TELEGRAM_VALID_FROM_ID=123456789 (Your numeric User ID)

# Application
EXPENSE_CATEGORIES=food,transport,shopping,bills,entertainment,misc
```

### Wrangler Configuration (`wrangler.jsonc`)

Ensure your D1 database is bound:

```jsonc
{
  "d1_databases": [
    {
      "binding": "budget_db",
      "database_name": "budget-db",
      "database_id": "your-d1-uuid"
    }
  ],
  "ai": {
    "binding": "AI"
  }
}
```

---

## 🚀 Setup & Deployment

### 1. Installation

```bash
git clone https://github.com/your-username/budget-for-dummies.git
cd budget-for-dummies
npm install
```

### 2. Database Migration

Initialize your D1 database schema:

```bash
npx wrangler d1 execute budget-db --local --file=./src/db/schema.sql
```

### 3. Local Development

Run the worker locally. It will start a server at `http://localhost:8787`.

```bash
npm run dev
```

> **Note**: To test Telegram webhooks locally, use `ngrok` or `cloudflared` to tunnel requests to your localhost.

### 4. Production Deployment

Deploy to Cloudflare's global network:

```bash
npm run deploy
```

---

## 📚 API Reference

### POST `/`

The main webhook endpoint invoked by the gateway/Telegram.

**Headers:**
- `x-custom-client-id`: Must match `GATEWAY_SERVICE_CALL_TOKEN`
- `x-custom-request-sent-time`: Unix timestamp (ms)

**Body:**
Standard Telegram Update JSON object.

---

## 🧪 Testing and Verification

We emphasize robustness. Key logic is unit-tested in `tests/` (coming soon).

To manually verify the signal detection logic:
```bash
npx ts-node repro_signals.ts
```

---

## 📄 License

MIT © 2024
