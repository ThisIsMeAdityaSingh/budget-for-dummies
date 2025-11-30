export interface Expense {
    amount: number;
    category: string;
    description: string;
    date: string;
    time: string;
    merchant?: string;
}

/**
 * Validates an expense object
 * @param {Expense} expense The expense object to validate
 * @returns {boolean} true if the expense object is valid, false otherwise
 */
export function isValidExpenseObject(expense: any): expense is Expense {
    if (!expense || typeof expense !== 'object') return false;
    const required = ['amount', 'category', 'description'];

    for (const key of required) {
        if (!(key in expense)) return false;
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