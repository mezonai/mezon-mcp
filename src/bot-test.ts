import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MezonClient } from "mezon-sdk";
import { TextChannel } from "mezon-sdk/dist/cjs/mezon-client/structures/TextChannel.js";
import { processWithGemini } from "./gemini.js";
import dotenv from "dotenv";

dotenv.config();

const mezonClient = new MezonClient(process.env.MEZON_TOKEN || "");

const client = new Client({
  name: "mezon-bot",
  version: "1.0.0",
  capabilities: {
    tools: ["send-message", "read-messages", "ask-gemini"],
  },
});

const commands = {
  help: {
    description: "Hiển thị danh sách các lệnh có sẵn",
    execute: async (channel: string) => {
      const helpText = `
🎮 **Danh sách lệnh:**
!help - Hiển thị danh sách lệnh
!ask [câu hỏi] - Hỏi Gemini AI ,
!ping - Kiểm tra bot có hoạt động không
!info - Hiển thị thông tin về bot
            `;
      await sendMessage(channel, helpText);
    },
  },
  ask: {
    description: "Hỏi bot AI",
    execute: async (channel: string, args: string[]) => {
      if (args.length === 0) {
        await sendMessage(
          channel,
          "Vui lòng nhập câu hỏi sau lệnh !ask !close để thóat chế độ hỏi"
        );
        return;
      }
      const question = args.join(" ");
      const response = await processWithGemini(question);
      await sendMessage(channel, response);
    },
  },
  ping: {
    description: "Kiểm tra bot có hoạt động không",
    execute: async (channel: string) => {
      await sendMessage(channel, "🏓 Pong! Bot đang hoạt động bình thường!");
    },
  },
  info: {
    description: "Hiển thị thông tin về bot",
    execute: async (channel: string) => {
      const infoText = `
🤖 **Thông tin bot:**
- Tên: Mezon AI Bot
- Phiên bản: 1.0.0
- Tính năng: Tích hợp Gemini AI
- Lệnh: !help để xem danh sách lệnh
            `;
      await sendMessage(channel, infoText);
    },
  },
  close: {
    description: "Thoát khỏi chế độ hỏi Gemini",
    execute: async (channel: string) => {
      await sendMessage(channel, "🔒 Đã thoát khỏi chế độ hỏi Gemini.");
    },
  },
};

async function sendMessage(channel: string, message: string) {
  try {
    const result = await client.callTool({
      name: "send-message",
      arguments: {
        server: "hello888",
        channel: channel,
        message: message,
      },
    });
    console.log("Message sent:", result);
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

async function readMessages(channel: string, limit: number = 5) {
  try {
    const result = await client.callTool({
      name: "read-messages",
      arguments: {
        server: "hello888",
        channel: channel,
        limit: limit,
      },
    });

    return result;
  } catch (err) {
    console.error("Error reading messages:", err);
    return null;
  }
}

async function handleCommand(channel: string, message: string) {
  const args = message.slice(1).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (!command || !(command in commands)) {
    return false;
  }

  try {
    await commands[command as keyof typeof commands].execute(channel, args);
    return true;
  } catch (err) {
    console.error(`Error executing command ${command}:`, err);
    await sendMessage(
      channel,
      "❌ An error occurred while executing the command."
    );
    return true;
  }
}

const activeSessions = new Map<string, boolean>();

const checkNewMessages = async () => {
  try {
    const result = await readMessages("1840681202449649664", 1);
    if (!result) {
      console.log("No messages received");
      return;
    }

    let messages = [];
    if (Array.isArray(result.content) && result.content[0]?.text) {
      try {
        messages = JSON.parse(result.content[0].text);
        console.log("Parsed messages:", messages);
      } catch (parseError) {
        console.error("Error parsing messages:", parseError);
        return;
      }
    } else {
      console.error("Invalid content format in result:", result.content);
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || typeof lastMessage !== "object") return;

    if (!lastMessage.channel || typeof lastMessage.channel !== "string") {
      console.log("Invalid message channel:", lastMessage);
      return;
    }

    if (lastMessage.author.includes(process.env.BOT || "bot")) {
      console.log("Message from bot, skipping:", lastMessage);
      return;
    }

    const sessionKey = `${lastMessage.channel}:${lastMessage.author}`;
    const messageText = lastMessage?.content?.t;

    if (typeof messageText === "string" && messageText.startsWith("!")) {
      const args = messageText.slice(1).trim().split(/ +/);
      const command = args.shift()?.toLowerCase();

      if (!command || !(command in commands)) return;

      try {
        await commands[command as keyof typeof commands].execute(
          lastMessage.channel,
          args
        );

        if (command === "ask") {
          activeSessions.set(sessionKey, true);
        } else if (command === "close") {
          activeSessions.delete(sessionKey);
        }

        return;
      } catch (err) {
        console.error(`Error executing command ${command}:`, err);
        await sendMessage(
          lastMessage.channel,
          "❌ Đã xảy ra lỗi khi thực thi lệnh."
        );
        return;
      }
    }

    if (activeSessions.has(sessionKey)) {
      const response = await processWithGemini(messageText);
      await sendMessage(lastMessage.channel, response);
    }
  } catch (error) {
    console.error("Unhandled error in onChannelMessage:", error);
  }
};

async function main() {
  let transport;
  try {
    await mezonClient.login();
    console.log("✅ Mezon bot is ready!");

    mezonClient.once("ready", () => {});

    mezonClient.onChannelMessage(async (data) => {
      checkNewMessages();
    });

    if (mezonClient.clans.size === 0) {
      console.error("⚠️ Bot has not joined any clan yet.");
      return;
    }

    console.error("📋 Bots are in clans:");
    for (const clan of mezonClient.clans.values()) {
      console.error(`- ${clan.name} (ID: ${clan.id})`);
      const textChannels = Array.from(clan.channels.cache.values()).filter(
        (c) => c instanceof TextChannel
      );

      if (textChannels.length > 0) {
        console.error(`  📺 Channels text:`);
        for (const channel of textChannels) {
          console.error(`- #${channel.name} (ID: ${channel.id})`);
        }
      }
    }

    transport = new StdioClientTransport({
      command: "node",
      args: ["./build/index.js"],
    });

    await client.connect(transport);
    console.log("Successfully connected to MCP server");

    const welcomeMessage =
      "Xin chào! Tôi là bot được tích hợp với Gemini AI. Gõ !help để xem danh sách lệnh.";
    await sendMessage("1840681202449649664", welcomeMessage);

    // setInterval(checkNewMessages, 10000);
  } catch (err) {
    console.error("Error occurred:", err);
    if (transport) {
      await transport.close();
    }
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
