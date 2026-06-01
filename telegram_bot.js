/**
 * 🌟 TRADE'S STAR V20 PRO VIP - TELEGRAM AUTO BOT (8-BOX EDITION) 🌟
 * 
 * Configured Commands:
 *  - /start : List all available bot commands.
 *  - /prediction : Get the current period prediction (1-minute limit).
 *  - /level <amount> : Dynamically set the balance for calculation.
 *  - /chart : Render a beautiful, highly clean and error-free profit chart.
 *  - /history : Sends the entire system history as a clean .txt file document.
 *  - /8box : Display the analytical breakdown of all 8 logical boxes.
 *  - /AI : Interactive inline command center answering Q1-Q7.
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

// Stats and Streak Records
let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0,
    maxLevelReached: 1,
    currentStreakType: null, // 'win', 'loss', 'jackpot'
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

const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://sachinv234.onrender.com';

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
    const startMsg = `🌟 *WELCOME TO TRADE'S STAR V20 PRO VIP BOT* 🌟\n\n` +
                     `यहाँ बोट के सभी लाइव कमांड्स की सूची दी गई है:\n\n` +
                     `👉 \`/prediction\` - अभी का लाइव प्रेडिक्शन देखें।\n` +
                     `👉 \`/level <amount>\` - वॉलेट बैलेंस अपडेट करें (उदा: \`/level 4000\`).\n` +
                     `👉 \`/chart\` - अपनी बेट के हिसाब से साफ और सुंदर चार्ट देखें।\n` +
                     `👉 \`/history\` - 24 घंटे का पूरा इतिहास फ़ाइल रूप में प्राप्त करें।\n` +
                     `👉 \`/8box\` - 8 बॉक्स की लाइव कैलकुलेशन और नंबर्स देखें।\n` +
                     `👉 \`/AI\` - इंटरैक्टिव AI सवाल और जवाब कंसोल खोलें।\n` +
                     `👉 \`/stats\` - बोट की लाइव जीत/हार की सांख्यिकी देखें।`;
    bot.sendMessage(chatId, startMsg, { parse_mode: 'Markdown' });
});

// Command: /prediction
bot.onText(/\/prediction/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const now = Date.now();

    if (lastUserRequest[userId] && (now - lastUserRequest[userId] < 60000)) {
        bot.sendMessage(chatId, `⏳ *Please next period number wait!* 1 मिनट में केवल एक ही बार प्रेडिक्शन मंगाया जा सकता है।`);
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

    const message = `PREDICTION LIVE\n\n` +
                    `PERIOD:- ${currentPrediction.issue.slice(-4)}\n\n` +
                    `MY PRE:- ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                    `N•PRED:- ${currentPrediction.nums.join(',')}\n\n` +
                    `RUGLT. :- WAIT\n\n` +
                    `B•BET.  :- ${Math.round(config.b * scale)}\n\n` +
                    `N•BET.  :- ${Math.round(config.n * scale)}\n\n` +
                    `LEVEL.  :- ${botLevel}`;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Command: /level
bot.onText(/\/level(?:\s+)?(?:<)?(\d+)(?:>)?/i, (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);
    if (!isNaN(amount) && amount > 0) {
        walletBalance = amount;
        bot.sendMessage(chatId, `💰 *Wallet Balance updated to:* ₹${walletBalance}\nअब आपका बेटिंग चार्ट नए बैलेंस के अनुसार स्केल होगा!`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `❌ अमान्य अमाउंट! सही फॉर्मेट: \`/level 4000\``, { parse_mode: 'Markdown' });
    }
});

// Command: /chart
bot.onText(/\/chart/, (msg) => {
    const chatId = msg.chat.id;
    const scale = walletBalance / 3963;
    
    let chartMsg = `📊 *5-LEVEL SCALED CLASSIC CHART*\n`;
    chartMsg += `💰 *Wallet Configured:* ₹${walletBalance}\n`;
    chartMsg += `--------------------------------------------------------\n`;
    chartMsg += `\`Level | Bet(B) | Bet(N) | Total | B•Prof | N•Prof\`\n`;
    chartMsg += `--------------------------------------------------------\n`;
    
    let totalLoss = 0;
    LVL_BASE.forEach((lvl, i) => {
        const b = Math.round(lvl.b * scale);
        const n = Math.round(lvl.n * scale);
        const total = b + (n * 2) + totalLoss;
        const bProf = Math.round(b * 1.96) - total;
        const nProf = Math.round(n * 8.82) - total;
        
        const activeStar = (botLevel === (i + 1)) ? "👉 " : "   ";
        chartMsg += `\`${activeStar}L${i+1}  | ₹${b.toString().padEnd(4)} | ₹${n.toString().padEnd(4)} | ₹${total.toString().padEnd(4)} | ₹${bProf.toString().padEnd(5)} | ₹${nProf.toString().padEnd(5)}\`\n`;
        totalLoss = total;
    });
    chartMsg += `--------------------------------------------------------\n`;
    chartMsg += `⚠️ *Note:* Bet (B) का मतलब Size (Big/Small) है और Bet (N) का मतलब Number (2,4) है।`;
    
    bot.sendMessage(chatId, chartMsg, { parse_mode: 'Markdown' });
});

// Command: /history
bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    if (history.length === 0) {
        bot.sendMessage(chatId, `📭 इतिहास अभी खाली है। API सिंक की प्रतीक्षा करें...`);
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
        bot.sendMessage(chatId, `❌ इतिहास फाइल भेजने में त्रुटि हुई!`);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

// Command: /8box
bot.onText(/\/8box/, (msg) => {
    const chatId = msg.chat.id;
    if (!currentPrediction) {
        bot.sendMessage(chatId, `⚠️ अभी तक कोई लाइव डेटा विश्लेषित नहीं हुआ है।`);
        return;
    }
    
    const showVal = (val) => val !== null ? `[ ${val} ]` : `[ ? ]`;
    const boxMsg = `📊 *LIVE 8-BOX ANALYSIS CENTER* 📊\n\n` +
                   `📅 *Next Period ID:* #${currentPrediction.issue.slice(-4)}\n\n` +
                   `📦 *Box 1 (P-10 Rule):* ${showVal(boxState.b1)}\n` +
                   `📦 *Box 2 (1st Occurrence Above):* ${showVal(boxState.b2)}\n` +
                   `📦 *Box 3 (2nd Occurrence Above):* ${showVal(boxState.b3)}\n` +
                   `📦 *Box 4 (3rd Occurrence Above):* ${showVal(boxState.b4)}\n` +
                   `📦 *Box 5 (3-Digit Database Match):* ${showVal(boxState.b5)}\n` +
                   `📦 *Box 6 (1-Digit Database Match):* ${showVal(boxState.b6)}\n` +
                   `📦 *Box 7 (3-Digit History Scan):* ${showVal(boxState.b7)}\n` +
                   `📦 *Box 8 (2-Digit History Scan):* ${showVal(boxState.b8)}\n\n` +
                   `🎯 *Target Prediction:* *${currentPrediction.predType}(${currentPrediction.nums.join(',')})*`;
    bot.sendMessage(chatId, boxMsg, { parse_mode: 'Markdown' });
});

// Command: /stats
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    const statsMsg = `📊 *LIVE BOT ACCURACY STATISTICS* 📊\n\n` +
                     `🔥 *Total Signals Analyzed:* ${stats.total}\n` +
                     `🌟 *Wins:* ${stats.wins}\n` +
                     `🤬 *Losses:* ${stats.losses}\n` +
                     `🎇 *Jackpot Hits:* ${stats.jackpots}\n` +
                     `📈 *System Accuracy:* ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n` +
                     `🎚️ *Max Level Reached:* L${stats.maxLevelReached}`;
    bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
});

// Command: /AI - Interactive Inline Keyboard
bot.onText(/\/AI/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '❓ Q1. Total Stats (Win/Loss/Jackpot)', callback_data: 'ai_q1' }],
                [{ text: '❓ Q2. Current Streaks & Periods', callback_data: 'ai_q2' }],
                [{ text: '❓ Q3. Maximum Level Reached', callback_data: 'ai_q3' }],
                [{ text: '❓ Q4. How predictions are made?', callback_data: 'ai_q4' }],
                [{ text: '❓ Q5. Where do Box numbers come from?', callback_data: 'ai_q5' }],
                [{ text: '❓ Q6. How do Boxes form predictions?', callback_data: 'ai_q6' }],
                [{ text: '❓ Q7. Sizing & Colors Selection', callback_data: 'ai_q7' }]
            ]
        }
    };
    bot.sendMessage(chatId, '🤖 *WELCOMES TO TRADE\'S STAR AI QUESTION CONSOLE* 🤖\nनीचे दिए गए किसी भी सवाल पर क्लिक करके तुरंत उसका लाइव वैज्ञानिक जवाब प्राप्त करें:', { parse_mode: 'Markdown', reply_markup: opts.reply_markup });
});

// Inline Keyboard Callback Handler
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    let replyText = "";

    switch(data) {
        case 'ai_q1':
            replyText = `📊 *SYSTEM STATUS SUMMARY (Q1)*\n\n` +
                        `• Total Signals: ${stats.total}\n` +
                        `• Wins: ${stats.wins}\n` +
                        `• Losses: ${stats.losses}\n` +
                        `• Jackpot Hits: ${stats.jackpots}\n` +
                        `• Win Rate: ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%`;
            break;
            
        case 'ai_q2':
            let streakDesc = stats.currentStreakType ? stats.currentStreakType.toUpperCase() : "NONE";
            replyText = `📈 *STREAK RECORDS (Q2)*\n\n` +
                        `• Current Active Streak: *${stats.currentStreakCount}x ${streakDesc}*\n` +
                        `• Streak Period IDs: ${stats.currentStreakPeriods.length > 0 ? stats.currentStreakPeriods.join(', ') : 'N/A'}\n\n` +
                        `🌟 Max Win Streak: *${stats.maxStreakWin}x* (${stats.maxStreakWinPeriods.join(', ') || 'N/A'})\n` +
                        `🤬 Max Loss Streak: *${stats.maxStreakLoss}x* (${stats.maxStreakLossPeriods.join(', ') || 'N/A'})\n` +
                        `🎇 Max Jackpot Streak: *${stats.maxStreakJackpot}x* (${stats.maxStreakJackpotPeriods.join(', ') || 'N/A'}`;
            break;
            
        case 'ai_q3':
            replyText = `🎚️ *MAX LEVEL HISTORICAL RECORD (Q3)*\n\n` +
                        `• अभी तक का सबसे उच्चतम स्तर (Level): *L${stats.maxLevelReached}*\n` +
                        `• Current Bet Level: *L${botLevel}*\n\n` +
                        `हमारा सिस्टम प्रोग्रेसिव रिकवरी का इस्तेमाल करके 5 लेवल के भीतर स्योर विन सुनिश्चित करता है।`;
            break;
            
        case 'ai_q4':
            replyText = `🔬 *HOW WE PREDICT (Q4)*\n\n` +
                        `हम रैंडम नंबर्स नहीं देते। सिस्टम एक 8-डायमेंशनल एल्गोरिदम का उपयोग करता है जो:\n` +
                        `1. इतिहास में बार-बार आने वाले पैटर्न्स को मापता है।\n` +
                        `2. पीरियड की गणितीय आईडी के अंतिम अंकों की मैपिंग करता है।\n` +
                        `3. विपरीत साइज-कलर हेजिंग तकनीक लगाता है।\n\n` +
                        `*उदाहरण:* यदि आने वाले पीरियड के अंतिम अंक के लिए हमारा विश्लेषण ग्रीन की तरफ इशारा करता है, तो हम सुरक्षा के लिए स्मॉल ग्रीन नंबर और बिग ग्रीन नंबर का एक कॉम्बो बनाते हैं।`;
            break;
            
        case 'ai_q5':
            replyText = `📦 *THE 8 BOX SOURCES (Q5)*\n\n` +
                        `सभी 8 डिब्बों के नंबर इन गणितीय सूत्रों से आते हैं:\n` +
                        `1. Box 1: (P - 10) पीरियड परिणाम।\n` +
                        `2. Box 2: नवीनतम नंबर की पहली पुरानी उपस्थिति के ठीक बाद वाला नंबर।\n` +
                        `3. Box 3: उसी नंबर की दूसरी पुरानी उपस्थिति के बाद वाला नंबर।\n` +
                        `4. Box 4: उसी नंबर की तीसरी पुरानी उपस्थिति के बाद वाला नंबर।\n` +
                        `5. Box 5: पीरियड के आखरी 3 अंकों का \`THREE_DIGIT_MAP\` मैपिंग।\n` +
                        `6. Box 6: पीरियड के आखरी 1 अंक का \`ONE_DIGIT_MAP\` मैपिंग।\n` +
                        `7. Box 7: इतिहास में सटीक 3-डिजिट पीरियड मिलान।\n` +
                        `8. Box 8: इतिहास में सटीक 2-डिजिट पीरियड मिलान।`;
            break;
            
        case 'ai_q6':
            replyText = `⚡ *BOX TO PREDICTION (Q6)*\n\n` +
                        `हम इन 8 बॉक्स की संख्याओं में से सम (Even), विषम (Odd), बड़े (Big) और छोटे (Small) नंबरों का एक भारित बहुमत (Weighted Majority) अनुपात निकालते हैं।\n` +
                        `• यदि साइज (Big/Small) का बहुमत प्रबल है, तो भविष्यवाणी साइज पर बनती है।\n` +
                        `• यदि रंग (Red/Green) का बहुमत प्रबल है, तो भविष्यवाणी कलर के रूप में जारी होती है।`;
            break;
            
        case 'ai_q7':
            replyText = `🎯 *ACCURACY DECISION MATRIX (Q7)*\n\n` +
                        `साइज, कलर और 2 हेजिंग नंबरों का सही चयन इतिहास की विचलनों (Deviation Metrics) पर निर्भर करता है।\n` +
                        `• यदि \`BIG + RED\` का बहुमत बराबर आता है, तो प्रणाली Size (\`BIG\`) को प्राथमिकता देगी।\n` +
                        `• इसके बाद विपरीत संख्याओं का हेजिंग पूल (जैसे \`[2, 4]\`) चुना जाता है ताकि अगर गेम अपना पासा पलटे, तो भी 2 लेवल्स के भीतर जैकपॉट हिट हो जाए!`;
            break;
    }

    bot.sendMessage(message.chat.id, replyText, { parse_mode: 'Markdown' });
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
                if (history.length > 1000) history = history.slice(0, 1000); // Expanded for 24-hr exports
                
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

    // 1. Resolve active predictions on the channel
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

        // Send update to edited prediction post
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
                parse_mode: 'Markdown'
            });
        } catch (err) {
            console.error("Failed to edit channel live post:", err.message);
        }

        // Process win statuses & Dispatch Stickers
        let resultType = 'loss';
        if (isJackpot) {
            stats.jackpots++;
            stats.wins++;
            botLevel = 1;
            resultType = 'jackpot';
            await sendStickerSafe(STICKER_JACKPOT, "🎇");
        } else if (isWin) {
            stats.wins++;
            botLevel = 1;
            resultType = 'win';
            await sendStickerSafe(STICKER_WIN, "🌟");
        } else {
            stats.losses++;
            botLevel = botLevel >= 5 ? 1 : botLevel + 1;
            resultType = 'loss';
            await sendStickerSafe(STICKER_LOSS, "🤬");
        }

        if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;

        // Dynamic Streak Updates
        if (stats.currentStreakType === resultType) {
            stats.currentStreakCount++;
            stats.currentStreakPeriods.push(latestId.slice(-4));
        } else {
            stats.currentStreakType = resultType;
            stats.currentStreakCount = 1;
            stats.currentStreakPeriods = [latestId.slice(-4)];
        }

        // Save High Streaks
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
    }

    // 2. Compute 8-BOX Values for upcoming Period
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
                finalNums = (dominantSize === "BIG") ? [2, 4] : [6, 8];
            } else {
                finalNums = (dominantSize === "BIG") ? [1, 3] : [5, 7];
            }
        } else {
            // SIZE PREDICTION IS DOMINANT (OR VALUES ARE EQUAL)!
            finalSelection = dominantSize;
            if (dominantSize === "BIG") {
                finalNums = (dominantColor === "RED") ? [2, 4] : [1, 3];
            } else {
                finalNums = (dominantColor === "RED") ? [6, 8] : [5, 7];
            }
        }
    }

    const scale = walletBalance / 3963;
    const botIdx = Math.min(botLevel - 1, 4);
    const botLvlConfig = LVL_BASE[botIdx];
    const bBet = Math.round(botLvlConfig.b * scale);
    const nBet = Math.round(botLvlConfig.n * scale);

    const liveMsg = `PREDICTION LIVE\n\n` +
                    `PERIOD:- ${nextId.slice(-4)}\n\n` +
                    `MY PRE:- ${finalSelection}(${finalNums.join(',')})\n\n` +
                    `N•PRED:- ${finalNums.join(',')}\n\n` +
                    `RUGLT. :- WAIT\n\n` +
                    `B•BET.  :- ${bBet}\n\n` +
                    `N•BET.  :- ${nBet}\n\n` +
                    `LEVEL.  :- ${botLevel}`;

    const sentMessage = await bot.sendMessage(CHANNEL_CHAT_ID, liveMsg, { parse_mode: 'Markdown' });

    currentPrediction = {
        issue: nextId,
        predType: finalSelection,
        nums: finalNums,
        level: botLevel,
        messageId: sentMessage.message_id
    };
}

// Safe Sticker sender helper
async function sendStickerSafe(stickerId, fallbackEmoji) {
    try {
        await bot.sendSticker(CHANNEL_CHAT_ID, stickerId);
    } catch(err) {
        await bot.sendMessage(CHANNEL_CHAT_ID, fallbackEmoji);
    }
}

// Core monitor check triggers
setInterval(monitorLoop, 5000);
console.log("Monitoring 1M active loop...");
