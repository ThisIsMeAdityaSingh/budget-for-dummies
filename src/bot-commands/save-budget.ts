import { sendMessageToTelegram } from "../handlers/send-message";

export async function saveBudget(env: Env, frequency: string, chatId: number, amount: number): Promise<Response> {
    try {
        if (isNaN(amount)) {
            await sendMessageToTelegram(env, String(chatId), "Enter a number, like, 100, 1000");
            return new Response("Enter a number, like, 100, 1000", { status: 200 });
        };
        await env.budget_storage.put("budget_" + frequency, amount.toString());
        await sendMessageToTelegram(env, String(chatId), "Budget saved successfully");
        return new Response("Budget saved successfully", { status: 200 });

    } catch (error) {
        return new Response("Failed to save budget", { status: 500 });
    }
}