import { ServiceError, ServiceErrorTypes } from "../error";
import { LogLevels, sendLogs } from "../handlers/send-logs";
import { sendMessageToTelegram } from "../handlers/send-message";

/**
 * Idea is that this command will delete the last log from the database
 * - by last I mean the latest entered log
 * @param env 
 * @param chatId 
 */
export async function deleteLastLog(env: Env, chatId: number): Promise<Response> {
    try {
        const GET_LAST_LOG_COMMAND = `select id from expenses order by created_at desc limit 1`;
        const lastLog = await env.budget_db.prepare(GET_LAST_LOG_COMMAND).first();
        if (!lastLog) throw new ServiceError("No logs found", ServiceErrorTypes.REQUEST_ERROR, 400, LogLevels.ERROR, ServiceErrorTypes.REQUEST_ERROR);

        const DELETE_LAST_LOG_COMMAND = `delete from expenses where id = ${lastLog.id}`;
        await env.budget_db.prepare(DELETE_LAST_LOG_COMMAND).run();

        await sendMessageToTelegram(env, String(chatId), "Last log deleted successfully");
        return new Response(JSON.stringify({ ok: true, lastLog }), { status: 200 });
    } catch (error) {
        if (error instanceof ServiceError) {
            sendLogs(env, error.level, error.message, error.stack || {}, error.errorCategory);
            return new Response(JSON.stringify({ ok: false, error: error.message }), { status: error.statusCode });
        }
        return new Response(JSON.stringify({ ok: false, error: "Internal Server Error" }), { status: 500 });
    }
}