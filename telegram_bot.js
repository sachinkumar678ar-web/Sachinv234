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
 *  - /sctimeline : Sends a clean .txt file of last 24 hours SC-Outcomes (Jackpot = Loss).
 *  - /8box : Display the analytical breakdown of all 8 logical boxes.
 *  - /ai : Interactive inline command center answering Q1-Q6 in Hindi.
 *  - /losscover : Start an AI-driven personal session to recover user's losses.
 *  - /editwallet <amount> : Edit current wallet balance inside active loss cover session.
 */

const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// --- SETUP CONFIGURATIONS ---
const TELEGRAM_BOT_TOKEN = '8555094944:AAEJuHmxBosT6qST62J-AwbwfiZp1NHoY5s'; 
const CHANNEL_CHAT_ID = '-1003752888794'; 

// --- STICKERS FILES IDS (UPDATED) ---
const STICKER_SESSION_START = 'CAACAgUAAxkBAAERUflqH59hulm8S3jEyVYqrTDfemK-dgAC4BEAAnSoKFdG6jNCVXRX-DsE';
const STICKER_SESSION_CLOSE = 'CAACAgUAAxkBAAERUftqH5-9mY4eVbyNMsNOFqFFs4nVWgACIhAAArn7MFcF9EgzX3u20zsE';
const STICKER_WIN = 'CAACAgUAAxkBAAERUfdqH5xnHp2mdQFRb9jhkjAhCI8IKgACdh8AAtLWAVXrhhN_7ShJYjsE'; 
const STICKER_LOSS = 'CAACAgUAAxkBAAERUfNqH5wHEHfz47JqHTak7ngYhPDAagACdR8AAtLWAVXv3QvM7v_5zTsE';
const STICKER_JACKPOT = 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE';

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
let lowBudgetLevelSim = 1; // Simulated Level tracker for timeline2
let walletBalance = 4000; 
let currentPrediction = null; 
let lastUserRequest = {};
let boxState = { b1: null, b2: null, b3: null, b4: null, b5: null, b6: null, b7: null, b8: null };
let autoPostTimeout = null;

// User session tracking
let userSessions = {};       
let personalRequests = {};   

// Rolling window for 24 hours timeline results
let periodResults = [];      // timeline1 (WIN, LOSS, JACKPOT)
let periodResultsLow = [];   // timeline2 (WIN, LOSS - Jackpots treated as Loss/Win)
let lastPinnedDate = null;   
let pinnedMessageId = null;  

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
}).catch(err => {
    console.error("⚠️ Error dropping webhook on startup:", err.message);
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

// CRITICAL EXCEPTION SAFEGUARDS: Prevents Render Node process from ever crashing
process.on('uncaughtException', (err) => {
    console.error('🔥 SYSTEM WARNING: Uncaught Exception caught securely:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 SYSTEM WARNING: Unhandled Rejection bypassed safely at:', promise, 'reason:', reason);
});

// Helper: Get Exact IST Time values
function getISTTime() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * 5.5)); // IST is UTC+5.5
    return nd;
}

function getISTTimeString() {
    const nd = getISTTime();
    let hours = nd.getHours();
    let minutes = nd.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;
    const strTime = (hours < 10 ? '0'+hours : hours) + ':' + minutes + ' ' + ampm;
    return strTime;
}

// Default static safe slots for emergency fallback
const DEFAULT_SAFE_SLOTS = [
    { start: "11:00 AM", end: "01:00 PM", label: "UNDER 1 LEVEL" },
    { start: "03:20 PM", end: "04:00 PM", label: "UNDER 2 LEVEL" },
    { start: "08:00 PM", end: "08:40 PM", label: "UNDER 2 LEVEL" },
    { start: "10:10 PM", end: "10:50 PM", label: "UNDER 2 LEVEL" }
];

function parseTimeToMinutes12(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!parts) return 0;
    let hours = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const ampm = parts[3].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

function minutesToTime12(totalMin) {
    let hours = Math.floor(totalMin / 60);
    let minutes = totalMin % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return (hours < 10 ? '0' + hours : hours) + ':' + minutes + ' ' + ampm;
}

function extractSafeSlots(timelineRecords, maxAllowedLevel, minDuration) {
    if (timelineRecords.length === 0) return [];
    
    // Sort records chronologically (oldest first)
    const sorted = [...timelineRecords].sort((a, b) => a.timestamp - b.timestamp);
    
    let cycles = [];
    let currentCycle = [];
    for (let i = 0; i < sorted.length; i++) {
        currentCycle.push(sorted[i]);
        if (sorted[i].status === "win") {
            cycles.push({
                records: currentCycle,
                maxLevel: sorted[i].level,
                startTime: currentCycle[0].predTime || currentCycle[0].time,
                endTime: sorted[i].time // Resolution time
            });
            currentCycle = [];
        } else if (sorted[i].status === "jackpot" && maxAllowedLevel > 2) {
            // For standard timeline calculations only, treat jackpot as safe cycles
            cycles.push({
                records: currentCycle,
                maxLevel: sorted[i].level,
                startTime: currentCycle[0].predTime || currentCycle[0].time,
                endTime: sorted[i].time
            });
            currentCycle = [];
        }
    }
    
    let safeSlots = [];
    let currentSlotStart = null;
    let currentSlotEnd = null;
    
    for (let i = 0; i < cycles.length; i++) {
        const cycle = cycles[i];
        if (cycle.maxLevel <= maxAllowedLevel) {
            if (currentSlotStart === null) {
                currentSlotStart = cycle.startTime;
            }
            currentSlotEnd = cycle.endTime;
        } else {
            if (currentSlotStart !== null && currentSlotEnd !== null) {
                const startMin = parseTimeToMinutes12(currentSlotStart);
                const endMin = parseTimeToMinutes12(currentSlotEnd);
                const duration = (endMin >= startMin) ? (endMin - startMin) : (1440 - startMin + endMin);
                if (duration >= minDuration) {
                    // Subtract 1 minute from start, and 2 minutes from end times
                    const startAdjusted = minutesToTime12((startMin - 1 + 1440) % 1440);
                    const endAdjusted = minutesToTime12((endMin - 2 + 1440) % 1440);
                    safeSlots.push({
                        start: startAdjusted,
                        end: endAdjusted,
                        label: `UNDER ${maxAllowedLevel} LEVEL`
                    });
                }
            }
            currentSlotStart = null;
            currentSlotEnd = null;
        }
    }
    
    if (currentSlotStart !== null && currentSlotEnd !== null) {
        const startMin = parseTimeToMinutes12(currentSlotStart);
        const endMin = parseTimeToMinutes12(currentSlotEnd);
        const duration = (endMin >= startMin) ? (endMin - startMin) : (1440 - startMin + endMin);
        if (duration >= minDuration) {
            const startAdjusted = minutesToTime12((startMin - 1 + 1440) % 1440);
            const endAdjusted = minutesToTime12((endMin - 2 + 1440) % 1440);
            safeSlots.push({
                start: startAdjusted,
                end: endAdjusted,
                label: `UNDER ${maxAllowedLevel} LEVEL`
            });
        }
    }
    return safeSlots;
}

function getSafeTimeSlots(useTimeline2 = false) {
    const targetTimeline = useTimeline2 ? periodResultsLow : periodResults;
    const now = getISTTime().getTime();
    const last24h = targetTimeline.filter(r => now - r.timestamp < 24 * 60 * 60 * 1000);
    
    // Low-balance timeline2 requires 5 min minimum duration and UNDER 2 LEVEL restriction
    const minDuration = useTimeline2 ? 5 : 10;
    const allowedLevel = useTimeline2 ? 2 : 2; 

    if (last24h.length < 5) return DEFAULT_SAFE_SLOTS;
    
    const calculatedSlots = extractSafeSlots(last24h, allowedLevel, minDuration);
    return calculatedSlots.length > 0 ? calculatedSlots : DEFAULT_SAFE_SLOTS;
}

function isTimeInSafeSlot(useTimeline2 = false) {
    const timeStr = getISTTimeString(); // "HH:MM AM/PM"
    const currentMin = parseTimeToMinutes12(timeStr);
    
    const activeSlots = getSafeTimeSlots(useTimeline2);
    for (const slot of activeSlots) {
        const startMin = parseTimeToMinutes12(slot.start);
        const endMin = parseTimeToMinutes12(slot.end);
        if (currentMin >= startMin && currentMin <= endMin) {
            return { isSafe: true, slot: slot };
        }
    }
    return { isSafe: false, slots: activeSlots };
}

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
    
    let sortedPool = [...pool].sort((a, b) => counts[b] - counts[a]);
    return [sortedPool[0], sortedPool[1]].sort((a, b) => a - b);
}

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
        
        const activeSlots = getSafeTimeSlots(false);
        let slotText = "";
        activeSlots.forEach(s => {
            slotText += `🟢 <b>स्लॉट: ${s.start} - ${s.end} (${s.label})</b>\n`;
        });
        
        const pinMsg = `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🏆 <b>WELCOME TO TRADE'S STAR V20 PRO VIP</b> 🏆\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `यह कोई साधारण प्रेडिक्शन चैनल नहीं है। यह विंगो (Wingo 1M) गेम के इतिहास का सबसे उन्नत, वैज्ञानिक और 100% गणितीय AI सिग्नल्स (8-Box Neural Matrix) का घर है।\n\n` +
                       `यदि आप बार-बार लॉस करके थक चुके हैं, तो इस मैसेज को शुरू से लेकर आखिरी तक ध्यान से पढ़ें।\n` +
                       `यह एक मैसेज आपकी पूरी ट्रेडिंग लाइफ और आपके बैंक बैलेंस को बदल सकता है! 💰🤖\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `⏰ <b>ट्रेडिंग के सुनहरे स्लॉट्स (Golden Time Slots)</b>\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `${slotText}\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🛡️ <b>अपना लॉस रिकवर कैसे करें? (/losscover)</b>\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `1. बोट पर जाएँ\n` +
                       `2. /losscover दबाएँ\n` +
                       `3. अपना लॉस अमाउंट दर्ज करें\n` +
                       `4. वॉलेट बैलेंस लिखें\n\n` +
                       `⚠️ <b>नियम:</b>\n` +
                       `कम से कम ₹2000 बैलेंस होना जरूरी है\n\n` +
                       `👉 बोट 10% डेली टारगेट सेट करेगा\n` +
                       `👉 टारगेट पूरा होते ही 2 घंटे का लॉक\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `📊 <b>5-LEVEL MONEY MANAGEMENT CHART</b>\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `📶 <b>L1:</b> ₹9 | ₹2\n` +
                       `📶 <b>L2:</b> ₹36 | ₹8\n` +
                       `📶 <b>L3:</b> ₹139 | ₹31\n` +
                       `📶 <b>L4:</b> ₹533 | ₹119\n` +
                       `📶 <b>L5:</b> ₹2026 | ₹450\n\n` +
                       `👉 इस सिस्टम से लॉस practically impossible है\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🔗 <b>IMPORTANT LINKS</b>\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `📱 <b>REGISTER LINKS:</b>\n` +
                       `👉 <a href="https://www.tirangagames8.com/">TIRANGA GAMES</a>\n` +
                       `👉 <a href="https://www.bdgwin.com/">BDG WIN</a>\n\n` +
                       `🤖 <b>BOT:</b>\n` +
                       `👉 @TRADE_STAR_V20_BOT\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🛑 <b>VIP GOLDEN RULES</b>\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `🚫 <b>लालच न करें</b> (10% profit पर बंद)\n` +
                       `🚫 <b>खुद से ट्रेड न करें</b>\n` +
                       `🛡️ <b>5 Level fund ready रखें</b>\n` +
                       `🔄 <b>Panic न करें</b> (Recovery possible है)\n\n` +
                       `👉 <i>"अनुशासन ही जीत की चाबी है"</i> 🔑\n\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🏆 <b>TEAM @TREDSTERV20</b>\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━`;
                       
        const sent = await bot.sendMessage(CHANNEL_CHAT_ID, pinMsg, { parse_mode: 'HTML', disable_web_page_preview: true });
        await bot.pinChatMessage(CHANNEL_CHAT_ID, sent.message_id);
        pinnedMessageId = sent.message_id;
        console.log(`📌 Daily fresh message pinned securely on channel in IST. ID: ${pinnedMessageId}`);
    } catch (err) {
        console.error("⚠️ Failed to execute daily Pin-Delete system in IST:", err.message);
    }
}

function getFancyType(type) {
    if (type === "BIG") return "BIGGG";
    if (type === "RED") return "REDDD";
    return type; 
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const startMsg = `🌟 <b>WELCOME TO TRADE'S STAR V20 PRO VIP BOT</b> 🌟\n\n` +
                     `यहाँ बोट के सभी लाइव कमांड्स की सूची दी गई है (कमांड पर क्लिक करें):\n\n` +
                     `👉 /prediction - अभी का लाइव प्रेडिक्शन देखें।\n` +
                     `👉 /losscover - अपनी लॉस रिकवरी सेशन शुरू करें।\n` +
                     `👉 /editwallet - लॉस कवर वॉलेट बैलेंस संपादित करें (उदा: /editwallet 2500).\n` +
                     `👉 /level - वॉलेट बैलेंस अपडेट करें (उदा: /level 4000).\n` +
                     `👉 /chart - अपनी बेट के हिसाब से साफ और सुंदर चार्ट देखें।\n` +
                     `👉 /history - 24 घंटे का पूरा इतिहास फ़ाइल रूप में प्राप्त करें।\n` +
                     `👉 /timeline - पिछले 24 घंटे का रीयल-टाइम परिणाम टाइमलाइन फ़ाइल डाउनलोड करें।\n` +
                     `👉 /sctimeline - पिछले 24 घंटे का SC-टाइमलाइन (Jackpot = Loss) फ़ाइल डाउनलोड करें।\n` +
                     `👉 /8box - 8 बॉक्स की लाइव कैलकुलेशन और Numbers देखें।\n` +
                     `👉 /ai - इंटरैक्टिव ai सवाल और जवाब कंसोल खोलें।\n` +
                     `👉 /stats - बोट की लाइव जीत/हार की सांख्यिकी देखें।`;
    bot.sendMessage(chatId, startMsg, { parse_mode: 'HTML' }).catch(err => console.error("Error sending /start:", err.message));
});

bot.onText(/\/prediction/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const now = getISTTime().getTime();

    const session = userSessions[userId];
    if (session) {
        if (session.step === 'cooldown') {
            if (now < session.cooldownUntil) {
                const remainingMin = Math.round((session.cooldownUntil - now) / 60000);
                const lockoutMsg = `⚠️ <b>अभी आपका लॉस हो सकता है!</b>\n\n` +
                                   `यदि आपको तुरंत प्रेडिक्शन चाहिए तो आप हमारे ऑफिशियल टीम चैनल 👉 <b>@TREDSTERV20</b> से ले सकते हैं जहाँ 24 घंटे लगातार लाइव प्रेडिक्शन मिलता है।\n\n` +
                                   `⏳ आपका अगला सुरक्षित पर्सनल सेशन <b>${remainingMin} मिनट</b> बाद शुरू होगा।`;
                await bot.sendMessage(chatId, lockoutMsg, { parse_mode: 'HTML' }).catch(() => {});
                return;
            } else {
                session.initialBalance = session.currentBalance;
                session.targetBalance = session.type === 'low_balance' ? Math.round(session.currentBalance * 1.05) : Math.round(session.currentBalance * 1.10);
                session.step = 'active';
                session.activeLevel = 1;
                session.lastPredictedPeriod = null;
            }
        }

        if (session.step === 'active') {
            if (!currentPrediction) {
                await bot.sendMessage(chatId, `⚠️ लाइव API सिंकिंग की प्रतीक्षा करें... 5 सेकंड में दोबारा प्रयास करें।`).catch(() => {});
                return;
            }

            // Low-Balance Gatekeeper (No numbers, sctimeline Safe Slot restriction only)
            if (session.type === 'low_balance') {
                const checkSafe = isTimeInSafeSlot(true); // check sctimeline slots
                if (!checkSafe.isSafe) {
                    const nextSlot = checkSafe.slots[0] || DEFAULT_SAFE_SLOTS[0];
                    const unsafeMsg = `⚠️ <b>अभी आपका लॉस हो सकता है!</b>\n\n` +
                                      `चूंकि आपका बजट छोटा (₹2000 से कम) है, इसलिए सुरक्षित प्रेडिक्शन के लिए कृपया <b>${nextSlot.start} से ${nextSlot.end}</b> के बीच तैयार रहें। तब आपको सुरक्षित प्रेडिक्शन दिया जाएगा!`;
                    await bot.sendMessage(chatId, unsafeMsg, { parse_mode: 'HTML' }).catch(() => {});
                    return;
                }

                const bBet = 10 * Math.pow(2, session.activeLevel - 1);

                const lowBalMsg = `🚨 <b>PREDICTION LIVE</b> 🚨\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🔮 N•PRED:-   🌐🌐(SAFE)🌐🌐\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🎲 RUGLT. :-   WAIT\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `💵 B•BET.  :- ₹${bBet}\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🪙 N•BET.  :- ₹0\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `📊 LEVEL.  :- ${session.activeLevel}\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━`;

                const sentMsg = await bot.sendMessage(chatId, lowBalMsg, { parse_mode: 'HTML' }).catch(() => {});
                if (sentMsg) {
                    session.lastMessageId = sentMsg.message_id;
                    session.lastPredictedPeriod = currentPrediction.issue;
                }
                return;
            }

            // Standard High-Balance Loss Cover prediction
            const scale = session.currentBalance / 3963;
            const botIdx = Math.min(session.activeLevel - 1, 4);
            const config = LVL_BASE[botIdx];
            const bBet = Math.round(config.b * scale);
            const nBet = Math.round(config.n * scale);

            const liveMsg = `🚨 <b>PREDICTION LIVE</b> 🚨\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🎲 RUGLT. :-   WAIT\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `💵 B•BET.  :- ₹${bBet}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🪙 N•BET.  :- ₹${nBet}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `📊 LEVEL.  :- ${session.activeLevel}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━`;

            const sentMsg = await bot.sendMessage(chatId, liveMsg, { parse_mode: 'HTML' }).catch(() => {});
            if (sentMsg) {
                session.lastMessageId = sentMsg.message_id;
                session.lastPredictedPeriod = currentPrediction.issue;
            }
            return;
        }
    }

    // Standard user limit constraint
    if (lastUserRequest[userId] && (now - lastUserRequest[userId] < 60000)) {
        bot.sendMessage(chatId, `⏳ <b>Please next period number wait!</b> 1 मिनट में केवल एक ही बार प्रेडिक्शन मंगाया जा सकता है।`, { parse_mode: 'HTML' }).catch(() => {});
        return;
    }

    if (!currentPrediction) {
        bot.sendMessage(chatId, `⚠️ लाइव API सिंकिंग की प्रतीक्षा करें... 5 सेकंड में दोबारा प्रयास करें।`).catch(() => {});
        return;
    }

    lastUserRequest[userId] = now;
    const scale = walletBalance / 3963;
    const botIdx = Math.min(botLevel - 1, 4);
    const config = LVL_BASE[botIdx];
    const bBet = Math.round(config.b * scale);
    const nBet = Math.round(config.n * scale);

    const message = `🚨 <b>PREDICTION LIVE</b> 🚨\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🎲 RUGLT. :-   WAIT\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `💵 B•BET.  :- ₹${bBet}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🪙 N•BET.  :- ₹${nBet}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📊 LEVEL.  :- ${botLevel}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━`;

    const sentMsg = await bot.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => {});
    
    if (sentMsg) {
        personalRequests[userId] = {
            chatId: chatId,
            lastMessageId: sentMsg.message_id,
            lastPredictedPeriod: currentPrediction.issue
        };
    }
});

bot.onText(/\/losscover/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const session = userSessions[userId];
    if (session) {
        if (session.step === 'cooldown' && getISTTime().getTime() < session.cooldownUntil) {
            const remainingMin = Math.round((session.cooldownUntil - getISTTime().getTime()) / 60000);
            const lockoutMsg = `⚠️ <b>अभी आपका लॉस हो सकता है!</b>\n\n` +
                               `यदि आपको तुरंत प्रेडिक्शन चाहिए तो आप हमारे ऑफिशियल टीम चैनल 👉 <b>@TREDSTERV20</b> से ले सकते हैं।\n\n` +
                               `⏳ आपका पर्सनल सेशन <b>${remainingMin} मिनट</b> बाद शुरू किया जा सकेगा।`;
            await bot.sendMessage(chatId, lockoutMsg, { parse_mode: 'HTML' }).catch(() => {});
            return;
        }
        if (session.step === 'active') {
            await bot.sendMessage(chatId, `📈 आपका लॉस कवर सेशन पहले से ही सक्रिय है!\n💰 <b>बैलेंस:</b> ₹${session.currentBalance}\n🎯 <b>लक्ष्य:</b> ₹${session.targetBalance}\n\nनया प्रेडिक्शन लेने के लिए /prediction दबाएं या नीचे दिए बटन पर क्लिक करें।`, { parse_mode: 'HTML' }).catch(() => {});
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
        lastMessageId: null,
        type: 'standard'
    };

    await bot.sendMessage(chatId, "📉 <b>लॉस रिकवरी असिस्टेंट में आपका स्वागत है!</b>\n\nकृपया अपना कुल लॉस अमाउंट दर्ज करें (जैसे: 40000 या 5000):", { parse_mode: 'HTML' }).catch(() => {});
});

bot.onText(/\/editwallet(?:\s+)?(?:<)?(\d+)(?:>)?/i, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const amount = parseFloat(match[1]);

    const session = userSessions[userId];
    if (!session || (session.step !== 'active' && session.step !== 'cooldown')) {
        bot.sendMessage(chatId, `❌ आपका कोई सक्रिय लॉस कवर सेशन नहीं चल रहा है! पहले /losscover शुरू करें।`, { parse_mode: 'HTML' }).catch(() => {});
        return;
    }

    if (!isNaN(amount) && amount >= 200) {
        session.currentBalance = amount;
        session.initialBalance = amount;
        
        if (amount < 2000) {
            session.type = 'low_balance';
            session.targetBalance = Math.round(amount + session.lossAmount);
            bot.sendMessage(chatId, `💰 <b>Wallet Balance updated to (Low Budget Mode):</b> ₹${amount}\n\nअब प्रेडिक्शन केवल सुरक्षित स्लॉट्स में ₹10 -> ₹20 प्रोग्रेसिव साइज/कलर पर मिलेंगे!`, { parse_mode: 'HTML' }).catch(() => {});
        } else {
            session.type = 'standard';
            session.targetBalance = Math.round(amount * 1.10);
            bot.sendMessage(chatId, `💰 <b>Wallet Balance updated to (Standard Mode):</b> ₹${amount}\n\nआज का 10% प्रॉफिट लक्ष्य ₹${session.targetBalance} निर्धारित किया गया है!`, { parse_mode: 'HTML' }).catch(() => {});
        }
    } else {
        bot.sendMessage(chatId, `❌ अमान्य अमाउंट! सही फॉर्मेट: /editwallet 2500 (न्यूनतम ₹200)`, { parse_mode: 'HTML' }).catch(() => {});
    }
});

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
                await bot.sendMessage(chatId, "❌ कृपया एक सही लॉस राशि दर्ज करें (जैसे: 40000):").catch(() => {});
                return;
            }
            session.lossAmount = loss;
            session.step = 'awaiting_balance';
            await bot.sendMessage(chatId, "💰 <b>धन्यवाद!</b> अब दर्ज करें कि आपके वॉलेट में अभी कितना अमाउंट उपलब्ध है?", { parse_mode: 'HTML' }).catch(() => {});
            return;
        }

        if (session.step === 'awaiting_balance') {
            const balance = parseFloat(text);
            if (isNaN(balance) || balance < 200) {
                await bot.sendMessage(chatId, "⚠️ <b>डिपॉजिट आवश्यक!</b> कृपया कम से कम <b>₹200</b> या इससे ज़्यादा का वॉलेट बैलेंस लिखें, क्योंकि इतने कम अमाउंट में लेवल मैनेज नहीं हो पाता।", { parse_mode: 'HTML' }).catch(() => {});
                return;
            }

            session.initialBalance = balance;
            session.currentBalance = balance;

            if (balance < 2000) {
                // Low Balance Route (Safe Slot + Size/Color Only)
                session.type = 'low_balance';
                session.targetBalance = Math.round(balance + session.lossAmount); 
                session.step = 'active';
                session.activeLevel = 1;
                session.lastPredictedPeriod = null;

                const nextSlot = DEFAULT_SAFE_SLOTS[0];
                await sendStickerSafe(chatId, STICKER_SESSION_START, "🚀");
                const successMsg = `🚀 <b>लॉस कवर सेशन (LOW BUDGET MODE) शुरू हो चुका है!</b>\n\n` +
                                   `📉 <b>आपका कुल लॉस:</b> ₹${session.lossAmount}\n` +
                                   `💰 <b>शुरुआती वॉलेट बैलेंस:</b> ₹${session.initialBalance}\n` +
                                   `🎯 <b>अंतिम लॉस रिकवरी लक्ष्य:</b> ₹${session.targetBalance}\n\n` +
                                   `🛡️ <b>विशेष नियम (बैलेंस < ₹2000):</b>\n` +
                                   `👉 आपको केवल <b>BIGGG/SMALL/REDDD/GREEN</b> प्रेडिक्शन मिलेंगे।\n` +
                                   `👉 प्रोग्रेसिव बेट: <b>₹10 -> ₹20 -> ₹40 -> ₹80...</b>\n` +
                                   `👉 सिग्नल्स केवल सुरक्षित स्लॉट्स के दौरान ही कार्य करेंगे।\n\n` +
                                   `नया प्रेडिक्शन प्राप्त करने के लिए अभी /prediction दबाएं!`;
                await bot.sendMessage(chatId, successMsg, { parse_mode: 'HTML' }).catch(() => {});
            } else {
                // Standard High Balance Route
                session.type = 'standard';
                session.targetBalance = Math.round(balance * 1.10); 
                session.step = 'active';
                session.activeLevel = 1;
                session.lastPredictedPeriod = null;

                await sendStickerSafe(chatId, STICKER_SESSION_START, "🚀");
                const successMsg = `🚀 <b>लॉस कवर सेशन शुरू हो चुका है!</b>\n\n` +
                                   `📉 <b>आपका कुल लॉस:</b> ₹${session.lossAmount}\n` +
                                   `💰 <b>शुरुआती वॉलेट बैलेंस:</b> ₹${session.initialBalance}\n` +
                                   `🎯 <b>आज का प्रॉफिट लक्ष्य (10%):</b> ₹${session.targetBalance}\n\n` +
                                   `नया प्रेडिक्शन प्राप्त करने के लिए अभी /prediction दबाएं!`;
                await bot.sendMessage(chatId, successMsg, { parse_mode: 'HTML' }).catch(() => {});
            }
        }
    }
});

bot.onText(/\/level\s+(\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);
    if (!isNaN(amount) && amount > 0) {
        walletBalance = amount;
        bot.sendMessage(chatId, `💰 <b>Channel Wallet Balance updated to:</b> ₹${walletBalance}\nअब सार्वजनिक बेटिंग चार्ट नए बैलेंस के अनुसार स्केल होगा!`, { parse_mode: 'HTML' }).catch(() => {});
    } else {
        bot.sendMessage(chatId, `❌ अमान्य अमाउंट! सही फॉर्मेट: /level 4000`, { parse_mode: 'HTML' }).catch(() => {});
    }
});

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
    
    bot.sendMessage(chatId, chartMsg, { parse_mode: 'HTML' }).catch(() => {});
});

bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    if (history.length === 0) {
        bot.sendMessage(chatId, `📭 इतिहास अभी खाली है। API सिंक की प्रतीक्षा करें...`, { parse_mode: 'HTML' }).catch(() => {});
        return;
    }

    let fileContent = `📜 TRADE'S STAR V20 PRO VIP - 24 HOURS SYSTEM HISTORY 📜\n\n`;
    fileContent += `Period ID   |  Number  |  Size   |  Color\n`;
    fileContent += `--------------------------------------------\n`;

    history.forEach(h => {
        const size = h.number >= 5 ? "BIGGG" : "SMALL";
        const col = [1,3,7,9].includes(h.number) ? "GREEN" : ([0,5].includes(h.number) ? "VIOLET" : "REDDD");
        fileContent += `${h.issue.padEnd(12)} |  ${h.number.toString().padEnd(7)} |  ${size.padEnd(6)} |  ${col}\n`;
    });

    const filePath = `./history_export_${Date.now()}.txt`;
    fs.writeFileSync(filePath, fileContent);

    try {
        await bot.sendDocument(chatId, filePath, { caption: `✅ आपके लिए पिछले सभी रीयल-टाइम इतिहास की फाइल तैयार की गई है!` });
    } catch (err) {
        bot.sendMessage(chatId, `❌ इतिहास फाइल भेजने में त्रुटि हुई!`, { parse_mode: 'HTML' }).catch(() => {});
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

bot.onText(/\/timeline/, async (msg) => {
    const chatId = msg.chat.id;
    const now = getISTTime().getTime();
    const records24h = periodResults.filter(r => now - r.timestamp < 24 * 60 * 60 * 1000);
    
    if (records24h.length === 0) {
        bot.sendMessage(chatId, "📭 टाइमलाइन अभी खाली है। परिणामों के लाइव सिंक्रोनाइजेशन की प्रतीक्षा करें।", { parse_mode: "HTML" }).catch(() => {});
        return;
    }
    
    let fileBody = `📜 TRADE'S STAR V20 PRO VIP - 24 HOURS RESULT TIMELINE 📜\n\n`;
    records24h.reverse().forEach(r => {
        fileBody += `${r.predTime || r.time} - Period #${r.period} -> ${r.status.toUpperCase()} (L${r.level})\n`;
    });
    
    const filePath = `./timeline_export_${Date.now()}.txt`;
    fs.writeFileSync(filePath, fileBody);
    
    try {
        await bot.sendDocument(chatId, filePath, { caption: "✅ आपके लिए पिछले 24 घंटे का परिणाम टाइमलाइन फाइल तैयार किया गया है!" });
    } catch (err) {
        bot.sendMessage(chatId, "❌ टाइमलाइन भेजने में त्रुटि हुई।", { parse_mode: "HTML" }).catch(() => {});
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

bot.onText(/\/sctimeline/, async (msg) => {
    const chatId = msg.chat.id;
    const now = getISTTime().getTime();
    const records24h = periodResultsLow.filter(r => now - r.timestamp < 24 * 60 * 60 * 1000);
    
    if (records24h.length === 0) {
        bot.sendMessage(chatId, "📭 टाइमलाइन अभी खाली है। परिणामों के लाइव सिंक्रोनाइजेशन की प्रतीक्षा करें।", { parse_mode: "HTML" }).catch(() => {});
        return;
    }
    
    let fileBody = `📜 TRADE'S STAR V20 PRO VIP - 24 HOURS SC-TIMELINE (JACKPOT = LOSS) 📜\n\n`;
    records24h.reverse().forEach(r => {
        fileBody += `${r.predTime || r.time} - Period #${r.period} -> ${r.status.toUpperCase()} (L${r.level})\n`;
    });
    
    const filePath = `./sctimeline_export_${Date.now()}.txt`;
    fs.writeFileSync(filePath, fileBody);
    
    try {
        await bot.sendDocument(chatId, filePath, { caption: "✅ आपके लिए पिछले 24 घंटे का SC-टाइमलाइन (Jackpot = Loss) फाइल तैयार किया गया है!" });
    } catch (err) {
        bot.sendMessage(chatId, "❌ SC-टाइमलाइन भेजने में त्रुटि हुई।", { parse_mode: "HTML" }).catch(() => {});
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

bot.onText(/\/8box/, (msg) => {
    const chatId = msg.chat.id;
    if (!currentPrediction) {
        bot.sendMessage(chatId, `⚠️ अभी तक कोई लाइव डेटा विश्लेषित हुआ है।`, { parse_mode: 'HTML' }).catch(() => {});
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
                   `🎯 <b>Target Prediction:</b> <b>${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})</b>`;
    bot.sendMessage(chatId, boxMsg, { parse_mode: 'HTML' }).catch(() => {});
});

bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    const statsMsg = `📊 <b>LIVE BOT ACCURACY STATISTICS</b> 📊\n\n` +
                     `🔥 <b>Total Signals Analyzed:</b> ${stats.total}\n` +
                     `🌟 <b>Wins:</b> ${stats.wins}\n` +
                     `🤬 <b>Losses:</b> ${stats.losses}\n` +
                     `🎇 <b>Jackpot Hits:</b> ${stats.jackpots}\n` +
                     `📈 <b>System Accuracy:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n` +
                     `🎚️ <b>Max Level Reached:</b> L${stats.maxLevelReached}`;
    bot.sendMessage(chatId, statsMsg, { parse_mode: 'HTML' }).catch(() => {});
});

bot.onText(/\/ai/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '❓ Q1. कितना भी प्रेड्शन दिया उसका विन रेत बताओ', callback_data: 'ai_q1' }],
                [{ text: '❓ Q2. सबसे ज़्यादा स्ट्रीक बार क्या आया है और कितनी बार', callback_data: 'ai_q2' }],
                [{ text: '❓ Q3. प्रेडिक्शन सबसे कम लेवल किस टाइम पर जाता है', callback_data: 'ai_q3' }],
                [{ text: '❓ Q4. क्या तुम इस काम को लेकर एक्सपर्ट हो', callback_data: 'ai_q4' }],
                [{ text: '❓ Q5. तुम्हारे साथ कौन-कौन है', callback_data: 'ai_q5' }],
                [{ text: '❓ Q6. यदि मेरे पास 2000 से कम पैसा है तो बेस्ट टाइम बताओ', callback_data: 'ai_q6' }]
            ]
        }
    };
    bot.sendMessage(chatId, '🤖 <b>TRADE\'S STAR ai प्रश्न कंसोल में आपका स्वागत है</b> 🤖\nनीचे दिए गए किसी भी मुख्य सवाल पर क्लिक करके तुरंत उसका लाइव वैज्ञानिक जवाब प्राप्त करें:', { parse_mode: 'HTML', reply_markup: opts.reply_markup }).catch(() => {});
});

bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    let replyText = "";

    try {
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

            const now = getISTTime().getTime();
            if (session.type === 'low_balance') {
                const checkSafe = isTimeInSafeSlot(true); // check sctimeline slots
                if (!checkSafe.isSafe) {
                    const nextSlot = checkSafe.slots[0] || DEFAULT_SAFE_SLOTS[0];
                    const unsafeMsg = `⚠️ <b>अभी आपका लॉस हो सकता है!</b>\n\n` +
                                      `सुरक्षित स्लॉट के लिए कृपया <b>${nextSlot.start} से ${nextSlot.end}</b> के बीच तैयार रहें।`;
                    await bot.sendMessage(message.chat.id, unsafeMsg, { parse_mode: 'HTML' }).catch(() => {});
                    await bot.answerCallbackQuery(callbackQuery.id);
                    return;
                }

                const bBet = 10 * Math.pow(2, session.activeLevel - 1);

                const lowBalMsg = `🚨 <b>PREDICTION LIVE</b> 🚨\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🔮 N•PRED:-   🌐🌐(SAFE)🌐🌐\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🎲 RUGLT. :-   WAIT\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `💵 B•BET.  :- ₹${bBet}\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🪙 N•BET.  :- ₹0\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `📊 LEVEL.  :- ${session.activeLevel}\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━`;

                const sentMsg = await bot.sendMessage(message.chat.id, lowBalMsg, { parse_mode: 'HTML' }).catch(() => {});
                if (sentMsg) {
                    session.lastMessageId = sentMsg.message_id;
                    session.lastPredictedPeriod = currentPrediction.issue;
                }
            } else {
                const scale = session.currentBalance / 3963;
                const botIdx = Math.min(session.activeLevel - 1, 4);
                const config = LVL_BASE[botIdx];
                const bBet = Math.round(config.b * scale);
                const nBet = Math.round(config.n * scale);

                const liveMsg = `🚨 <b>PREDICTION LIVE</b> 🚨\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `🎲 RUGLT. :-   WAIT\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `💵 B•BET.  :- ₹${bBet}\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `🪙 N•BET.  :- ₹${nBet}\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `📊 LEVEL.  :- ${session.activeLevel}\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━`;

                const sentMsg = await bot.sendMessage(message.chat.id, liveMsg, { parse_mode: 'HTML' }).catch(() => {});
                if (sentMsg) {
                    session.lastMessageId = sentMsg.message_id;
                    session.lastPredictedPeriod = currentPrediction.issue;
                }
            }

            await bot.answerCallbackQuery(callbackQuery.id, { text: "🚀 नया प्रेडिक्शन पर्सनल चैट में डिलीवर हुआ!" });
            return;
        }

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

            const liveMsg = `🚨 <b>PREDICTION LIVE</b> 🚨\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🎲 RUGLT. :-   WAIT\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `💵 B•BET.  :- ₹${bBet}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🪙 N•BET.  :- ₹${nBet}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `📊 LEVEL.  :- ${botLevel}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━`;

            const sentMsg = await bot.sendMessage(message.chat.id, liveMsg, { parse_mode: 'HTML' }).catch(() => {});
            
            if (sentMsg) {
                personalRequests[userId] = {
                    chatId: message.chat.id,
                    lastMessageId: sentMsg.message_id,
                    lastPredictedPeriod: currentPrediction.issue
                };
            }

            await bot.answerCallbackQuery(callbackQuery.id, { text: "🚀 नया प्रेडिक्शन पर्सनल चैट में डिलीवर हुआ!" });
            return;
        }

        if (data === 'continue_prediction_after_loss_cover') {
            const session = userSessions[userId];
            if (session) {
                session.initialBalance = session.currentBalance;
                session.step = 'active';
                session.activeLevel = 1;
                session.lastPredictedPeriod = null;
                await bot.sendMessage(message.chat.id, "🚀 <b>शानदार निर्णय!</b> नया प्रेडिक्शन प्राप्त करने के लिए /prediction दबाएं।", { parse_mode: 'HTML' }).catch(() => {});
            }
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }

        switch(data) {
            case 'ai_q1': {
                const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
                replyText = `📊 <b>Q1. कितना भी प्रेडिक्शन दिया उसका विन रेट बताओ:</b>\n\n` +
                            `• <b>टोटल सिग्नल्स:</b> ${stats.total}\n` +
                            `• <b>सफल जीत (Wins):</b> ${stats.wins}\n` +
                            `• <b>जैकपॉट हिट्स (Jackpots):</b> ${stats.jackpots}\n` +
                            `• <b>नुकसान (Losses):</b> ${stats.losses}\n\n` +
                            `📈 <b>विन रेट:</b> <b>${winRate}%</b>`;
                break;
            }
                
            case 'ai_q2': {
                replyText = `🎯 <b>Q2. सबसे ज़्यादा स्ट्रीक बार क्या आया है और कितनी बार:</b>\n\n` +
                            `• 🌟 <b>जीत स्ट्रीक (Win Streak):</b> ${stats.maxStreakWin} बार लगातार ` +
                            `(${stats.maxStreakWinPeriods.length > 0 ? 'पीरियड्स: ' + stats.maxStreakWinPeriods.join(', ') : 'L1 Pass'})\n\n` +
                            `• 🤬 <b>लॉस स्ट्रीक (Loss Streak):</b> ${stats.maxStreakLoss} बार लगातार ` +
                            `(${stats.maxStreakLossPeriods.length > 0 ? 'पीरियड्स: ' + stats.maxStreakLossPeriods.join(', ') : 'No Limit'})\n\n` +
                            `• 🎇 <b>जैकपॉट स्ट्रीक (Jackpot Streak):</b> ${stats.maxStreakJackpot} बार ` +
                            `(${stats.maxStreakJackpotPeriods.length > 0 ? 'पीरियड्स: ' + stats.maxStreakJackpotPeriods.join(', ') : 'Direct'})`;
                break;
            }
                
            case 'ai_q3': {
                const activeSlots = getSafeTimeSlots(false); // standard timeline1
                let slotText = "";
                activeSlots.forEach(s => {
                    slotText += `🟢 <b>स्लॉट: ${s.start} - ${s.end} (${s.label})</b>\n`;
                });
                replyText = `⏰ <b>Q3. प्रेडिक्शन सबसे कम लेवल किस टाइम पर जाता है:</b>\n\n` +
                            `हमारे वास्तविक इतिहास के 24 घंटे की Time-List के अनुसार सबसे कम लेवल जाने वाले स्लॉट्स:\n\n` +
                            `${slotText}\n\n` +
                            `⚠️ <i>इस टाइम के स्लॉट में प्रेडिक्शन हमेशा 3 लेवल से कम (अमूमन 0 या 1 लेवल) में ब्लास्ट पास होते हैं!</i>`;
                break;
            }
                
            case 'ai_q4': {
                replyText = `🧠 <b>Q4. क्या तुम इस काम को लेकर एक्सपर्ट हो?</b>\n\n` +
                            `<b>उत्तर:</b> हाँ, मैं विंगो 1M प्रेडिक्शन का एक अभेद्य <b>God-Tier ai System</b> हूँ। मेरे पास 10,000 से अधिक गेम पीरियड्स का गहरा गणितीय अनुभव है। बिना किसी मानवीय लालच या भावना के, मैं पूरी तरह विपरीत हेजिंग और रिस्क मैनेजमेंट पर काम करता हूँ।`;
                break;
            }
                
            case 'ai_q5': {
                replyText = `👑 <b>Q5. तुम्हारे साथ कौन-कौन है?</b>\n\n` +
                            `<b>उत्तर:</b> मेरे साथ मेरा मुख्य ओनर <b>Gemini ai</b>, 10,000+ ऐतिहासिक डेटा रिकॉर्ड्स, 10 साल का गहरा गेमिंग एक्सपीरियंस, और एक अत्यंत शक्तिशाली 24/7 चलने वाला टेलीग्राम ऑटोमेशन बोट व वीआईपी चैनल है जो लगातार लाइव प्रेडिक्शन डिलीवर करता है।`;
                break;
            }

            case 'ai_q6': {
                const activeSlotsLow = getSafeTimeSlots(true); // low balance timeline2 (sctimeline)
                let slotText = "";
                activeSlotsLow.forEach(s => {
                    slotText += `🟢 <b>स्लॉट: ${s.start} - ${s.end} (${s.label})</b>\n`;
                });
                replyText = `🛡️ <b>Q6. यदि मेरे पास 2000 से कम पैसा है तो हमें बेस्ट टाइम निकाल कर के दो:</b>\n\n` +
                            `कम बजट वाले यूज़र्स के लिए हमारी विशेष <b>SC-Timeline (Timeline 2)</b> गणना के आधार पर निकाले गए सुरक्षित स्लॉट्स:\n\n` +
                            `${slotText}\n\n` +
                            `⚠️ <i>इन स्लॉट्स में केवल Size/Color दांव लगाया जाता है (नंबर जैकपॉट पूर्णतः वर्जित हैं) ताकि छोटा बैलेंस बिल्कुल सुरक्षित रहे!</i>`;
                break;
            }
        }

        await bot.sendMessage(message.chat.id, replyText, { parse_mode: 'HTML' }).catch(() => {});
        await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
        console.error("Error inside callback_query handler:", err.message);
    }
});

async function monitorLoop() {
    try {
        console.log("🔍 Checking API for new outcomes...");
        const response = await fetch(`${API_ENDPOINT}&t=${Date.now()}`);
        if (!response.ok) {
            console.log("⚠️ API returned non-200 status code.");
            return;
        }
        
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
                    console.log(`📡 New outcome added to history database: Period #${id} -> Number: ${num}`);
                }
            });

            if (newlyAdded) {
                history.sort((a,b) => b.issue.localeCompare(a.issue));
                if (history.length > 1000) history = history.slice(0, 1000); 
                
                await handleNewOutcome();
            }
        }
        
        // Daily Pin-Delete System Check (12:00 AM IST Date Transition)
        const istDate = getISTTime();
        const todayStr = istDate.toISOString().slice(0, 10);
        
        if (lastPinnedDate !== todayStr) {
            lastPinnedDate = todayStr;
            await refreshDailyPinnedMessage();
        }
        
    } catch (e) {
        console.error("API Fetch Error inside monitor loop:", e.message);
    }
}

async function handleNewOutcome() {
    if (history.length < 15) return;

    const latestOutcome = history[0];
    const latestId = latestOutcome.issue;

    // A. RESOLVE CHANNEL PREDICTIONS (NO BUTTON ON CHANNEL)
    if (currentPrediction && currentPrediction.issue === latestId) {
        const actualNum = latestOutcome.number;
        const actualSize = actualNum >= 5 ? "BIGGG" : "SMALL";
        const actualCol = [1,3,7,9].includes(actualNum) ? "GREEN" : ([0,5].includes(actualNum) ? "VIOLET" : "REDDD");
        stats.total++;

        let isWin = false;
        let isJackpot = currentPrediction.nums.includes(actualNum); 
        
        if (currentPrediction.predType === "BIG" || currentPrediction.predType === "SMALL") {
            isWin = (currentPrediction.predType === (actualSize === "BIGGG" ? "BIG" : "SMALL"));
        } else {
            isWin = (currentPrediction.predType === (actualCol === "REDDD" ? "RED" : "GREEN") || actualCol === "VIOLET");
        }

        const scale = walletBalance / 3963;
        const botIdx = Math.min(currentPrediction.level - 1, 4);
        const config = LVL_BASE[botIdx];
        const bBet = Math.round(config.b * scale);
        const nBet = Math.round(config.n * scale);

        let outcomeDisplay = `🌟${actualSize}(${actualNum})🌟`;
        if (currentPrediction.predType === "RED" || currentPrediction.predType === "GREEN") {
            outcomeDisplay = `🌟${actualCol}(${actualNum})🌟`;
        }

        // Edit predicted post on Channel - Exact Requested Resolved Layout
        const editedMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `🎲 RUGLT. :-   ${outcomeDisplay}\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `💵 B•BET.  :- ₹${bBet}\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `🪙 N•BET.  :- ₹${nBet}\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `📊 LEVEL.  :- ${currentPrediction.level}\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━`;

        try {
            await bot.editMessageText(editedMsg, {
                chat_id: CHANNEL_CHAT_ID,
                message_id: currentPrediction.messageId,
                parse_mode: 'HTML'
            });
            console.log(`✅ Successfully edited live post for Period #${latestId.slice(-4)}`);
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

        // Resolve low budget simulated level tracker for sctimeline (Jackpot is strictly demoted to loss)
        let lowBudgetStatus = 'loss';
        if (isWin && !isJackpot) {
            lowBudgetStatus = 'win';
            lowBudgetLevelSim = 1;
        } else {
            lowBudgetStatus = 'loss';
            lowBudgetLevelSim = lowBudgetLevelSim >= 5 ? 1 : lowBudgetLevelSim + 1;
        }

        // Save entry for timeline1 (Standard) with recorded prediction generation time
        periodResults.unshift({
            period: latestId.slice(-4),
            time: getISTTimeString(), // current resolution time
            predTime: currentPrediction.predTime, // saved prediction release time
            timestamp: getISTTime().getTime(),
            status: resultType,
            level: currentPrediction.level
        });

        // Save entry for timeline2 (SC-Timeline: Jackpot is strictly demoted to loss)
        periodResultsLow.unshift({
            period: latestId.slice(-4),
            time: getISTTimeString(),
            predTime: currentPrediction.predTime,
            timestamp: getISTTime().getTime(),
            status: lowBudgetStatus,
            level: lowBudgetLevelSim
        });
        
        // Auto-clean timelines: Keep only last 24 hours
        const now = getISTTime().getTime();
        periodResults = periodResults.filter(r => now - r.timestamp < 24 * 60 * 60 * 1000);
        periodResultsLow = periodResultsLow.filter(r => now - r.timestamp < 24 * 60 * 60 * 1000);

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
                const editedPersonalMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n` +
                                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                          `🆔 PERIOD:- #${latestId.slice(-4)}\n` +
                                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                          `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                          `🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n` +
                                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                          `🎲 RUGLT. :-    ${outcomeDisplay}\n` +
                                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                          `💵 B•BET.  :- ₹${bBet}\n` +
                                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                          `🪙 N•BET.  :- ₹${nBet}\n` +
                                          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                          `📊 LEVEL.  :- ${botLevel}\n` +
                                          `━━━━━━━━━━━━━━━━━━━━━━━`;

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

                const nextPromptMsg = `<b>🎯 अगला प्रेडिक्शन तैयार है!</b>\n\n` +
                                      `नीचे दिए गए बटन पर क्लिक करके तुरंत नया प्रीडिक्शन प्राप्त करें:`;
                const nextOpts = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '➡️ अगला प्रेडिक्शन प्राप्त करें', callback_data: 'get_next_pred_personal_standard' }]
                        ]
                    }
                };
                await bot.sendMessage(req.chatId, nextPromptMsg, { parse_mode: 'HTML', reply_markup: nextOpts.reply_markup }).catch(() => {});

                delete personalRequests[userId]; 
            }
        }

        // C. RESOLVE LOSS COVER ACTIVE SESSIONS
        for (let userId in userSessions) {
            const session = userSessions[userId];
            if (session.step === 'active' && session.lastPredictedPeriod === latestId) {
                let sessionGain = 0;
                let sessionResult = 'loss';

                if (session.type === 'low_balance') {
                    // Low Budget size bet calculation: 10, 20, 40, 80...
                    const sBetB = 10 * Math.pow(2, session.activeLevel - 1);
                    const sTotalCost = sBetB;

                    if (isWin && !isJackpot) { // sctimeline limits treat jackpot as loss
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

                    const editedSessionMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🆔 PERIOD:- #${latestId.slice(-4)}\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🔮 N•PRED:-   🌐🌐(SAFE)🌐🌐\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🎲 RUGLT. :-    ${outcomeDisplay}\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `💵 B•BET.  :- ₹${sBetB}\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🪙 N•BET.  :- ₹0\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `📊 LEVEL.  :- ${session.activeLevel}\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `💰 <b>नया वॉलेट बैलेंस:</b> ₹${session.currentBalance}`;

                    try {
                        await bot.editMessageText(editedSessionMsg, {
                            chat_id: session.chatId,
                            message_id: session.lastMessageId,
                            parse_mode: 'HTML'
                        });
                    } catch (err) {}
                } else {
                    // Standard High Balance resolution
                    const sScale = session.currentBalance / 3963;
                    const sBotIdx = Math.min(session.activeLevel - 1, 4);
                    const sLvlConfig = LVL_BASE[sBotIdx];
                    const sBetB = Math.round(sLvlConfig.b * sScale);
                    const sBetN = Math.round(sLvlConfig.n * sScale);
                    const sTotalCost = sBetB + (sBetN * 2);

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

                    const editedSessionMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🆔 PERIOD:- #${latestId.slice(-4)}\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🎲 RUGLT. :-    ${outcomeDisplay}\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `💵 B•BET.  :- ₹${sBetB}\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `🪙 N•BET.  :- ₹${sBetN}\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `📊 LEVEL.  :- ${session.activeLevel}\n` +
                                             `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                             `💰 <b>नया वॉलेट बैलेंस:</b> ₹${session.currentBalance}`;

                    try {
                        await bot.editMessageText(editedSessionMsg, {
                            chat_id: session.chatId,
                            message_id: session.lastMessageId,
                            parse_mode: 'HTML'
                        });
                    } catch (err) {}
                }

                // Sticker dispatch
                const sSticker = sessionResult === 'jackpot' ? STICKER_JACKPOT : (sessionResult === 'win' ? STICKER_WIN : STICKER_LOSS);
                const sFallback = sessionResult === 'jackpot' ? '🎇' : (sessionResult === 'win' ? '🌟' : '🤬');
                await sendStickerSafe(session.chatId, sSticker, sFallback);

                // Check overall FULL loss recovery or 10% daily completion
                const netProfit = session.currentBalance - session.initialBalance;

                if (netProfit >= session.lossAmount) {
                    // Full Loss completely covered state with customized closed session sticker
                    session.step = 'loss_covered_choice';
                    await sendStickerSafe(session.chatId, STICKER_SESSION_CLOSE, "🎉");
                    const victoryMsg = `🎉 <b>बधाई हो! आपका ₹${session.lossAmount} का कुल लॉस पूरी तरह कवर हो चुका है!</b>\n\n` +
                                       `💰 <b>वर्तमान वॉलेट बैलेंस:</b> ₹${session.currentBalance}\n\n` +
                                       `क्या आप और प्रेडिक्शन चाहते हैं? यदि हाँ, तो नीचे दिए गए बटन पर क्लिक करें:`;
                    const contOpts = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '➡️ हाँ, प्रेडिक्शन जारी रखें', callback_data: 'continue_prediction_after_loss_cover' }]
                            ]
                        }
                    };
                    await bot.sendMessage(session.chatId, victoryMsg, { parse_mode: 'HTML', reply_markup: contOpts.reply_markup }).catch(() => {});
                } else if (session.type === 'standard' && session.currentBalance >= session.targetBalance) {
                    // 10% target daily lockdown
                    session.step = 'cooldown';
                    session.cooldownUntil = getISTTime().getTime() + 2 * 60 * 60 * 1000; // 2 Hours lockdown
                    await sendStickerSafe(session.chatId, STICKER_SESSION_CLOSE, "🎉");

                    const completeMsg = `🎉 <b>बधाई हो! आपका आज का प्रॉफिट लक्ष्य पूरा हुआ।</b>\n\n` +
                                        `💰 <b>नया वॉलेट बैलेंस:</b> ₹${session.currentBalance}\n` +
                                        `⏳ हम अगले <b>2 घंटे बाद</b> ₹${session.currentBalance} से नया सेशन फिर से शुरू करेंगे!\n\n` +
                                        `यदि आपको तुरंत प्रेडिक्शन चाहिए तो आप हमारे ऑफिशियल चैनल 👉 <b>@TREDSTERV20</b> से ले सकते हैं जहाँ 24 घंटे लगातार लाइव प्रेडिक्शन मिलता है।`;
                    await bot.sendMessage(session.chatId, completeMsg, { parse_mode: 'HTML' }).catch(() => {});
                } else {
                    const sessionPrompt = `🎯 <b>लॉस रिकवरी प्रेडिक्शन तैयार है!</b>\n\nनीचे दिए गए बटन पर क्लिक करके तुरंत नया प्रेडिक्शन प्राप्त करें:`;
                    const sOpts = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '➡️ अगला प्रेडिक्शन प्राप्त करें', callback_data: 'get_next_pred_personal' }]
                            ]
                        }
                    };
                    await bot.sendMessage(session.chatId, sessionPrompt, { parse_mode: 'HTML', reply_markup: sOpts.reply_markup }).catch(() => {});
                }
            }
        }
    }

    // 3. Compute 8-BOX Values for upcoming Period
    const nextId = (BigInt(latestId) + 1n).toString();
    
    let P;
    try {
        P = BigInt(nextId);
    } catch (e) {
        console.error("BigInt conversion failed safely for issue ID:", nextId);
        return;
    }

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

    // Formulate final selection
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
            finalSelection = dominantColor;
            if (dominantColor === "RED") {
                // RED prediction -> Hedge with opposite GREEN numbers
                finalNums = (dominantSize === "BIG") ? getOppositeHedgingNums([7, 9], history) : getOppositeHedgingNums([1, 3], history);
            } else {
                // GREEN prediction -> Hedge with opposite RED numbers
                finalNums = (dominantSize === "BIG") ? getOppositeHedgingNums([6, 8], history) : getOppositeHedgingNums([0, 2, 4], history);
            }
        } else {
            finalSelection = dominantSize;
            if (dominantSize === "BIG") {
                finalNums = (dominantColor === "RED") ? getOppositeHedgingNums([0, 2, 4], history) : getOppositeHedgingNums([1, 3], history);
            } else {
                finalNums = (dominantColor === "RED") ? getOppositeHedgingNums([6, 8], history) : getOppositeHedgingNums([5, 7, 9], history);
            }
        }
    }

    // Ensure we always only have exactly 2 numbers for predicted numbers
    finalNums = finalNums.slice(0, 2);
    // Dynamic Fallback logic: If 0 or 5 is heavily recurrent in last 15 outputs, ensure it's in finalNums
    const last15 = history.slice(0, 15);
    const count0 = last15.filter(h => h.number === 0).length;
    const count5 = last15.filter(h => h.number === 5).length;
    if (count0 > 1 && !finalNums.includes(0) && (finalSelection === "SMALL" || finalSelection === "RED")) {
        finalNums[1] = 0;
    }
    if (count5 > 1 && !finalNums.includes(5) && (finalSelection === "BIG" || finalSelection === "GREEN")) {
        finalNums[1] = 5;
    }

    currentPrediction = {
        issue: nextId,
        predType: finalSelection,
        nums: finalNums,
        level: botLevel,
        messageId: null,
        isChannelPosted: false,
        predTime: getISTTimeString() // Save exact prediction release time
    };

    console.log(`🎯 New Prediction Computed: Issue: #${nextId.slice(-4)} -> Type: ${finalSelection} (Hedging: ${finalNums.join(',')})`);

    // Auto-Post to channel
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) {
            await sendPredictionToChannel();
        }
    }, 12000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;

    const scale = walletBalance / 3963;
    const botIdx = Math.min(currentPrediction.level - 1, 4);
    const botLvlConfig = LVL_BASE[botIdx];
    const bBet = Math.round(botLvlConfig.b * scale);
    const nBet = Math.round(botLvlConfig.n * scale);

    const liveMsg = `🚨 <b>PREDICTION LIVE</b> 🚨\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🎲 RUGLT. :-   WAIT\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `💵 B•BET.  :- ₹${bBet}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🪙 N•BET.  :- ₹${nBet}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📊 LEVEL.  :- ${currentPrediction.level}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━`;

    try {
        const sentMessage = await bot.sendMessage(CHANNEL_CHAT_ID, liveMsg, { parse_mode: 'HTML' });
        currentPrediction.messageId = sentMessage.message_id;
        currentPrediction.isChannelPosted = true;
        console.log(`📢 Live prediction successfully posted to Channel! ID: ${sentMessage.message_id}`);
    } catch (err) {
        console.error("Failed to post next prediction to channel:", err.message);
    }
}

async function sendStickerSafe(chatId, stickerId, fallbackEmoji) {
    try {
        await bot.sendSticker(chatId, stickerId);
    } catch(err) {
        try {
            await bot.sendMessage(chatId, fallbackEmoji);
        } catch (sendErr) {
            console.error("Fallback sticker send failed:", sendErr.message);
        }
    }
}

// Core monitor check triggers (Run every 5 seconds)
setInterval(monitorLoop, 5000);
console.log("Monitoring 1M active Wingo loop on Render server...");
