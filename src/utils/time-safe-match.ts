import crypto from "crypto";

export function performTimeSafeEquals(sample1: string, sample2: string) {
    const sample1Buffer = Buffer.from(sample1, 'utf-8');
    const sample2Buffer = Buffer.from(sample2, 'utf-8');

    if (sample1Buffer.length !== sample2Buffer.length || !crypto.timingSafeEqual(sample1Buffer, sample2Buffer)) {
        return false;
    }

    return true;
}