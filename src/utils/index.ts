export interface Expense {
    amount: number;
    category: string;
    description: string;
    date: string;
    time: string;
    merchant?: string;
}

export interface ExpenseSignal {
    raw: string;
    hasCurrency: boolean;
    hasDate: boolean;
    hasTime: boolean;
    hasExpenseVerb: boolean;
    hasMerchantLike: boolean;
    hasNumber: boolean;
    amountCandidate: number | null;
    currencySymbol: string | null;
    inferredDescription: string | null;
    canBeExpenseWithoutAmount?: boolean;
}

export interface TelegramUpdate {
    message?: {
        chat?: {
            id: number;
            [key: string]: any;
        };
        text?: string;
        from?: {
            id: number;
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

export function isEmptyObject(obj: any) {
    if (!obj || typeof obj !== "object") return true;
    if (Array.isArray(obj)) return true;

    return Object.keys(obj).length === 0;
}

/**
 * Validates an expense object
 * @param {Expense} expense The expense object to validate
 * @returns {boolean} true if the expense object is valid, false otherwise
 */
export function isValidExpenseObject(expense: any): expense is Expense {
    console.log('type of expense', typeof expense);
    if (!expense || typeof expense !== 'object') return false;
    const required = ['amount', 'category', 'description'];

    for (const key of required) {
        if (!(key in expense)) {
            console.log(`${key} not found in expense object`);
            return false;
        };
    }

    // amount should be +ve and within limit
    if (typeof expense.amount !== 'number' || expense.amount <= 0 || !isFinite(expense.amount) || expense.amount > 999999) return false;

    // category should be a string
    if (typeof expense.category !== 'string') return false;

    // description should be a string
    if (typeof expense.description !== 'string') return false;

    return true;
};

/**
 * Validates a Telegram ID
 * @param {string} id The Telegram ID to validate
 * @returns {boolean} true if the Telegram ID is valid, false otherwise
 */
export function validateTelegramId(id: string): boolean {
    if (typeof id !== 'string' || id.length !== 12) return false;
    return true;
}

/**
 * Escapes special characters in a string for use in Markdown
 * @param {string} text The string to escape
 * @returns {string} The escaped string
 */
export function escapeMarkdownV2(text: string): string {
    if (!text) return '';
    return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Ultra pro max stable strict signal detector: Amount/currency mandatory for expense/merchants.
 * Handles locales, signs, false positives, end-of-string amounts.
 */
export function detectSignals(inputText: string): ExpenseSignal {
    const t = (inputText || "").trim();

    // Currency: \b for words, no for symbols
    const currencyPattern = /\b(?:rs\.?|rupees?|inr|bucks?)\b|(?:₹|\$|€)/i;

    // Amount pattern
    const amountPattern = /(?<![a-zA-Z0-9_])(?:(₹|rs\.?|rupees?|inr|\$|usd|€|GBP)\s*)?([+-]?\d+(?:[ ,]\d+)*(?:\.\d{1,2})?)(?:\s*(INR|Rs\.?|rupees?|inr|₹|\$|USD|€|GBP))?(?![a-zA-Z0-9_])/i;

    // Expense verbs
    const expenseVerbPattern = /\b(spent|paid|purchase|bought|ordered|took|bill|charged|expense|cost|invested)\b/i;

    // Merchant: first word any case after prep; cap starts with upper
    const merchantPattern = /\b(?:at|from|via|by|in|on)\s+([A-Za-z][A-Za-z0-9'&.-]+(?:\s+[A-Z][A-Za-z0-9'&.-]+)*)\b/i;
    const capitalizedMerchantPattern = /\b([A-Z][a-z0-9'&.-]+(?:\s+[A-Z][a-z0-9'&.-]+)*)\b/i;

    // Date/time
    const isoDate = /\b\d{4}-\d{2}-\d{2}\b/;
    const altDate = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/;
    const timePattern = /\b([01]?\d|2[0-3]):[0-5]\d\b/;

    const signals: ExpenseSignal = {
        raw: t,
        hasCurrency: currencyPattern.test(t),
        hasDate: isoDate.test(t) || altDate.test(t),
        hasTime: timePattern.test(t),
        hasExpenseVerb: expenseVerbPattern.test(t),
        hasMerchantLike: false,
        hasNumber: false,
        amountCandidate: null,
        currencySymbol: null,
        inferredDescription: null,
        canBeExpenseWithoutAmount: false
    };

    // Amount extraction
    const amtMatch = t.match(amountPattern);
    if (amtMatch) {
        console.log('Signals amount match ', amtMatch);
        let fullMatch = amtMatch[0];
        let numStr = fullMatch.replace(/(?:₹|rs\.?|rupees?|inr|\$|usd|€|GBP)\s*/i, '').replace(/\s*(?:INR|Rs\.?|rupees?|inr|₹|\$|USD|€|GBP)/i, '');

        // Next char check: only if exists and invalid
        const nextPos = amtMatch.index! + fullMatch.length;
        const nextChar = t[nextPos] || '';
        let isValid = !(nextChar && '%/'.includes(nextChar));

        // Validate: contains % or / or multiple .
        if (isValid && (/[%/]/i.test(fullMatch) || (fullMatch.match(/\./g) || []).length > 1)) {
            isValid = false;
        }

        if (isValid) {
            // Normalize
            if (/,/.test(numStr) && !/\./.test(numStr)) {
                const parts = numStr.split(',');
                if (parts.length === 2 && parts[1].length <= 2) {
                    numStr = parts[0] + '.' + parts[1];
                } else {
                    numStr = numStr.replace(/,/g, '');
                }
            } else {
                numStr = numStr.replace(/[,\s]/g, '');
            }
            if (numStr.startsWith('.')) numStr = '0' + numStr;

            const parsed = parseFloat(numStr);
            if (!Number.isNaN(parsed)) {
                signals.hasNumber = true;
                signals.amountCandidate = parsed;
            }
        }

        // Currency
        if (amtMatch[1]) {
            signals.currencySymbol = amtMatch[1];
        } else if (amtMatch[3]) {
            signals.currencySymbol = amtMatch[3];
        }

        // Description (preserve -)
        const start = Math.max(0, amtMatch.index! - 30);
        const end = Math.min(t.length, amtMatch.index! + fullMatch.length + 30);
        const snippet = t.slice(start, end).replace(/\s+/g, ' ').trim();
        signals.inferredDescription = snippet.replace(/^[\s,.:;]+|[\s,.:;]+$/g, '');
    }

    // Strict merchant
    if (signals.hasNumber || signals.hasCurrency) {
        const merchantMatch = t.match(merchantPattern);
        console.log('Signals merchant match ', merchantMatch);
        if (merchantMatch && merchantMatch[1]) {
            signals.hasMerchantLike = true;
            signals.inferredDescription = signals.inferredDescription || merchantMatch[1];
        } else {
            const capMatch = t.match(capitalizedMerchantPattern);
            if (capMatch && capMatch[1]) {
                signals.hasMerchantLike = true;
                signals.inferredDescription = signals.inferredDescription || capMatch[1];
            }
        }
    }

    signals.canBeExpenseWithoutAmount = signals.hasNumber || signals.hasCurrency;

    console.log('Signals', '---', signals);
    return signals;
}

export function getSentimentPrompt(text: string) {
    const prompt = `
    Classify if this text is a PERSONAL EXPENSE (money YOU spent/paid). Assume it's your journal: implied first-person (e.g., "Spent X on Y") = YOU, unless third-party specified. Output ONLY JSON.

    SCORING (lean 1.0 for implied personal spends):
    - 1.0: Your spend/pay/buy/order/invest (past/present/habitual tense; amount optional if action clear).
    Examples: "Spent 121 buying milk and protein bar from flipkart." (implied you, past action). "Bought keyboard 500." (shorthand personal). "Paid 14000 as rent this month" (implied you, past action). "Spent 100 for lunch on zomato" (implied you, past action).

    - 0.0: Third-party ("Friend spent"), income ("Got paid"), facts ("Prices high"), future/questions ("Might buy"), non-money ("Spent time").
    Examples: "Dad paid 500." (other subject). "Salary received 50000." (income). "I have 100 plants" (fact). "I am 100 kms away from home" (future). "I should buy a new phone" (question). "I want to buy a new phone" (question).

    - 0.5: Rare ambiguity (e.g., "We spent 100" w/o your share).

    INPUT: "${text}"

    OUTPUT: {"score": X.X, "explanation": "[1 sentence]"}`;

    return prompt;
}

export function getExpenseGenerationPrompt(todayDate: string, todayTime: string, categoriesList: string) {
    const systemContent = `You are a JSON extractor. You must output exactly one JSON object and nothing else — no explanation, no markdown, no commentary, no extra keys. The JSON must match the schema: { amount (number|null), category (string|null), description (string|null), date (YYYY-MM-DD|null), time (HH:MM|null), merchant (string|null) }.
Rules:
    - If a field cannot be reliably extracted, set it to null.
- Context: Today is ${todayDate}, time is ${todayTime}
    - Categories: ${categoriesList}
    - Keep category and merchant lowercase.
- Prefer merchant found in patterns like "on <merchant>", "at <merchant>", "via <merchant>", "ordered from <merchant>".
- DO NOT output anything other than the single JSON object.`;

    return systemContent;
}

export function sanitizeText(text: string) {
    const issues = {
        isValid: true,
        telegramMessage: "",
        error: "",
        sanitizedText: ""
    };

    if (text.length < 10) {
        issues.isValid = false;
        issues.telegramMessage = "✖️ Text is too short";
        issues.error = "text too short";

        return issues;
    }

    if (text.length > 300) {
        issues.isValid = false;
        issues.telegramMessage = "✖️ Text is too long, gotta save those tokens 💸";
        issues.error = "text too long";

        return issues;
    }

    // check has to contain both alpha and numeric & should not contain dangerous special characters
    // Allow common punctuation: . , ! ?
    if (!/[a-zA-Z]/.test(text) || !/[0-9]/.test(text) || /[@#$%^&*()_+\-=\[\]{};':"\\|<>\/]/.test(text)) {
        issues.isValid = false;
        issues.telegramMessage = "✖️ Text must contain both alpha and numeric characters and should not contain special characters (except . , ! ?)";
        issues.error = "text must contain both alpha and numeric characters and should not contain special characters";

        return issues;
    }

    // text should not contain any html tags
    if (/<[^>]+>/i.test(text)) {
        issues.isValid = false;
        issues.telegramMessage = "⁉️ What are you trying to do?";
        issues.error = "html tags found";

        return issues;
    }

    // text should not contain more than 25 words
    if (text.split(" ").length > 25) {
        issues.isValid = false;
        issues.telegramMessage = "🤖 Text should not contain more than 25 words. Not expecting a trauma dump here.";
        issues.error = "text should not contain more than 25 words";

        return issues;
    }

    issues.isValid = true;
    issues.error = "";
    issues.telegramMessage = "";
    issues.sanitizedText = text.trim();

    return issues;
}