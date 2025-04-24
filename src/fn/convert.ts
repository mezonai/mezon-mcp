import { Type } from "@google/genai";

export function convertToolsToFunctionDeclarations(tools: any[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: convertSchemaTypes(tool.inputSchema),
  }));
}

function convertSchemaTypes(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  // Map type strings to Type constants if possible
  const mappedType =
    schema.type === "object"
      ? Type.OBJECT
      : schema.type === "array"
      ? Type.ARRAY
      : schema.type === "string"
      ? Type.STRING
      : schema.type === "number"
      ? Type.NUMBER
      : schema.type === "boolean"
      ? Type.BOOLEAN
      : schema.type;

  const result: any = { ...schema, type: mappedType };

  if (schema.properties) {
    result.properties = {};
    for (const key in schema.properties) {
      result.properties[key] = convertSchemaTypes(schema.properties[key]);
    }
  }

  if (schema.items) {
    result.items = convertSchemaTypes(schema.items);
  }

  return result;
}

export const SendMessageFunctionDeclaration = {
  name: "send-message",
  description: "Send a message to a Mezon channel",
  parameters: {
    type: Type.OBJECT,
    properties: {
      server: {
        type: Type.STRING,
        description: "Clan name or ID (optional if bot is only in one server)",
      },
      channel: {
        type: Type.STRING,
        description: 'Channel name (e.g., "general") or ID',
      },
      message: {
        type: Type.STRING,
        description: "Message content to send",
      },
    },
    required: ["channel", "message", "server"],
  },
};

// export const ReadMessageFunctionDeclaration = {
//   name: "read-message",
//   description: "Read recent messages from a Mezon channel",
//   parameters: {
//     type: Type.OBJECT,
//     properties: {
//       server: {
//         type: Type.STRING,
//         description: "Clan name or ID (optional if bot is only in one server)",
//       },
//       channel: {
//         type: Type.STRING,
//         description: 'Channel name (e.g., "general") or ID',
//       },
//       limit: {
//         type: Type.NUMBER,
//         description: "Number of messages to fetch (max 100)",
//         default: 50,
//       },
//     },
//     required: ["channel"],
//   },
// };
