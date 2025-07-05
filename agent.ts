import OpenAI from "openai";
import dayjs from "dayjs";
import {z} from "zod";
import { getEventInfo, getTradesInfo } from "./polymarket";
import { zodToJsonSchema } from "zod-to-json-schema";
import { prompt } from "./prompt";

const getEventInfoSchema = z.object({
   eventLink:z.string().url().describe('The full URL of the Polymarket event to fetch information.'),
})
const getTradesInfoSchema = z.object({
  conditionId:z.string().describe('The condition ID of the Polymarket event to fetch trades info.'),
})
const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1/",
});

interface ChatResult {
    content:string|null;
    citations:string[]|null;
}



type ProgressCallback = (message: string) => Promise<any>;

export async function chat(userMessage:string, onProgress: ProgressCallback):Promise<ChatResult>{
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {role:'system',content:prompt},
      {role:'user',content:userMessage}
    ]

    // 第一步：强制调用 get_event_info
    await onProgress("🛠 正在获取事件信息...");
    
    const firstCompletion = await client.chat.completions.create({
        model: "grok-3-mini",
        messages,
        tools: [{
          type:"function",
          function:{
              name:"get_event_info",
              description:"Get current Polymarket event info",
              parameters:zodToJsonSchema(getEventInfoSchema)
          }
        }],
        tool_choice: { type: "function", function: { name: "get_event_info" } }
    });

    const firstResponse = firstCompletion.choices[0]?.message;
    let hasEventInfo = false;
    
    if (firstResponse?.tool_calls) {
      messages.push(firstResponse);
      
      for (const toolCall of firstResponse.tool_calls) {
        if (toolCall.function.name === "get_event_info") {
          try {
            const eventInfo = await getEventInfo(JSON.parse(toolCall.function.arguments).eventLink);
            await onProgress("✅ 事件信息获取成功");
            
            if (eventInfo && !('error' in eventInfo)) {
              hasEventInfo = true;
            }
            
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(eventInfo)
            });
          } catch (error) {
            await onProgress("❌ 事件信息获取失败");
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: 'Failed to fetch event info' })
            });
          }
        }
      }
    }

    // 第二步：如果有事件信息，让 AI 自己决定是否调用 get_trades_info
    if (hasEventInfo) {
      
      const secondCompletion = await client.chat.completions.create({
          model: "grok-3-mini",
          messages,
          tools: [{
            type:"function",
            function:{
              name:"get_trades_info",
              description:"Get trades info for specific condition",
              parameters:zodToJsonSchema(getTradesInfoSchema)
            }
          }]
      });

      const secondResponse = secondCompletion.choices[0]?.message;
      if (secondResponse?.tool_calls) {
        messages.push(secondResponse);
        
        for (const toolCall of secondResponse.tool_calls) {
          if (toolCall.function.name === "get_trades_info") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const tradesInfo = await getTradesInfo(args.conditionId);
              await onProgress("✅ 链上交易信息获取成功");
              
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(tradesInfo)
              });
            } catch (error) {
              await onProgress("❌ 链上交易信息获取失败");
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: 'Failed to fetch trades info' })
              });
            }
          }
        }
      } else {
        // AI 没有调用工具，添加一个消息到上下文
        await onProgress("🤔 没有调用工具，继续分析...");
        if (secondResponse) {
          messages.push(secondResponse);
        }
      }
    }

    // 第三步：最终分析（包含 Live Search）
    await onProgress("🔍 正在进行实时搜索分析...");
  
    const finalCompletion = await client.chat.completions.create({
      model: "grok-3-mini",
      messages,
      // @ts-expect-error
      search_parameters: {
        mode: "on",
        return_citations: true,
        from_date: dayjs().subtract(3, 'day').format("YYYY-MM-DD"), 
        to_date: dayjs().format("YYYY-MM-DD"),
      }
    });

    const content = finalCompletion.choices[0]!.message.content;
    // @ts-expect-error
    const citations = finalCompletion.citations;
    console.log("最终分析结果：",content,citations)
    await onProgress("✅ 分析完成");
    return {content, citations};
}

