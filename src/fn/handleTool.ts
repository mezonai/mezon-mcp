import { client } from "./connection.js";

interface McpResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export const sendMessage = async (channel: string, message: string) => {
  try {
    await client.callTool({
      name: "send-message",
      arguments: {
        server: "hello888",
        channel,
        message,
      },
    });
  } catch (err) {
    console.error("Error sending message:", err);
  }
};

export const askGemini = async (
  channel: string,
  question: string,
  messages: any[],
  server?: string
): Promise<McpResponse | null> => {
  try {
    const response = (await client.callTool({
      name: "ask-gemini",
      arguments: {
        server: server || "hello888",
        channel,
        question,
        messages,
      },
    })) as McpResponse;

    if (response?.content?.[0]?.text) {
      await sendMessage(channel, response.content[0].text);
    } else {
      console.error("Invalid response format:", response);
    }
    return response;
  } catch (err) {
    console.error("Error", err);
    return null;
  }
};

export const readMessages = async (channel: string, limit: number = 5) => {
  try {
    return await client.callTool({
      name: "read-messages",
      arguments: {
        server: "hello888",
        channel,
        limit,
      },
    });
  } catch (err) {
    console.error("Error reading messages:", err);
    return null;
  }
};
