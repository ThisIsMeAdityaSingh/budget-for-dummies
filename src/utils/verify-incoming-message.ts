import { TelegramUpdate } from ".";
import { ServiceError, ServiceErrorTypes } from "../error";
import { LogLevels } from "../handlers/send-logs";
import { sendMessageToTelegram } from "../handlers/send-message";
import { performTimeSafeEquals } from "./time-safe-match";

export async function verifyIncomingMessage(request: Request, env: Env) {
    const requestSentTime = request.headers.get("x-custom-request-sent-time") as string;
    if (!requestSentTime) throw new ServiceError("Request error: no request sent time", ServiceErrorTypes.REQUEST_ERROR, 400, LogLevels.WARNING, ServiceErrorTypes.REQUEST_ERROR);

    if (Date.now() - Number(requestSentTime) >= 5 * 60 * 1000) {
        throw new ServiceError("Request error: request too old", ServiceErrorTypes.REQUEST_ERROR, 400, LogLevels.WARNING, ServiceErrorTypes.REQUEST_ERROR);
    }

    const clientId = request.headers.get("x-custom-client-id") as string;
    if (!clientId) throw new ServiceError("Request error: no client id", ServiceErrorTypes.REQUEST_ERROR, 400, LogLevels.CRITICAL_ERROR, ServiceErrorTypes.UNAUTHORIZED_ACCESS_ERROR);

    if (!performTimeSafeEquals(clientId, env.GATEWAY_SERVICE_CALL_TOKEN)) {
        throw new ServiceError("Request error: unauthorized", ServiceErrorTypes.TELEGRAM_ERROR, 200, LogLevels.CRITICAL_ERROR, ServiceErrorTypes.UNAUTHORIZED_ACCESS_ERROR);
    }

    const body = await request.json() as TelegramUpdate;

    const chatId = body?.message?.chat?.id;
    if (!chatId) throw new ServiceError("Request error: wrong source", ServiceErrorTypes.REQUEST_ERROR, 400, LogLevels.ERROR, ServiceErrorTypes.REQUEST_ERROR);

    const unSanitizedtext = body?.message?.text;
    if (!unSanitizedtext) throw new ServiceError("Request error: no action needed", ServiceErrorTypes.REQUEST_ERROR, 400, LogLevels.ERROR, ServiceErrorTypes.REQUEST_ERROR);

    const messageFromId = body?.message?.from?.id;
    if (!messageFromId) throw new ServiceError("Request error: unknown person", ServiceErrorTypes.TELEGRAM_ERROR, 200, LogLevels.ERROR, ServiceErrorTypes.TELEGRAM_ERROR);

    if (!performTimeSafeEquals(String(messageFromId), env.TELEGRAM_VALID_FROM_ID)) {
        await sendMessageToTelegram(env, String(chatId), 'You are supposed to be here ⁉️');
        throw new ServiceError("Request error: unauthorized", ServiceErrorTypes.TELEGRAM_ERROR, 200, LogLevels.CRITICAL_ERROR, ServiceErrorTypes.UNAUTHORIZED_ACCESS_ERROR);
    }

    return body;
}