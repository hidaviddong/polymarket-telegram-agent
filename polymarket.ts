// import z from 'zod'
// import { Mastra } from '@mastra/core/mastra';
// import { PinoLogger } from '@mastra/loggers';
// import { LibSQLStore } from '@mastra/libsql';
// import { Agent, createStep, createWorkflow } from '@mastra/core';
// import { deepseek } from '@ai-sdk/deepseek';
// import { xai } from '@ai-sdk/xai';

// function getSlugFromUrl(url:string) {
//   const slug = url.split("/")
//   const eventIndex = slug.indexOf('event');
//   let eventSlug = slug[eventIndex + 1];
//   if (eventSlug.includes('?tid=')) {
//       eventSlug = eventSlug.split('?tid=')[0];
//   }
//   return eventSlug;
// }

// const generateNewsQueryAgent = new Agent({
//   name: 'Generate News Query Agent',
//   instructions: `
// You are an event entity extractor. Given a JSON object describing a prediction market event, extract the single most relevant search query that would be directly useful for searching related news.

// - Output only one concise, self-contained search phrase or question that would be most effective for finding news about the event or its possible outcomes.
// - Do not include any platform-specific words or technical details.
// - Do not include market status, dates, probabilities, or numbers unless they are essential to the event.
// - Only output the most essential keywords or phrase.
// - If the event is about a competition or award, output the most relevant competitor or nominee with the relevant title.
// - If the event is about a person or organization and an action, output the person/organization and the action.
// - If the event is about a yes/no question, output the main subject and the action or outcome.

// Do not output any explanations or extra text, only the single search query string.
//   `,
//   model: deepseek('deepseek-chat')
// });

// const searchNewsAgent = new Agent({
//   name: 'Search News Agent',
//   instructions: `
//   You are a news search agent. Given a search query, search the web for the most relevant news articles.
//   `,
//   model: xai('grok-3-mini')
// });



// const getSlugStep = createStep({
//   id: 'get-slug',
//   description: 'Get slug from URL',
//   inputSchema: z.object({
//     url: z.string().url()
//   }),
//   outputSchema: z.object({
//     slug: z.string(),
//   }),
//   execute: async ({ inputData }) => {
//     const slug = getSlugFromUrl(inputData.url);
//     return { slug };
//   },
// })


// const getPolymarketEventStep = createStep({
//   id: 'get-polymarket-event',
//   description: 'Get event JSON from polymarket by URL',
//   inputSchema: z.object({
//     slug: z.string(),
//   }),
//   outputSchema: z.object({
//     events: z.any(),
//   }),
//   execute: async ({ inputData }) => {
//     const apiUrl = `https://gamma-api.polymarket.com/events?slug=${inputData.slug}`;
//     const response = await fetch(apiUrl);
//     const events = await response.json();
//     return { events };
//   },
// });


// const generateNewsQueryStep = createStep({
//   id: 'generate-news-query',
//   description: 'Extracts keywords/entities from event JSON for news search',
//   inputSchema: z.object({
//     events: z.any(),
//   }),
//   outputSchema: z.object({
//     newsQuery: z.string(),
//   }),
//   execute: async ({ inputData }) => {
//     const {text} = await generateNewsQueryAgent.generate([
//       {
//         role: "user",
//         content: `Given the following JSON object describing a prediction market event, extract the most relevant entities or options for news search as described in your instructions.
//         JSON: ${JSON.stringify(inputData.events)}`
//       }
//     ]);
    
//     return { newsQuery: text };
//   },
// });

// const searchNewsStep = createStep({
//   id: 'search-news',
//   description: 'Search news for the given query',
//   inputSchema: z.object({
//     newsQuery: z.string(),
//   }),
//   outputSchema: z.object({
//     news: z.string(),
//   }),
//   execute: async ({ inputData }) => {
//     const { text: news } = await searchNewsAgent.generate([
//       {
//         role: "user",
//         content: inputData.newsQuery
//       }
//     ]);
//     return { news };
//   },
// });

// const workflow = createWorkflow({
//   id: 'polymarket-workflow',
//   inputSchema: z.object({
//     url: z.string().url(),
//   }),
//   outputSchema: z.object({
//     news: z.array(z.object({
//       title: z.string(),
//       summary: z.string(),
//       url: z.string().url(),
//       date: z.string().optional(),
//     })),
//   })
// }).then(getSlugStep)
//   .then(getPolymarketEventStep)
//   .then(generateNewsQueryStep)
//   .then(searchNewsStep)
//   .commit()



// export const mastra = new Mastra({
//   workflows: { workflow },
//   storage: new LibSQLStore({
//     url: "file:../mastra.db",
//   }),
//   logger: new PinoLogger({
//     name: 'Mastra',
//     level: 'info',
//   }),
// });
