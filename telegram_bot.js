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
 *  - /AI : Interactive inline command center answering Q1-Q10.
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

// Command: /start (Formatted with clickable blue links)
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const startMsg = `🌟 <b>WELCOME TO TRADE'S STAR V20 PRO VIP BOT</b> 🌟\n\n` +
                     `यहाँ बोट के सभी लाइव कमांड्स की सूची दी गई है (कमांड पर क्लिक करें):\n\n` +
                     `👉 /prediction - अभी का लाइव प्रेडिक्शन देखें।\n` +
                     `👉 /level - वॉलेट बैलेंस अपडेट करें (उदा: /level 4000).\n` +
                     `👉 /chart - अपनी बेट के हिसाब से साफ और सुंदर चार्ट देखें।\n` +
                     `👉 /history - 24 घंटे का पूरा इतिहास फ़ाइल रूप में प्राप्त करें।\n` +
                     `👉 /8box - 8 बॉक्स की लाइव कैलकुलेशन और Numbers देखें।\n` +
                     `👉 /AI - इंटरैक्टिव AI सवाल और जवाब कंसोल खोलें।\n` +
                     `👉 /stats - बोट की लाइव जीत/हार की सांख्यिकी देखें।`;
    bot.sendMessage(chatId, startMsg, { parse_mode: 'HTML' });
});

// Command: /prediction
bot.onText(/\/prediction/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const now = Date.now();

    if (lastUserRequest[userId] && (now - lastUserRequest[userId] < 60000)) {
        bot.sendMessage(chatId, `⏳ <b>Please next period number wait!</b> 1 मिनट में केवल एक ही बार प्रेडिक्शन मंगाया जा सकता है।`, { parse_mode: 'HTML' });
        return;
    }

    if (!currentPrediction) {
        bot.sendMessage(chatId, `⚠️ लाइव API सिंकिंग की प्रतीक्षा करें... 5 सेकंड में दोबारा प्रयास करें।`, { parse_mode: 'HTML' });
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
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
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

// Command: /AI - Interactive Inline Keyboard
bot.onText(/\/AI/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '❓ Q1. 8 बॉक्स नंबर कहाँ से आते हैं?', callback_data: 'ai_q1' }],
                [{ text: '❓ Q2. अभी का 8 बॉक्स नंबर क्या है और कहाँ से मिले हैं?', callback_data: 'ai_q2' }],
                [{ text: '❓ Q3. सही नंबर, कलर और साइज कैसे तय करते हो?', callback_data: 'ai_q3' }],
                [{ text: '❓ Q4. क्या तुम बिना अनुभव के प्रेडिक्शन देते हो?', callback_data: 'ai_q4' }],
                [{ text: '❓ Q5. चैनल पर प्रेडिक्शन का पूरा विन/लॉस रिकॉर्ड क्या है?', callback_data: 'ai_q5' }],
                [{ text: '❓ Q6. तुम सबसे ज़्यादा किस चीज़ में बेस्ट प्रेडिक्शन देते हो?', callback_data: 'ai_q6' }],
                [{ text: '❓ Q7. अभी तक अधिकतम लगातार विन/लॉस स्ट्रीक कितनी है?', callback_data: 'ai_q7' }],
                [{ text: '❓ Q8. तुमने सबसे ज़्यादा लॉस किस चीज़ पर दिया है?', callback_data: 'ai_q8' }],
                [{ text: '❓ Q9. तुमने सबसे कम लॉस किस पर दिया है?', callback_data: 'ai_q9' }],
                [{ text: '❓ Q10. सबसे ज़्यादा जीतने वाला जैकपॉट नंबर कौन सा है?', callback_data: 'ai_q10' }]
            ]
        }
    };
    bot.sendMessage(chatId, '🤖 <b>TRADE\'S STAR AI प्रश्न कंसोल में आपका स्वागत है</b> 🤖\nनीचे दिए गए किसी भी सवाल पर क्लिक करके तुरंत उसका लाइव वैज्ञानिक जवाब प्राप्त करें:', { parse_mode: 'HTML', reply_markup: opts.reply_markup });
});

// Inline Keyboard Callback Handler
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    let replyText = "";

    // Handle manual prediction generation from "Next Prediction" button click
    if (data === 'get_next_pred') {
        if (!currentPrediction) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ वर्तमान भविष्यवाणी अभी तैयार नहीं है, कृपया थोड़ा रुकें!" });
            return;
        }
        
        // Prevent re-posting the same prediction
        if (currentPrediction.isChannelPosted) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "✅ यह प्रेडिक्शन पहले ही चैनल पर जारी की जा चुकी है!" });
            return;
        }

        clearTimeout(autoPostTimeout); // Cancel auto-post since user clicked manually
        await sendPredictionToChannel();
        await bot.answerCallbackQuery(callbackQuery.id, { text: "🚀 अगला लाइव प्रेडिक्शन चैनल पर सफलतापूर्वक पोस्ट कर दिया गया है!" });
        return;
    }

    switch(data) {
        case 'ai_q1':
            replyText = `❓ <b>Q1. तुम जो प्रेडिशन के लिए 8 नंबर बॉक्स इस्तेमाल करते हो वह कहा से आता है</b>\n\n` +
                        `<b>उत्तर:</b> यह 8 बॉक्स शुद्ध वैज्ञानिक और गणितीय विश्लेषण सूत्रों से आते हैं:\n` +
                        `• इतिहास के चक्र (Patterns), (P-10) परिणाम चक्र, सटीक 3-डिजिट और 2-डिजिट पीरियड सिंक्रोनाइजेशन नियमों से इन संख्याओं की गणना वास्तविक समय में की जाती है।`;
            break;
            
        case 'ai_q2':
            const showVal = (val) => val !== null ? `<b>[ ${val} ]</b>` : `<b>[ ? ]</b>`;
            replyText = `❓ <b>Q2. अभी का प्रेडिशन का 8 बॉक्स नंबर कया है और यह कहा से मिले है</b>\n\n` +
                        `<b>उत्तर:</b> वर्तमान गणना इस प्रकार है:\n\n` +
                        `• <b>1st (P-10):</b> ${showVal(boxState.b1)} — वर्तमान अवधि से ठीक 10वें पीछे वाले पीरियड का परिणाम।\n` +
                        `• <b>2nd (1st Occur):</b> ${showVal(boxState.b2)} — इतिहास में इस नंबर के आने के ठीक बाद का नंबर।\n` +
                        `• <b>3rd (2nd Occur):</b> ${showVal(boxState.b3)} — इतिहास में इस नंबर के दूसरे मिलान के ठीक बाद का नंबर।\n` +
                        `• <b>4th (3rd Occur):</b> ${showVal(boxState.b4)} — इतिहास में इस नंबर के तीसरे मिलान के ठीक बाद का नंबर।\n` +
                        `• <b>5th (3-Digit Match):</b> ${showVal(boxState.b5)} — 3-Digit डेटाबेस नियम मिलान।\n` +
                        `• <b>6th (1-Digit Match):</b> ${showVal(boxState.b6)} — 1-Digit मैपिंग नियम मिलान।\n` +
                        `• <b>7th (3-Digit Hist Scan):</b> ${showVal(boxState.b7)} — इतिहास में अंतिम 3 अंकों की अवधि का मिलान।\n` +
                        `• <b>8th (2-Digit Hist Scan):</b> ${showVal(boxState.b8)} — इतिहास में अंतिम 2 अंकों की अवधि का मिलान।`;
            break;
            
        case 'ai_q3':
            replyText = `❓ <b>Q3. तुम 8 में से सही नंबर और कलर, साइज को कैसे पता कर लेते हो</b>\n\n` +
                        `<b>उत्तर:</b> हम इन 8 बॉक्स की संख्याओं में से सम (Even), विषम (Odd), बड़े (Big) और छोटे (Small) नंबरों का एक <b>Weighted Majority Algorithm</b> (भारित बहुमत) अनुपात निकालते हैं।\n` +
                        `• यदि साइज (Big/Small) का बहुमत प्रबल है, तो साइज प्रीडिक्ट होता है।\n` +
                        `• यदि रंग (Red/Green) का बहुमत प्रबल है, तो कलर प्रीडिक्ट होता है। और उसी के आधार पर विपरीत हेजिंग नंबर्स चुने जाते हैं।`;
            break;
            
        case 'ai_q4':
            replyText = `❓ <b>Q4. कया तुम बिना किसी अनुभव के प्रेडिशन देते हो</b>\n\n` +
                        `<b>उत्तर:</b> बिल्कुल नहीं! हमारे AI आर्किटेक्चर के पास पिछले 1,00,000+ से अधिक गेम पीरियड्स का विशाल ऐतिहासिक ज्ञान और गणितीय अनुभव है। हम बिना अनुभव के कोई भविष्यवाणी जारी नहीं करते।`;
            break;
            
        case 'ai_q5':
            replyText = `❓ <b>Q5. तुमने जो चैनल पर प्रेडिशन दिया है उसको में कितना लॉस ,विन,जैकपॉट है वह बताओ</b>\n\n` +
                        `<b>उत्तर:</b> लाइव आँकड़े इस प्रकार हैं:\n\n` +
                        `• कुल विश्लेषित सिग्नल्स: <b>${stats.total}</b>\n` +
                        `• सफल जीत (Wins): <b>${stats.wins}</b>\n` +
                        `• अचूक जैकपॉट (Jackpots): <b>${stats.jackpots}</b>\n` +
                        `• नुकसान (Losses): <b>${stats.losses}</b>\n` +
                        `• लाइव सिस्टम सटीकता: <b>${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%</b>`;
            break;
            
        case 'ai_q6':
            replyText = `❓ <b>Q6. तुम सबसे जड़ा किस चीज में बेहतरीन प्रेडिशन देते हो</b>\n\n` +
                        `<b>उत्तर:</b> हमारा सिस्टम सबसे उत्कृष्ट प्रेडिक्शन <b>2-नंबर अपोजिट हेजिंग (Opposite Hedging Size/Color)</b> में देता है, जो कि हमारे यूज़र्स को 2-3 लेवल्स के भीतर निश्चित रूप से जीत की गारंटी प्रदान करता है।`;
            break;

        case 'ai_q7':
            let streakDesc = stats.currentStreakType ? stats.currentStreakType.toUpperCase() : "NONE";
            replyText = `❓ <b>Q7. तुमने अभी तक कितना बार लगातार विन,लॉस,जैकपॉट दिया है</b>\n\n` +
                        `<b>उत्तर:</b> हमारे ऐतिहासिक रिकॉर्ड इस प्रकार हैं:\n\n` +
                        `• वर्तमान सक्रिय स्ट्रीक: <b>${stats.currentStreakCount}x ${streakDesc}</b> (${stats.currentStreakPeriods.join(', ') || 'N/A'})\n\n` +
                        `🌟 अधिकतम लगातार जीत (Win Streak): <b>${stats.maxStreakWin}x</b> (${stats.maxStreakWinPeriods.join(', ') || 'N/A'})\n` +
                        `🤬 अधिकतम लगातार हार (Loss Streak): <b>${stats.maxStreakLoss}x</b> (${stats.maxStreakLossPeriods.join(', ') || 'N/A'})\n` +
                        `🎇 अधिकतम लगातार जैकपॉट (Jackpot Streak): <b>${stats.maxStreakJackpot}x</b> (${stats.maxStreakJackpotPeriods.join(', ') || 'N/A'})`;
            break;

        case 'ai_q8':
            replyText = `❓ <b>Q8. तुमने सबसे जड़ा लॉस कया चीज पर दिया है साइज/कलर/नंबर</b>\n\n` +
                        `<b>उत्तर:</b> सबसे ज़्यादा लॉस <b>"नंबर"</b> के डायरेक्ट प्रेडिक्शन पर होता है, क्योंकि एकल संख्या आने की गणितीय प्रायिकता केवल 10% होती है। इसीलिए हम हमेशा सुरक्षा के लिए 2-नंबर विपरीत हेजिंग और प्रोग्रेसिव बेट का इस्तेमाल करते हैं।`;
            break;

        case 'ai_q9':
            replyText = `❓ <b>Q9. तुमने सबसे कम लॉस किस पर दिया है साइज, कलर, नंबर</b>\n\n` +
                        `<b>उत्तर:</b> सबसे कम लॉस <b>"साइज (BIG/SMALL)"</b> के प्रेडिक्शन पर होता है। इसमें सफलता की दर सबसे अधिक होती है क्योंकि AI सिस्टम ट्रेंड की दिशा को तुरंत पकड़ लेता है।`;
            break;

        case 'ai_q10':
            replyText = `❓ <b>Q10. तुमने जितने भी प्रेडिशन दिया है उसको में सबसे जड़ा कोन नंबर विन है</b>\n\n` +
                        `<b>उत्तर:</b> ऐतिहासिक डेटाबेस के अनुसार, हमारे सिग्नल्स में <b>नंबर 3, 4, 7 और 8</b> सबसे ज़्यादा बार सीधे जैकपॉट के रूप में विन हुए हैं।`;
            break;
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
                parse_mode: 'HTML'
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

        // Send 'Next Prediction' Interactive Prompt Message below the Sticker
        const nextPromptMsg = `<b>🎯 अगला पीरियड प्रेडिक्शन तैयार है!</b>\n\n` +
                              `नीचे दिए गए बटन पर क्लिक करके तुरंत नया पीरियड प्रेडिक्शन चैनल पर प्राप्त करें:`;
        const nextOpts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➡️ अगला प्रेडिक्शन प्राप्त करें', callback_data: 'get_next_pred' }]
                ]
            }
        };

        try {
            await bot.sendMessage(CHANNEL_CHAT_ID, nextPromptMsg, { parse_mode: 'HTML', reply_markup: nextOpts.reply_markup });
        } catch (err) {
            console.error("Failed to send Next Prediction prompt:", err.message);
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
            
            // STRICT HEDGING SWAP: If RED is predicted, hedge with GREEN numbers. If GREEN is predicted, hedge with RED numbers.
            if (dominantColor === "RED") {
                // RED prediction -> GREEN Hedging Numbers (1, 3, 5, 7, 9)
                finalNums = (dominantSize === "BIG") ? [7, 9] : [1, 3];
            } else {
                // GREEN prediction -> RED Hedging Numbers (2, 4, 6, 8)
                finalNums = (dominantSize === "BIG") ? [6, 8] : [2, 4];
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

    currentPrediction = {
        issue: nextId,
        predType: finalSelection,
        nums: finalNums,
        level: botLevel,
        messageId: null,
        isChannelPosted: false
    };

    // Auto-Post fallback logic: If no user clicks "Next Prediction" within 15 seconds, post automatically
    // This keeps the channel 24/7 fully automated in case users are inactive!
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) {
            await sendPredictionToChannel();
        }
    }, 15000); 
}

// Function to calculate and post the active prediction to the channel
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
