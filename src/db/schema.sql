CREATE TABLE IF NOT EXISTS expenses (
    id  integer primary key autoincrement,
    user_id text not null,
    amount real not null,
    category text not null check(category in ('food', 'transport', 'health', 'education', 'entertainment', 'travel', 'grocery', 'sip', 'subscriptions', 'rent', 'misc', 'uncategorized', 'urban clap')),
    description text,
    date text default (date('now')),
    time text default (time('now')),
    merchant TEXT DEFAULT 'Telegram',
    platform text,
    created_at TEXT DEFAULT (datetime('now'))
);

create index if not EXISTS idx_user_date on expenses (user_id, date);

