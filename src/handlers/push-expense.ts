import moment from "moment";
import { GoogleGenAI, Type } from "@google/genai";
import { detectSignals, escapeMarkdownV2, isValidExpenseObject } from "../utils";
import { sendMessageToTelegram } from "./send-message";
import { analyseSentimentSchema } from "../utils/confidence-utility";

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

    if (!text) {
        return new Response("No text", { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (messageFromId !== parseInt(env.TELEGRAM_VALID_FROM_ID)) {
        await sendMessageToTelegram(env, String(chatId), 'Wow, really?? 🫨. Go tell yo mom as well, she must be proud of this 😄');
        return new Response("Unauthorized", { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // checking with signal detection what the text is even worth sending to AI systems, this would help us reduce costs
    // for strings that are totally hopeless
    const signals = detectSignals(text);

    const noExpense =
        !signals.hasNumber &&
        !signals.hasCurrency &&
        !signals.hasExpenseVerb &&
        !signals.hasMerchantLike &&
        !signals.hasDate &&
        !signals.hasTime;

    if (noExpense) {
        await sendMessageToTelegram(env, String(chatId), '⁉️ No expense detected. Try: `Lunch 150 at Dominos`');
        return new Response(JSON.stringify({ ok: false, reason: 'invalid_data' }), { status: 200 });
    }

    // if amount is not detected, we can't process it
    if (!signals.hasNumber && !signals.hasCurrency) {
        await sendMessageToTelegram(env, String(chatId), '⁉️ No amount detected. Try: `Lunch 150 at Dominos`');
        return new Response(JSON.stringify({ ok: false, reason: 'invalid_data' }), { status: 200 });
    }

    // before hitting text generation model, which is kinda expensive and we need to conserve tokens, we need to figure out if the text is a valid expense
    // intent should be of an expense
    const client = new GoogleGenAI({ apiKey: env.GOOGLE_GEMINI_API_KEY });

    const sentimentSchema = analyseSentimentSchema();
    const sentimentPrompt = `
    Analyze the text to determine if it represents a PERSONAL EXPENSE by the narrator (User).

    SCORING RULES:
    - Score 0.95 - 1.0: User explicitly paid or spent money, implicitly or explicitly paid or spent money (e.g., "Spent 150 for dinner on Zomato.", "Paid 14000 on rent for this month.", "150 dinner swiggy."), or paid a debt.
    - Score 0.0 - 0.1: 
        1. General statements or facts ("Rent is expensive", "I have 100 trees").
        2. Third-party expenses ("Dad paid 500", "She bought 4 apples in 100 dollars").
        3. INCOME statements ("Received salary 5000" -> This is NOT an expense).
        4. Future plans ("I will buy this next year").

    INPUT TEXT: "${text}"`;

    let score;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: [{ role: 'user', parts: [{ text: sentimentPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: sentimentSchema,
                temperature: 0.0,
            }
        });

        console.log("Google gemini sentiment response ", JSON.stringify(response), " || END");
        score = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (err) {
        console.log("Google gemini sentiment error", err);
    }

    if (!score) {
        await sendMessageToTelegram(env, String(chatId), '⁉️ No sentiment detected. Try: `Lunch 150 at Dominos`');
        return new Response(JSON.stringify({ ok: false, reason: 'invalid_data' }), { status: 200 });
    }

    if (score) {
        try {
            const sentimentScore = JSON.parse(score);
            const sentimentScoreValue = sentimentScore?.score;

            if (sentimentScoreValue < Number(env.SENTIMENT_CONFIDENT_THRESHOLD || "0.95")) {
                await sendMessageToTelegram(env, String(chatId), '⁉️ No sentiment detected. Try: `Lunch 150 at Dominos`');
                return new Response(JSON.stringify({ ok: false, reason: 'invalid_data' }), { status: 200 });
            }
        } catch (error) {
            console.log("Google gemini sentiment error", error);
            await sendMessageToTelegram(env, String(chatId), '⁉️ No sentiment detected. Try: `Lunch 150 at Dominos`');
            return new Response(JSON.stringify({ ok: false, reason: 'invalid_data' }), { status: 200 });
        }
    }


    console.log(`Processing for ${chatId}: ${text}`);
    const todayDate = moment().format('ll');
    const todayTime = moment().format('LT');
    const categoriesList = env.EXPENSE_CATEGORIES.split(',').join(', ');

    let parsed;

    // const systemContent = `You are a JSON extractor. Return exactly one JSON object and nothing else — no explanation, no markdown, no bullet lists. Extract expense data. Context: Today is ${todayDate}, time is ${todayTime}. Categories: ${categoriesList}. Rules: 1. Calculate relative dates (e.g., "yesterday") based on context. 2. If text is not a clear expense, return null for 'amount'. 3. 'category' must be from the list (lowercase). 4. If a field cannot be reliably extracted, set it to null. 5. Output must be strictly valid JSON only (single object). 6. Merchant should be the vendor or service (e.g., "swiggy", "zomato", "dominos", "amazon") where the payment went. If the text contains "on <merchant>", "at <merchant>", "via <merchant>" or "ordered from <merchant>", that is the merchant.`;

    const systemContent = `You are a JSON extractor. You must output exactly one JSON object and nothing else — no explanation, no markdown, no commentary, no extra keys. The JSON must match the schema: { amount (number|null), category (string|null), description (string|null), date (YYYY-MM-DD|null), time (HH:MM|null), merchant (string|null) }.
Rules:
    - If a field cannot be reliably extracted, set it to null.
- Context: Today is ${todayDate}, time is ${todayTime}
    - Categories: ${categoriesList}
    - Keep category and merchant lowercase.
- Prefer merchant found in patterns like "on <merchant>", "at <merchant>", "via <merchant>", "ordered from <merchant>".
- DO NOT output anything other than the single JSON object.`;

    const messages = [
        { role: "system", content: systemContent },
        { role: "user", content: "Spent 500 on swiggy for groceries" },
        { role: "assistant", content: `{ "amount": 500, "category": "grocery", "description": "groceries", "date": "${todayDate}", "time": "${todayTime}", "merchant": "swiggy" } ` },
        { role: "user", content: "Paid 349 to zomato for dinner" },
        { role: "assistant", content: `{ "amount": 349, "category": "food", "description": "dinner", "date": "${todayDate}", "time": "${todayTime}", "merchant": "zomato" } ` },
        { role: "user", content: "I paid 349 to zomato for dinner yesterday" },
        { role: "assistant", content: `{ "amount": 349, "category": "food", "description": "dinner", "date": "${moment().subtract(1, 'day').format('ll')}", "time": "${todayTime}", "merchant": "zomato" } ` },
        { role: "user", content: "Lunch 120" },
        { role: "assistant", content: `{ "amount": 120, "category": "food", "description": "lunch", "date": "${todayDate}", "time": "${todayTime}", "merchant": null } ` },
        { role: "user", content: text }
    ];

    try {
        const aiResponse = await env.AI.run('@cf/meta/llama-3.2-1b-instruct', {
            max_tokens: 500,
            temperature: 0.0,
            messages: messages,
            response_format: {
                type: 'json_object',
                json_schema: {
                    type: 'object',
                    properties: {
                        amount: { type: 'number' },
                        category: { type: 'string' },
                        description: { type: 'string' },
                        date: { type: 'string' },
                        time: { type: 'string' },
                        merchant: { type: 'string' }
                    },
                    required: ['amount', 'category', 'description', 'date', 'time', 'merchant']
                }
            }
        });

        if (!aiResponse.response) {
            throw new Error('AI response is empty');
        }

        parsed = JSON.parse(aiResponse.response);
    } catch (error) {
        console.error('AI Parse Error:', error);
        await sendMessageToTelegram(env, String(chatId), '⚠️ Sorry, I could not parse the expense. Please try again.');
        return new Response(JSON.stringify({ ok: false, reason: 'ai_error' }), { status: 200 });
    }

    // validating the parsed ai data
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
    const INSERT_QUERY = `INSERT INTO Expenses(user_id, amount, category, description, date, time, merchant, platform) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`;

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

    const confirmation = `✅ Logged * ${parsed.amount}* (${excapedCat}) for _${excapedDescription}_ at _${excapedMerchant} _.`;

    await sendMessageToTelegram(env, String(chatId), confirmation, true);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}