import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  ReadMessageFunctionDeclaration,
  SendMessageFunctionDeclaration,
} from "./fn/convert.js";
import { readMessages, sendMessage } from "./fn/handleTool.js";

interface Message {
  author: string;
  channel: string;
  channel_id: string;
  server: string;
  content: string | { t: string };
}

interface FunctionCall {
  name: string;
  args: any;
}

interface FunctionResponse {
  name: string;
  response: {
    content: string;
  };
}

interface ContentPart {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

interface Content {
  role: string;
  parts: ContentPart[];
}

dotenv.config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function sendMessageAndGetResponse(
  question: string,
  context?: any,
  tools?: any
) {
  try {
    const systemPrompt = `Bạn là một trợ lý ảo tên **Mezon Bot** hoạt động trong các kênh chat.
Vai trò của bạn bao gồm:
- Tóm tắt hoặc hiểu nội dung tin nhắn trước đó.
- Trả lời tin nhắn của người dùng một cách tự nhiên và phù hợp ngữ cảnh.
- Khi cần gửi tin nhắn, bạn **phải sử dụng đúng ID của kênh**, không dùng tên kênh.
- Bạn có quyền đọc các tin nhắn gần đây trong kênh nếu cần để đưa ra phản hồi chính xác hơn.
Lưu ý:
- Tin nhắn sẽ có định dạng bao gồm: tên người gửi, tên kênh, ID kênh và tên server.
- Nếu được yêu cầu gọi công cụ read-message, bạn cần phản hồi tiếp sau khi đã nhận được nội dung.
- Luôn đảm bảo nội dung bạn gửi lại thân thiện, dễ hiểu, không máy móc.
Hãy phản hồi như một trợ lý AI thông minh và hiểu ngữ cảnh tốt.`;

    let currentContents: Content[] = [
      {
        role: "model",
        parts: [{ text: systemPrompt }],
      },
    ];

    if (Array.isArray(context)) {
      for (const msg of context) {
        const text =
          typeof msg.content === "object" ? msg.content.t : msg.content;
        const role = msg.author === process.env.BOT ? "model" : "user";
        const fullText = `Từ người dùng ${msg.author} tại kênh ${msg.channel}  ID kênh ${msg.channel_id} trên server ${msg.server}:\n${text}`;
        currentContents.push({
          role: role,
          parts: [{ text: fullText }],
        });
      }
    }

    if (question) {
      currentContents.push({
        role: "user",
        parts: [{ text: question }],
      });
    }


    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: currentContents,
      config: {
        tools: [
          { functionDeclarations: [SendMessageFunctionDeclaration] },
          { functionDeclarations: [ReadMessageFunctionDeclaration] },
        ],
      },
    });


    if (result.functionCalls && result.functionCalls.length > 0) {
      const functionCall = result.functionCalls[0];
      const { name, args } = functionCall;

      switch (name) {
        case "send-message": {
          const { server, channel, message } = args as {
            server: string;
            channel: string;
            message: string;
          };

          await sendMessage(channel, message, server);
          return "send-message";
        }

        case "read-message": {
          const { server, channel, limit } = args as {
            server: string;
            channel: string;
            limit: number;
          };

          const readResult = await readMessages(channel, limit, server);
          let responseText = "Không thể đọc tin nhắn hoặc kênh trống.";

          if (readResult && typeof readResult === "object") {
            try {
              if (
                readResult.content &&
                Array.isArray(readResult.content) &&
                readResult.content[0]?.text
              ) {
                const messagesArray = JSON.parse(readResult.content[0].text);
                responseText = `Đã đọc được ${messagesArray.length} tin nhắn:\n${JSON.stringify(messagesArray, null, 2)}`;
              }
            } catch (error) {
              responseText = "Lỗi khi xử lý dữ liệu tin nhắn đọc được.";
            }
          }

          currentContents.push({
            role: "model",
            parts: [{
              functionCall: {
                name: functionCall.name || "",
                args: functionCall.args || {}
              }
            }],
          });
          currentContents.push({
            role: "function",
            parts: [{
              functionResponse: {
                name: "read-message",
                response: { content: responseText }
              }
            }],
          });

          const secondResult = await genAI.models.generateContent({
            model: "gemini-2.0-flash-001",
            contents: currentContents,
            config: {
              tools: [
                { functionDeclarations: [SendMessageFunctionDeclaration] }
              ],
            },
          });


          if (secondResult.functionCalls && secondResult.functionCalls.length > 0) {
            const secondFunctionCall = secondResult.functionCalls[0];
            if (secondFunctionCall.name === 'send-message') {
              const { server, channel, message } = secondFunctionCall.args as any;
              await sendMessage(channel, message, server);
              return "send-message";
            }
          } else if (secondResult.text) {
            return secondResult.text;
          }

          return "Không thể xử lý phản hồi sau khi đọc tin nhắn.";
        }

        default: {
          return `command ${name} not supported.`;
        }
      }
    } else if (result.text) {
      return result.text;
    }

    return "Bot không thể tạo phản hồi.";
  } catch (err) {
    console.error("Lỗi trong sendMessageAndGetResponse:", err);
    if (err instanceof Error) {
      return `Đã xảy ra lỗi: ${err.message}`;
    }
    return "Đã xảy ra lỗi không xác định khi xử lý yêu cầu của bạn.";
  }
}
