import moment from "moment";
import { GoogleGenAI } from "@google/genai";
import { detectSignals, escapeMarkdownV2, getExpenseGenerationPrompt, getSentimentPrompt, isValidExpenseObject, TelegramUpdate, sanitizeText } from "../utils";
import { sendMessageToTelegram } from "./send-message";
import { analyseSentimentSchema } from "../utils/confidence-utility";
import { HttpError, throwError } from "../utils/error";
import { ServiceError, ServiceErrorTypes } from "../error";
import { performTimeSafeEquals } from "../utils/time-safe-match";

export async function pushExpense(request: Request, env: Env): Promise<Response> {
    try {
        if (request.method !== "POST") {
            throw new ServiceError("Method not allowed", ServiceErrorTypes.WRONG_METHOD_ERROR, 405);
        }

        const requestSentTime = request.headers.get("x-custom-request-sent-time") as string;
        if (!requestSentTime) throw new ServiceError("Request error: no request sent time", ServiceErrorTypes.REQUEST_ERROR, 400);

        if (Date.now() - Number(requestSentTime) >= 5 * 60 * 1000) {
            throw new ServiceError("Request error: request too old", ServiceErrorTypes.REQUEST_ERROR, 400);
        }

        const clientId = request.headers.get("x-custom-client-id") as string;
        if (!clientId) throw new ServiceError("Request error: no client id", ServiceErrorTypes.REQUEST_ERROR, 400);

        if (!performTimeSafeEquals(clientId, env.GATEWAY_SERVICE_CALL_TOKEN)) {
            throw new ServiceError("Request error: unauthorized", ServiceErrorTypes.TELEGRAM_ERROR, 200);
        }

        const body = await request.json() as TelegramUpdate;

        const chatId = body?.message?.chat?.id;
        if (!chatId) throw new ServiceError("Request error: wrong source", ServiceErrorTypes.REQUEST_ERROR, 400);

        const unSanitizedtext = body?.message?.text;
        if (!unSanitizedtext) throw new ServiceError("Request error: no action needed", ServiceErrorTypes.REQUEST_ERROR, 400);

        const { isValid, telegramMessage, error, sanitizedText } = sanitizeText(unSanitizedtext);
        if (!isValid) {
            telegramMessage && await sendMessageToTelegram(env, String(chatId), telegramMessage);
            throw new ServiceError(error, ServiceErrorTypes.REQUEST_ERROR, 200);
        }

        const text = sanitizedText;


        const messageFromId = body?.message?.from?.id;
        if (!messageFromId) throw new ServiceError("Request error: unknown person", ServiceErrorTypes.TELEGRAM_ERROR, 200);

        if (!performTimeSafeEquals(String(messageFromId), env.TELEGRAM_VALID_FROM_ID)) {
            await sendMessageToTelegram(env, String(chatId), 'You are supposed to be here ⁉️');
            throw new ServiceError("Request error: unauthorized", ServiceErrorTypes.TELEGRAM_ERROR, 200);
        }

        // now to save me money, the text would go through singal detection
        // if no valid signals are detected, we ask user to re-phrase it, and try again
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
            throw new ServiceError("Signal error: signal detection", ServiceErrorTypes.SIGNAL_ERROR, 200);
        }

        // if amount is not detected, we can't process it
        if (!signals.hasNumber && !signals.hasCurrency) {
            await sendMessageToTelegram(env, String(chatId), '⁉️ No amount detected. Try: `Lunch 150 at Dominos`');
            throw new ServiceError("Signal error: amount detection", ServiceErrorTypes.SIGNAL_ERROR, 200);
        }

        // now that signal detection would block majority of the bad traffic (I hope),
        // we now have to focus on sentiment, because my signal detection logic is not bullet proof
        // so, we would be using gemini 2.5 flash lite model for this.
        const client = new GoogleGenAI({ apiKey: env.GOOGLE_GEMINI_API_KEY });

        const sentimentSchema = analyseSentimentSchema();
        const sentimentPrompt = getSentimentPrompt(text);

        let score;

        try {
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash-lite',
                contents: [{ role: 'user', parts: [{ text: sentimentPrompt }] }],
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: sentimentSchema,
                    temperature: 0.0, // i want it exact no deviation what so ever, so putting temp as 0
                }
            });

            score = response?.candidates?.[0]?.content?.parts?.[0]?.text;
        } catch (err) {
            await sendMessageToTelegram(env, String(chatId), "⁉️ Sorry, can't figure out what that was. Try: `Lunch 150 at Dominos`");
            throw new ServiceError("Sentiment error: no strong sentiment", ServiceErrorTypes.AI_ERROR, 200);
        }

        if (!score) {
            await sendMessageToTelegram(env, String(chatId), "⁉️ Sorry, can't figure out what that was. Try: `Lunch 150 at Dominos`");
            throw new ServiceError("Sentiment error: no strong sentiment", ServiceErrorTypes.AI_ERROR, 200);
        }

        try {
            const sentimentScore = JSON.parse(score);
            const sentimentScoreValue = sentimentScore?.score;

            if (sentimentScoreValue < Number(env.SENTIMENT_CONFIDENT_THRESHOLD || "0.95")) {
                throw throwError(`Sentiment for text low, doesn't seem to be an expense ${text} || ${score}`, 200);
            }
        } catch (error) {
            await sendMessageToTelegram(env, String(chatId), "⁉️ Sorry, can't figure out what that was. Try: `Lunch 150 at Dominos`");
            throw new ServiceError("Sentiment error: not parsable", ServiceErrorTypes.AI_ERROR, 200);
        }

        const todayDate = moment().format('ll');
        const todayTime = moment().format('LT');
        const categoriesList = env.EXPENSE_CATEGORIES.split(',').join(', ');
        const systemContent = getExpenseGenerationPrompt(todayDate, todayTime, categoriesList);

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

        let parsed;

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
                throw new ServiceError("AI error: no response", ServiceErrorTypes.AI_ERROR, 200);
            }

            parsed = JSON.parse(aiResponse.response);
        } catch (error) {
            await sendMessageToTelegram(env, String(chatId), '⚠️ Sorry, I could not parse the expense. Please try again.');
            if (error instanceof ServiceError) {
                throw new ServiceError(error.message, error.type, error.statusCode);
            }
            throw throwError("Text generation model failed in extracting expense", 200);
        }

        // validating the parsed ai data
        if (!isValidExpenseObject(parsed)) {
            await sendMessageToTelegram(env, String(chatId), '⚠️ Sorry, I could not parse the expense. Please try again.');
            throw new ServiceError("AI error: invalid expense generate", ServiceErrorTypes.AI_ERROR, 200);
        }

        // Default date/time if null
        const date = parsed.date || moment().format('ll');
        const time = parsed.time || moment().format('LT');

        if (parsed.category) {
            parsed.category = parsed.category.toLowerCase().trim();
        } else {
            parsed.category = 'misc';
        }

        if (!parsed.description) {
            parsed.description = 'expense';
        }

        const INSERT_QUERY = `INSERT INTO expenses(user_id, amount, category, description, date, time, merchant, platform) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`;

        try {
            await env.budget_db.prepare(INSERT_QUERY)
                .bind(String(chatId), parsed.amount, parsed.category, parsed.description, date, time, parsed?.merchant?.toLowerCase() || 'Unknown', 'Telegram')
                .run();
        } catch (error) {
            await sendMessageToTelegram(env, String(chatId), '⚠️ Sorry, I could not save the expense. Please try again.');
            throw new ServiceError("DB error: unable to insert records", ServiceErrorTypes.DATABASE_ERROR, 200);
        }

        const excapedCat = escapeMarkdownV2(parsed.category);
        const excapedMerchant = escapeMarkdownV2(parsed?.merchant || 'Unknown');
        const excapedDescription = escapeMarkdownV2(parsed.description || '');

        const confirmation = `✅ Logged * ${parsed.amount}* (${excapedCat}) for _${excapedDescription}_ at _${excapedMerchant} _.`;

        await sendMessageToTelegram(env, String(chatId), confirmation, true);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (error) {
        //TODO: add a logging service which could log issues
        if (error instanceof ServiceError) {
            return new Response(JSON.stringify({ ok: false, message: error.message }), { status: error.statusCode });
        }

        if (error instanceof HttpError) {
            return new Response(JSON.stringify({ ok: false, error }), { status: error.status });
        }

        return new Response(JSON.stringify({ ok: false, error }), { status: 500 });
    }
}