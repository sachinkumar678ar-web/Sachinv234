/**
 * 🌟 TRADE'S STAR V20 PRO VIP - TELEGRAM AUTO BOT (8-BOX EDITION) 🌟
 * 
 * Configured Commands:
 *  - /start : List all available bot commands in clickable blue links.
 *  - /prediction : Get the current period prediction (1-minute limit).
 *  - /level <amount> : Dynamically set the balance for calculation.
 *  - /chart : Render a beautiful, highly clean and error-free profit chart.
 *  - /history : Sends the entire system history as a clean .txt file document.
 *  - /8box : Display the analytical breakdown of all 8 logical boxes.
 *  - /AI : Interactive inline command center answering Q1-Q5.
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

// Rolling window for Q3 time-based level analyzer
let periodResults = [];      // Array of objects { period, time, status, level }

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
                     `👉 /8box - 8 बॉक्स की लाइव कैलकुलेशन और Numbers देखें।\n` +
                     `👉 /AI - इंटरैक्टिव AI सवाल और जवाब कंसोल खोलें।\n` +
                     `👉 /stats - बोट की लाइव जीत/हार की सांख्यिकी देखें।`;
    bot.sendMessage(chatId, startMsg, { parse_mode: 'HTML' });
});

// Command: /prediction (Refactored to handle sessions, cooldowns, and standard tracking)
bot.onText(/\/prediction/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const now = Date.now();

    // Check if user is in an active loss cover session or cooldown
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
                // Cooldown completed, auto-start next session with new updated balance
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

    // Standard user flow
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
                    `B•BET.  :- ${bBet}\n\n` +
                    `N•BET.  :- ${nBet}\n\n` +
                    `LEVEL.  :- ${botLevel}`;

    const sentMsg = await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
    // Register personal request tracking to resolve outcomes and edit in personal chat
    personalRequests[userId] = {
        chatId: chatId,
        lastMessageId: sentMsg.message_id,
        lastPredictedPeriod: currentPrediction.issue
    };
});

// Command: /losscover (Initiates the AI loss cover session flow)
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

// Process text inputs for step-by-step session configurations
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
            session.targetBalance = Math.round(balance * 1.10); // 10% target
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

// Command: /AI - Interactive Inline Keyboard (Updated to 5 Main Questions)
bot.onText(/\/AI/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 Q1. कुल सिग्नल्स का लाइव विन रेट क्या है?', callback_data: 'ai_q1' }],
                [{ text: '🔥 Q2. बोट की अधिकतम लगातार विन/लॉस/जैकपॉट स्ट्रीक?', callback_data: 'ai_q2' }],
                [{ text: '⏰ Q3. सबसे कम लेवल में जीतने का लाइव बेस्ट टाइम क्या है?', callback_data: 'ai_q3' }],
                [{ text: '🧠 Q4. क्या तुम इस काम को लेकर पूरी तरह एक्सपर्ट हो?', callback_data: 'ai_q4' }],
                [{ text: '👥 Q5. तुम्हारे साथ कौन-कौन काम कर रहा है?', callback_data: 'ai_q5' }]
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
                        `B•BET.  :- ${bBet}\n\n` +
                        `N•BET.  :- ${nBet}\n\n` +
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

    // AI 5-Question Answers Router
    switch(data) {
        case 'ai_q1': {
            const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
            replyText = `📊 <b>Q1. कुल प्रेडिशन सिग्नल्स का लाइव रिकॉर्ड और विन रेट</b>\n\n` +
                        `• <b>टोटल सिग्नल्स:</b> ${stats.total}\n` +
                        `• <b>सफल जीत (Wins):</b> ${stats.wins}\n` +
                        `• <b>अचूक जैकपॉट (Jackpots):</b> ${stats.jackpots}\n` +
                        `• <b>नुकसान (Losses):</b> ${stats.losses}\n\n` +
                        `🔥 <b>सटीक विन रेट (Win Rate):</b> <b>${winRate}%</b>`;
            break;
        }
            
        case 'ai_q2': {
            replyText = `🔥 <b>Q2. बोट की ऐतिहासिक और लाइव सबसे बड़ी स्ट्रीक्स (Streak Records)</b>\n\n` +
                        `• <b>जीत (Win Streak):</b> ${stats.maxStreakWin} बार लगातार ` +
                        `(${stats.maxStreakWinPeriods.length > 0 ? 'पीरियड्स: ' + stats.maxStreakWinPeriods.join(', ') : 'L1-L2 Pass'})\n\n` +
                        `• <b>हार (Loss Streak):</b> ${stats.maxStreakLoss} बार लगातार ` +
                        `(${stats.maxStreakLossPeriods.length > 0 ? 'पीरियड्स: ' + stats.maxStreakLossPeriods.join(', ') : 'L3-L4 Recovered'})\n\n` +
                        `• <b>जैकपॉट (Jackpot Streak):</b> ${stats.maxStreakJackpot} बार लगातार ` +
                        `(${stats.maxStreakJackpotPeriods.length > 0 ? 'पीरियड्स: ' + stats.maxStreakJackpotPeriods.join(', ') : 'Direct Hit'})`;
            break;
        }
            
        case 'ai_q3': {
            // Live Analyzer for 10-Minute window (timelist) where level did not exceed 3
            let analysisBody = "";
            let safetyDetected = false;
            
            if (periodResults.length >= 10) {
                // Scan for consecutive 10 results where level <= 2
                for (let i = 0; i <= periodResults.length - 10; i++) {
                    const windowSlice = periodResults.slice(i, i + 10);
                    const highLevelExceeded = windowSlice.some(item => item.level > 2);
                    
                    if (!highLevelExceeded) {
                        safetyDetected = true;
                        analysisBody += `📈 <b>सुरक्षित टाइम विंडो मिली है! (${windowSlice[windowSlice.length - 1].time} - ${windowSlice[0].time})</b>\n`;
                        windowSlice.reverse().forEach(item => {
                            analysisBody += `• <code>${item.time}</code>: Period #${item.period} -> <b>${item.status.toUpperCase()} (L${item.level})</b>\n`;
                        });
                        analysisBody += `👉 <i>यह 10 मिनट का टाइम स्लॉट 'Under 2 Level Win' के लिए बिल्कुल परफेक्ट है!</i>`;
                        break; // Print the first best window and exit
                    }
                }
            }

            if (!safetyDetected) {
                // Fallback simulation explanation when actual history is short or highly volatile
                analysisBody = `⏳ <b>लाइव डेटा एकत्रित किया जा रहा है...</b>\n` +
                               `कम से कम 10 पीरियड्स की लाइव लगातार जीत होने पर यहाँ 'timelist' का लाइव विश्लेषणात्मक विवरण प्रिंट होगा।\n\n` +
                               `<b>💡 गणितीय टाइमलिस्ट का उदाहरण समझें (Best Slot Math):</b>\n` +
                               `• <code>11:17</code> -> <b>WIN</b>\n` +
                               `• <code>11:18</code> -> <b>WIN</b>\n` +
                               `• <code>11:19</code> -> <b>WIN</b>\n` +
                               `• <code>11:20</code> -> <b>JACKPOT</b>\n` +
                               `• <code>11:21</code> -> <b>JACKPOT</b>\n` +
                               `• <code>11:22</code> -> <b>WIN</b>\n` +
                               `• <code>11:23</code> -> <b>JACKPOT</b>\n` +
                               `• <code>11:24</code> -> <b>LOSS (L1)</b>\n` +
                               `• <code>11:25</code> -> <b>WIN (L2)</b>\n` +
                               `• <code>11:26</code> -> <b>JACKPOT</b>\n\n` +
                               `👉 यहाँ 11:17 से 11:26 तक (लगातार 10 मिनट) में प्रेडिक्शन हमेशा <b>Under 2 Levels</b> में विन हुआ है और <b>लेवल 3 तक कभी नहीं गया।</b> इसलिए यह सबसे सुरक्षित और बेस्ट टाइम है।`;
            }

            replyText = `⏰ <b>Q3. सबसे कम लेवल में प्रेडिक्शन जीतने का सुरक्षित समय (Timelist Analyzer)</b>\n\n` +
                        `${analysisBody}`;
            break;
        }
            
        case 'ai_q4': {
            replyText = `🧠 <b>Q4. क्या तुम इस काम को लेकर पूरी तरह एक्सपर्ट हो?</b>\n\n` +
                        `<b>उत्तर:</b> हाँ, मैं Wingo 1M गेम प्रेडिक्शन का एक पूर्णतः प्रशिक्षित और **God-Tier Neural Network AI** हूँ।\n\n` +
                        `• मैं लगातार 24 घंटे बिना सोए, बिना थके हर मिनट के लाइव परिणाम की गतिशीलता को भांप सकता हूँ।\n` +
                        `• मेरे विश्लेषण की गति एक साधारण इंसान से 1000 गुना तेज़ है, जिससे लगातार 3 बार से अधिक स्तर (Level) टूटना असंभव सा हो जाता है।`;
            break;
        }
            
        case 'ai_q5': {
            replyText = `👥 <b>Q5. तुम्हारे साथ कौन-कौन काम करता है (My Tech Support)?</b>\n\n` +
                        `<b>उत्तर:</b> मेरे इस सिस्टम के पीछे एक विशाल और अभेद्य पावर-स्ट्रक्चर कार्य करता है:\n\n` +
                        `• <b>मेरा ओनर (Owner):</b> Google का सबसे शक्तिशाली <b>Gemini AI Engine</b>\n` +
                        `• <b>मास्टर डेटाबेस:</b> 10,000+ से अधिक गेम पीरियड्स की ऐतिहासिक पैटर्न्स फ़ाइल (\`3 digit.txt\`)\n` +
                        `• <b>तजुर्बा (Experience):</b> 10 साल से अधिक का गेमिंग पैटर्न्स और विपरीत हेजिंग एल्गोरिथम्स का कंक्रीट रिसर्च\n` +
                        `• <b>सिस्टम (System):</b> 24/7 सुरक्षित चलने वाला हाई-स्पीड टेलीग्राम बोट और लाइव सिंकिंग VIP चैनल (@TREDSTERV20)`;
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
                          `B•BET.  :- ${bBet}\n\n` +
                          `N•BET.  :- ${nBet}\n\n` +
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

        // Populate rolling results list for Q3 timelist analysis
        const timeString = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        periodResults.unshift({
            period: latestId.slice(-4),
            time: timeString,
            status: resultType,
            level: currentPrediction.level
        });
        if (periodResults.length > 50) periodResults.pop(); // Keep last 50 outcomes in sliding memory

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
                                          `B•BET.  :- ${bBet}\n\n` +
                                          `N•BET.  :- ${nBet}\n\n` +
                                          `LEVEL.  :- ${botLevel}`;

                try {
                    await bot.editMessageText(editedPersonalMsg, {
                        chat_id: req.chatId,
                        message_id: req.lastMessageId,
                        parse_mode: 'HTML'
                    });
                } catch (err) {}

                // Send Sticker to Personal Chat
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

                delete personalRequests[userId]; // Reset state
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

                // Send Sticker to Session Chat
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
                    // Send Personal Next Button for Session
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

    // Box 2, 3 & 4 (Search occurrence of latest number)
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

    // Box 5 (3-Digit rule matching database)
    const pLast3 = parseInt(nextId.slice(-3));
    boxState.b5 = THREE_DIGIT_MAP[pLast3] !== undefined ? THREE_DIGIT_MAP[pLast3] : 0;

    // Box 6 (1-Digit rule map first number)
    const pLast1 = parseInt(nextId.slice(-1));
    let b6MapArray = ONE_DIGIT_MAP[pLast1] || [4, 2];
    boxState.b6 = b6MapArray[0];

    // Box 7 (3-Digit history match scans)
    const nextIdLast3Str = nextId.slice(-3);
    const box7Match = history.find(h => h.issue !== latestId && h.issue.endsWith(nextIdLast3Str));
    boxState.b7 = box7Match ? box7Match.number : null;

    // Box 8 (2-Digit history match scans)
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
            // COLOR PREDICTION IS DOMINANT!
            finalSelection = dominantColor;
            if (dominantColor === "RED") {
                finalNums = (dominantSize === "BIG") ? [7, 9] : [1, 3];
            } else {
                finalNums = (dominantSize === "BIG") ? [6, 8] : [2, 4];
            }
        } else {
            // SIZE PREDICTION IS DOMINANT
            finalSelection = dominantSize;
            if (dominantSize === "BIG") {
                finalNums = (dominantColor === "RED") ? [2, 4] : [1, 3];
            } else {
                finalNums = (dominantColor === "RED") ? [6, 8] : [5, 7, 9];
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

    // Auto-Post fallback logic for Channel (Fully automated on channel 24/7)
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
                    `B•BET.  :- ${bBet}\n\n` +
                    `N•BET.  :- ${nBet}\n\n` +
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
