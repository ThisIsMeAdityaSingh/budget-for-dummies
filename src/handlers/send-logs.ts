import { ServiceErrorTypes } from "../error";

export enum LogLevels {
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR",
    CRITICAL_ERROR = "CRITICAL_ERROR"
}

export async function sendLogs(env: Env, level: LogLevels, message: string, metaData: string | object, errorType: ServiceErrorTypes) {
    try {
        const response = await fetch(`${env.LOGGING_ENDPOINT}/logger`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-custom-client-id': env.LOGGING_SERVICE_TOKEN!,
                'x-custom-request-sent-time': Date.now().toString(),
            },
            body: JSON.stringify({
                level,
                source: "CLOUDFARE_WORKER",
                requestId: `req_${crypto.randomUUID()}`,
                message,
                metaData,
                errorType,
            }),
        });

        return response;
    } catch (error) {
        console.error(error);
    }
}