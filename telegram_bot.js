/**
 * 🌟 TRADE'S STAR V20 PRO VIP - TELEGRAM AUTO BOT (STABLE EDITION) 🌟
 * 
 * Features:
 *  - Native HTTP Health Check Server to bypass Render Suspension.
 *  - Live Dynamic Message Editing (Live prediction -> Outcome result update).
 *  - Box-4 History Pattern Recognition & Fallback.
 *  - 2-Number Target Prediction.
 *  - Accurate Jackpot vs Win distinction.
 *  - Commands: /stats, /level, /chart, /prediction, /history
 *  - FIXED: Self-Ping Keep-Alive loop to prevent Render from going to sleep.
 */

const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// --- SETUP CONFIGURATIONS ---
const TELEGRAM_BOT_TOKEN = '8555094944:AAEJuHmxBosT6qST62J-AwbwfiZp1NHoY5s'; 
const CHANNEL_CHAT_ID = '-1003752888794'; 

// --- STICKERS FILES IDS ---
const STICKER_WIN = 'CAACAgUAAxkBAAERTcRqG9-PZ0KFyAw7wsPpgZDuCzIVqwAC1w8AAvPbqFV1s2OiBxrZcjsE'; 
const STICKER_LOSS = 'CAACAgUAAxkBAAERTcZqG9-jI7AjERzeb9MHjqTtPJlzpwACXBEAAmUfuFV3xxYkqMI8FjsE';
const STICKER_JACKPOT = 'CAACAgUAAxkBAAERTcJqG9-Cy7F9u15glGNz5ovKsoG6DgACuBEAAi-IuFXIfWQ-6-g1TDsE';

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=15";

// --- EMBEDDED DATABASES ---
const ONE_DIGIT_MAP = {
    0: [4, 2], 1: [6, 8], 2: [1, 3], 3: [9, 7], 4: [0, 2],
    5: [3, 1], 6: [5, 7], 7: [0, 4], 8: [9, 5], 9: [1, 3]
};

const THREE_DIGIT_STR = "999:8|998:5|997:7|996:7|995:1|994:5|993:2|992:3|991:6|990:7|989:7|988:7|987:6|986:2|985:0|984:7|983:9|982:3|981:6|980:5|979:6|978:8|977:3|976:7|975:2|974:6|973:9|972:6|971:4|970:2|969:5|968:0|967:5|966:5|965:2|964:0|963:2|962:1|961:5|960:0|959:1|958:8|957:5|956:0|955:9|954:6|953:9|952:8|951:4|950:5|949:9|948:5|947:4|946:3|945:4|944:9|943:0|942:6|941:7|940:1|939:4|938:7|937:9|936:4|935:2|934:5|933:0|932:0|931:3|930:8|929:6|928:9|927:2|926:4|925:0|924:9|923:1|922:9|921:8|920:8|919:9|918:9|917:6|916:0|915:0|914:5|913:1|912:9|911:0|910:1|000:7";
const THREE_DIGIT_MAP = {};
THREE_DIGIT_STR.split('|').forEach(pair => {
    const [k, v] = pair.split(':');
    THREE_DIGIT_MAP[parseInt(k.trim())] = parseInt(v.trim());
});

const LVL_BASE = [
    {b:9, n:2},
    {b:36, n:8},
    {b:139, n:31},
    {b:533, n:119},
    {b:2026, n:450}
];

// Bot State memory
let history = [];
let botLevel = 1;
let currentPrediction = null; 
let stats = { wins: 0, losses: 0, jackpots: 0, total: 0 };
let walletBalance = 4000; 
let lastUserRequest = {};

// --- ACTIVE POLLING WITH RENDER HEALTH CHECK SERVER ---
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// Clean previous webhooks & start polling
bot.deleteWebHook({ drop_pending_updates: true }).then(() => {
    bot.startPolling({ restart: true });
    console.log("🤖 Local Polling mode activated. Pending updates dropped successfully.");
});

// Render Web Service requires binding to a port, otherwise it suspends
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Trades Star Bot is running smoothly!\n');
});

// --- SELF-PING / KEEP-ALIVE SYSTEM ---
// Render URL configured dynamically with a static fallback
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://sachinv234.onrender.com';

function startKeepAlive() {
    console.log(`📡 Keep-Alive routine successfully initialized for: ${RENDER_URL}`);
    // Ping every 5 minutes (300,000 milliseconds)
    setInterval(async () => {
        try {
            const response = await fetch(RENDER_URL);
            console.log(`📡 [Keep-Alive] Self-Ping sent to ${RENDER_URL}. Status: ${response.status}`);
        } catch (err) {
            console.error(`⚠️ [Keep-Alive] Self-Ping failed:`, err.message);
        }
    }, 300000); 
}

server.listen(PORT, () => {
    console.log(`🤖 Native Health-Check Server Listening on Port: ${PORT}`);
    startKeepAlive(); // Trigger keep-alive loops once server is bound
});

console.log(`🌟 TRADE'S STAR BOT SYNCHRONIZED SUCCESSFULLY FOR CHANNEL ${CHANNEL_CHAT_ID} 🌟`);

// Command: /stats
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    const response = `📊 *CURRENT SYSTEM STATUS* 📊\n\n` +
                     `🔥 *Total Signals:* ${stats.total}\n` +
                     `🌟 *Wins:* ${stats.wins}\n` +
                     `🎇 *Jackpots:* ${stats.jackpots}\n` +
                     `🤬 *Losses:* ${stats.losses}\n` +
                     `📈 *Accuracy:* ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n` +
                     `🎚️ *Current Bet Level:* L${botLevel}\n` +
                     `💰 *Wallet Configured:* ₹${walletBalance}`;
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
});

// Command: /level <amount> (Supports styles: /level 2000, /level <2000>, /level2000)
bot.onText(/\/level(?:\s+)?(?:<)?(\d+)(?:>)?/i, (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);
    if (!isNaN(amount) && amount > 0) {
        walletBalance = amount;
        bot.sendMessage(chatId, `💰 *Wallet Balance updated to:* ₹${walletBalance}\nNow charts will scale dynamically around this!`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `❌ Invalid amount! Use: \`/level 4000\``, { parse_mode: 'Markdown' });
    }
});

// Command: /chart
bot.onText(/\/chart/, (msg) => {
    const chatId = msg.chat.id;
    const scale = walletBalance / 3963;
    let chartMsg = `📊 *5-LEVEL SCALED CLASSIC CHART* (Balance: ₹${walletBalance})\n\n`;
    let totalLoss = 0;
    
    LVL_BASE.forEach((lvl, i) => {
        const b = Math.round(lvl.b * scale);
        const n = Math.round(lvl.n * scale);
        const total = b + (n * 2) + totalLoss;
        const bProf = Math.round(b * 1.96);
        const nProf = Math.round(n * 8.82);
        
        const activeStar = (botLevel === (i + 1)) ? "👉 " : "";
        chartMsg += `${activeStar}*L${i+1}:* Bet(B): ₹${b} | Bet(N): ₹${n} | Total Cost: ₹${total} | Profit: ₹${bProf - total}\n`;
        totalLoss = total;
    });
    bot.sendMessage(chatId, chartMsg, { parse_mode: 'Markdown' });
});

// Command: /history
bot.onText(/\/history/, (msg) => {
    const chatId = msg.chat.id;
    if (history.length === 0) {
        bot.sendMessage(chatId, `📭 History is empty. Waiting for Wingo API sync...`);
        return;
    }
    let historyMsg = `📜 *LATEST 15 WINGO RESULTS* 📜\n\n`;
    history.slice(0, 15).forEach(h => {
        const size = h.number >= 5 ? "BIG" : "SMALL";
        const col = [1,3,7,9].includes(h.number) ? "GREEN" : ([0,5].includes(h.number) ? "VIOLET" : "RED");
        historyMsg += `• *Period #${h.issue.slice(-4)}:* ${h.number} (${size} - ${col})\n`;
    });
    bot.sendMessage(chatId, historyMsg, { parse_mode: 'Markdown' });
});

// Command: /prediction (1 prediction limit per minute)
bot.onText(/\/prediction/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const now = Date.now();

    if (lastUserRequest[userId] && (now - lastUserRequest[userId] < 60000)) {
        bot.sendMessage(chatId, `⏳ *Please next period number wait!*`);
        return;
    }

    if (!currentPrediction) {
        bot.sendMessage(chatId, `⚠️ Waiting for live API packet sync. Try again in 5 seconds...`);
        return;
    }

    lastUserRequest[userId] = now;
    const scale = walletBalance / 3963;
    const botIdx = Math.min(botLevel - 1, 4);
    const config = LVL_BASE[botIdx];

    const manualMsg = `PREDICTION LIVE\n\n` +
                      `PERIOD:- ${currentPrediction.issue.slice(-4)}\n\n` +
                      `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                      `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                      `RUGLT. :- WAIT\n\n` +
                      `B•BET.  :- ${Math.round(config.b * scale)}\n\n` +
                      `N•BET.  :- ${Math.round(config.n * scale)}\n\n` +
                      `LEVEL.  :- ${botLevel}`;
    bot.sendMessage(chatId, manualMsg, { parse_mode: 'Markdown' });
});

// Main loop for Wingo 1M monitoring
async function monitorLoop() {
    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) return;
        const json = await response.json();
        const list = json.data?.list || json.list || json.data || [];
        
        if (Array.isArray(list) && list.length > 0) {
            let newlyAdded = false;
            list.reverse().forEach(item => {
                const id = (item.issueNumber || item.period || item.issue).toString();
                const num = parseInt(item.number !== undefined ? item.number : item.resultNum);
                
                if (!history.find(h => h.issue === id)) {
                    history.unshift({ issue: id, number: num });
                    newlyAdded = true;
                }
            });

            if (newlyAdded) {
                history.sort((a,b) => b.issue.localeCompare(a.issue));
                if (history.length > 100) history = history.slice(0, 100);
                
                await handleNewOutcome();
            }
        }
    } catch (e) {
        console.error("API Fetch Error:", e.message);
    }
}

// Logic analysis & prediction evaluation
async function handleNewOutcome() {
    if (history.length < 15) return;

    const latestOutcome = history[0];
    const latestId = latestOutcome.issue;

    // 1. Process and EDIT previous period prediction live message
    if (currentPrediction && currentPrediction.issue === latestId) {
        const actualNum = latestOutcome.number;
        const actualSize = actualNum >= 5 ? "BIG" : "SMALL";
        stats.total++;

        const matchesSize = (currentPrediction.predType === actualSize);
        const matchesNumber = currentPrediction.nums.includes(actualNum);

        const scale = walletBalance / 3963;
        const botIdx = Math.min(currentPrediction.level - 1, 4);
        const config = LVL_BASE[botIdx];
        const bBet = Math.round(config.b * scale);
        const nBet = Math.round(config.n * scale);

        // Edit the original live message on the channel
        const editedMsg = `PREDICTION LIVE\n\n` +
                          `PERIOD:- ${currentPrediction.issue.slice(-4)}\n\n` +
                          `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                          `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                          `RUGLT. :- ${actualSize}(${actualNum})\n\n` +
                          `B•BET.  :- ${bBet}\n\n` +
                          `N•BET.  :- ${nBet}\n\n` +
                          `LEVEL.  :- ${currentPrediction.level}`;

        try {
            await bot.editMessageText(editedMsg, {
                chat_id: CHANNEL_CHAT_ID,
                message_id: currentPrediction.messageId,
                parse_mode: 'Markdown'
            });
        } catch (err) {
            console.error("Failed to edit channel message:", err.message);
        }

        // Jackpot vs Win accurate segregation
        if (matchesNumber) {
            // Number matched directly -> JACKPOT WINNER
            stats.jackpots++;
            stats.wins++;
            botLevel = 1;
            await sendStickerSafe(STICKER_JACKPOT, "🎇");
        } else if (matchesSize) {
            // Only size matched -> WIN
            stats.wins++;
            botLevel = 1;
            await sendStickerSafe(STICKER_WIN, "🌟");
        } else {
            // Neither matched -> LOSS
            stats.losses++;
            botLevel = botLevel >= 5 ? 1 : botLevel + 1; 
            await sendStickerSafe(STICKER_LOSS, "🤬");
        }
    }

    // 2. Generate Prediction for NEXT upcoming period
    const nextId = (BigInt(latestId) + 1n).toString();
    const P = BigInt(nextId);

    // Box 1 (P - 10)
    let b1Val = history.find(h => h.issue === (P - 10n).toString());
    let b1 = b1Val ? b1Val.number : null;

    // Box 2 & 3 Matching
    const curN = latestOutcome.number;
    let matches = [];
    for (let i = 1; i < history.length; i++) {
        if (history[i].number === curN) {
            if (history[i-1]) matches.push(history[i-1].number);
        }
    }
    let b2 = matches[0] !== undefined ? matches[0] : null;
    let b3 = matches[1] !== undefined ? matches[1] : null;

    // Box 4: Last 3 digits history scan rule
    const nextIdLast3Str = nextId.slice(-3); 
    let b4 = null;
    
    // Check history for period ending with matching 3 digits
    const historicalMatch = history.find(h => h.issue.endsWith(nextIdLast3Str));
    if (historicalMatch) {
        b4 = historicalMatch.number;
        console.log(`[Box 4] Historical Match Found ending in ${nextIdLast3Str}. Set Box-4 to: ${b4}`);
    } else {
        // Fallback to 3-digit database rule
        const pLast3 = parseInt(nextIdLast3Str);
        b4 = THREE_DIGIT_MAP[pLast3] !== undefined ? THREE_DIGIT_MAP[pLast3] : 0;
        console.log(`[Box 4] No Match in History. Fallback database lookup for ${pLast3}: ${b4}`);
    }

    // Box 5 Mapping (P - 11)
    let b5Val = history.find(h => h.issue === (P - 11n).toString());
    let b5 = b5Val ? b5Val.number : null;

    // Hedging Solver
    let inputs = [b1, b2, b3, b4, b5].filter(v => v !== null);
    let finalSelection = "BIG";
    let finalNums = [2, 4];

    if (inputs.length > 0) {
        let bigCount = 0, smallCount = 0, redCount = 0, greenCount = 0;
        inputs.forEach(n => {
            if (n >= 5) bigCount++; else smallCount++;
            if ([0, 2, 4, 6, 8].includes(n)) redCount++; else greenCount++;
        });

        // Size priority decision
        let isSize = (bigCount === smallCount && redCount === greenCount) || (bigCount === redCount);
        if (isSize) {
            finalSelection = bigCount >= smallCount ? "BIG" : "SMALL";
        } else {
            finalSelection = redCount >= greenCount ? "RED" : "GREEN";
        }

        // Apply strict 2-number opposite hedging rules (Ensuring exact 2 numbers)
        if (bigCount >= smallCount) {
            finalSelection = "BIG";
            finalNums = (redCount >= greenCount) ? [2, 4] : [1, 3]; 
        } else {
            finalSelection = "SMALL";
            finalNums = (redCount >= greenCount) ? [6, 8] : [5, 7]; // Strict 2 numbers, dropped fallback index of 9
        }
    }

    const scale = walletBalance / 3963;
    const botIdx = Math.min(botLevel - 1, 4);
    const botLvlConfig = LVL_BASE[botIdx];
    const bBet = Math.round(botLvlConfig.b * scale);
    const nBet = Math.round(botLvlConfig.n * scale);

    // Initial Live message layout
    const nextPredMsg = `PREDICTION LIVE\n\n` +
                        `PERIOD:- ${nextId.slice(-4)}\n\n` +
                        `MY PRE:- ${finalSelection}(${finalNums.join(',')})\n\n` +
                        `N•PRED:- ${finalNums.join(',')}\n\n` +
                        `RUGLT. :- WAIT\n\n` +
                        `B•BET.  :- ${bBet}\n\n` +
                        `N•BET.  :- ${nBet}\n\n` +
                        `LEVEL.  :- ${botLevel}`;

    const sentMsg = await bot.sendMessage(CHANNEL_CHAT_ID, nextPredMsg, { parse_mode: 'Markdown' });

    currentPrediction = {
        issue: nextId,
        predType: finalSelection,
        nums: finalNums,
        level: botLevel,
        messageId: sentMsg.message_id
    };
}

// Safe Sticker dispatcher
async function sendStickerSafe(stickerId, fallbackEmoji) {
    try {
        await bot.sendSticker(CHANNEL_CHAT_ID, stickerId);
    } catch(err) {
        await bot.sendMessage(CHANNEL_CHAT_ID, fallbackEmoji);
    }
}

// Run loop checks every 5 seconds
setInterval(monitorLoop, 5000);
console.log("Monitoring Wingo loop active. Processing updates...");
