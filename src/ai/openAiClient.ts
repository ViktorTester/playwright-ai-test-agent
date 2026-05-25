import OpenAI from "openai";

export function createOpenAiClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set. Add it to your .env file.");
    }

    return new OpenAI({
        apiKey,
    });
}