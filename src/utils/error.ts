import { isEmptyObject } from "./index";

export class HttpError extends Error {
    status: number;
    headers: object;

    constructor(message: string, status: number, headers?: object) {
        super(message);
        Object.setPrototypeOf(this, HttpError.prototype);

        this.status = status;
        this.headers = isEmptyObject(headers) ? { 'Content-Type': 'application/json' } : headers!;
    }
}

export function throwError(message: string, status: number, headers?: object) {
    return new HttpError(message, status, headers);
}