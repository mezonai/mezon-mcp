import { MezonClient } from "mezon-sdk";
import { TextChannel } from "mezon-sdk/dist/cjs/mezon-client/structures/TextChannel.js";
import dotenv from "dotenv";
import { connectClient } from "./fn/connection.js";
import { askGemini, readMessages, sendMessage } from "./fn/handleTool.js";

dotenv.config();

const mezonClient = new MezonClient(process.env.MEZON_TOKEN || "");

let messages: any[] = [];

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

      try {
        console.error("Contents gửi context:", messages);
        await askGemini(channel, question, messages);
      } catch (err) {
        console.error("Error getting tools:", err);
        await sendMessage(
          channel,
          "Xin lỗi, có lỗi xảy ra khi lấy danh sách công cụ."
        );
      }
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

interface McpResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

const activeSessions = new Map<string, boolean>();

const checkNewMessages = async (data: any) => {
  if (data.sender_id === process.env.BOT) return;
  try {
    const result = await readMessages(data?.channel_id, 5);
    if (!result) {
      console.log("No messages received");
      return;
    }

    if (Array.isArray(result.content) && result.content[0]?.text) {
      try {
        messages = JSON.parse(result.content[0].text);
      } catch (parseError) {
        console.error("Error parsing messages:", parseError);
        return;
      }
    } else {
      return;
    }

    const lastMessage = messages[messages.length - 1];

    const sessionKey = `${lastMessage.channel}:${lastMessage.author}`;

    if (
      typeof data?.content?.t === "string" &&
      data?.content?.t.startsWith("!")
    ) {
      const args = data?.content?.t.slice(1).trim().split(/ +/);
      const command = args.shift()?.toLowerCase();

      if (!command || !(command in commands)) return;

      try {
        await commands[command as keyof typeof commands].execute(
          data.channel_id,
          args
        );

        if (command === "ask") {
          activeSessions.set(sessionKey, true);
          return;
        } else if (command === "close") {
          activeSessions.delete(sessionKey);
        }

        return;
      } catch (err) {
        console.error(`Error executing command ${command}:`, err);
        await sendMessage(
          data.channel_id,
          "❌ Đã xảy ra lỗi khi thực thi lệnh."
        );
        return;
      }
    }

    if (activeSessions.has(sessionKey)) {
      await askGemini(lastMessage.channel_id, data?.content?.t, messages);
    }
  } catch (error) {
    console.error("Unhandled error in onChannelMessage:", error);
  }
};

async function main() {
  let transport;
  try {
    // Connect to MCP client first
    transport = await connectClient();
    console.log("✅ Connected to MCP server");

    // Then connect to Mezon client
    await mezonClient.login();
    console.log("✅ Mezon bot is ready!");

    // Set up event listeners
    mezonClient.once("ready", () => {
      console.log("✅ Mezon client is ready");
    });

    mezonClient.onChannelMessage(async (data) => {
      console.error("Received message:", data);
      await checkNewMessages(data);
    });

    // Check if bot is in any clans
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
  } catch (err) {
    console.error("Error occurred:", err);
    if (transport) {
      await transport.close();
    }
    process.exit(1);
  }
}

main();
