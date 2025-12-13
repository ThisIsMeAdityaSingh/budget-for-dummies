import { ServiceError } from "../error";
import { sendLogs } from "../handlers/send-logs";
import { sendMessageToTelegram } from "../handlers/send-message";
import { getExpenseSummaryPrompt } from "../utils";

export async function getExpenseSummary(env: Env, startDate: string, endDate: string, chatId: number): Promise<Response> {
    try {
        console.log(startDate, endDate);
        const GET_EXPENSE_SUMMARY_COMMAND = `select * from expenses where date between ? and ?`;
        const expenseSummary = await env.budget_db.prepare(GET_EXPENSE_SUMMARY_COMMAND)
            .bind(startDate, endDate)
            .all();

        console.log(expenseSummary)

        if (expenseSummary.error || expenseSummary.results.length === 0) {
            await sendMessageToTelegram(env, String(chatId), "No expenses found for the given date range", true);
            return new Response(JSON.stringify({ ok: true, message: "No expenses found for the given date range" }), { status: 200 });
        }

        // AI layer
        const expenseSummaryPrompt = getExpenseSummaryPrompt();
        const message = [
            { role: "system", content: expenseSummaryPrompt },
            { role: "user", content: JSON.stringify(expenseSummary) },
        ];

        const aiResponse = await env.AI.run('@cf/meta/llama-3.2-1b-instruct', {
            max_tokens: 500,
            messages: message,
        });

        if (aiResponse.response) {
            await sendMessageToTelegram(env, String(chatId), aiResponse.response, true);
        }

        return new Response(JSON.stringify({ ok: true, message: aiResponse.response || "" }), { status: 200 });
    } catch (error) {
        if (error instanceof ServiceError) {
            sendLogs(env, error.level, error.message, error.stack || {}, error.errorCategory);
            return new Response(JSON.stringify({ ok: false, error: error.message }), { status: error.statusCode });
        }
        return new Response(JSON.stringify({ ok: false, error: "Internal Server Error" }), { status: 500 });
    }
}