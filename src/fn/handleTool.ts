import { client, connectClient } from "./connection.js";

interface McpResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export const sendMessage = async (
  channel: string,
  message: string,
  server = "hello888"
) => {
  try {
    await connectClient();
    await client.callTool({
      name: "send-message",
      arguments: {
        server: server,
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

    if (response?.content?.[0]?.text === "send-message") return null;
    if (response?.content?.[0]?.text === "read-message") return null;

    if (response?.content?.[0]?.text) {
      await sendMessage(channel, response.content[0].text);
    } else {
      await sendMessage(
        channel,
        "Tôi không thể thực hiện yêu cầu  vui lòng thử lại"
      );
    }
    return response;
  } catch (err) {
    console.error("Error", err);
    return null;
  }
};

export const readMessages = async (
  channel: string,
  limit: number = 5,
  server = "hello888"
) => {
  try {
    return await client.callTool({
      name: "read-messages",
      arguments: {
        server: server,
        channel,
        limit,
      },
    });
  } catch (err) {
    console.error("Error reading messages:", err);
    return null;
  }
};
