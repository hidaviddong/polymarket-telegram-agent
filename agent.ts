import OpenAI from "openai";
import dayjs from "dayjs";
import {z} from "zod";
import { getEventInfo } from "./polymarket";
import { zodToJsonSchema } from "zod-to-json-schema";

const getEventInfoSchema = z.object({
   eventLink:z.string().url().describe('The full URL of the Polymarket event to fetch information.'),
})
const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1/",
});

interface ChatResult {
    content:string|null;
    citations:string[]|null;
}

const prompt = `
Please analyze the user's Polymarket trade following these steps:
You must think in English, and response in Chinese.
You must summary in 100-200 words, pure words, no markdown.

The user will input the following format:
I bought a polymarket event at \${percentage}% for \${choice} on \${eventLink}

1. Event Information Retrieval:
   - First, attempt to use the get_event_info tool to fetch detailed information about the current event based on the user's eventLink
   - If the tool call fails or returns an error, proceed directly to step 2 (Live Search)
   - If the tool call succeeds, summarize the retrieved JSON data briefly, extracting key information

2. Live Search Analysis:
   - Utilize your web search capabilities to find news, analysis, and market dynamics related to this event
   - Focus on recent developments that may impact the event outcome
   - If you have event data from step 1, combine it with your search results for comprehensive analysis

3. Investment Recommendation:
   - You are a professional trader, you need to provide clear investment advice in polymaket: BUY/SELL/LIMIT ORDER ?
   - At the beginning of your response, based on the user's specific position (YES/NO choice) and entry price point, combined with current market analysis

4. Response Requirements:
   - Clear structure with highlighted key points
   - Include data support and logical analysis
   - Provide actionable specific recommendations
   - If event data was successfully retrieved, mention it in your analysis
   - If event data was not available, rely on your search results and general market knowledge
`;


export async function chat(userMessage:string):Promise<ChatResult>{
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
          type:"function",
          function:{
              name:"get_event_info",
              description:"Get current Polymarket event info, include current event ",
              parameters:zodToJsonSchema(getEventInfoSchema)
          }
      },
    ]
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {role:'system',content:prompt},
      {role:'user',content:userMessage}
    ]
    const completion = await client.chat.completions.create({
        model: "grok-3-mini",
        messages,
        tools,
        tool_choice:'required'
      });

const responseMessage = completion.choices[0]?.message;
if(responseMessage?.tool_calls){
  console.log("\n--- OpenAI requested a tool call ---");
  const toolCalls = responseMessage.tool_calls
  
  // Add the assistant message with tool calls
  messages.push(responseMessage);
  
  for (const tool of toolCalls) {
    const functionName = tool.function.name
    const functionArgs = JSON.parse(tool.function.arguments)
    if(functionName === "get_event_info"){
      try {
        const eventInfo = await getEventInfo(functionArgs.eventLink)
        messages.push({
          role:'tool',
          tool_call_id: tool.id,
          content: JSON.stringify(eventInfo)
        })
      } catch (error) {
        console.error('Tool call failed:', error);
        messages.push({
          role:'tool',
          tool_call_id: tool.id,
          content: JSON.stringify({ error: 'Failed to fetch event info' })
        })
      }
    }
  }

  const secondCompletion = await client.chat.completions.create({
    model: "grok-3-mini",
    messages,
    // @ts-expect-error
    search_parameters: {
      mode: "on",
      return_citations: true,
      from_date: dayjs().format("YYYY-MM-DD"),
      to_date: dayjs().format("YYYY-MM-DD"),
    },
  })

  const content = secondCompletion.choices[0]!.message.content;
  // @ts-expect-error
  const citations = secondCompletion.citations;
  return {content,citations}

}else{
  const content = completion.choices[0]!.message.content;
  // @ts-expect-error
  const citations = completion.citations;
  return {content,citations}
}
}

