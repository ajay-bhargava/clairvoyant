import { AppServer, type AppSession } from "@mentra/sdk";
import { RateLimiter } from "./utils/core/rateLimiting";
import { initializeMemory } from "./utils/tools/memoryCall";
import { handleTranscription } from "./utils/transcriptionFlow";

const PACKAGE_NAME =
	process.env.PACKAGE_NAME ??
	(() => {
		throw new Error("PACKAGE_NAME is not set in .env file");
	})();
const MENTRAOS_API_KEY =
	process.env.MENTRAOS_API_KEY ??
	(() => {
		throw new Error("MENTRAOS_API_KEY is not set in .env file");
	})();
const PORT = parseInt(process.env.PORT || "3000");

class Clairvoyant extends AppServer {
	private questionRateLimiter: RateLimiter;

	constructor() {
		super({
			packageName: PACKAGE_NAME,
			apiKey: MENTRAOS_API_KEY,
			port: PORT,
		});

		this.questionRateLimiter = new RateLimiter(1000);
	}

	protected override async onSession(session: AppSession): Promise<void> {
		const [memorySession, peers] = await initializeMemory();

		session.events.onTranscription(async (data) => {
			// If its not a final utterance, skip
			if (!data.isFinal) return;

			// If the audio segment causing this transcription is too short, skip
			if (data.duration) {
				if (data.duration < 200) {
					return;
				}
			}

			// If the question rate limiter is triggered, skip
			if (this.questionRateLimiter.shouldSkip(session.logger, "Clairvoyant")) {
				return;
			}

			// Handle the transcription
			await handleTranscription(data, session, memorySession, peers);
		});
	}
}

const app = new Clairvoyant();
app.start().catch(console.error);
