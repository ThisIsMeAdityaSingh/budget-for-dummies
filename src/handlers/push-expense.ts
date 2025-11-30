interface TelegramUpdate {
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

export async function pushExpense(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    let body: TelegramUpdate;

    try {
        body = await request.json() as TelegramUpdate;
    } catch (error) {
        return new Response("Invalid JSON", { status: 400 });
    }

    const chatId = body.message?.chat?.id;
    const text = body.message?.text;
    const messageFromId = body.message?.from?.id;

    if (messageFromId !== parseInt(env.TELEGRAM_VALID_FROM_ID)) {
        return new Response("Unauthorized", { status: 401 });
    }
}