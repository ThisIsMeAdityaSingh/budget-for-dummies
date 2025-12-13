import { ServiceError } from "./error";
import { processBotCommands } from "./handlers/process-bot-commands";
import { pushExpense } from "./handlers/push-expense";
import { sendLogs } from "./handlers/send-logs";
import { verifyIncomingMessage } from "./utils/verify-incoming-message";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			const url = new URL(request.url);

			const body = await verifyIncomingMessage(request, env);

			if (url.pathname === "/" && request.method === "POST") {
				const textMessage = body!.message!.text;
				if (env.TELEGRAM_MENU_OPTIONS_COMMAND.split(',').includes(textMessage?.split(' ')[0]!)) {
					return processBotCommands(request, env);
				}

				return pushExpense(request, env);
			}

			return new Response("Not Found", { status: 404 });
		} catch (error) {
			if (error instanceof ServiceError) {
				sendLogs(env, error.level, error.message, error.stack || {}, error.errorCategory);
				return new Response(error.message, { status: error.statusCode });
			}
			return new Response("Internal Server Error", { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
