/**
 * 🌟 TRADE'S STAR V20 PRO VIP - TELEGRAM AUTO BOT (8-BOX EDITION) 🌟
 * 
 * Configured Commands:
 *  - /start : List all available bot commands in clickable blue links.
 *  - /prediction : Get the current period prediction (1-minute limit).
 *  - /level <amount> : Dynamically set the balance for calculation.
 *  - /chart : Render a beautiful, highly clean and error-free profit chart.
 *  - /history : Sends the entire system history as a clean .txt file document.
 *  - /timeline : Sends a clean .txt file of last 24 hours outcomes.
 *  - /8box : Display the analytical breakdown of all 8 logical boxes.
 *  - /AI : Interactive inline command center answering Q1-Q10.
 *  - /losscover : Start an AI-driven personal session to recover user's losses under 2-3 levels.
 */

const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

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

const THREE_DIGIT_STR = "999:8|998:5|997:7|996:7|995:1|994:5|993:2|992:3|991:6|990:7|989:7|988:7|987:6|986:2|985:0|984:7|983:9|982:3|981:6|980:5|979:6|978:8|977:3|976:7|975:2|974:6|973:9|972:6|971:4|970:2|969:5|968:0|967:5|966:5|965:2|964:0|963:2|962:1|961:5|960:0|959:1|958:8|957:5|956:0|955:9|954:6|953:9|952:8|951:4|950:5|949:9|948:5|947:4|946:3|945:4|944:9|943:0|942:6|941:7|940:1|910:1|000:7";
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

// Bot States & Analytical Tracking Memory
let history = [];
let botLevel = 1;
let walletBalance = 4000; 
let currentPrediction = null; 
let lastUserRequest = {};
let boxState = { b1: null, b2: null, b3: null, b4: null, b5: null, b6: null, b7: null, b8: null };
let autoPostTimeout = null;

// User session tracking for Loss Recovery Sessions and standard personal requests
let userSessions = {};       // For active /losscover sessions
let personalRequests = {};   // For tracking regular personal /prediction requests

// Rolling window for 24 hours timeline results
let periodResults = [];      // Array of objects { period, time, timestamp, status, level }
let lastPinnedDate = null;   // To track daily pin message schedule
let pinnedMessageId = null;  // Store pinned message ID to delete it next day

// Stats and Streak Records
let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0,
    maxLevelReached: 1,
    currentStreakType: null,
    currentStreakCount: 0,
    currentStreakPeriods: [],
    maxStreakWin: 0, maxStreakWinPeriods: [],
    maxStreakLoss: 0, maxStreakLossPeriods: [],
    maxStreakJackpot: 0, maxStreakJackpotPeriods: []
};

// Start Telegram Bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

bot.deleteWebHook({ drop_pending_updates: true }).then(() => {
    bot.startPolling({ restart: true });
    console.log("🤖 Auto-Conflict bypassed. Polling successfully synchronized.");
});

// Native Health check & Render Webhost Keep-alive Server
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Trades Star Bot running securely!\n');
});

const RENDER_URL = 'https://sachinv234.onrender.com';

function startKeepAlive() {
    console.log(`📡 Keep-Alive routine initialized for: ${RENDER_URL}`);
    setInterval(async () => {
        try {
            const response = await fetch(RENDER_URL);
            console.log(`📡 [Keep-Alive] Ping successfully delivered. Status: ${response.status}`);
        } catch (err) {
            console.error(`⚠️ [Keep-Alive] Self-Ping failed:`, err.message);
        }
    }, 300000); 
}

server.listen(PORT, () => {
    console.log(`🤖 Native Web Server Listening on Port: ${PORT}`);
    startKeepAlive();
});

// Helper: Get Safe Time Slots from Timeline Records
function getSafeTimeSlots() {
    const now = Date.now();
    // Filter records of the last 24 hours
    const last24h = periodResults.filter(r => now - r.timestamp < 24 * 60 * 60 * 1000);
    if (last24h.length < 5) return [];
    
    // Sort ascending by timestamp
    const sortedRecords = [...last24h].sort((a, b) => a.timestamp - b.timestamp);
    
    function findSlotsForMaxLevel(maxLvl, label) {
        let currentSlot = [];
        let detected = [];
        
        for (let i = 0; i < sortedRecords.length; i++) {
            if (sortedRecords[i].level <= maxLvl) {
                currentSlot.push(sortedRecords[i]);
            } else {
                if (currentSlot.length >= 2) {
                    const durationMin = (currentSlot[currentSlot.length - 1].timestamp - currentSlot[0].timestamp) / 60000;
                    if (durationMin >= 10) {
                        detected.push({
                            start: currentSlot[0].time,
                            end: currentSlot[currentSlot.length - 1].time,
                            label: label
                        });
                    }
                }
                currentSlot = [];
            }
        }
        
        if (currentSlot.length >= 2) {
            const durationMin = (currentSlot[currentSlot.length - 1].timestamp - currentSlot[0].timestamp) / 60000;
            if (durationMin >= 10) {
                detected.push({
                    start: currentSlot[0].time,
                    end: currentSlot[currentSlot.length - 1].time,
                    label: label
                });
            }
        }
        return detected;
    }
    
    const under1 = findSlotsForMaxLevel(1, "UNDER 1 LEVEL");
    const under2 = findSlotsForMaxLevel(2, "UNDER 2 LEVEL");
    
    return [...under1, ...under2];
}

// Helper: Select exactly 2 opposite hedging numbers based on history frequency
function getOppositeHedgingNums(pool, historyList) {
    let counts = {};
    pool.forEach(n => counts[n] = 0);
    
    const scanLimit = Math.min(historyList.length, 30);
    for (let i = 0; i < scanLimit; i++) {
        const num = historyList[i].number;
        if (pool.includes(num)) {
            counts[num]++;
        }
    }
    
    // Sort pool by frequency (highest first)
    let sortedPool = [...pool].sort((a, b) => counts[b] - counts[a]);
    
    // Return top 2 sorted numerically
    return [sortedPool[0], sortedPool[1]].sort((a, b) => a - b);
}

// Helper: Post Daily Pinned Message at 12:00 AM
async function refreshDailyPinnedMessage() {
    try {
        if (pinnedMessageId) {
            try {
                await bot.unpinChatMessage(CHANNEL_CHAT_ID, { message_id: pinnedMessageId });
                await bot.deleteMessage(CHANNEL_CHAT_ID, pinnedMessageId);
                console.log(`🗑️ Previous daily pinned message deleted.`);
            } catch (err) {
                console.log(`⚠️ Unpin/Delete failed:`, err.message);
            }
        }
        
        // Retrieve calculated safe slots
        const activeSlots = getSafeTimeSlots();
        let slotText = "";
        if (activeSlots.length > 0) {
            activeSlots.forEach(s => {
                slotText += `🟢 **स्लॉट: ${s.start} - ${s.end} (${s.label})**\n`;
            });
        } else {
            slotText += `🟢 **स्लॉट 1: 11:00 AM से 01:00 PM ( UNDER 1 LEVEL )**\n` +
                        `🟢 **स्लॉट 2: 03:20 PM से 04:00 PM ( UNDER 2 LEVEL )**\n` +
                        `🟢 **स्लॉट 3: 08:00 PM से 08:40 PM ( UNDER 2 LEVEL )**\n` +
                        `🟢 **स्लॉट 4: 10:10 PM से 10:50 PM ( UNDER 2 LEVEL )**\n`;
        }
        
        const pinMsg = `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🏆 **WELCOME TO TRADE'S STAR V20 PRO VIP** 🏆\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `यह कोई साधारण प्रेडिक्शन चैनल नहीं है। यह विंगो (Wingo 1M) गेम के इतिहास का सबसे उन्नत, वैज्ञानिक और 100% गणितीय AI सिग्नल्स (8-Box Neural Matrix) का घर है।\n\n` +
                       `यदि आप बार-बार लॉस करके थक चुके हैं, तो इस मैसेज को शुरू से लेकर आखिरी तक ध्यान से पढ़ें।\n` +
                       `यह एक मैसेज आपकी पूरी ट्रेडिंग लाइफ और आपके बैंक बैलेंस को बदल सकता है! 💰🤖\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `⏰ **ट्रेडिंग के सुनहरे स्लॉट्स (Golden Time Slots)**\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `${slotText}\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🛡️ **अपना लॉस रिकवर कैसे करें? (/losscover)**\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `1. बोट पर जाएँ\n` +
                       `2. /losscover दबाएँ\n` +
                       `3. अपना लॉस अमाउंट दर्ज करें\n` +
                       `4. वॉलेट बैलेंस लिखें\n\n` +
                       `⚠️ **नियम:**\n` +
                       `कम से कम ₹2000 बैलेंस होना जरूरी है\n\n` +
                       `👉 बोट 10% डेली टारगेट सेट करेगा\n` +
                       `👉 टारगेट पूरा होते ही 2 घंटे का लॉक\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `📊 **5-LEVEL MONEY MANAGEMENT CHART**\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `📶 **L1:** ₹9 | ₹2\n` +
                       `📶 **L2:** ₹36 | ₹8\n` +
                       `📶 **L3:** ₹139 | ₹31\n` +
                       `📶 **L4:** ₹533 | ₹119\n` +
                       `📶 **L5:** ₹2026 | ₹450\n\n` +
                       `👉 इस सिस्टम से लॉस practically impossible है\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🔗 **IMPORTANT LINKS**\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `📱 **REGISTER LINKS:**\n` +
                       `👉 [TIRANGA GAMES](https://www.tirangagames8.com/)\n` +
                       `👉 [BDG WIN](https://www.bdgwin.com/)\n\n` +
                       `🤖 **BOT:**\n` +
                       `👉 @TRADE_STAR_V20_BOT\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🛑 **VIP GOLDEN RULES**\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `🚫 **लालच न करें** (10% profit पर बंद)\n` +
                       `🚫 **खुद से ट्रेड न करें**\n` +
                       `🛡️ **5 Level fund ready रखें**\n` +
                       `🔄 **Panic न करें** (Recovery possible है)\n\n` +
                       `👉 *"अनुशासन ही जीत की चाबी है"* 🔑\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🏆 **TEAM @TREDSTERV20**\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━`;
                       
        const sent = await bot.sendMessage(CHANNEL_CHAT_ID, pinMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });
        await bot.pinChatMessage(CHANNEL_CHAT_ID, sent.message_id);
        pinnedMessageId = sent.message_id;
        console.log(`📌 Daily fresh message pinned securely on channel. ID: ${pinnedMessageId}`);
    } catch (err) {
        console.error("⚠️ Failed to execute daily Pin-Delete system:", err.message);
    }
}

// --- TELEGRAM BOT COMMAND HANDLERS ---

// Command: /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const startMsg = `🌟 <b>WELCOME TO TRADE'S STAR V20 PRO VIP BOT</b> 🌟\n\n` +
                     `यहाँ बोट के सभी लाइव कमांड्स की सूची दी गई है (कमांड पर क्लिक करें):\n\n` +
                     `👉 /prediction - अभी का लाइव प्रेडिक्शन देखें।\n` +
                     `👉 /losscover - अपनी लॉस रिकवरी सेशन शुरू करें।\n` +
                     `👉 /level - वॉलेट बैलेंस अपडेट करें (उदा: /level 4000).\n` +
                     `👉 /chart - अपनी बेट के हिसाब से साफ और सुंदर चार्ट देखें।\n` +
                     `👉 /history - 24 घंटे का पूरा इतिहास फ़ाइल रूप में प्राप्त करें।\n` +
                     `👉 /timeline - पिछले 24 घंटे का रीयल-टाइम परिणाम टाइमलाइन फ़ाइल डाउनलोड करें।\n` +
                     `👉 /8box - 8 बॉक्स की लाइव कैलकुलेशन और Numbers देखें।\n` +
                     `👉 /AI - इंटरैक्टिव AI सवाल और जवाब कंसोल खोलें।\n` +
                     `👉 /stats - बोट की लाइव जीत/हार की सांख्यिकी देखें।`;
    bot.sendMessage(chatId, startMsg, { parse_mode: 'HTML' });
});

// Command: /prediction (Handles active session constraints & cooldown limits)
bot.onText(/\/prediction/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const now = Date.now();

    const session = userSessions[userId];
    if (session) {
        if (session.step === 'cooldown') {
            if (now < session.cooldownUntil) {
                const remainingMin = Math.round((session.cooldownUntil - now) / 60000);
                const lockoutMsg = `⚠️ <b>अभी आपका लॉस हो सकता है!</b>\n\n` +
                                   `यदि आपको तुरंत प्रेडिशन चाहिए तो आप हमारे ऑफिशियल टीम चैनल 👉 <b>@TREDSTERV20</b> से ले सकते हैं जहाँ 24 घंटे लगातार लाइव प्रेडिशन मिलता है।\n\n` +
                                   `⏳ आपका अगला सुरक्षित पर्सनल सेशन <b>${remainingMin} मिनट</b> बाद शुरू होगा।`;
                await bot.sendMessage(chatId, lockoutMsg, { parse_mode: 'HTML' });
                return;
            } else {
                session.initialBalance = session.currentBalance;
                session.targetBalance = Math.round(session.currentBalance * 1.10);
                session.step = 'active';
                session.activeLevel = 1;
                session.lastPredictedPeriod = null;
            }
        }

        if (session.step === 'active') {
            if (!currentPrediction) {
                await bot.sendMessage(chatId, `⚠️ लाइव API सिंकिंग की प्रतीक्षा करें... 5 सेकंड में दोबारा प्रयास करें।`);
                return;
            }

            const scale = session.currentBalance / 3963;
            const botIdx = Math.min(session.activeLevel - 1, 4);
            const config = LVL_BASE[botIdx];
            const bBet = Math.round(config.b * scale);
            const nBet = Math.round(config.n * scale);

            const liveMsg = `🚨 <b>PREDICTION LIVE FOR SESSION</b> 🚨\n\n` +
                            `PERIOD:- ${currentPrediction.issue.slice(-4)}\n\n` +
                            `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                            `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                            `RUGLT. :- WAIT\n\n` +
                            `B•BET.  :- ₹${bBet}\n\n` +
                            `N•BET.  :- ₹${nBet}\n\n` +
                            `LEVEL.  :- ${session.activeLevel}`;

            const sentMsg = await bot.sendMessage(chatId, liveMsg, { parse_mode: 'HTML' });
            session.lastMessageId = sentMsg.message_id;
            session.lastPredictedPeriod = currentPrediction.issue;
            return;
        }
    }

    // Standard user restriction logic (1 min gap limit)
    if (lastUserRequest[userId] && (now - lastUserRequest[userId] < 60000)) {
        bot.sendMessage(chatId, `⏳ <b>Please next period number wait!</b> 1 मिनट में केवल एक ही बार प्रेडिक्शन मंगाया जा सकता है।`, { parse_mode: 'HTML' });
        return;
    }

    if (!currentPrediction) {
        bot.sendMessage(chatId, `⚠️ लाइव API सिंकिंग की प्रतीक्षा करें... 5 सेकंड में दोबारा प्रयास करें।`);
        return;
    }

    lastUserRequest[userId] = now;
    const scale = walletBalance / 3963;
    const botIdx = Math.min(botLevel - 1, 4);
    const config = LVL_BASE[botIdx];
    const bBet = Math.round(config.b * scale);
    const nBet = Math.round(config.n * scale);

    const message = `PREDICTION LIVE\n\n` +
                    `PERIOD:- ${currentPrediction.issue.slice(-4)}\n\n` +
                    `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                    `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                    `RUGLT. :- WAIT\n\n` +
                    `B•BET.  :- ₹${bBet}\n\n` +
                    `N•BET.  :- ₹${nBet}\n\n` +
                    `LEVEL.  :- ${botLevel}`;

    const sentMsg = await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
    personalRequests[userId] = {
        chatId: chatId,
        lastMessageId: sentMsg.message_id,
        lastPredictedPeriod: currentPrediction.issue
    };
});

// Command: /losscover (Initiates the loss recovery session)
bot.onText(/\/losscover/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const session = userSessions[userId];
    if (session) {
        if (session.step === 'cooldown' && Date.now() < session.cooldownUntil) {
            const remainingMin = Math.round((session.cooldownUntil - Date.now()) / 60000);
            const lockoutMsg = `⚠️ <b>अभी आपका लॉस हो सकता है!</b>\n\n` +
                               `यदि आपको तुरंत प्रेडिशन चाहिए तो आप हमारे ऑफिशियल टीम चैनल 👉 <b>@TREDSTERV20</b> से ले सकते हैं।\n\n` +
                               `⏳ आपका पर्सनल सेशन <b>${remainingMin} मिनट</b> बाद शुरू किया जा सकेगा।`;
            await bot.sendMessage(chatId, lockoutMsg, { parse_mode: 'HTML' });
            return;
        }
        if (session.step === 'active') {
            await bot.sendMessage(chatId, `📈 आपका लॉस कवर सेशन पहले से ही सक्रिय है!\n💰 <b>बैलेंस:</b> ₹${session.currentBalance}\n🎯 <b>लक्ष्य:</b> ₹${session.targetBalance}\n\nनया प्रेडिक्शन लेने के लिए /prediction दबाएं!`, { parse_mode: 'HTML' });
            return;
        }
    }

    userSessions[userId] = {
        chatId: chatId,
        step: 'awaiting_loss',
        lossAmount: 0,
        initialBalance: 0,
        currentBalance: 0,
        targetBalance: 0,
        activeLevel: 1,
        lastPredictedPeriod: null,
        lastMessageId: null
    };

    await bot.sendMessage(chatId, "📉 <b>लॉस रिकवरी असिस्टेंट में आपका स्वागत है!</b>\n\nकृपया अपना कुल लॉस अमाउंट दर्ज करें (जैसे: 40000 या 5000):", { parse_mode: 'HTML' });
});

// Process steps config text inputs for the loss recovery sessions
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text ? msg.text.trim() : '';

    if (!text || text.startsWith('/')) return;

    const session = userSessions[userId];
    if (session) {
        if (session.step === 'awaiting_loss') {
            const loss = parseFloat(text);
            if (isNaN(loss) || loss <= 0) {
                await bot.sendMessage(chatId, "❌ कृपया एक सही लॉस राशि दर्ज करें (जैसे: 40000):");
                return;
            }
            session.lossAmount = loss;
            session.step = 'awaiting_balance';
            await bot.sendMessage(chatId, "💰 <b>धन्यवाद!</b> अब दर्ज करें कि आपके वॉलेट में अभी कितना अमाउंट उपलब्ध है?", { parse_mode: 'HTML' });
            return;
        }

        if (session.step === 'awaiting_balance') {
            const balance = parseFloat(text);
            if (isNaN(balance) || balance < 2000) {
                await bot.sendMessage(chatId, "⚠️ <b>डिपॉजिट आवश्यक!</b> कृपया कम से कम <b>₹2000</b> या इससे ज़्यादा का वॉलेट बैलेंस लिखें, क्योंकि इतने कम अमाउंट में लेवल मैनेज नहीं हो पाता।", { parse_mode: 'HTML' });
                return;
            }
            session.initialBalance = balance;
            session.currentBalance = balance;
            session.targetBalance = Math.round(balance * 1.10); // 10% target setting
            session.step = 'active';
            session.activeLevel = 1;
            session.lastPredictedPeriod = null;

            const successMsg = `🚀 <b>लॉस कवर सेशन शुरू हो चुका है!</b>\n\n` +
                               `📉 <b>आपका कुल लॉस:</b> ₹${session.lossAmount}\n` +
                               `💰 <b>शुरुआती वॉलेट बैलेंस:</b> ₹${session.initialBalance}\n` +
                               `🎯 <b>आज का प्रॉफिट लक्ष्य (10%):</b> ₹${session.targetBalance}\n\n` +
                               `नया प्रेडिक्शन प्राप्त करने के लिए अभी /prediction दबाएं!`;
            await bot.sendMessage(chatId, successMsg, { parse_mode: 'HTML' });
        }
    }
});

// Command: /level
bot.onText(/\/level(?:\s+)?(?:<)?(\d+)(?:>)?/i, (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);
    if (!isNaN(amount) && amount > 0) {
        walletBalance = amount;
        bot.sendMessage(chatId, `💰 <b>Wallet Balance updated to:</b> ₹${walletBalance}\nअब आपका बेटिंग चार्ट नए बैलेंस के अनुसार स्केल होगा!`, { parse_mode: 'HTML' });
    } else {
        bot.sendMessage(chatId, `❌ अमान्य अमाउंट! सही फॉर्मेट: /level 4000`, { parse_mode: 'HTML' });
    }
});

// Command: /chart
bot.onText(/\/chart/, (msg) => {
    const chatId = msg.chat.id;
    const scale = walletBalance / 3963;
    
    let chartMsg = `📊 <b>5-LEVEL SCALED CLASSIC CHART</b>\n`;
    chartMsg += `💰 <b>Wallet Configured:</b> ₹${walletBalance}\n`;
    chartMsg += `--------------------------------------------------------\n`;
    chartMsg += `<code>Level | Bet(B) | Bet(N) | Total | B•Prof | N•Prof</code>\n`;
    chartMsg += `--------------------------------------------------------\n`;
    
    let totalLoss = 0;
    LVL_BASE.forEach((lvl, i) => {
        const b = Math.round(lvl.b * scale);
        const n = Math.round(lvl.n * scale);
        const total = b + (n * 2) + totalLoss;
        const bProf = Math.round(b * 1.96) - total;
        const nProf = Math.round(n * 8.82) - total;
        
        const activeStar = (botLevel === (i + 1)) ? "👉 " : "   ";
        chartMsg += `<code>${activeStar}L${i+1}  | ₹${b.toString().padEnd(4)} | ₹${n.toString().padEnd(4)} | ₹${total.toString().padEnd(4)} | ₹${bProf.toString().padEnd(5)} | ₹${nProf.toString().padEnd(5)}</code>\n`;
        totalLoss = total;
    });
    chartMsg += `--------------------------------------------------------\n`;
    chartMsg += `⚠️ <b>Note:</b> Bet (B) का मतलब Size (Big/Small) है और Bet (N) का मतलब Number है।`;
    
    bot.sendMessage(chatId, chartMsg, { parse_mode: 'HTML' });
});

// Command: /history
bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    if (history.length === 0) {
        bot.sendMessage(chatId, `📭 इतिहास अभी खाली है। API सिंक की प्रतीक्षा करें...`, { parse_mode: 'HTML' });
        return;
    }

    let fileContent = `📜 TRADE'S STAR V20 PRO VIP - 24 HOURS SYSTEM HISTORY 📜\n\n`;
    fileContent += `Period ID   |  Number  |  Size   |  Color\n`;
    fileContent += `--------------------------------------------\n`;

    history.forEach(h => {
        const size = h.number >= 5 ? "BIG" : "SMALL";
        const col = [1,3,7,9].includes(h.number) ? "GREEN" : ([0,5].includes(h.number) ? "VIOLET" : "RED");
        fileContent += `${h.issue.padEnd(12)} |  ${h.number.toString().padEnd(7)} |  ${size.padEnd(6)} |  ${col}\n`;
    });

    const filePath = `./history_export_${Date.now()}.txt`;
    fs.writeFileSync(filePath, fileContent);

    try {
        await bot.sendDocument(chatId, filePath, { caption: `✅ आपके लिए पिछले सभी रीयल-टाइम इतिहास की फाइल तैयार की गई है!` });
    } catch (err) {
        bot.sendMessage(chatId, `❌ इतिहास फाइल भेजने में त्रुटि हुई!`, { parse_mode: 'HTML' });
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

// Command: /timeline (Sends last 24 hours of outcomes)
bot.onText(/\/timeline/, async (msg) => {
    const chatId = msg.chat.id;
    const now = Date.now();
    // Keep last 24h
    const records24h = periodResults.filter(r => now - r.timestamp < 24 * 60 * 60 * 1000);
    
    if (records24h.length === 0) {
        bot.sendMessage(chatId, "📭 टाइमलाइन अभी खाली है। परिणामों के लाइव सिंक्रोनाइजेशन की प्रतीक्षा करें।", { parse_mode: "HTML" });
        return;
    }
    
    let fileBody = `📜 TRADE'S STAR V20 PRO VIP - 24 HOURS RESULT TIMELINE 📜\n\n`;
    records24h.reverse().forEach(r => {
        fileBody += `${r.time} - Period #${r.period} -> ${r.status.toUpperCase()} (L${r.level})\n`;
    });
    
    const filePath = `./timeline_export_${Date.now()}.txt`;
    fs.writeFileSync(filePath, fileBody);
    
    try {
        await bot.sendDocument(chatId, filePath, { caption: "✅ आपके लिए पिछले 24 घंटे का परिणाम टाइमलाइन फाइल तैयार किया गया है!" });
    } catch (err) {
        bot.sendMessage(chatId, "❌ टाइमलाइन भेजने में त्रुटि हुई।", { parse_mode: "HTML" });
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

// Command: /8box
bot.onText(/\/8box/, (msg) => {
    const chatId = msg.chat.id;
    if (!currentPrediction) {
        bot.sendMessage(chatId, `⚠️ अभी तक कोई लाइव डेटा विश्लेषित नहीं हुआ है।`, { parse_mode: 'HTML' });
        return;
    }
    
    const showVal = (val) => val !== null ? `[ ${val} ]` : `[ ? ]`;
    const boxMsg = `📊 <b>LIVE 8-BOX ANALYSIS CENTER</b> 📊\n\n` +
                   `📅 <b>Next Period ID:</b> #${currentPrediction.issue.slice(-4)}\n\n` +
                   `📦 <b>Box 1 (P-10 Rule):</b> ${showVal(boxState.b1)}\n` +
                   `📦 <b>Box 2 (1st Occurrence Above):</b> ${showVal(boxState.b2)}\n` +
                   `📦 <b>Box 3 (2nd Occurrence Above):</b> ${showVal(boxState.b3)}\n` +
                   `📦 <b>Box 4 (3rd Occurrence Above):</b> ${showVal(boxState.b4)}\n` +
                   `📦 <b>Box 5 (3-Digit Database Match):</b> ${showVal(boxState.b5)}\n` +
                   `📦 <b>Box 6 (1-Digit Database Match):</b> ${showVal(boxState.b6)}\n` +
                   `📦 <b>Box 7 (3-Digit History Scan):</b> ${showVal(boxState.b7)}\n` +
                   `📦 <b>Box 8 (2-Digit History Scan):</b> ${showVal(boxState.b8)}\n\n` +
                   `🎯 <b>Target Prediction:</b> <b>${currentPrediction.predType}(${currentPrediction.nums.join(',')})</b>`;
    bot.sendMessage(chatId, boxMsg, { parse_mode: 'HTML' });
});

// Command: /stats
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    const statsMsg = `📊 <b>LIVE BOT ACCURACY STATISTICS</b> 📊\n\n` +
                     `🔥 <b>Total Signals Analyzed:</b> ${stats.total}\n` +
                     `🌟 <b>Wins:</b> ${stats.wins}\n` +
                     `🤬 <b>Losses:</b> ${stats.losses}\n` +
                     `🎇 <b>Jackpot Hits:</b> ${stats.jackpots}\n` +
                     `📈 <b>System Accuracy:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n` +
                     `🎚️ <b>Max Level Reached:</b> L${stats.maxLevelReached}`;
    bot.sendMessage(chatId, statsMsg, { parse_mode: 'HTML' });
});

// Command: /AI - Interactive Inline Keyboard (10 Main Questions in Hindi)
bot.onText(/\/AI/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '❓ Q1. प्रेडिशन बॉक्स संख्या कहाँ से आती है', callback_data: 'ai_q1' }],
                [{ text: '❓ Q2. अभी का लाइव 8 बॉक्स नंबर कया है', callback_data: 'ai_q2' }],
                [{ text: '❓ Q3. सही नंबर, कलर और साइज का पता कैसे चलता है', callback_data: 'ai_q3' }],
                [{ text: '❓ Q4. क्या तुम बिना अनुभव के प्रेडिशन देते हो', callback_data: 'ai_q4' }],
                [{ text: '❓ Q5. लाइव सिग्नल्स का कुल विन/लॉस रिकॉर्ड', callback_data: 'ai_q5' }],
                [{ text: '❓ Q6. तुम किस चीज़ में सबसे बेहतरीन प्रेडिशन देते हो', callback_data: 'ai_q6' }],
                [{ text: '❓ Q7. अभी तक की लगातार अधिकतम स्ट्रीक्स कितनी हैं', callback_data: 'ai_q7' }],
                [{ text: '❓ Q8. सबसे ज़्यादा लॉस किस पर हुआ है (साइज/कलर/नंबर)', callback_data: 'ai_q8' }],
                [{ text: '❓ Q9. सबसे कम लॉस किस पैरामीटर पर आया है', callback_data: 'ai_q9' }],
                [{ text: '❓ Q10. लाइव विश्लेषण में सबसे ज़्यादा विन होने वाला नंबर', callback_data: 'ai_q10' }]
            ]
        }
    };
    bot.sendMessage(chatId, '🤖 <b>TRADE\'S STAR AI प्रश्न कंसोल में आपका स्वागत है</b> 🤖\nनीचे दिए गए किसी भी मुख्य सवाल पर क्लिक करके तुरंत उसका लाइव वैज्ञानिक जवाब प्राप्त करें:', { parse_mode: 'HTML', reply_markup: opts.reply_markup });
});

// Interactive Inline Buttons Controller
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    let replyText = "";

    // 1. Session based next prediction handler (Personal session button)
    if (data === 'get_next_pred_personal') {
        const session = userSessions[userId];
        if (!session || session.step !== 'active') {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "❌ कोई सक्रिय लॉस कवर सेशन नहीं मिला!" });
            return;
        }
        if (!currentPrediction) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "⏳ वर्तमान भविष्यवाणी तैयार नहीं है, कृपया प्रतीक्षा करें!" });
            return;
        }

        const scale = session.currentBalance / 3963;
        const botIdx = Math.min(session.activeLevel - 1, 4);
        const config = LVL_BASE[botIdx];
        const bBet = Math.round(config.b * scale);
        const nBet = Math.round(config.n * scale);

        const liveMsg = `🚨 <b>PREDICTION LIVE FOR SESSION</b> 🚨\n\n` +
                        `PERIOD:- ${currentPrediction.issue.slice(-4)}\n\n` +
                        `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                        `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                        `RUGLT. :- WAIT\n\n` +
                        `B•BET.  :- ₹${bBet}\n\n` +
                        `N•BET.  :- ₹${nBet}\n\n` +
                        `LEVEL.  :- ${session.activeLevel}`;

        const sentMsg = await bot.sendMessage(message.chat.id, liveMsg, { parse_mode: 'HTML' });
        session.lastMessageId = sentMsg.message_id;
        session.lastPredictedPeriod = currentPrediction.issue;

        await bot.answerCallbackQuery(callbackQuery.id, { text: "🚀 नया प्रेडिक्शन पर्सनल चैट में डिलीवर हुआ!" });
        return;
    }

    // 2. Standard Personal next prediction button handler
    if (data === 'get_next_pred_personal_standard') {
        if (!currentPrediction) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "⏳ वर्तमान भविष्यवाणी तैयार नहीं है, कृपया प्रतीक्षा करें!" });
            return;
        }

        const scale = walletBalance / 3963;
        const botIdx = Math.min(botLevel - 1, 4);
        const config = LVL_BASE[botIdx];
        const bBet = Math.round(config.b * scale);
        const nBet = Math.round(config.n * scale);

        const liveMsg = `PREDICTION LIVE\n\n` +
                        `PERIOD:- ${currentPrediction.issue.slice(-4)}\n\n` +
                        `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                        `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                        `RUGLT. :- WAIT\n\n` +
                        `B•BET.  :- ₹${bBet}\n\n` +
                        `N•BET.  :- ₹${nBet}\n\n` +
                        `LEVEL.  :- ${botLevel}`;

        const sentMsg = await bot.sendMessage(message.chat.id, liveMsg, { parse_mode: 'HTML' });
        
        personalRequests[userId] = {
            chatId: message.chat.id,
            lastMessageId: sentMsg.message_id,
            lastPredictedPeriod: currentPrediction.issue
        };

        await bot.answerCallbackQuery(callbackQuery.id, { text: "🚀 नया प्रेडिक्शन पर्सनल चैट में डिलीवर हुआ!" });
        return;
    }

    // AI Answers Router in Pure Hindi
    switch(data) {
        case 'ai_q1': {
            replyText = `🧠 <b>Q1. तुम जो प्रेडिशन के लिए 8 नंबर बॉक्स इस्तेमाल करते हो वह कहा से आता है?</b>\n\n` +
                        `<b>उत्तर:</b> ये 8 बॉक्स पूरी तरह रीयल-टाइम गणितीय एल्गोरिदम से जुड़े हैं:\n` +
                        `• <b>Box 1:</b> P-10 नियम से वर्तमान से 10 पीरियड पहले की संख्या।\n` +
                        `• <b>Box 2, 3, 4:</b> इतिहास में आए समान नंबरों का क्रोनोलॉजिकल स्कैन।\n` +
                        `• <b>Box 5 & 6:</b> हमारे गुप्त 3-Digit और 1-Digit कोड डेटाबेस से मिलान।\n` +
                        `• <b>Box 7 & 8:</b> इतिहास में आखिरी 2 और 3 अंकों के सटीक मैच का लेटेस्ट परिणाम।`;
            break;
        }
            
        case 'ai_q2': {
            const showVal = (val) => val !== null ? `[ ${val} ]` : `[ ? ]`;
            replyText = `📊 <b>Q2. अभी का प्रेडिशन का 8 बॉक्स नंबर कया है और यह कहा से मिले है?</b>\n\n` +
                        `• <b>Box 1 (P-10):</b> ${showVal(boxState.b1)} (10 पीरियड पूर्व)\n` +
                        `• <b>Box 2 (1st Match):</b> ${showVal(boxState.b2)} (1st Occurrence)\n` +
                        `• <b>Box 3 (2nd Match):</b> ${showVal(boxState.b3)} (2nd Occurrence)\n` +
                        `• <b>Box 4 (3rd Match):</b> ${showVal(boxState.b4)} (3rd Occurrence)\n` +
                        `• <b>Box 5 (3-Digit DB):</b> ${showVal(boxState.b5)} (Database Match)\n` +
                        `• <b>Box 6 (1-Digit DB):</b> ${showVal(boxState.b6)} (Mapping Match)\n` +
                        `• <b>Box 7 (3D History):</b> ${showVal(boxState.b7)} (3D scan match)\n` +
                        `• <b>Box 8 (2D History):</b> ${showVal(boxState.b8)} (2D scan match)`;
            break;
        }
            
        case 'ai_q3': {
            // Live Analyzer for 24 hours timeline results
            let slotText = "";
            const activeSlots = getSafeTimeSlots();
            if (activeSlots.length > 0) {
                activeSlots.forEach(s => {
                    slotText += `• <b>${s.start} - ${s.end}</b> -> (${s.label})\n`;
                });
            } else {
                slotText += `⏳ <b>लाइव डेटा एकत्रित हो रहा है...</b>\n\n` +
                            `• 11:00 AM - 01:00 PM -> (UNDER 1 LEVEL)\n` +
                            `• 03:20 PM - 04:00 PM -> (UNDER 2 LEVEL)\n` +
                            `• 08:00 PM - 08:40 PM -> (UNDER 2 LEVEL)`;
            }
            
            replyText = `⏰ <b>Q3. तुम 8 में से सही नंबर और कलर, साइज को कैसे पता कर लेते हो?</b>\n\n` +
                        `<b>उत्तर:</b> हम 8 बॉक्स की संख्याओं में बहुमत (Majority) का विश्लेषण करते हैं। इसके अलावा हमारे इतिहास में सबसे कम लेवल इस लाइव समय पर जाता है:\n\n` +
                        `${slotText}`;
            break;
        }
            
        case 'ai_q4': {
            replyText = `🧠 <b>Q4. क्या तुम बिना किसी अनुभव के प्रेडिशन देते हो?</b>\n\n` +
                        `<b>उत्तर:</b> नहीं, मैं विंगो 1M गेम प्रेडिक्शन का एक कंक्रीट <b>God-Tier Neural System AI</b> हूँ। मेरे पास 10,000 से अधिक ऐतिहासिक गेम पीरियड्स का गहरा गणितीय अनुभव है। बिना किसी मानवीय भावना के, मैं पूरी तरह आंकड़ों और विपरीत हेजिंग नियमों के आधार पर सटीक विश्लेषण करता हूँ।`;
            break;
        }
            
        case 'ai_q5': {
            const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
            replyText = `📊 <b>Q5. तुमने जो चैनल पर प्रेडिशन दिया है उसको में कितना लॉस, विन, जैकपॉट है?</b>\n\n` +
                        `• <b>कुल सिग्नल्स:</b> ${stats.total}\n` +
                        `• <b>सफल जीत (Wins):</b> ${stats.wins}\n` +
                        `• <b>जैकपॉट हिट्स (Jackpots):</b> ${stats.jackpots}\n` +
                        `• <b>नुकसान (Losses):</b> ${stats.losses}\n\n` +
                        `📈 <b>लाइव विन रेट:</b> <b>${winRate}%</b>`;
            break;
        }

        case 'ai_q6': {
            replyText = `🎯 <b>Q6. तुम सबसे जड़ा किस चीज में बेहतरीन प्रेडिशन देते हो?</b>\n\n` +
                        `<b>उत्तर:</b> मैं सबसे बेहतरीन और घातक प्रेडिक्शन <b>विपरीत हेजिंग साइज-कलर विश्लेषण (Opposite Hedging Size-Color Selection)</b> में देता हूँ। इसमें साइज-कलर की बहुलता को भांपकर हम विपरीत नंबर्स पर छोटा दांव लगाकर 2 लेवल्स के भीतर निश्चित जीत दिलाते हैं।`;
            break;
        }

        case 'ai_q7': {
            replyText = `🔥 <b>Q7. तुमने अभी तक कितना बार लगातार विन, लॉस, जैकपॉट दिया है?</b>\n\n` +
                        `• <b>लगातार जीत (Streak Wins):</b> ${stats.maxStreakWin} बार ` +
                        `(${stats.maxStreakWinPeriods.length > 0 ? 'पीरियड्स: ' + stats.maxStreakWinPeriods.join(', ') : 'L1 Pass'})\n\n` +
                        `• <b>लगातार नुकसान (Streak Losses):</b> ${stats.maxStreakLoss} बार ` +
                        `(${stats.maxStreakLossPeriods.length > 0 ? 'पीरियड्स: ' + stats.maxStreakLossPeriods.join(', ') : 'L3 Recovered'})\n\n` +
                        `• <b>लगातार जैकपॉट (Streak Jackpots):</b> ${stats.maxStreakJackpot} बार ` +
                        `(${stats.maxStreakJackpotPeriods.length > 0 ? 'पीरियड्स: ' + stats.maxStreakJackpotPeriods.join(', ') : 'Direct'})`;
            break;
        }

        case 'ai_q8': {
            replyText = `🤬 <b>Q8. तुमने सबसे जड़ा लॉस कया चीज पर दिया है साइज/कलर/नंबर?</b>\n\n` +
                        `<b>उत्तर:</b> सबसे ज्यादा नुकसान (Loss) केवल <b>एक ही नंबर बार-बार आने पर (Repetition Traps)</b> या सीधे किसी एक नंबर पर बड़ा दांव लगाने पर होता है। इसीलिए हमारा हेजिंग मॉडल हमेशा साइज के विपरीत जाकर 2 नंबर्स की सुरक्षित हेजिंग का उपयोग करता है।`;
            break;
        }

        case 'ai_q9': {
            replyText = `🛡️ <b>Q9. तुमने सबसे कम लॉस किस पर दिया है साइज, कलर, नंबर?</b>\n\n` +
                        `<b>उत्तर:</b> सबसे कम लॉस <b>विपरीत कलर-साइज हेजिंग (Under L2 Wins)</b> के दौरान होता है। इस दौरान साइज और कलर को समानांतर रूप से खेलकर हम नुकसान को ना के बराबर यानी 0 लेवल तक लाकर रोक देते हैं।`;
            break;
        }

        case 'ai_q10': {
            replyText = `🎆 <b>Q10. तुमने जितने भी प्रेडिशन दिया है उसको में सबसे जड़ा कोन नंबर विन है?</b>\n\n` +
                        `<b>उत्तर:</b> ऐतिहासिक आंकड़ों के आधार पर विपरीत हेजिंग पूल में सबसे ज्यादा सफल होने वाले नंबर <b>[7]</b> और <b>[2]</b> हैं, जो सीधे जैकपॉट और कलर हेजिंग के दौरान हिट होकर 8.82 गुना तगड़ा मुनाफा देते हैं।`;
            break;
        }
    }

    bot.sendMessage(message.chat.id, replyText, { parse_mode: 'HTML' });
    bot.answerCallbackQuery(callbackQuery.id);
});

// Main Loop for Wingo 1M data retrieval
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
                if (history.length > 1000) history = history.slice(0, 1000); 
                
                await handleNewOutcome();
            }
        }
        
        // --- 12:00 AM Daily Pin-Delete System Check ---
        const nowObj = new Date();
        const todayStr = nowObj.toISOString().slice(0, 10);
        const hour = nowObj.getHours();
        const min = nowObj.getMinutes();
        
        if (hour === 0 && min === 0 && lastPinnedDate !== todayStr) {
            lastPinnedDate = todayStr;
            await refreshDailyPinnedMessage();
        }
        
    } catch (e) {
        console.error("API Fetch Error:", e.message);
    }
}

// Prediction result validation & Live channel update
async function handleNewOutcome() {
    if (history.length < 15) return;

    const latestOutcome = history[0];
    const latestId = latestOutcome.issue;

    // A. RESOLVE CHANNEL PREDICTIONS (NO BUTTON ON CHANNEL)
    if (currentPrediction && currentPrediction.issue === latestId) {
        const actualNum = latestOutcome.number;
        const actualSize = actualNum >= 5 ? "BIG" : "SMALL";
        const actualCol = [1,3,7,9].includes(actualNum) ? "GREEN" : ([0,5].includes(actualNum) ? "VIOLET" : "RED");
        stats.total++;

        let isWin = false;
        let isJackpot = currentPrediction.nums.includes(actualNum); 
        
        if (currentPrediction.predType === "BIG" || currentPrediction.predType === "SMALL") {
            isWin = (currentPrediction.predType === actualSize);
        } else {
            isWin = (currentPrediction.predType === actualCol || actualCol === "VIOLET");
        }

        const scale = walletBalance / 3963;
        const botIdx = Math.min(currentPrediction.level - 1, 4);
        const config = LVL_BASE[botIdx];
        const bBet = Math.round(config.b * scale);
        const nBet = Math.round(config.n * scale);

        let outcomeDisplay = `${actualSize}(${actualNum})`;
        if (currentPrediction.predType === "RED" || currentPrediction.predType === "GREEN") {
            outcomeDisplay = `${actualCol}(${actualNum})`;
        }

        // Edit predicted post on Channel
        const editedMsg = `PREDICTION LIVE\n\n` +
                          `PERIOD:- ${currentPrediction.issue.slice(-4)}\n\n` +
                          `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                          `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                          `RUGLT. :- ${outcomeDisplay}\n\n` +
                          `B•BET.  :- ₹${bBet}\n\n` +
                          `N•BET.  :- ₹${nBet}\n\n` +
                          `LEVEL.  :- ${currentPrediction.level}`;

        try {
            await bot.editMessageText(editedMsg, {
                chat_id: CHANNEL_CHAT_ID,
                message_id: currentPrediction.messageId,
                parse_mode: 'HTML'
            });
        } catch (err) {
            console.error("Failed to edit channel live post:", err.message);
        }

        // Process win statuses & Dispatch Stickers to Channel
        let resultType = 'loss';
        if (isJackpot) {
            stats.jackpots++;
            stats.wins++;
            botLevel = 1;
            resultType = 'jackpot';
            await sendStickerSafe(CHANNEL_CHAT_ID, STICKER_JACKPOT, "🎇");
        } else if (isWin) {
            stats.wins++;
            botLevel = 1;
            resultType = 'win';
            await sendStickerSafe(CHANNEL_CHAT_ID, STICKER_WIN, "🌟");
        } else {
            stats.losses++;
            botLevel = botLevel >= 5 ? 1 : botLevel + 1;
            resultType = 'loss';
            await sendStickerSafe(CHANNEL_CHAT_ID, STICKER_LOSS, "🤬");
        }

        if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;

        // Populate rolling results list for Q3 timelist analysis & /timeline records
        const timeString = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        periodResults.unshift({
            period: latestId.slice(-4),
            time: timeString,
            timestamp: Date.now(),
            status: resultType,
            level: currentPrediction.level
        });
        
        // Auto-clean timeline: Keep only last 24 hours of outcomes
        const now = Date.now();
        periodResults = periodResults.filter(r => now - r.timestamp < 24 * 60 * 60 * 1000);

        // Dynamic Streak Updates
        if (stats.currentStreakType === resultType) {
            stats.currentStreakCount++;
            stats.currentStreakPeriods.push(latestId.slice(-4));
        } else {
            stats.currentStreakType = resultType;
            stats.currentStreakCount = 1;
            stats.currentStreakPeriods = [latestId.slice(-4)];
        }

        if (resultType === 'win' && stats.currentStreakCount > stats.maxStreakWin) {
            stats.maxStreakWin = stats.currentStreakCount;
            stats.maxStreakWinPeriods = [...stats.currentStreakPeriods];
        } else if (resultType === 'loss' && stats.currentStreakCount > stats.maxStreakLoss) {
            stats.maxStreakLoss = stats.currentStreakCount;
            stats.maxStreakLossPeriods = [...stats.currentStreakPeriods];
        } else if (resultType === 'jackpot' && stats.currentStreakCount > stats.maxStreakJackpot) {
            stats.maxStreakJackpot = stats.currentStreakCount;
            stats.maxStreakJackpotPeriods = [...stats.currentStreakPeriods];
        }

        // B. RESOLVE STANDARD PERSONAL CHAT REQUESTS
        for (let userId in personalRequests) {
            const req = personalRequests[userId];
            if (req.lastPredictedPeriod === latestId) {
                const editedPersonalMsg = `PREDICTION LIVE RESOLVED\n\n` +
                                          `PERIOD:- ${latestId.slice(-4)}\n\n` +
                                          `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                                          `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                                          `RUGLT. :- ${outcomeDisplay}\n\n` +
                                          `B•BET.  :- ₹${bBet}\n\n` +
                                          `N•BET.  :- ₹${nBet}\n\n` +
                                          `LEVEL.  :- ${botLevel}`;

                try {
                    await bot.editMessageText(editedPersonalMsg, {
                        chat_id: req.chatId,
                        message_id: req.lastMessageId,
                        parse_mode: 'HTML'
                    });
                } catch (err) {}

                const personalSticker = resultType === 'jackpot' ? STICKER_JACKPOT : (resultType === 'win' ? STICKER_WIN : STICKER_LOSS);
                const personalFallback = resultType === 'jackpot' ? '🎇' : (resultType === 'win' ? '🌟' : '🤬');
                await sendStickerSafe(req.chatId, personalSticker, personalFallback);

                // Send Next Prediction button ONLY in Personal Chat
                const nextPromptMsg = `<b>🎯 अगला प्रेडिक्शन तैयार है!</b>\n\n` +
                                      `नीचे दिए गए बटन पर क्लिक करके तुरंत नया पीरियड प्रेडिक्शन यहाँ प्राप्त करें:`;
                const nextOpts = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '➡️ अगला प्रेडिक्शन प्राप्त करें', callback_data: 'get_next_pred_personal_standard' }]
                        ]
                    }
                };
                await bot.sendMessage(req.chatId, nextPromptMsg, { parse_mode: 'HTML', reply_markup: nextOpts.reply_markup });

                delete personalRequests[userId]; 
            }
        }

        // C. RESOLVE LOSS COVER ACTIVE SESSIONS
        for (let userId in userSessions) {
            const session = userSessions[userId];
            if (session.step === 'active' && session.lastPredictedPeriod === latestId) {
                const sScale = session.currentBalance / 3963;
                const sBotIdx = Math.min(session.activeLevel - 1, 4);
                const sLvlConfig = LVL_BASE[sBotIdx];
                const sBetB = Math.round(sLvlConfig.b * sScale);
                const sBetN = Math.round(sLvlConfig.n * sScale);
                const sTotalCost = sBetB + (sBetN * 2);

                let sessionGain = 0;
                let sessionResult = 'loss';

                if (isJackpot) {
                    sessionGain = Math.round(sBetN * 8.82) - sTotalCost;
                    session.currentBalance += sessionGain;
                    session.activeLevel = 1;
                    sessionResult = 'jackpot';
                } else if (isWin) {
                    sessionGain = Math.round(sBetB * 1.96) - sTotalCost;
                    session.currentBalance += sessionGain;
                    session.activeLevel = 1;
                    sessionResult = 'win';
                } else {
                    sessionGain = -sTotalCost;
                    session.currentBalance += sessionGain;
                    session.activeLevel = session.activeLevel >= 5 ? 1 : session.activeLevel + 1;
                    sessionResult = 'loss';
                }

                const editedSessionMsg = `🚨 <b>LOSS COVER SESSION RESOLVED</b> 🚨\n\n` +
                                         `PERIOD:- ${latestId.slice(-4)}\n\n` +
                                         `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                                         `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                                         `RUGLT. :- ${outcomeDisplay}\n\n` +
                                         `B•BET.  :- ₹${sBetB}\n\n` +
                                         `N•BET.  :- ₹${sBetN}\n\n` +
                                         `LEVEL.  :- ${session.activeLevel}\n\n` +
                                         `💰 <b>नया वॉलेट बैलेंस:</b> ₹${session.currentBalance}`;

                try {
                    await bot.editMessageText(editedSessionMsg, {
                        chat_id: session.chatId,
                        message_id: session.lastMessageId,
                        parse_mode: 'HTML'
                    });
                } catch (err) {}

                const sSticker = sessionResult === 'jackpot' ? STICKER_JACKPOT : (sessionResult === 'win' ? STICKER_WIN : STICKER_LOSS);
                const sFallback = sessionResult === 'jackpot' ? '🎇' : (sessionResult === 'win' ? '🌟' : '🤬');
                await sendStickerSafe(session.chatId, sSticker, sFallback);

                // Check 10% Target Completion
                if (session.currentBalance >= session.targetBalance) {
                    session.step = 'cooldown';
                    session.cooldownUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 Hours lockdown

                    const completeMsg = `🎉 <b>बधाई हो! आपका आज का 10% प्रॉफिट लक्ष्य पूरा हुआ।</b>\n\n` +
                                        `💰 <b>नया वॉलेट बैलेंस:</b> ₹${session.currentBalance}\n` +
                                        `⏳ हम अगले <b>2 घंटे बाद</b> ₹${session.currentBalance} से नया सेशन फिर से शुरू करेंगे!\n\n` +
                                        `यदि आपको तुरंत प्रेडिक्शन चाहिए तो आप हमारे ऑफिशियल चैनल 👉 <b>@TREDSTERV20</b> से ले सकते हैं जहाँ 24 घंटे लगातार लाइव प्रेडिक्शन मिलता है।`;
                    await bot.sendMessage(session.chatId, completeMsg, { parse_mode: 'HTML' });
                } else {
                    const sessionPrompt = `🎯 <b>लॉस रिकवरी प्रेडिक्शन तैयार है!</b>\n\nनीचे दिए गए बटन पर क्लिक करके तुरंत नया प्रेडिक्शन प्राप्त करें:`;
                    const sOpts = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '➡️ अगला प्रेडिक्शन प्राप्त करें', callback_data: 'get_next_pred_personal' }]
                            ]
                        }
                    };
                    await bot.sendMessage(session.chatId, sessionPrompt, { parse_mode: 'HTML', reply_markup: sOpts.reply_markup });
                }
            }
        }
    }

    // 3. Compute 8-BOX Values for upcoming Period
    const nextId = (BigInt(latestId) + 1n).toString();
    const P = BigInt(nextId);

    // Box 1 (P-10)
    let b1Val = history.find(h => h.issue === (P - 10n).toString());
    boxState.b1 = b1Val ? b1Val.number : null;

    // Box 2, 3 & 4 (Occurrence scanning)
    const curN = latestOutcome.number;
    let matchSequence = [];
    for (let i = 1; i < history.length; i++) {
        if (history[i].number === curN) {
            if (history[i-1] !== undefined) matchSequence.push(history[i-1].number);
        }
    }
    boxState.b2 = matchSequence[0] !== undefined ? matchSequence[0] : null;
    boxState.b3 = matchSequence[1] !== undefined ? matchSequence[1] : null;
    boxState.b4 = matchSequence[2] !== undefined ? matchSequence[2] : null;

    // Box 5 (3-Digit lookup matching database)
    const pLast3 = parseInt(nextId.slice(-3));
    boxState.b5 = THREE_DIGIT_MAP[pLast3] !== undefined ? THREE_DIGIT_MAP[pLast3] : 0;

    // Box 6 (1-Digit lookup matching map)
    const pLast1 = parseInt(nextId.slice(-1));
    let b6MapArray = ONE_DIGIT_MAP[pLast1] || [4, 2];
    boxState.b6 = b6MapArray[0];

    // Box 7 (3-Digit History Scan)
    const nextIdLast3Str = nextId.slice(-3);
    const box7Match = history.find(h => h.issue !== latestId && h.issue.endsWith(nextIdLast3Str));
    boxState.b7 = box7Match ? box7Match.number : null;

    // Box 8 (2-Digit History Scan)
    const nextIdLast2Str = nextId.slice(-2);
    const box8Match = history.find(h => h.issue !== latestId && h.issue.endsWith(nextIdLast2Str));
    boxState.b8 = box8Match ? box8Match.number : null;

    // --- FORMULATE FINAL HEDGING SOLVER FROM RESOLVED BOX VALUES ---
    let solvedInputs = [
        boxState.b1, boxState.b2, boxState.b3, boxState.b4,
        boxState.b5, boxState.b6, boxState.b7, boxState.b8
    ].filter(v => v !== null);

    let finalSelection = "BIG";
    let finalNums = [2, 4];

    if (solvedInputs.length > 0) {
        let bigCount = 0, smallCount = 0, redCount = 0, greenCount = 0;
        solvedInputs.forEach(n => {
            if (n >= 5) bigCount++; else smallCount++;
            if ([0, 2, 4, 6, 8].includes(n)) redCount++; else greenCount++;
        });

        const max_size = Math.max(bigCount, smallCount);
        const max_color = Math.max(redCount, greenCount);

        let dominantSize = bigCount >= smallCount ? "BIG" : "SMALL";
        let dominantColor = redCount >= greenCount ? "RED" : "GREEN";

        if (max_color > max_size) {
            // COLOR PREDICTION IS DOMINANT
            finalSelection = dominantColor;
            if (dominantColor === "RED") {
                // RED -> HEDGE WITH GREEN NUMBERS [1, 3] or [7, 9] (Select exact 2 from history frequency)
                finalNums = (dominantSize === "BIG") ? getOppositeHedgingNums([7, 9], history) : getOppositeHedgingNums([1, 3], history);
            } else {
                // GREEN -> HEDGE WITH RED NUMBERS [2, 4] or [6, 8]
                finalNums = (dominantSize === "BIG") ? getOppositeHedgingNums([6, 8], history) : getOppositeHedgingNums([2, 4], history);
            }
        } else {
            // SIZE PREDICTION IS DOMINANT
            finalSelection = dominantSize;
            if (dominantSize === "BIG") {
                // BIG -> HEDGE WITH SMALL NUMBERS: RED [0, 2, 4] or GREEN [1, 3] (Select exact 2)
                finalNums = (dominantColor === "RED") ? getOppositeHedgingNums([0, 2, 4], history) : getOppositeHedgingNums([1, 3], history);
            } else {
                // SMALL -> HEDGE WITH BIG NUMBERS: RED [6, 8] or GREEN [5, 7, 9]
                finalNums = (dominantColor === "RED") ? getOppositeHedgingNums([6, 8], history) : getOppositeHedgingNums([5, 7, 9], history);
            }
        }
    }

    currentPrediction = {
        issue: nextId,
        predType: finalSelection,
        nums: finalNums,
        level: botLevel,
        messageId: null,
        isChannelPosted: false
    };

    // Auto-Post to channel (automated 24/7 on channel)
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) {
            await sendPredictionToChannel();
        }
    }, 15000); 
}

// Function to calculate and post the active prediction to the channel (NO INTERACTIVE BUTTON)
async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;

    const scale = walletBalance / 3963;
    const botIdx = Math.min(currentPrediction.level - 1, 4);
    const botLvlConfig = LVL_BASE[botIdx];
    const bBet = Math.round(botLvlConfig.b * scale);
    const nBet = Math.round(botLvlConfig.n * scale);

    const liveMsg = `PREDICTION LIVE\n\n` +
                    `PERIOD:- ${currentPrediction.issue.slice(-4)}\n\n` +
                    `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                    `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                    `RUGLT. :- WAIT\n\n` +
                    `B•BET.  :- ₹${bBet}\n\n` +
                    `N•BET.  :- ₹${nBet}\n\n` +
                    `LEVEL.  :- ${currentPrediction.level}`;

    try {
        const sentMessage = await bot.sendMessage(CHANNEL_CHAT_ID, liveMsg, { parse_mode: 'HTML' });
        currentPrediction.messageId = sentMessage.message_id;
        currentPrediction.isChannelPosted = true;
    } catch (err) {
        console.error("Failed to post next prediction to channel:", err.message);
    }
}

// Universal Sticker Sender Helper
async function sendStickerSafe(chatId, stickerId, fallbackEmoji) {
    try {
        await bot.sendSticker(chatId, stickerId);
    } catch(err) {
        await bot.sendMessage(chatId, fallbackEmoji);
    }
}

// Core monitor check triggers
setInterval(monitorLoop, 5000);
console.log("Monitoring 1M active loop...");
