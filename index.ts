import OpenAI from "openai";
import dayjs from "dayjs";

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1/",
});

const completion = await client.chat.completions.create({
  model: "grok-3-latest",
  messages: [
    {
        role:"system",
        content: "Search in English , Reply me in chinese, you should summarize the result in your first sentence"
    },
    {
      role: "user",
      content: "New York City Mayoral Election?"
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
console.log(content, citations);

