export async function sendMessageToTelegram(env: Env, chatId: string, text: string, useMarkdown = false) {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    const payload: { [key: string]: string } = {
        chat_id: chatId,
        text: text
    }

    if (useMarkdown) {
        payload.parse_mode = 'Markdown';
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    return response;
}