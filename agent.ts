import OpenAI from "openai";
import dayjs from "dayjs";

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1/",
});

interface ChatResult {
    content:string|null;
    citations:string[]|null;
}
export async function chat(message:string):Promise<ChatResult>{

    const completion = await client.chat.completions.create({
        model: "grok-3-mini",
        messages: [
          {
              role:"system",
              content: "Search in English , Reply me in chinese, you should summarize the result in your first sentence"
          },
          {
            role: "user",
            content: `${message}`
          },
        ],
        // @ts-expect-error
        search_parameters: {
          mode: "on",
          return_citations: true,
          from_date: dayjs().format("YYYY-MM-DD"),
          to_date: dayjs().format("YYYY-MM-DD"),
        },
      });
    
const content = completion.choices[0]!.message.content;
// @ts-expect-error
const citations = completion.citations;
return {content,citations}
}
