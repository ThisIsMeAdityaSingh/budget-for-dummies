import moment from "moment";
import { escapeMarkdownV2, isValidExpenseObject } from "../utils";
import { sendMessageToTelegram } from "./send-message";

interface TelegramUpdate {
    message?: {
        chat?: {
            id: number;
            [key: string]: any;
        };
        text?: string;
        from?: {
            id: number;
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

export async function pushExpense(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    let body: TelegramUpdate;

    try {
        body = await request.json() as TelegramUpdate;
    } catch (error) {
        return new Response("Invalid JSON", { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const chatId = body.message?.chat?.id;
    const text = body.message?.text;
    const messageFromId = body.message?.from?.id;

    console.log(`4. Validating from id.`)
    if (messageFromId !== parseInt(env.TELEGRAM_VALID_FROM_ID)) {
        await sendMessageToTelegram(env, String(chatId), 'Wow, really?? 🫨. Go tell yo mom as well, she must be proud of this 😄');
        return new Response("Unauthorized", { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`Processing for ${chatId}: ${text}`);

    const categories = env.EXPENSE_CATEGORIES.split(',');

    const promptText = [
        "You are a strict JSON extractor. Output exactly one JSON object and nothing else. No explanation, no backticks, no extra text.",
        "Schema (exact fields):",
        "  - amount (number or null),",
        "  - category (one of: " + categories.join(', ') + " or null),",
        "  - description (string or null),",
        "  - date (YYYY-MM-DD or null),",
        "  - time (HH:MM or null).",
        "Rules:",
        "  1) If the text contains no expense-like tokens (numbers, currency symbols like ₹, rs, rupee, USD, date patterns, time patterns, or clear merchant names), return all fields as null.",
        "  2) Do not invent amounts, categories, merchants, dates or times. If unsure, set that field to null.",
        "  3) Always produce valid JSON parseable by JSON.parse().",
        "Examples:",
        '  Input: "Bought pizza for 100 at Domino\'s on 2025-11-29 19:30"',
        '  Output: {"amount":100.0,"category":"Food","description":"Bought pizza at Domino\'s","date":"2025-11-29","time":"19:30","merchant":"Domino\'s"}',
        '  Input: "Spent 350 on dinner on Zomato"',
        '  Output: {"amount":350.0,"category":"Food","description":"Spent 350 on dinner on Zomato","date":null,"time":null,"merchant":"Zomato"}',
        '  Input: "random"',
        '  Output: {"amount":null,"category":null,"description":null,"date":null,"time":null}',
        "Now extract from the following text (Text begins):",
        "Text: " + text
    ].join("\n");

    let parsed;

    try {
        const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            prompt: promptText,
            max_tokens: 500,
            temperature: 0.1,
        });

        parsed = JSON.parse(aiResponse.response);
    } catch (error) {
        console.error('AI Parse Error:', error);
        await sendMessageToTelegram(env, String(chatId), '⚠️ Sorry, I could not parse the expense. Please try again.');
        return new Response(JSON.stringify({ ok: false, reason: 'ai_error' }), { status: 200 });
    }

    // validating the parsed ai data
    console.log(`Parsed - Data - ${JSON.stringify(parsed)}`)
    if (!isValidExpenseObject(parsed)) {
        console.error('Invalid Expense Object:', parsed);
        await sendMessageToTelegram(env, String(chatId), '⚠️ Sorry, I could not parse the expense. Please try again.');
        return new Response(JSON.stringify({ ok: false, reason: 'invalid_data' }), { status: 200 });
    }

    // Default date/time if null
    const date = parsed.date || moment().format('ll');
    const time = parsed.time || moment().format('LT');

    if (parsed.category) {
        parsed.category = parsed.category.toLowerCase().trim();
    }

    // inserting into DB
    const INSERT_QUERY = `INSERT INTO Expenses (user_id, amount, category, description, date, time, merchant, platform) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    try {
        await env.budget_db.prepare(INSERT_QUERY)
            .bind(String(chatId), parsed.amount, parsed.category, parsed.description, date, time, parsed?.merchant || 'Unknown', 'Telegram')
            .run();
    } catch (error) {
        console.error('DB Insert Error:', error);
        await sendMessageToTelegram(env, String(chatId), '⚠️ Sorry, I could not save the expense. Please try again.');
        return new Response(JSON.stringify({ ok: false, reason: 'db_error' }), { status: 200 });
    }

    const excapedCat = escapeMarkdownV2(parsed.category);
    const excapedMerchant = escapeMarkdownV2(parsed?.merchant || 'Unknown');
    const excapedDescription = escapeMarkdownV2(parsed.description || '');

    const confirmation = `✅ Logged *${parsed.amount}* (${excapedCat}) for _${excapedDescription}_ at _${excapedMerchant}_\\.`;

    await sendMessageToTelegram(env, String(chatId), confirmation, true);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}