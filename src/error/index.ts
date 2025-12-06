export enum ServiceErrorTypes {
    TELEGRAM_ERROR = 'TELEGRAM_ERROR',
    AI_ERROR = 'AI_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    SIGNAL_ERROR = 'SIGNAL_ERROR',
    UNAUTHORIZED_ACCESS_ERROR = 'UNAUTHORIZED_ACCESS_ERROR',
    WRONG_METHOD_ERROR = 'WRONG_METHOD_ERROR',
    REQUEST_ERROR = 'REQUEST_ERROR',
    GENRAL_ERROR = 'GENRAL_ERROR'
}

export class ServiceError extends Error {
    constructor(message: string, public type: string, public statusCode: number) {
        super(message);
    }
}