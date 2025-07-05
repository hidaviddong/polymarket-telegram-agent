interface PolymarketEvent {
  title: string;
  description: string;
  active: boolean;
  closed: boolean;
  liquidity: string;
  volume: string;
  volume24hr: string;
  tags: {label: string}[];
  markets: {
    conditionId: string;
    question: string;
    closed: boolean;
    umaResolutionStatus: string;
  }[];
}
export function getSlugFromUrl(url:string) {
  const slug = url.split("/")
  const eventIndex = slug.indexOf('event');
  let eventSlug = slug[eventIndex + 1] as string;
  if (eventSlug.includes('?tid=')) {
      eventSlug = eventSlug.split('?tid=')[0] as string;
  }
  return eventSlug;
}


export async function getEventInfo(url:string) {
  const slug = getSlugFromUrl(url);
  if(!slug){
    return {error: "Could not extract slug from URL."}
  }
  const apiUrl = `https://gamma-api.polymarket.com/events?slug=${slug}`;
  try {
    const response = await fetch(apiUrl);
    if(!response.ok) {
        return {error: `API request failed with status ${response.status}`}
    }
    const event = await response.json() as PolymarketEvent[];
    const eventData = event[0];
    if(!eventData){
        return {error: "Event not found for this slug."}
    }
    const simplifiedEvent = {
        event_group_title: eventData.title,
        description: eventData.description,
        status: eventData.active && !eventData.closed ? "Active" : "Closed",
        total_liquidity: parseFloat(eventData.liquidity),
        total_volume: parseFloat(eventData.volume),
        volume_24hr: parseFloat(eventData.volume24hr),
        tags: eventData.tags?.map((tag: any) => tag.label) || [],
        sub_markets: eventData.markets.map((market: any) => {
            // 解析 outcomes 和 prices
            let probabilities: Record<string, number> = {};
            try {
                const outcomes = JSON.parse(market.outcomes);
                const prices = JSON.parse(market.outcomePrices);
                outcomes.forEach((outcomeName: string, index: number) => {
                    probabilities[outcomeName] = parseFloat(prices[index]);
                });
            } catch (e) {
                // 如果解析失败，则保留原始字符串
                probabilities = { raw_outcomes: market.outcomes, raw_prices: market.outcomePrices } as any;
            }

            let status = "Active";
            if (market.closed) {
                status = market.umaResolutionStatus === 'resolved' ? 'Resolved' : 'Closed';
            }

            return {
                question: market.question,
                conditionId: market.conditionId,
                status: status,
                resolution_date: market.endDateIso,
                probabilities: probabilities,
                volume: parseFloat(market.volume),
            };
        }),
    };

    return simplifiedEvent
  } catch (error) {
    return {error: "An exception occurred while fetching event data."}
  }
}

export async function getTradesInfo(conditionId:string) {
    if(!conditionId){
        return {error: "Condition ID is required"}
    }
    const url = `https://data-api.polymarket.com/trades?market=${conditionId}&limit=10&offset=0&filterType=CASH&filterAmount=1000`
    try {
        const response = await fetch(url)
        if(!response.ok) {
            return {error: `API request failed with status ${response.status}`}
        }
        const trades = await response.json()
        return trades   
    } catch (error) {
        return {error: "An exception occurred while fetching trades data."}
    }
}
    