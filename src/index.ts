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

// Load environment variables
dotenv.config();

// Mezon client setup
const client = new MezonClient("736f556c6f764f685162756e53387651");

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
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "send-message": {
        const { channel: channelId, message } = SendMessageSchema.parse(args);
        const channel = await findChannel(channelId);

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
        const { channel: channelId, limit } = ReadMessagesSchema.parse(args);
        const channel = await findChannel(channelId);

        const messages = channel.messages.values();
        const formattedMessages = Array.from(messages).map((msg) => ({
          channel: `#${channel.name}`,
          server: channel.clan.name,
          author: msg.sender_id,
          content: msg.content,
          // timestamp: msg.createdAt.toISOString(), // update on sdk
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

// Mezon client login and error handling
client.once("ready", () => {
  console.error("Mezon bot is ready!");
});

// Start the server
async function main() {
  // Check for Mezon token
  const token = process.env.MEZON_TOKEN;
  if (!token) {
    throw new Error("MEZON_TOKEN environment variable is not set");
  }

  try {
    // Login to Mezon
    await client.login();

    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Mezon MCP Clan running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

main();
