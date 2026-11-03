import type { ComponentProps } from 'react';
import type { Icon } from '../components/design';

export type Lesson = {
  id: string; title: string; category: string; chapterId: string; minutes: number;
  icon: ComponentProps<typeof Icon>['name']; description: string; content: string[];
  question: string; answers: string[]; correct: number;
};
export type LessonChapter = { id: string; title: string; category: string; color: string; icon: ComponentProps<typeof Icon>['name']; lessonIds: string[] };

/** Original lessons keep their IDs so saved completion and bookmarks remain valid. */
export const lessons: Lesson[] = [
  {
    "id": "why-people-trade",
    "title": "Why People Trade",
    "category": "Foundations",
    "chapterId": "why-trade",
    "minutes": 4,
    "icon": "flag-outline",
    "description": "Write down one learning goal that you can measure without relying on profit.",
    "content": [
      "Markets bring together people with different needs. A business may exchange currencies to pay a supplier, an investor may hold an asset for years, and a speculator may seek a shorter-term price change. Their different purposes help explain why buying and selling can happen at the same price.",
      "Practice prompt: Write down one learning goal that you can measure without relying on profit."
    ],
    "question": "Do all market participants have the same goal?",
    "answers": [
      "No, their needs and time horizons differ",
      "Yes, every participant speculates",
      "Yes, everyone trades for one day"
    ],
    "correct": 0
  },
  {
    "id": "realistic-expectations",
    "title": "What You Can Really Make",
    "category": "Foundations",
    "chapterId": "why-trade",
    "minutes": 4,
    "icon": "flag-outline",
    "description": "Measure whether you followed a clear plan as well as the result.",
    "content": [
      "Trading results are uncertain. Returns depend on price changes, position size, costs, and the decisions made along the way. A winning week is not evidence of a dependable income, and a simulator cannot reproduce every condition of a live market.",
      "Practice prompt: Measure whether you followed a clear plan as well as the result."
    ],
    "question": "What does a profitable practice week establish?",
    "answers": [
      "That the same income is guaranteed next week",
      "Only that the recorded practice results were positive",
      "That risk can now be ignored"
    ],
    "correct": 1
  },
  {
    "id": "practice-first",
    "title": "Start with Practice",
    "category": "Foundations",
    "chapterId": "why-trade",
    "minutes": 4,
    "icon": "flag-outline",
    "description": "Make your first goal to explain an order before placing it.",
    "content": [
      "A virtual account lets you learn the order flow and review decisions without depositing real money. Treat the virtual balance as a learning tool: record your reasoning, choose consistent position sizes, and review mistakes instead of repeatedly resetting an account to hide them.",
      "Practice prompt: Make your first goal to explain an order before placing it."
    ],
    "question": "What is the main purpose of a practice account?",
    "answers": [
      "Proving that future profits are certain",
      "Avoiding the need to understand orders",
      "Learning and reviewing a process"
    ],
    "correct": 2
  },
  {
    "id": "participants",
    "title": "Who Is on the Other Side?",
    "category": "Foundations",
    "chapterId": "why-trade",
    "minutes": 4,
    "icon": "flag-outline",
    "description": "Separate observable price behavior from stories about why it happened.",
    "content": [
      "Banks, businesses, funds, and individuals can all participate in financial markets. Orders express different needs, and the identity of another participant is usually not visible from a price chart. A candle shows traded price information rather than a complete account of everyone’s motivation.",
      "Practice prompt: Separate observable price behavior from stories about why it happened."
    ],
    "question": "Can a candle identify every trader’s motivation?",
    "answers": [
      "No, a chart does not reveal every participant’s purpose",
      "Yes, the candle color identifies the buyer",
      "Yes, every wick names an institution"
    ],
    "correct": 0
  },
  {
    "id": "forex",
    "title": "Your First Look at Forex",
    "category": "Foundations",
    "chapterId": "why-trade",
    "minutes": 4,
    "icon": "flag-outline",
    "description": "Describe a pair in one sentence before opening its chart.",
    "content": [
      "A currency pair compares the value of one currency with another. In EUR/USD, EUR is the base currency and USD is the quote. A rate of 1.08 means one euro is worth 1.08 US dollars. Buying a pair expresses a view that its price will rise; selling expresses the opposite view.",
      "Practice prompt: Describe a pair in one sentence before opening its chart."
    ],
    "question": "In EUR/USD, which currency is the base?",
    "answers": [
      "US dollar",
      "Euro",
      "Both at once"
    ],
    "correct": 1
  },
  {
    "id": "base-quote",
    "title": "Base and Quote Currencies",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Use the pair order when explaining a price move.",
    "content": [
      "The first currency in a forex pair is the base; the second is the quote. The displayed rate tells you how much of the quote currency corresponds to one unit of the base. If EUR/USD rises, one euro buys more dollars, although each currency can still move differently against other currencies.",
      "Practice prompt: Use the pair order when explaining a price move."
    ],
    "question": "What does a higher EUR/USD rate mean?",
    "answers": [
      "One dollar always buys more euros",
      "Both currencies rise against every other currency",
      "One euro buys more US dollars"
    ],
    "correct": 2
  },
  {
    "id": "bid-ask",
    "title": "Two Prices, One Market",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Distinguish a real two-sided quote from the simulator’s sample mark.",
    "content": [
      "A quoted market can show a bid and an ask. The bid is the price at which a buyer is willing to buy; the ask is the price at which a seller is willing to sell. They need not be equal. Pipwise currently uses a fixed sample quote rather than a live two-sided order book.",
      "Practice prompt: Distinguish a real two-sided quote from the simulator’s sample mark."
    ],
    "question": "Which quote represents a seller’s offered price?",
    "answers": [
      "The ask",
      "The bid",
      "The account balance"
    ],
    "correct": 0
  },
  {
    "id": "spreads",
    "title": "Understand the Spread",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Record the pricing assumptions used in any practice result.",
    "content": [
      "The spread is the difference between ask and bid. It is one potential trading cost and may vary with liquidity, the instrument, or market conditions. An attractive chart move does not remove that cost. Compare results after all applicable costs rather than using the chart distance alone.",
      "Practice prompt: Record the pricing assumptions used in any practice result."
    ],
    "question": "How is a spread calculated?",
    "answers": [
      "Balance minus equity",
      "Ask minus bid",
      "High minus last year’s low"
    ],
    "correct": 1
  },
  {
    "id": "pips",
    "title": "Small Moves and Pips",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Check the instrument’s quote precision before describing a move.",
    "content": [
      "A pip is a conventional forex price increment. For many non-JPY pairs it is 0.0001; for many JPY pairs it is 0.01. Some platforms display fractional pips. The money value of a move also depends on position size and the currencies involved, so pip count alone is not a profit figure.",
      "Practice prompt: Check the instrument’s quote precision before describing a move."
    ],
    "question": "Does a pip count alone determine money profit?",
    "answers": [
      "Yes, every pip always equals one dollar",
      "Yes, every pair uses identical decimal places",
      "No, position size and currency conversion also matter"
    ],
    "correct": 2
  },
  {
    "id": "long-short",
    "title": "Long and Short",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Explain which price change would hurt your chosen practice direction.",
    "content": [
      "A long position benefits from a higher exit price before costs; a short benefits from a lower exit price before costs. Neither direction guarantees a profit. Pipwise’s practice engine reserves the position’s full entry value for both directions and does not provide leveraged borrowing.",
      "Practice prompt: Explain which price change would hurt your chosen practice direction."
    ],
    "question": "Which price change benefits a short before costs?",
    "answers": [
      "A fall from its entry price",
      "A rise from its entry price",
      "No price change always creates a profit"
    ],
    "correct": 0
  },
  {
    "id": "notional",
    "title": "The Size Behind the Trade",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Estimate the reserved amount before confirming a virtual order.",
    "content": [
      "Quote-currency notional is price multiplied by quantity. Pipwise displays its wallet in US dollars, so values need currency conversion where applicable. For USD/JPY, quantity is in base US-dollar units: its reserved dollar entry value equals the quantity, while yen-denominated price profit or loss is converted to dollars.",
      "Practice prompt: Estimate the reserved amount before confirming a virtual order."
    ],
    "question": "How is quote-currency notional calculated?",
    "answers": [
      "Quantity divided by account age",
      "Entry price multiplied by quantity",
      "Only the last decimal of the price"
    ],
    "correct": 1
  },
  {
    "id": "contract-size",
    "title": "Units, Lots, and Contracts",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Read a platform’s instrument specification before comparing quantities.",
    "content": [
      "A quantity label is meaningful only with its unit. A unit of currency, a broker-defined forex lot, and an exchange futures contract can represent different exposures. Pipwise’s order sheet uses units; do not assume its number is a broker lot or an exchange contract size.",
      "Practice prompt: Read a platform’s instrument specification before comparing quantities."
    ],
    "question": "What quantity unit does this simulator’s order sheet use?",
    "answers": [
      "A universal lot shared by every broker",
      "One futures contract by default",
      "Units"
    ],
    "correct": 2
  },
  {
    "id": "liquidity",
    "title": "Why Liquidity Matters",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Identify which live-market frictions your practice environment omits.",
    "content": [
      "Liquidity describes how readily an asset can be traded without a large change in price. It depends on available orders and conditions, not just a familiar symbol. Thin conditions can make spreads wider or execution less predictable. A fixed-quote simulator does not reproduce these changes.",
      "Practice prompt: Identify which live-market frictions your practice environment omits."
    ],
    "question": "What can happen when liquidity becomes thin?",
    "answers": [
      "Execution can become less predictable",
      "All orders become free of cost",
      "Every price move stops"
    ],
    "correct": 0
  },
  {
    "id": "volatility",
    "title": "Movement Is Not Direction",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Write one observation about movement size and another about direction.",
    "content": [
      "Volatility describes the extent of price variation. A volatile instrument can move sharply upward and downward; the term does not tell you which direction comes next. Distinguish the amount of movement from the trend when writing a market observation.",
      "Practice prompt: Write one observation about movement size and another about direction."
    ],
    "question": "Does higher volatility specify an upward direction?",
    "answers": [
      "Yes, it always means rising prices",
      "No, it describes variation rather than direction",
      "Yes, it always means a profit"
    ],
    "correct": 1
  },
  {
    "id": "market-hours",
    "title": "Sessions and Market Hours",
    "category": "Foundations",
    "chapterId": "market-basics",
    "minutes": 4,
    "icon": "globe-outline",
    "description": "Check the market’s calendar before interpreting an apparent gap.",
    "content": [
      "Instruments have different trading schedules. Forex activity varies through regional sessions, equities have exchange calendars, and some crypto venues operate continuously. Holidays, maintenance, and daylight-saving changes can affect availability. Check the relevant venue rather than assuming every market follows your local clock.",
      "Practice prompt: Check the market’s calendar before interpreting an apparent gap."
    ],
    "question": "What should determine the trading schedule you use?",
    "answers": [
      "Only the time on your phone",
      "A schedule copied from any other asset",
      "The instrument and its trading venue"
    ],
    "correct": 2
  },
  {
    "id": "candles",
    "title": "The Story in a Candle",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Identify open, high, low, and close on one sample candle.",
    "content": [
      "Each candlestick represents one time interval. Its body spans the opening and closing prices, while its wicks reach the interval’s high and low. A candle summarizes prices; it does not show every individual trade or guarantee what the next candle will do.",
      "Practice prompt: Identify open, high, low, and close on one sample candle."
    ],
    "question": "What do the wicks represent?",
    "answers": [
      "The high and low",
      "Trading fees",
      "Guaranteed future targets"
    ],
    "correct": 0
  },
  {
    "id": "timeframes",
    "title": "One Market, Many Timeframes",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Compare two timeframes while keeping the symbol unchanged.",
    "content": [
      "A timeframe controls how prices are grouped. A five-minute candle summarizes a different interval from a daily candle, so the same market can appear choppy on one chart and directional on another. State the timeframe whenever describing a pattern or trend.",
      "Practice prompt: Compare two timeframes while keeping the symbol unchanged."
    ],
    "question": "Why can two charts of one asset look different?",
    "answers": [
      "One timeframe must always be wrong",
      "They may group prices into different time intervals",
      "The asset has changed its identity"
    ],
    "correct": 1
  },
  {
    "id": "chart-types",
    "title": "Line, Area, or Candles?",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Use the same series to compare a line chart with candles.",
    "content": [
      "A line chart commonly connects a selected price such as each interval’s close. Candlesticks include open, high, low, and close. An area fill adds presentation rather than another forecast. Choose a chart form that exposes the information relevant to your observation.",
      "Practice prompt: Use the same series to compare a line chart with candles."
    ],
    "question": "What extra information do candles show beyond closing prices?",
    "answers": [
      "The next guaranteed price",
      "The identity of every trader",
      "Open, high, and low"
    ],
    "correct": 2
  },
  {
    "id": "candle-body",
    "title": "Read the Candle Body",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Describe a large body without predicting the next interval.",
    "content": [
      "The candle body shows the distance between the opening and closing prices for an interval. A large body indicates a large net change during that interval; it is not proof that the move will continue. Body size is more meaningful when compared with nearby candles on the same timeframe.",
      "Practice prompt: Describe a large body without predicting the next interval."
    ],
    "question": "What does a large candle body directly describe?",
    "answers": [
      "A large open-to-close change in that interval",
      "A guaranteed continuation",
      "The spread charged on every order"
    ],
    "correct": 0
  },
  {
    "id": "candle-wicks",
    "title": "Look Beyond the Body",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Compare a wick with the previous and following intervals.",
    "content": [
      "A wick marks prices beyond the candle’s body. A long upper wick means the high was substantially above the open and close range. It can prompt further observation, but it does not reveal all trading motives or establish a certain reversal.",
      "Practice prompt: Compare a wick with the previous and following intervals."
    ],
    "question": "What can you directly infer from a long upper wick?",
    "answers": [
      "A reversal is guaranteed",
      "The interval traded above its body range",
      "The market cannot rise again"
    ],
    "correct": 1
  },
  {
    "id": "gaps",
    "title": "When Prices Jump",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Mark a gap as an observation rather than a guaranteed target.",
    "content": [
      "A price gap appears when adjacent intervals do not cover a continuous range. Gaps may occur around closures, news, or thin trading, depending on the instrument. A chart gap is not a promise that price will return to fill it, and real orders may execute differently across a jump.",
      "Practice prompt: Mark a gap as an observation rather than a guaranteed target."
    ],
    "question": "Must a price gap always be filled?",
    "answers": [
      "Yes, always in the next interval",
      "Yes, before any other trade can occur",
      "No, a return into the gap is not guaranteed"
    ],
    "correct": 2
  },
  {
    "id": "swing-points",
    "title": "Find Swing Highs and Lows",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Write a simple swing definition and apply it to several candles.",
    "content": [
      "A swing high or low is a local turning area relative to neighboring prices. The exact definition depends on the rule you use. Set a consistent comparison window before labeling swings; otherwise you can unconsciously change the pattern to fit a preferred conclusion.",
      "Practice prompt: Write a simple swing definition and apply it to several candles."
    ],
    "question": "What makes swing labeling more consistent?",
    "answers": [
      "Using the same comparison rule",
      "Changing the rule after every loss",
      "Ignoring neighboring prices"
    ],
    "correct": 0
  },
  {
    "id": "trend",
    "title": "Trends Need Context",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Label a sequence and state what new price behavior would challenge it.",
    "content": [
      "An uptrend is often described using higher highs and higher lows; a downtrend uses lower highs and lower lows. A range has repeated movement between areas without a clear directional sequence. These descriptions depend on timeframe and can change as new prices arrive.",
      "Practice prompt: Label a sequence and state what new price behavior would challenge it."
    ],
    "question": "Which sequence commonly describes an uptrend?",
    "answers": [
      "Every candle having the same color",
      "Higher highs and higher lows",
      "A guarantee that the next price rises"
    ],
    "correct": 1
  },
  {
    "id": "support",
    "title": "Support as an Area",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Mark a zone using more than one exact price point.",
    "content": [
      "Support refers to an area where price previously encountered buying interest or slowed a decline. It is a historical observation, not an invisible floor. Different traders may draw the area differently, and price can pass through it. Explain the evidence for the zone and what would invalidate your idea.",
      "Practice prompt: Mark a zone using more than one exact price point."
    ],
    "question": "Can price move below a support area?",
    "answers": [
      "No, support is an absolute barrier",
      "Only if the chart is broken",
      "Yes, support can fail"
    ],
    "correct": 2
  },
  {
    "id": "resistance",
    "title": "Resistance as an Area",
    "category": "Technical analysis",
    "chapterId": "read-charts",
    "minutes": 4,
    "icon": "stats-chart-outline",
    "description": "Compare a resistance zone with the surrounding trend.",
    "content": [
      "Resistance describes an area where price previously encountered selling interest or slowed an advance. A prior response does not require the same response later. Treat the area as context for observing price rather than a certain turning point.",
      "Practice prompt: Compare a resistance zone with the surrounding trend."
    ],
    "question": "What does a resistance area describe?",
    "answers": [
      "A historical area of selling interest or stalled advances",
      "A guaranteed future maximum",
      "A limit on account deposits"
    ],
    "correct": 0
  },
  {
    "id": "moving-averages",
    "title": "Smooth the Noise",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Compare a short and long window on the same historical series.",
    "content": [
      "A moving average combines a rolling window of past prices into a smoother line. Changing the window changes its sensitivity. Because its inputs are historical, a moving average can lag a turning point and cannot establish a guaranteed future direction.",
      "Practice prompt: Compare a short and long window on the same historical series."
    ],
    "question": "What are moving averages calculated from?",
    "answers": [
      "Guaranteed future prices",
      "Historical prices",
      "Your wallet balance"
    ],
    "correct": 1
  },
  {
    "id": "sma-ema",
    "title": "SMA and EMA",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Describe the trade-off between responsiveness and noise.",
    "content": [
      "A simple moving average gives equal weight to prices in its window. An exponential moving average places more weight on recent observations. Greater responsiveness can also mean more reaction to short-term noise, so faster does not automatically mean better.",
      "Practice prompt: Describe the trade-off between responsiveness and noise."
    ],
    "question": "Which average puts more weight on recent prices?",
    "answers": [
      "Every simple average by definition",
      "Neither uses any recent prices",
      "An exponential moving average"
    ],
    "correct": 2
  },
  {
    "id": "rsi",
    "title": "Read RSI Carefully",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Record the lookback and surrounding trend alongside an RSI observation.",
    "content": [
      "The Relative Strength Index summarizes recent gains relative to recent losses using a chosen lookback. Common threshold labels such as overbought and oversold describe the indicator’s scale, not a command to sell or buy. Strong trends can keep an oscillator elevated or depressed.",
      "Practice prompt: Record the lookback and surrounding trend alongside an RSI observation."
    ],
    "question": "Does an overbought RSI reading guarantee an immediate fall?",
    "answers": [
      "No, a strong trend can keep the reading elevated",
      "Yes, the next candle must fall",
      "Yes, losses become impossible"
    ],
    "correct": 0
  },
  {
    "id": "macd",
    "title": "Momentum and MACD",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Compare a crossover in a trend with one in a range.",
    "content": [
      "MACD compares moving averages and is often displayed with a signal line and histogram. These components transform historical price information. Crossovers can occur repeatedly in sideways conditions, so an isolated crossover should not replace a complete observation and risk plan.",
      "Practice prompt: Compare a crossover in a trend with one in a range."
    ],
    "question": "Why can MACD produce repeated crossovers in a range?",
    "answers": [
      "It sees the future with certainty",
      "Historical prices can alternate around its averages",
      "Its histogram removes all market noise"
    ],
    "correct": 1
  },
  {
    "id": "bollinger",
    "title": "Bollinger Bands",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Distinguish a volatility observation from a direction forecast.",
    "content": [
      "Bollinger Bands place an upper and lower band around a moving average using a measure of variation. Their width can change as variation changes. A touch of a band does not prove that price must reverse, and a narrowing band does not specify the direction of a later move.",
      "Practice prompt: Distinguish a volatility observation from a direction forecast."
    ],
    "question": "What does a narrowing band directly tell you?",
    "answers": [
      "The next move must be upward",
      "A reversal is guaranteed now",
      "Recent measured variation has decreased"
    ],
    "correct": 2
  },
  {
    "id": "atr",
    "title": "Measure Range with ATR",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Use a range measure to describe movement without choosing a direction.",
    "content": [
      "Average True Range summarizes recent price ranges, including gaps through its true-range calculation. It is a measure of movement size rather than bullish or bearish direction. A chosen lookback and timeframe are essential context when comparing ATR readings.",
      "Practice prompt: Use a range measure to describe movement without choosing a direction."
    ],
    "question": "Does ATR identify bullish versus bearish direction?",
    "answers": [
      "No, it measures range rather than direction",
      "Yes, high ATR always means bullish",
      "Yes, low ATR always means bearish"
    ],
    "correct": 0
  },
  {
    "id": "volume",
    "title": "What Volume Can Tell You",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Check what your chart’s volume field actually measures.",
    "content": [
      "Volume measures activity according to the data source and instrument. Exchange trade volume and a forex platform’s tick count are different things. A rise in activity can add context to a price move, but it does not identify every participant’s intent or guarantee continuation.",
      "Practice prompt: Check what your chart’s volume field actually measures."
    ],
    "question": "Are exchange volume and forex tick count always identical measures?",
    "answers": [
      "Yes, they are universally interchangeable",
      "No, the source and measure can differ",
      "Neither depends on its source"
    ],
    "correct": 1
  },
  {
    "id": "trend-lines",
    "title": "Draw a Consistent Trend Line",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Apply one drawing rule to several historical sections.",
    "content": [
      "A trend line connects selected historical points to make a slope visible. Its placement depends on which points are chosen and whether bodies or wicks are used. Define a drawing rule before evaluating it and avoid moving the line only to preserve a preferred interpretation.",
      "Practice prompt: Apply one drawing rule to several historical sections."
    ],
    "question": "Which habit improves trend-line consistency?",
    "answers": [
      "Redrawing it until every trade looks correct",
      "Using a line as a guarantee of profit",
      "Defining which points to connect in advance"
    ],
    "correct": 2
  },
  {
    "id": "breakouts",
    "title": "Observe a Breakout",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Write a breakout rule without looking at the following candles.",
    "content": [
      "A breakout describes a move beyond a previously defined area. Whether the move continues is a separate question. Define the area, the observation interval, and what counts as a break before evaluating examples; otherwise your definition can change after seeing the outcome.",
      "Practice prompt: Write a breakout rule without looking at the following candles."
    ],
    "question": "What must be defined before evaluating a breakout?",
    "answers": [
      "The area and the rule for a break",
      "Only the profit you hope to make",
      "A guaranteed future target"
    ],
    "correct": 0
  },
  {
    "id": "false-breakouts",
    "title": "When a Break Does Not Hold",
    "category": "Technical analysis",
    "chapterId": "technical-tools",
    "minutes": 4,
    "icon": "construct-outline",
    "description": "Review one failed break using the rule you wrote before it.",
    "content": [
      "A move beyond a range can return inside it. Traders may call this a false breakout, but the label depends on an explicit time window and invalidation rule. Use the experience to examine the rule rather than assuming any tool can eliminate every unsuccessful observation.",
      "Practice prompt: Review one failed break using the rule you wrote before it."
    ],
    "question": "What makes a false-breakout label meaningful?",
    "answers": [
      "Hindsight without any rule",
      "A defined time window and invalidation rule",
      "A promise that the next breakout succeeds"
    ],
    "correct": 1
  },
  {
    "id": "risk",
    "title": "Protect Your Next Opportunity",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "Calculate a sample budget before considering a position size.",
    "content": [
      "A risk budget defines an amount you are prepared to lose in a scenario. For example, 1% of a $10,000 virtual balance is $100. That arithmetic is an educational exercise, not a recommendation for everyone. Actual losses can include costs and execution differences beyond a planned exit.",
      "Practice prompt: Calculate a sample budget before considering a position size."
    ],
    "question": "What is 1% of a $10,000 virtual account?",
    "answers": [
      "$1,000",
      "$10",
      "$100"
    ],
    "correct": 2
  },
  {
    "id": "risk-budget",
    "title": "A Budget Is a Limit",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "Add the planned loss amounts across a sample set of positions.",
    "content": [
      "A risk budget should be chosen before the outcome is known. Increasing it merely to recover a prior loss changes the original plan. Distinguish a per-trade budget from total exposure across several positions; several individually small positions can add up.",
      "Practice prompt: Add the planned loss amounts across a sample set of positions."
    ],
    "question": "What should you review when several positions are open?",
    "answers": [
      "Their combined exposure as well as each trade",
      "Only the newest position",
      "Only the number of winning trades"
    ],
    "correct": 0
  },
  {
    "id": "position-size",
    "title": "Quantity Changes the Outcome",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "Compare two quantities using the same entry and hypothetical exit.",
    "content": [
      "Before costs, a position’s profit or loss changes with quantity. Multiplying quantity by the distance between entry and a hypothetical exit gives a result in the quote currency. Convert it into the wallet currency when they differ, and allow for costs when interpreting the result.",
      "Practice prompt: Compare two quantities using the same entry and hypothetical exit."
    ],
    "question": "What happens to a given price-move P&L when quantity doubles?",
    "answers": [
      "It becomes zero",
      "Its magnitude doubles before costs",
      "It stops depending on price"
    ],
    "correct": 1
  },
  {
    "id": "stop-targets",
    "title": "Plan Protective Levels",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "State your intended exit rule in plain language.",
    "content": [
      "A stop level records where a trade idea may be invalidated; a target records a possible favorable exit. These are planning tools rather than guaranteed execution prices. In Pipwise, stop-loss and take-profit values are journal targets: virtual positions must currently be closed manually.",
      "Practice prompt: State your intended exit rule in plain language."
    ],
    "question": "Does entering a protective level auto-close a Pipwise position?",
    "answers": [
      "Yes, the target guarantees execution",
      "Yes, it guarantees profit",
      "No, close practice positions manually"
    ],
    "correct": 2
  },
  {
    "id": "risk-reward",
    "title": "Compare Risk and Potential Reward",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "Calculate both distances and keep them separate from probability.",
    "content": [
      "A reward-to-risk ratio compares a favorable scenario with an unfavorable one using specified exits. It does not include the likelihood of either scenario by itself. A large possible reward can coexist with a low success rate, so the ratio alone cannot prove that a method is profitable.",
      "Practice prompt: Calculate both distances and keep them separate from probability."
    ],
    "question": "Does reward-to-risk alone establish profitability?",
    "answers": [
      "No, outcome frequencies and costs also matter",
      "Yes, any large target guarantees profit",
      "Yes, losses no longer matter"
    ],
    "correct": 0
  },
  {
    "id": "correlation",
    "title": "Different Symbols, Shared Exposure",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "List the common drivers across your sample positions.",
    "content": [
      "Positions in different symbols can still react to similar forces. Several pairs involving the same currency may create overlapping exposure. Historical correlation can change, so a past relationship is context rather than a guarantee of diversification.",
      "Practice prompt: List the common drivers across your sample positions."
    ],
    "question": "Can different symbols still carry overlapping exposure?",
    "answers": [
      "No, different names eliminate shared risk",
      "Yes, they may share an important driver",
      "Only if their prices are equal"
    ],
    "correct": 1
  },
  {
    "id": "leverage",
    "title": "Understand Leverage",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "Explain why leverage changes capital sensitivity rather than prediction accuracy.",
    "content": [
      "Leverage allows exposure larger than the capital committed to it. It magnifies the effect of price changes relative to that capital, including losses. This app’s current practice wallet uses full collateral and does not offer leverage, so its reserved amount differs from a leveraged broker account.",
      "Practice prompt: Explain why leverage changes capital sensitivity rather than prediction accuracy."
    ],
    "question": "Does the current Pipwise wallet offer leveraged exposure?",
    "answers": [
      "Yes, every position is highly leveraged",
      "Yes, but only losses are magnified",
      "No, it uses full collateral"
    ],
    "correct": 2
  },
  {
    "id": "margin",
    "title": "Margin Is Not the Same as Cost",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "Keep collateral, costs, and potential loss as separate concepts.",
    "content": [
      "In a leveraged account, margin is collateral required to support a position. It is different from a commission or spread, and account rules can require more collateral or liquidate positions. Pipwise instead reserves the full entry value and is not modeling a broker’s margin system.",
      "Practice prompt: Keep collateral, costs, and potential loss as separate concepts."
    ],
    "question": "Is margin simply another name for a commission?",
    "answers": [
      "No, margin is collateral under account rules",
      "Yes, they are identical",
      "Yes, it is always a fixed trading fee"
    ],
    "correct": 0
  },
  {
    "id": "slippage",
    "title": "Expected and Actual Execution",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "Record where your simulation assumes perfect execution.",
    "content": [
      "Slippage is the difference between an expected price and the actual execution price. It can be favorable or unfavorable and may matter during fast movement or thin liquidity. A fixed sample quote does not recreate that execution process, which limits how practice results translate to live conditions.",
      "Practice prompt: Record where your simulation assumes perfect execution."
    ],
    "question": "Can slippage be favorable as well as unfavorable?",
    "answers": [
      "No, it always has exactly one size",
      "Yes, actual execution can differ in either direction",
      "No, it applies only to chart colors"
    ],
    "correct": 1
  },
  {
    "id": "drawdown",
    "title": "Track the Drop from a Peak",
    "category": "Risk management",
    "chapterId": "risk-management",
    "minutes": 4,
    "icon": "shield-checkmark-outline",
    "description": "Identify the time series used before comparing two drawdown statistics.",
    "content": [
      "Drawdown measures a decline from a prior peak in a specified account series. It is different from a single losing trade. Pipwise’s closed-trade drawdown uses its recorded balances after trades close; it does not capture every temporary movement while a trade is open.",
      "Practice prompt: Identify the time series used before comparing two drawdown statistics."
    ],
    "question": "Does closed-trade drawdown record every intratrade price move?",
    "answers": [
      "Yes, every market tick is recorded",
      "Yes, it is identical to the last trade loss",
      "No, it uses balances recorded at trade closures"
    ],
    "correct": 2
  },
  {
    "id": "hypothesis",
    "title": "Write a Testable Idea",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Write a hypothesis that another learner could check.",
    "content": [
      "A testable trade idea states what you observe, what you expect under specified conditions, and what would contradict the idea. It should be possible to review the statement after the event. A vague belief that an asset is good or bad is harder to evaluate consistently.",
      "Practice prompt: Write a hypothesis that another learner could check."
    ],
    "question": "Which idea is easier to review objectively?",
    "answers": [
      "One with explicit conditions and invalidation",
      "A belief with no observable conditions",
      "A target that changes after every candle"
    ],
    "correct": 0
  },
  {
    "id": "entry-conditions",
    "title": "Define an Entry Condition",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Write one observable condition without using the phrase looks good.",
    "content": [
      "An entry condition describes an observable event rather than an urge. It might refer to a price area or a completed interval under a practice rule. Define it before evaluating an example so that your decisions do not shift with the result.",
      "Practice prompt: Write one observable condition without using the phrase looks good."
    ],
    "question": "When should an entry condition be defined?",
    "answers": [
      "Only after a winning trade",
      "Before evaluating the outcome",
      "Whenever the last result becomes uncomfortable"
    ],
    "correct": 1
  },
  {
    "id": "invalidation",
    "title": "Know What Would Change Your Mind",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Write a condition that would lead you to reject your own hypothesis.",
    "content": [
      "Invalidation describes evidence that conflicts with the original trade idea. It helps you distinguish a planned review from changing a rule to avoid acknowledging a mistake. State the relevant price behavior or condition, along with the timeframe on which you will evaluate it.",
      "Practice prompt: Write a condition that would lead you to reject your own hypothesis."
    ],
    "question": "What does invalidation identify?",
    "answers": [
      "A guarantee that a stop fills exactly",
      "The amount of a monthly subscription",
      "Evidence that contradicts the original idea"
    ],
    "correct": 2
  },
  {
    "id": "exit-rules",
    "title": "Plan the Exit",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Write both favorable and unfavorable exit scenarios.",
    "content": [
      "An exit rule can depend on a price level, elapsed time, or a change in the reason for entering. Define how you will evaluate it before opening a position. Pipwise records protective targets for reflection but currently requires manual closure of virtual positions.",
      "Practice prompt: Write both favorable and unfavorable exit scenarios."
    ],
    "question": "Why define an exit before entry?",
    "answers": [
      "It makes the decision process reviewable",
      "It guarantees an exact live execution price",
      "It removes all uncertainty"
    ],
    "correct": 0
  },
  {
    "id": "sizing-plan",
    "title": "Turn a Plan into a Quantity",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Compare the order preview with your own quantity calculation.",
    "content": [
      "A plan becomes concrete when its scenario distances, quantity, and available capital are consistent. Check that the full reserved US-dollar value and entry fee fit the simulator’s available dollar cash. An idea that cannot be sized within the account’s rules needs revision before an order is placed.",
      "Practice prompt: Compare the order preview with your own quantity calculation."
    ],
    "question": "What must fit within available simulator cash?",
    "answers": [
      "Only the hoped-for profit",
      "Full reserved entry value plus entry fee",
      "Only the final decimal of quantity"
    ],
    "correct": 1
  },
  {
    "id": "economic-calendar",
    "title": "Use an Economic Calendar",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Separate the event time, expected value, actual release, and price response.",
    "content": [
      "An economic calendar lists scheduled releases such as policy decisions or economic reports. A schedule alone cannot tell you the actual result or the market’s response. Verify dates, time zones, and revisions using a current source; this app does not yet provide a connected live calendar.",
      "Practice prompt: Separate the event time, expected value, actual release, and price response."
    ],
    "question": "Can a release schedule guarantee the market reaction?",
    "answers": [
      "Yes, every scheduled release raises prices",
      "Yes, the listed time determines the direction",
      "No, the result and response remain uncertain"
    ],
    "correct": 2
  },
  {
    "id": "premarket-check",
    "title": "Make a Before-Trade Check",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Use the same short checklist for three practice decisions.",
    "content": [
      "A short checklist can make your practice process more consistent. Include the symbol and timeframe, the data’s age, the idea, the exit conditions, quantity, and costs. A checklist does not guarantee a result; it makes omissions easier to detect and discuss.",
      "Practice prompt: Use the same short checklist for three practice decisions."
    ],
    "question": "What is a useful purpose of a checklist?",
    "answers": [
      "Catching missing steps consistently",
      "Guaranteeing every trade wins",
      "Replacing all knowledge of the instrument"
    ],
    "correct": 0
  },
  {
    "id": "no-trade",
    "title": "Choosing to Wait",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Record one reasoned no-trade observation in your journal.",
    "content": [
      "Not taking a trade is also a decision. If your entry conditions are absent, the data is unclear, or the quantity does not fit the account, waiting can preserve the integrity of the practice plan. Activity by itself is not evidence of learning or a reason to change the rule.",
      "Practice prompt: Record one reasoned no-trade observation in your journal."
    ],
    "question": "What if the written entry conditions are absent?",
    "answers": [
      "A trade must still be opened immediately",
      "Waiting can be consistent with the plan",
      "The account balance determines the next price"
    ],
    "correct": 1
  },
  {
    "id": "trade-journal",
    "title": "Record the Reason, Not Just the Result",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Write your reasoning before pressing the practice order button.",
    "content": [
      "A useful journal records the decision before the outcome: observed context, hypothesis, quantity, and intended exit. After closure, add actual results and process notes. Keeping those stages separate helps reveal when hindsight is changing the story of the original decision.",
      "Practice prompt: Write your reasoning before pressing the practice order button."
    ],
    "question": "Which information is useful to record before the result?",
    "answers": [
      "Only a story written after a win",
      "Only the ending balance",
      "The hypothesis and intended rules"
    ],
    "correct": 2
  },
  {
    "id": "review-checklist",
    "title": "A Repeatable Review",
    "category": "Process",
    "chapterId": "trade-plans",
    "minutes": 4,
    "icon": "clipboard-outline",
    "description": "Review one winning and one losing example with the same questions.",
    "content": [
      "Use consistent review questions after both gains and losses. Ask whether the entry condition occurred, the quantity matched the plan, the exit rule was followed, and costs were included. A positive outcome can occur after a poor process, so review behavior separately from profit.",
      "Practice prompt: Review one winning and one losing example with the same questions."
    ],
    "question": "Does a positive outcome prove that the process was sound?",
    "answers": [
      "No, outcome and process need separate review",
      "Yes, all winning decisions are perfect",
      "Yes, rules matter only after losses"
    ],
    "correct": 0
  },
  {
    "id": "mindset",
    "title": "Trade the Plan, Not the Feeling",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Write a plan that remains understandable after your mood changes.",
    "content": [
      "A trading plan records the hypothesis, entry conditions, risk, and exit before a position is opened. Strong emotions can tempt you to change those rules after the result begins to unfold. A written record makes the change visible and easier to review.",
      "Practice prompt: Write a plan that remains understandable after your mood changes."
    ],
    "question": "When should you define your exit plan?",
    "answers": [
      "Only after a loss",
      "Before entering",
      "Never"
    ],
    "correct": 1
  },
  {
    "id": "overconfidence",
    "title": "A Winning Streak Is a Small Sample",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Review the sample size before changing a practice rule.",
    "content": [
      "Several successful decisions can increase confidence faster than the evidence justifies. A short streak does not establish that a process works across different conditions. Keep position rules consistent while collecting a broader record rather than treating recent wins as certainty.",
      "Practice prompt: Review the sample size before changing a practice rule."
    ],
    "question": "What does a short winning streak fail to establish?",
    "answers": [
      "That those recorded trades ended positive",
      "That the account has a trade history",
      "Reliable performance in all market conditions"
    ],
    "correct": 2
  },
  {
    "id": "loss-aversion",
    "title": "Notice the Discomfort of a Loss",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Name the feeling, then review the rule separately.",
    "content": [
      "The discomfort of realizing a loss can encourage delaying an exit or changing a plan. Acknowledging that feeling is different from proving the trade idea remains valid. Compare current evidence with the written rule rather than with the desire to avoid a negative result.",
      "Practice prompt: Name the feeling, then review the rule separately."
    ],
    "question": "What should be compared with the original trade rule?",
    "answers": [
      "Current evidence",
      "Only the wish to avoid a loss",
      "The color of the app icon"
    ],
    "correct": 0
  },
  {
    "id": "revenge-trading",
    "title": "Pause After a Setback",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Write the next idea without referring to the amount of the previous loss.",
    "content": [
      "Revenge trading describes making a new decision mainly to recover a prior loss. A larger or rushed position can introduce a new risk without improving the original reasoning. A pause and written review can help you separate the next idea from the emotional impact of the last one.",
      "Practice prompt: Write the next idea without referring to the amount of the previous loss."
    ],
    "question": "What motivates a revenge trade?",
    "answers": [
      "A clearly independent hypothesis by definition",
      "Trying to recover a prior loss through a rushed decision",
      "The need to complete a lesson quiz"
    ],
    "correct": 1
  },
  {
    "id": "fomo",
    "title": "The Fear of Missing Out",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Describe the entry condition separately from the feeling of urgency.",
    "content": [
      "A fast move can create pressure to join immediately, even when your entry rule is absent. That feeling does not supply evidence about the next price. Compare the opportunity with your documented conditions, and recognize that a market will continue to offer observations even after one move has passed.",
      "Practice prompt: Describe the entry condition separately from the feeling of urgency."
    ],
    "question": "Does urgency itself provide evidence for a trade?",
    "answers": [
      "Yes, urgency always predicts continuation",
      "Yes, a missed move must immediately reverse",
      "No, a feeling is not an entry condition"
    ],
    "correct": 2
  },
  {
    "id": "confirmation-bias",
    "title": "Look for Conflicting Evidence",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Find one piece of counterevidence for your current chart interpretation.",
    "content": [
      "Confirmation bias is a tendency to favor information that supports an existing belief. In a chart review, you might notice supporting candles while ignoring nearby contradictions. Deliberately record one observation that challenges your interpretation before deciding how strong the evidence is.",
      "Practice prompt: Find one piece of counterevidence for your current chart interpretation."
    ],
    "question": "Which habit can expose confirmation bias?",
    "answers": [
      "Writing evidence that challenges your own idea",
      "Hiding every contradictory observation",
      "Only reviewing winning examples"
    ],
    "correct": 0
  },
  {
    "id": "patience",
    "title": "Practice Waiting Consistently",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Review a session in which no entry condition occurred.",
    "content": [
      "Patience in a practice plan means waiting for defined conditions rather than simply waiting a fixed number of minutes. It can be evaluated by comparing actions with the rule. A quiet session may contain fewer valid observations, and that does not make the learning session unsuccessful.",
      "Practice prompt: Review a session in which no entry condition occurred."
    ],
    "question": "How can patience be evaluated in a plan?",
    "answers": [
      "Only by how many orders were opened",
      "By whether actions respected defined conditions",
      "Only by the largest possible target"
    ],
    "correct": 1
  },
  {
    "id": "routines",
    "title": "Build a Small Routine",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Choose a routine you can repeat for one week of practice.",
    "content": [
      "A repeatable routine reduces the number of steps you must remember during a decision. For practice, a routine might include checking the data source, describing the chart, writing a scenario, and reviewing later. Keep it short enough to perform consistently and revise it deliberately after review.",
      "Practice prompt: Choose a routine you can repeat for one week of practice."
    ],
    "question": "What makes a routine useful?",
    "answers": [
      "It guarantees a winning outcome",
      "It eliminates the need for any reflection",
      "It supports consistent, reviewable steps"
    ],
    "correct": 2
  },
  {
    "id": "fatigue",
    "title": "Notice Attention and Fatigue",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Note one environmental condition before starting a learning session.",
    "content": [
      "Attention can vary with sleep, distractions, and the length of a session. A practice mistake may come from missing information rather than from a market concept. Record those conditions alongside your decisions so that you can distinguish execution habits from the rule being studied.",
      "Practice prompt: Note one environmental condition before starting a learning session."
    ],
    "question": "Why record distractions in a practice journal?",
    "answers": [
      "They can affect how a decision was carried out",
      "They reveal tomorrow’s price",
      "They remove all trading costs"
    ],
    "correct": 0
  },
  {
    "id": "uncertainty",
    "title": "Leave Room for Not Knowing",
    "category": "Psychology",
    "chapterId": "psychology",
    "minutes": 4,
    "icon": "heart-outline",
    "description": "Write a complete observation that includes what remains unknown.",
    "content": [
      "A useful market explanation can include uncertainty. A blurred chart, missing timeframe, or conflicting observations may justify an unclear conclusion. Forcing a direction when the available information is insufficient makes the result sound more certain without improving the evidence.",
      "Practice prompt: Write a complete observation that includes what remains unknown."
    ],
    "question": "What is reasonable when a chart lacks important context?",
    "answers": [
      "Invent missing prices to choose a direction",
      "State that the conclusion is unclear",
      "Promise an exact result anyway"
    ],
    "correct": 1
  },
  {
    "id": "virtual-orders",
    "title": "Place a Virtual Order",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Use the order preview to explain the asset, direction, and quantity.",
    "content": [
      "A practice order records an asset, direction, quantity, and entry quote. Pipwise uses fixed sample quotes and virtual funds. It does not route the order to an exchange or broker. Read the preview carefully so that you understand what will be recorded before confirming it.",
      "Practice prompt: Use the order preview to explain the asset, direction, and quantity."
    ],
    "question": "Where does a Pipwise virtual order execute?",
    "answers": [
      "At a connected brokerage by default",
      "On every exchange at once",
      "Inside the local simulator"
    ],
    "correct": 2
  },
  {
    "id": "order-fees",
    "title": "Account for Both Fees",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Compare a flat price result before and after simulated fees.",
    "content": [
      "The simulator deducts an entry fee when a position opens and an exit fee when it closes. Closed-trade profit or loss includes both. Closing at the same sample price can therefore produce a small net loss, even when the price-based result before fees is zero.",
      "Practice prompt: Compare a flat price result before and after simulated fees."
    ],
    "question": "Can an unchanged-price trade have a net loss?",
    "answers": [
      "Yes, entry and exit fees can create one",
      "No, fees exist only after a profit",
      "No, an unchanged quote refunds every fee"
    ],
    "correct": 0
  },
  {
    "id": "reserved-capital",
    "title": "Cash and Reserved Capital",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Reconcile available cash and reserved capital after a sample order.",
    "content": [
      "Opening a fully collateralized practice position moves its entry value out of available cash into reserved capital. Reserved capital is not itself a realized trading loss. It returns when the position closes, adjusted by the price result and closing fee under the simulator’s rules.",
      "Practice prompt: Reconcile available cash and reserved capital after a sample order."
    ],
    "question": "Is reserved capital automatically a realized loss?",
    "answers": [
      "Yes, the full reserved amount is lost at entry",
      "No, it supports an open position",
      "Yes, it is identical to the entry fee"
    ],
    "correct": 1
  },
  {
    "id": "mark-price",
    "title": "Understand the Mark",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Check whether a quote is live, delayed, historical, or simulated.",
    "content": [
      "A mark is the price used to value a position at a particular time. Pipwise currently values positions using its fixed sample quote for the asset. A generated candle path is a visual exercise and does not turn those quotes into a connected live market feed.",
      "Practice prompt: Check whether a quote is live, delayed, historical, or simulated."
    ],
    "question": "Does the generated chart make Pipwise quotes live?",
    "answers": [
      "Yes, drawing a candle connects an exchange",
      "Yes, every chart point executes a trade",
      "No, quotes remain fixed samples"
    ],
    "correct": 2
  },
  {
    "id": "realized-pnl",
    "title": "When a Result Becomes Realized",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Compare closed results with the original hypothesis in your journal.",
    "content": [
      "Realized profit or loss belongs to a position that has been closed. Pipwise stores the closed result after both simulated fees in trade history. It is distinct from a temporary value change on an open position and from the amount of collateral returned at closure.",
      "Practice prompt: Compare closed results with the original hypothesis in your journal."
    ],
    "question": "Where does a realized trade result belong?",
    "answers": [
      "In closed-trade history",
      "Only in an open order preview",
      "In a list of account passwords"
    ],
    "correct": 0
  },
  {
    "id": "unrealized-pnl",
    "title": "Read Open Profit and Loss",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Read the fee label before comparing open and closed results.",
    "content": [
      "Unrealized profit or loss values an open position against its entry under the current mark. It can change before closure in a changing market. Pipwise shows open price-based P&L before fees, while current equity already reflects entry fees that were deducted from cash.",
      "Practice prompt: Read the fee label before comparing open and closed results."
    ],
    "question": "Is open price-based P&L the same as a final net result?",
    "answers": [
      "Yes, it can never change after entry",
      "No, the final result also depends on closure and fees",
      "Yes, it includes every future fee automatically"
    ],
    "correct": 1
  },
  {
    "id": "closing-shorts",
    "title": "Close a Short Position",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Calculate one favorable and one unfavorable hypothetical short exit.",
    "content": [
      "A short’s price-based result in the quote currency is entry minus exit, multiplied by quantity. A lower exit is favorable before costs; a higher exit is unfavorable. For USD/JPY, Pipwise converts yen profit or loss to dollars. Closure returns the reserved dollar capital, adjusted by the result and exit fee.",
      "Practice prompt: Calculate one favorable and one unfavorable hypothetical short exit."
    ],
    "question": "Which subtraction describes a short’s result per unit in the quote currency before fees?",
    "answers": [
      "Exit minus entry",
      "Balance minus lesson count",
      "Entry minus exit"
    ],
    "correct": 2
  },
  {
    "id": "manual-targets",
    "title": "Targets Need Manual Review",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Compare the intended target with the actual recorded close.",
    "content": [
      "The stop-loss and take-profit fields currently record your intended protective levels for reflection. They are not an automated execution system. Review open positions and use Close position manually; a displayed target alone does not create a closed trade in the journal.",
      "Practice prompt: Compare the intended target with the actual recorded close."
    ],
    "question": "What closes a virtual position in the current app?",
    "answers": [
      "The manual Close position action",
      "Merely writing a target value",
      "Opening a lesson screen"
    ],
    "correct": 0
  },
  {
    "id": "journal-review",
    "title": "Review One Closed Trade",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Write one process lesson from a closed virtual trade.",
    "content": [
      "A closed-trade review can compare the initial reason, position size, fee-adjusted result, and adherence to the exit plan. Ask which parts of the process were observable at the time and which were learned later. Keep a distinction between a favorable result and a well-followed rule.",
      "Practice prompt: Write one process lesson from a closed virtual trade."
    ],
    "question": "What should a review separate?",
    "answers": [
      "All winning trades from any explanation",
      "Decision quality and the eventual outcome",
      "The symbol from every price"
    ],
    "correct": 1
  },
  {
    "id": "series-review",
    "title": "Look Across a Series",
    "category": "Practice lab",
    "chapterId": "practice-lab",
    "minutes": 4,
    "icon": "flask-outline",
    "description": "Identify one repeated process habit across several journal entries.",
    "content": [
      "Reviewing several decisions can reveal repeated habits that one trade cannot. Compare consistent rules across the series and include losing as well as winning examples. A series is still limited by its size and conditions, so record the range of situations it actually covers.",
      "Practice prompt: Identify one repeated process habit across several journal entries."
    ],
    "question": "Which examples belong in a balanced series review?",
    "answers": [
      "Only the most profitable trade",
      "Only examples selected after the conclusion",
      "Winning and losing decisions"
    ],
    "correct": 2
  },
  {
    "id": "win-rate",
    "title": "A Win Rate Needs Context",
    "category": "Performance",
    "chapterId": "review-grow",
    "minutes": 4,
    "icon": "trophy-outline",
    "description": "Pair the win rate with average win and average loss.",
    "content": [
      "Win rate is the fraction of closed trades with positive net results under the chosen definition. It does not describe how large the wins or losses were. Pipwise includes breakeven closed trades in the total, so read the definition before comparing statistics across tools.",
      "Practice prompt: Pair the win rate with average win and average loss."
    ],
    "question": "Can win rate alone establish total profitability?",
    "answers": [
      "No, the sizes of wins, losses, and costs matter",
      "Yes, every rate above zero proves profit",
      "Yes, trade sizes are irrelevant"
    ],
    "correct": 0
  },
  {
    "id": "average-payoff",
    "title": "Compare Average Win and Loss",
    "category": "Performance",
    "chapterId": "review-grow",
    "minutes": 4,
    "icon": "trophy-outline",
    "description": "Compare an average result with the best and worst closed trades.",
    "content": [
      "Average win combines positive results and divides by the number of winning trades; average loss does the same for negative results. Averages summarize a distribution and can hide unusually large outcomes. Review the largest outcomes and sample size alongside the averages.",
      "Practice prompt: Compare an average result with the best and worst closed trades."
    ],
    "question": "What can an average hide?",
    "answers": [
      "The existence of every trade",
      "Unusually large individual outcomes",
      "The account’s display language"
    ],
    "correct": 1
  },
  {
    "id": "profit-factor",
    "title": "Read Profit Factor",
    "category": "Performance",
    "chapterId": "review-grow",
    "minutes": 4,
    "icon": "trophy-outline",
    "description": "Check both components before interpreting the ratio.",
    "content": [
      "Profit factor divides gross positive closed results by the absolute amount of gross negative closed results. If there are no losing trades, the ratio lacks a finite denominator; Pipwise shows a dash. The statistic summarizes recorded results and does not predict future performance.",
      "Practice prompt: Check both components before interpreting the ratio."
    ],
    "question": "Why might profit factor be unavailable?",
    "answers": [
      "A winning trade cannot be counted",
      "The profile avatar is missing",
      "There are no recorded losing results for a denominator"
    ],
    "correct": 2
  },
  {
    "id": "expectancy",
    "title": "Average Result per Trade",
    "category": "Performance",
    "chapterId": "review-grow",
    "minutes": 4,
    "icon": "trophy-outline",
    "description": "Record the sample and sizing assumptions beside an average.",
    "content": [
      "An average net result per trade divides total net closed results by the number of closed trades. It summarizes that observed series, including its costs and sizing choices. Changing the sample or quantity rules changes the meaning of the average.",
      "Practice prompt: Record the sample and sizing assumptions beside an average."
    ],
    "question": "What does average net result per trade summarize?",
    "answers": [
      "The observed closed-trade series",
      "A guaranteed result on the next order",
      "A price target for every asset"
    ],
    "correct": 0
  },
  {
    "id": "sample-size",
    "title": "Give the Sample Room to Grow",
    "category": "Performance",
    "chapterId": "review-grow",
    "minutes": 4,
    "icon": "trophy-outline",
    "description": "Describe what your sample includes and what it leaves out.",
    "content": [
      "A small set of outcomes can change sharply after one additional result. Larger samples can provide more information, but a large sample from only one type of condition may still be narrow. Describe both the number of observations and the conditions represented before drawing a conclusion.",
      "Practice prompt: Describe what your sample includes and what it leaves out."
    ],
    "question": "Is a large sample from one condition automatically universal?",
    "answers": [
      "Yes, sample size removes every limitation",
      "No, the conditions represented still matter",
      "Yes, no review is needed after it"
    ],
    "correct": 1
  },
  {
    "id": "backtesting",
    "title": "Keep the Future Hidden",
    "category": "Performance",
    "chapterId": "review-grow",
    "minutes": 4,
    "icon": "trophy-outline",
    "description": "Hide later candles when evaluating an earlier entry condition.",
    "content": [
      "A historical test evaluates a specified rule on past observations. Looking at later prices while defining earlier decisions introduces hindsight. Record assumptions about execution, costs, and which information was available at each point, and avoid repeatedly changing the rule to fit the same sample.",
      "Practice prompt: Hide later candles when evaluating an earlier entry condition."
    ],
    "question": "What introduces hindsight into a historical test?",
    "answers": [
      "Writing the rule before the test",
      "Including realistic costs in the result",
      "Using later information for an earlier decision"
    ],
    "correct": 2
  },
  {
    "id": "forward-testing",
    "title": "Practice a Rule as Events Unfold",
    "category": "Performance",
    "chapterId": "review-grow",
    "minutes": 4,
    "icon": "trophy-outline",
    "description": "Write each decision before viewing its later result.",
    "content": [
      "Forward practice applies a documented rule to observations as they become available. It can reveal ambiguity that was easy to overlook in hindsight. A fixed-quote simulator remains an educational exercise, and testing on live or historical data requires a clearly identified source and timing.",
      "Practice prompt: Write each decision before viewing its later result."
    ],
    "question": "What can forward practice reveal?",
    "answers": [
      "Ambiguity in applying a rule without hindsight",
      "A guarantee of future income",
      "An exemption from recording costs"
    ],
    "correct": 0
  },
  {
    "id": "review-plan",
    "title": "Choose Your Next Learning Goal",
    "category": "Performance",
    "chapterId": "review-grow",
    "minutes": 4,
    "icon": "trophy-outline",
    "description": "Choose one small improvement and a date to review your practice.",
    "content": [
      "A useful review ends with a specific next learning goal. Choose one behavior or concept that your record shows needs work, define how you will practice it, and decide when you will review again. Completing this course is a foundation for continued observation, not proof that trading outcomes are predictable.",
      "Practice prompt: Choose one small improvement and a date to review your practice."
    ],
    "question": "What makes a next learning goal useful?",
    "answers": [
      "It promises a fixed profit every day",
      "It names a specific behavior and review method",
      "It requires ignoring earlier mistakes"
    ],
    "correct": 1
  }
];

export const lessonChapters: LessonChapter[] = [
  {
    "id": "why-trade",
    "title": "Why Trade",
    "category": "Foundations",
    "color": "#FEF5DA",
    "icon": "flag-outline",
    "lessonIds": [
      "why-people-trade",
      "realistic-expectations",
      "practice-first",
      "participants",
      "forex"
    ]
  },
  {
    "id": "market-basics",
    "title": "Meet the Markets",
    "category": "Foundations",
    "color": "#EAF3FF",
    "icon": "globe-outline",
    "lessonIds": [
      "base-quote",
      "bid-ask",
      "spreads",
      "pips",
      "long-short",
      "notional",
      "contract-size",
      "liquidity",
      "volatility",
      "market-hours"
    ]
  },
  {
    "id": "read-charts",
    "title": "Read the Chart",
    "category": "Technical analysis",
    "color": "#F1EDFF",
    "icon": "stats-chart-outline",
    "lessonIds": [
      "candles",
      "timeframes",
      "chart-types",
      "candle-body",
      "candle-wicks",
      "gaps",
      "swing-points",
      "trend",
      "support",
      "resistance"
    ]
  },
  {
    "id": "technical-tools",
    "title": "Your Chart Toolkit",
    "category": "Technical analysis",
    "color": "#E6F7F2",
    "icon": "construct-outline",
    "lessonIds": [
      "moving-averages",
      "sma-ema",
      "rsi",
      "macd",
      "bollinger",
      "atr",
      "volume",
      "trend-lines",
      "breakouts",
      "false-breakouts"
    ]
  },
  {
    "id": "risk-management",
    "title": "Protect Your Practice",
    "category": "Risk management",
    "color": "#FFF0EE",
    "icon": "shield-checkmark-outline",
    "lessonIds": [
      "risk",
      "risk-budget",
      "position-size",
      "stop-targets",
      "risk-reward",
      "correlation",
      "leverage",
      "margin",
      "slippage",
      "drawdown"
    ]
  },
  {
    "id": "trade-plans",
    "title": "Build a Trading Plan",
    "category": "Process",
    "color": "#EAF3FF",
    "icon": "clipboard-outline",
    "lessonIds": [
      "hypothesis",
      "entry-conditions",
      "invalidation",
      "exit-rules",
      "sizing-plan",
      "economic-calendar",
      "premarket-check",
      "no-trade",
      "trade-journal",
      "review-checklist"
    ]
  },
  {
    "id": "psychology",
    "title": "Train Your Mindset",
    "category": "Psychology",
    "color": "#F1EDFF",
    "icon": "heart-outline",
    "lessonIds": [
      "mindset",
      "overconfidence",
      "loss-aversion",
      "revenge-trading",
      "fomo",
      "confirmation-bias",
      "patience",
      "routines",
      "fatigue",
      "uncertainty"
    ]
  },
  {
    "id": "practice-lab",
    "title": "Inside Your Practice Account",
    "category": "Practice lab",
    "color": "#E6F7F2",
    "icon": "flask-outline",
    "lessonIds": [
      "virtual-orders",
      "order-fees",
      "reserved-capital",
      "mark-price",
      "realized-pnl",
      "unrealized-pnl",
      "closing-shorts",
      "manual-targets",
      "journal-review",
      "series-review"
    ]
  },
  {
    "id": "review-grow",
    "title": "Measure and Keep Growing",
    "category": "Performance",
    "color": "#FEF5DA",
    "icon": "trophy-outline",
    "lessonIds": [
      "win-rate",
      "average-payoff",
      "profit-factor",
      "expectancy",
      "sample-size",
      "backtesting",
      "forward-testing",
      "review-plan"
    ]
  }
];
