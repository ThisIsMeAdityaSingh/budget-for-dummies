import { Type } from "@google/genai";

export const CONFIDENCE_THRESHOLD = 0.8;

interface ExpenseObject {
    amount: number;
    category: string;
    description: string;
    date: string;
    time: string;
    merchant: string;
}

export function validateParsedExpense(parsedExpense: ExpenseObject) {
    const issues = [];
    let score = 1;

    if (parsedExpense === null || typeof parsedExpense.amount !== "number" || !isFinite(parsedExpense.amount) || parsedExpense.amount <= 0) {
        issues.push("Invalid amount");
        score -= 0.2;
    }

    if (typeof parsedExpense.category !== "string" || parsedExpense.category.trim() === "") {
        issues.push("Invalid category");
        score -= 0.2;
    }

    if (typeof parsedExpense.description !== "string" || parsedExpense.description.trim() === "") {
        issues.push("Invalid description");
        score -= 0.2;
    }

    if (typeof parsedExpense.date !== "string" || parsedExpense.date.trim() === "") {
        issues.push("Invalid date");
        score -= 0.2;
    }

    if (typeof parsedExpense.time !== "string" || parsedExpense.time.trim() === "") {
        issues.push("Invalid time");
        score -= 0.2;
    }

    if (typeof parsedExpense.merchant !== "string" || parsedExpense.merchant.trim() === "") {
        issues.push("Invalid merchant");
        score -= 0.2;
    }

    if (score < 0) score = 0;
    if (score > 1) score = 1;

    return { issues, score };
}

export function analyseSentimentSchema() {
    return {
        type: Type.OBJECT,
        properties: {
            score: {
                type: Type.NUMBER,
                description: "A score between 0.0 and 1.0. 1.0 indicates the USER paid or spent money (explicit or implicit).",
                minimum: 0,
                maximum: 1
            }
        },
        required: ["score"]
    }
}