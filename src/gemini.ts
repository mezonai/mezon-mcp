import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { SendMessageFunctionDeclaration } from "./fn/convert.js";
import { sendMessage } from "./fn/handleTool.js";
import { connectClient } from "./fn/connection.js";

dotenv.config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function sendMessageAndGetResponse(
  question: string,
  context?: any,
  tools?: any
) {
  try {
    console.error("Contents gửi context:", context);
    const contents = [];

    if (Array.isArray(context)) {
      for (const msg of context) {
        const text =
          typeof msg.content === "object" ? msg.content.t : msg.content;
        const role = msg.author === process.env.BOT ? "model" : "user";
        const fullText = `Từ người dùng ${msg.author} tại kênh ${msg.channel}  ID kênh ${msg.channel_id} trên server ${msg.server}:\n${text}`;
        contents.push({
          role: role,
          parts: [{ text: fullText }],
        });
      }
    }

    // Add the question as the last message
    if (question) {
      contents.push({
        role: "user",
        parts: [{ text: question }],
      });
    }

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents,
      config: {
        tools: [
          { functionDeclarations: [SendMessageFunctionDeclaration] },
          // { functionDeclarations: [ReadMessageFunctionDeclaration] },
        ],
      },
    });

    console.error("Kết quả trả về từ Gemini:", JSON.stringify(result, null, 2));

    if (result.functionCalls && result.functionCalls.length > 0) {
      const functionCall = result.functionCalls[0];
      const { name, args } = functionCall;

      switch (name) {
        case "send-message":
          await connectClient();

          const {
            server: serverId,
            channel: channelId,
            message,
          } = args as {
            server: string;
            channel: string;
            message: string;
          };

          console.error(
            `Gửi tin nhắn tới server ${serverId}, kênh ${channelId}: ${message}`
          );

          await sendMessage(channelId, message);
          return;
      }
    } else {
      return result.text;
    }
  } catch (err) {
    console.error("Lỗi trong sendMessageAndGetResponse:", err);
    return;
  }
}
