import moment from "moment";
import { deleteLastLog } from "../bot-commands/delete-last-log";
import { ServiceError } from "../error";
import { TelegramUpdate } from "../utils";
import { sendLogs } from "./send-logs";
import { getExpenseSummary } from "../bot-commands/summary";
import { saveBudget } from "../bot-commands/save-budget";

export async function processBotCommands(request: Request, env: Env): Promise<Response> {
    const body = await request.json() as TelegramUpdate;

    const chatId = body!.message!.chat!.id!;
    const userText = body!.message!.text!;

    try {
        const [command, text] = userText.split(" ");
        if (command === "/deletelastlog") {
            return await deleteLastLog(env, chatId);
        }

        if (command === "/summarybyday") {
            const startDate = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
            const endDate = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');

            return await getExpenseSummary(env, startDate, endDate, chatId);
        }

        if (command === "/summarybyweek") {
            const startDate = moment().startOf('week').format('YYYY-MM-DD HH:mm:ss');
            const endDate = moment().endOf('week').format('YYYY-MM-DD HH:mm:ss');

            return await getExpenseSummary(env, startDate, endDate, chatId);
        }

        if (command === "/summarybymonth") {
            const startDate = moment().startOf('month').format('YYYY-MM-DD HH:mm:ss');
            const endDate = moment().endOf('month').format('YYYY-MM-DD HH:mm:ss');

            return await getExpenseSummary(env, startDate, endDate, chatId);
        }

        if (command === "/setmydailybudget") {
            return await saveBudget(env, "daily", chatId, Number(text));
        }

        if (command === "/setmyweeklybudget") {
            return await saveBudget(env, "weekly", chatId, Number(text));
        }

        if (command === "/setmymonthlybudget") {
            return await saveBudget(env, "monthly", chatId, Number(text));
        }

        return new Response("Invalid command", { status: 200 });
    } catch (error) {
        if (error instanceof ServiceError) {
            await sendLogs(env, error.level, error.message, error.stack || {}, error.errorCategory);
            return new Response(error.message, { status: error.statusCode });
        }
        return new Response("Failed to process command", { status: 500 });
    }
}