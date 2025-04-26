import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MezonClient } from "mezon-sdk";
import { TextChannel } from "mezon-sdk/dist/cjs/mezon-client/structures/TextChannel.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { sendMessageAndGetResponse } from "./gemini.js";

// Load environment variables
dotenv.config();
const token = process.env.MEZON_TOKEN;
if (!token) {
  throw new Error("MEZON_TOKEN environment variable is not set");
}

// Mezon client
const client = new MezonClient(process.env.MEZON_TOKEN);

// Thêm biến để lưu trữ tin nhắn đã xử lý
const processedMessages = new Set<string>();

// Helper function to find a clan by name or ID
async function findClan(clanId?: string) {
  if (!clanId) {
    // If no clan specified and bot is only in one clan, use that
    if (client.clans.size === 1) {
      return client.clans.first()!;
    }
    // List available clans
    const clanList = Array.from(client.clans.values())
      .map((g) => `"${g.name}"`)
      .join(", ");
    throw new Error(
      `Bot is in multiple servers. Please specify server name or ID. Available servers: ${clanList}`
    );
  }

  // Try to fetch by ID first
  try {
    const clan = await client.clans.fetch(clanId);
    if (clan) return clan;
  } catch {
    // If ID fetch fails, search by name
    const clans = client.clans.filter(
      (g) => g.name.toLowerCase() === clanId.toLowerCase()
    );

    if (clans.size === 0) {
      const availableClans = Array.from(client.clans.values())
        .map((g) => `"${g.name}"`)
        .join(", ");
      throw new Error(
        `Clan "${clanId}" not found. Available servers: ${availableClans}`
      );
    }
    if (clans.size > 1) {
      const clanList = clans.map((g) => `${g.name} (ID: ${g.id})`).join(", ");
      throw new Error(
        `Multiple servers found with name "${clanId}": ${clanList}. Please specify the server ID.`
      );
    }
    return clans.first()!;
  }
  throw new Error(`Clan "${clanId}" not found`);
}

// Helper function to find a channel by name or ID within a specific clan
async function findChannel(
  channelId: string,
  clanId?: string
): Promise<TextChannel> {
  const clan = await findClan(clanId);

  // First try to fetch by ID
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel instanceof TextChannel && channel.clan.id === clan.id) {
      return channel;
    }
  } catch {
    // If fetching by ID fails, search by name in the specified clan
    const channels = clan.channels.cache.filter(
      (channel): channel is TextChannel =>
        channel instanceof TextChannel &&
        (channel.name?.toLowerCase() === channelId.toLowerCase() ||
          channel.name?.toLowerCase() ===
          channelId.toLowerCase().replace("#", ""))
    );

    if (channels.size === 0) {
      const availableChannels = clan.channels.cache
        .filter((c): c is TextChannel => c instanceof TextChannel)
        .map((c) => `"#${c.name}"`)
        .join(", ");

      throw new Error(
        `Channel "${channelId}" not found in server "${clan.name}". Available channels: ${availableChannels}`
      );
    }
    if (channels.size > 1) {
      const channelList = channels
        .map((c) => `#${c.name} (${c.id})`)
        .join(", ");
      throw new Error(
        `Multiple channels found with name "${channelId}" in server "${clan.name}": ${channelList}. Please specify the channel ID.`
      );
    }
    return channels.first()!;
  }
  throw new Error(
    `Channel "${channelId}" is not a text channel or not found in server "${clan.name}"`
  );
}

// Updated validation schemas
const SendMessageSchema = z.object({
  server: z
    .string()
    .optional()
    .describe("Clan name or ID (optional if bot is only in one server)"),
  channel: z.string().describe('Channel name (e.g., "general") or ID'),
  message: z.string(),
});

const ReadMessagesSchema = z.object({
  server: z
    .string()
    .optional()
    .describe("Clan name or ID (optional if bot is only in one server)"),
  channel: z.string().describe('Channel name (e.g., "general") or ID'),
  limit: z.number().min(1).max(100).default(50),
});

const AskGeminiSchema = z.object({
  server: z
    .string()
    .optional()
    .describe("Clan name or ID (optional if bot is only in one server)"),
  channel: z.string().describe('Channel name (e.g., "general") or ID'),
  question: z.string().describe("The question to ask Gemini"),
  messages: z.any().describe("List of messages to use as context"),
});

// Create server instance
const server = new Server(
  {
    name: "mezon",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "send-message",
        description: "Send a message to a Mezon channel",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                "Clan name or ID (optional if bot is only in one server)",
            },
            channel: {
              type: "string",
              description: 'Channel name (e.g., "general") or ID',
            },
            message: {
              type: "string",
              description: "Message content to send",
            },
          },
          required: ["channel", "message"],
        },
      },
      {
        name: "read-messages",
        description: "Read recent messages from a Mezon channel",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                "Clan name or ID (optional if bot is only in one server)",
            },
            channel: {
              type: "string",
              description: 'Channel name (e.g., "general") or ID',
            },
            limit: {
              type: "number",
              description: "Number of messages to fetch (max 100)",
              default: 50,
            },
          },
          required: ["channel"],
        },
      },
      {
        name: "ask-gemini",
        description: "Ask Gemini AI about infomation in a channel",
        inputSchema: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                "Clan name or ID (optional if bot is only in one server)",
            },
            channel: {
              type: "string",
              description: "Channel name or ID",
            },
            question: {
              type: "string",
              description: "The question to ask Gemini",
            },
            tools: {
              type: "array",
              description: "List of tools to use",
            },
            messages: {
              type: "array",
              description: "List of messages to use as context",
            },
            required: ["channel", "question", "messages"],
          },
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "send-message": {
        const {
          server: serverId,
          channel: channelId,
          message,
        } = SendMessageSchema.parse(args);
        const channel = await findChannel(channelId, serverId);
        const sent = await channel.send({ t: message });
        return {
          content: [
            {
              type: "text",
              text: `Message sent successfully to #${channel.name} in ${channel.clan.name}. Message ID: ${sent.message_id}`,
            },
          ],
        };
      }

      case "read-messages": {

        const {
          server: serverId,
          channel: channelId,
          limit,
        } = ReadMessagesSchema.parse(args);
        const channel = await findChannel(channelId, serverId);

        const messages = channel.messages.values();

        const formattedMessages = Array.from(messages).map((msg) => ({
          channel: `${channel.name}`,
          server: channel.clan.name,
          author: msg.sender_id,
          content: msg.content,
          channel_id: channel.id,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(formattedMessages, null, 2),
            },
          ],
        };
      }

      case "ask-gemini": {
        const {
          server: serverId,
          channel: channelId,
          question,
          messages,
        } = AskGeminiSchema.parse(args);

        const channelMessages = messages.slice(0, -1);
        console.error("Formatted messages:", channelMessages);
        const response = await sendMessageAndGetResponse(
          question,
          channelMessages
        );

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
});

client.once("ready", () => {
  console.error("✅ Mezon bot is ready!");

  if (client.clans.size === 0) {
    console.error("⚠️ Bot has not joined any clan yet.");
    return;
  }
  console.error("📋 Bots are in clans:");
  for (const clan of client.clans.values()) {
    console.error(`- ${clan.name} (ID: ${clan.id})`);
    const textChannels = Array.from(clan.channels.cache.values()).filter(
      (c) => c instanceof TextChannel
    );

    if (textChannels.length > 0) {
      console.error(`  📺 Text channels:`);
      for (const channel of textChannels) {
        console.error(`- #${channel.name} (ID: ${channel.id})`);
      }
    } else {
      console.error("  ⚠️ There are no text channels.");
    }
  }
});

client.onChannelMessage(async (data) => {
  try {
    const clan = await client.clans.fetch(data?.clan_id!);
    const textChannels = Array.from(clan.channels.cache.values()).filter(
      (c) => c instanceof TextChannel
    );

    if (textChannels.length > 0) {
      console.error(`  📺 Text channels::`);
      for (const channel of textChannels) {
        console.error(`    - #${channel.name} (ID: ${channel.id})`);
      }
    } else {
      console.error("⚠️No text channels available.");
    }
  } catch (error) { }
});

async function main() {
  try {
    const token = process.env.MEZON_TOKEN;
    if (!token) {
      throw new Error("MEZON_TOKEN environment variable is not set");
    }

    try {
      await client.login();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error("Mezon MCP Clan running on stdio");
    } catch (error) {
      console.error("Fatal error in main():", error);
      process.exit(1);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
