# Budget For Dummies

A Cloudflare Workers based expense‑tracking bot that receives expense messages via Telegram, validates them with AI, and stores them in a D1 SQLite database.

---

## ✨ Features

- **Secure request validation** – time‑safe token comparison using `crypto.timingSafeEqual`.
- **Signal detection** – quick heuristics to filter out non‑expense messages.
- **Sentiment analysis** – uses Gemini 2.5 Flash Lite to ensure the message expresses an expense.
- **AI‑driven expense extraction** – Cloudflare AI (`@cf/meta/llama-3.2-1b-instruct`) parses amount, category, date, etc.
- **Database persistence** – stores expenses in a Cloudflare D1 database.
- **Telegram integration** – sends confirmations and error messages back to the user.
- **Typed environment** – full TypeScript typings for Cloudflare Workers.

---

## 📦 Prerequisites

- **Node.js** (v18 or later)
- **npm** (comes with Node)
- **Cloudflare account** with Workers KV/D1 enabled
- **Telegram bot token** and a **gateway service token** for request authentication
- **Google Gemini API key** for sentiment analysis

---

## 🚀 Installation

```bash
# Clone the repo
git clone https://github.com/your‑username/budget-for-dummies.git
cd budget-for-dummies

# Install dependencies
npm ci
```

---

## ⚙️ Configuration

Create a `.dev.vars` file (or set environment variables in your Cloudflare dashboard) with the following keys:

```text
GOOGLE_GEMINI_API_KEY=your‑gemini‑api‑key
SENTIMENT_CONFIDENT_THRESHOLD=0.95
GATEWAY_SERVICE_CALL_TOKEN=shared‑secret‑token
TELEGRAM_VALID_FROM_ID=123456789   # Telegram user ID allowed to call the bot
EXPENSE_CATEGORIES=food,groceries,transport,entertainment,other
```

The `worker-configuration.d.ts` type definition already lists these variables.

---

## 🏃‍♂️ Running locally

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`. Use a tool like **ngrok** or **Cloudflare Tunnel** to expose the endpoint to Telegram for local testing.

---

## 📦 Deploying to Cloudflare Workers

```bash
npm run deploy
```

Make sure your `wrangler.toml` (or `wrangler.jsonc`) contains the D1 binding `budget_db` and any other required secrets.

---

## 📚 Usage

1. **Send a message** to your Telegram bot in the format `Lunch 120 at Dominos`.
2. The worker validates the request, runs signal detection, sentiment analysis, and AI extraction.
3. On success, the expense is stored in the D1 database and a confirmation is sent back to Telegram.

---

## 🧪 Testing

If you have tests set up, run:

```bash
npm test
```

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository, create a feature branch, and open a pull request.

---

## 📄 License

MIT License – see the `LICENSE` file for details.
