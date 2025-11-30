export interface Expense {
    amount: number;
    category: string;
    description: string;
    date: string;
    time: string;
}

export function isValidExpenseObject(expense: any): expense is Expense {
    if (!expense || typeof expense !== 'object') return false;
    const required = ['amount', 'category', 'description', 'date', 'time'];

    for (const key of required) {
        if (!(key in expense)) return false;
    }

    // amount should be +ve and within limit
    if (typeof expense.amount !== 'number' || expense.amount <= 0 || !isFinite(expense.amount) || expense.amount > 999999) return false;

    // category should be one of the allowed categories
    const allowedCategories = ['food', 'transport', 'health', 'education', 'entertainment', 'travel', 'grocery', 'sip', 'subscriptions', 'rent', 'misc', 'uncategorized', 'urban clap'];
    if (typeof expense.category !== 'string' || !allowedCategories.includes(expense.category)) return false;

    // description should be a string
    if (typeof expense.description !== 'string' || expense.description.length > 355) return false;

    // date should be a string
    if (typeof expense.date !== 'string' || expense.date.length !== 10) return false;

    // time should be a string
    if (typeof expense.time !== 'string' || expense.time.length !== 8) return false;

    return true;
};
