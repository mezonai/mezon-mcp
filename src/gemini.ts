import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function processWithGemini(message: string, context?: string) {
    try {
        const result = await model.generateContent(message);

        const response = await result.response;
        console.error("Response from Gemini:", response.text());
        return response.text();
    } catch (err) {
        console.error("Error in processWithGemini:", err);
        return "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này.";
    }
}

// Hàm tạo prompt cho Gemini
export function createPrompt(message: string, context?: string) {
    return context 
        ? `${context}\n\nUser: ${message}\nBot:`
        : `You are a helpful assistant. Please respond to this message: ${message}`;
}

// Hàm gửi tin nhắn và nhận phản hồi từ Gemini
export async function sendMessageAndGetResponse(message: string, context?: string) {
    try {
        const prompt = createPrompt(message, context);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (err) { 
        console.error("Error in sendMessageAndGetResponse:", err);
        return "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này.";
    }
}