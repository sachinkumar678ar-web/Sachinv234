require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIGURATION & VARIABLES
// ==========================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const CHANNEL_CHAT_ID = process.env.CHANNEL_CHAT_ID; 
const ADMIN_ID = process.env.ADMIN_ID; 

const STICKER_WIN = 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA'; 
const STICKER_LOSS = 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA';
const STICKER_JACKPOT = 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE';

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=15";
const SCALE_BASE = 200; 

let history = []; // Limit: 50
let botLevel = 1;
let walletBalance = 4000; 
let currentPrediction = null; 
let autoPostTimeout = null;
let isPollingReconnecting = false; 
let isBotActive = true; 
let dailyReportSent = false;

// 📊 Stats Object (Auto-saved to file)
let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0, skips: 0,
    maxLevelReached: 1,
    levelHistoryTracker: {}
};

// 💾 State Persistence: Load & Save Stats
if (fs.existsSync('./stats.json')) {
    try { stats = JSON.parse(fs.readFileSync('./stats.json')); } catch (e) {}
}
setInterval(() => {
    fs.writeFileSync('./stats.json', JSON.stringify(stats));
}, 5 * 60 * 1000); // Save every 5 mins

// ==========================================
// 🤖 BOT SETUP & SERVER (KEEP-ALIVE)
// ==========================================
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
    polling: false,
    request: { agentOptions: { family: 4 } }
});

bot.on('polling_error', (error) => {
    const errorMsg = error.message || String(error);
    if (errorMsg.includes('409 Conflict') && !isPollingReconnecting) {
        isPollingReconnecting = true;
        bot.stopPolling().then(() => {
            setTimeout(() => {
                bot.startPolling({ restart: true }).then(() => isPollingReconnecting = false).catch(() => isPollingReconnecting = false);
            }, 15000); 
        }).catch(() => isPollingReconnecting = false);
    }
});
bot.deleteWebHook({ drop_pending_updates: true }).then(() => bot.startPolling({ restart: true }));

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Trade Star Bot Ultra-Safe Mode Active!\n');
}).listen(PORT, () => console.log(`🤖 Server Listening on Port: ${PORT}`));

// ==========================================
// 🛠️ UTILITY FUNCTIONS
// ==========================================
function getISTTime() {
    const d = new Date();
    return new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (3600000 * 5.5)); 
}

function getISTTimeString() {
    const nd = getISTTime();
    let hours = nd.getHours(), minutes = nd.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12; hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0'+minutes : minutes;
    return (hours < 10 ? '0'+hours : hours) + ':' + minutes + ' ' + ampm;
}

function getDynamicBet(level, scale) {
    const multiplier = Math.pow(3, level - 1);
    return { bBet: Math.round(10 * multiplier * scale), nBet: Math.round(1 * multiplier * scale) };
}

function getFancyType(type) {
    if (type === "BIG") return "BIGGG";
    if (type === "SMALL") return "SMALL";
    if (type === "WAIT") return "🛑 WAIT 🛑";
    return type; 
}

// ==========================================
// 🧠 ULTRA-SAFE DEFENSIVE AI & PREDICTION LOGIC
// ==========================================
function generatePrediction(nextId) {
    const recentHistory = history.slice(0, 15);
    let finalSelection = "WAIT", skipReason = "";

    // 1️⃣ Filters: Zig-Zag & 0/5
    let isZigZag = true;
    for (let i = 0; i < 3; i++) {
        if (!recentHistory[i] || !recentHistory[i+1]) break;
        let cSize = recentHistory[i].number >= 5 ? "BIG" : "SMALL";
        let pSize = recentHistory[i+1].number >= 5 ? "BIG" : "SMALL";
        if (cSize === pSize) { isZigZag = false; break; }
    }
    let hasZeroOrFive = recentHistory[0] && recentHistory[1] && ([0, 5].includes(recentHistory[0].number) || [0, 5].includes(recentHistory[1].number));

    // 2️⃣ Decision Making (Trend Confirmation)
    if (isZigZag) { skipReason = "Zig-Zag Market"; finalSelection = "WAIT"; }
    else if (hasZeroOrFive) { skipReason = "0/5 Volatile Number"; finalSelection = "WAIT"; }
    else {
        let lSize = recentHistory[0].number >= 5 ? "BIG" : "SMALL", slSize = recentHistory[1].number >= 5 ? "BIG" : "SMALL";
        if (lSize === slSize) finalSelection = lSize;
        else {
            let lColor = [1,3,7,9].includes(recentHistory[0].number) ? "GREEN" : ([0,5].includes(recentHistory[0].number) ? "VIOLET" : "RED");
            let slColor = [1,3,7,9].includes(recentHistory[1].number) ? "GREEN" : ([0,5].includes(recentHistory[1].number) ? "VIOLET" : "RED");
            if (lColor !== "VIOLET" && lColor === slColor) finalSelection = lColor;
            else { finalSelection = "WAIT"; skipReason = "No Clear Trend"; }
        }
    }

    // 3️⃣ Hedging Numbers
    let finalNums = [5, 7]; 
    if (finalSelection === "BIG") finalNums = [7, 9];
    if (finalSelection === "SMALL") finalNums = [1, 3];
    if (finalSelection === "RED") finalNums = [2, 4];
    if (finalSelection === "GREEN") finalNums = [3, 7];
    if (finalSelection === "WAIT") finalNums = ["-", "-"];

    currentPrediction = { issue: nextId, predType: finalSelection, nums: finalNums, level: botLevel, messageId: null, isChannelPosted: false, predTime: getISTTimeString(), skipReason: skipReason };
    console.log(`🎯 AI Computed: Issue: #${nextId.slice(-4)} -> Type: ${finalSelection}`);

    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) await sendPredictionToChannel();
    }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;
    let msgContent = "";
    if (currentPrediction.predType === "WAIT") {
        msgContent = `🛑 <b>MARKET IS HIGHLY VOLATILE</b> 🛑\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ <b>AI MESSAGE:</b> अभी मार्केट खराब (${currentPrediction.skipReason}) है। लॉस से बचने के लिए दांव न लगाएँ।\n━━━━━━━━━━━━━━━━━━━━━━━\n⏳ <b>PLEASE WAIT FOR SAFE TREND...</b>`;
    } else {
        const bets = getDynamicBet(currentPrediction.level, walletBalance / SCALE_BASE);
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   WAIT\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n🪙 N•BET.  :- ₹${bets.nBet} (EACH)\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level} (3X PROGRESSIVE)\n━━━━━━━━━━━━━━━━━━━━━━━`;
    }
    try {
        const sentMessage = await bot.sendMessage(CHANNEL_CHAT_ID, msgContent, { parse_mode: 'HTML' });
        currentPrediction.messageId = sentMessage.message_id;
        currentPrediction.isChannelPosted = true;
    } catch (err) {}
}

async function monitorLoop() {
    if (!isBotActive) return;
    try {
        const response = await fetch(`${API_ENDPOINT}&t=${Date.now()}`);
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
                if (history.length > 50) history = history.slice(0, 50); // 🧹 50 Limit
                await handleNewOutcome();
            }
        }
    } catch (e) {}
}

async function handleNewOutcome() {
    if (history.length < 15) return;
    const latestOutcome = history[0], latestId = latestOutcome.issue;

    if (currentPrediction && currentPrediction.issue === latestId) {
        const actualNum = latestOutcome.number;
        const actualSize = actualNum >= 5 ? "BIGGG" : "SMALL";
        const actualCol = [1,3,7,9].includes(actualNum) ? "GREEN" : ([0,5].includes(actualNum) ? "VIOLET" : "REDDD");
        
        if (currentPrediction.predType === "WAIT") {
            stats.skips++;
            if(currentPrediction.messageId) {
                let waitResolved = `🛑 <b>PERIOD SKIPPED SUCCESSFULLY</b> 🛑\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n✅ AI ने सही फैसला लिया, रिज़ल्ट: ${actualSize}(${actualNum}) आया।`;
                try { await bot.editMessageText(waitResolved, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (e) {}
            }
        } else {
            stats.total++;
            let isWin = false, isJackpot = currentPrediction.nums.includes(actualNum); 
            if (["BIG", "SMALL"].includes(currentPrediction.predType)) isWin = (currentPrediction.predType === (actualSize === "BIGGG" ? "BIG" : "SMALL"));
            else isWin = (currentPrediction.predType === (actualCol === "REDDD" ? "RED" : "GREEN") || actualCol === "VIOLET");

            const bets = getDynamicBet(currentPrediction.level, walletBalance / SCALE_BASE);
            let outcomeDisplay = ["RED", "GREEN"].includes(currentPrediction.predType) ? `🌟${actualCol}(${actualNum})🌟` : `🌟${actualSize}(${actualNum})🌟`;
            const editedMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━━━━`;
            try { await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (err) {}

            if (isWin || isJackpot) {
                stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
                stats.wins++;
                if(isJackpot) stats.jackpots++;
                
                // 🚀 Trust-Building: Recovery Message
                if (currentPrediction.level >= 3) {
                    const recoveryMsg = `🔥 <b>RECOVERY SUCCESSFUL!</b> 🔥\n\n📈 लगातार ${currentPrediction.level - 1} लॉस के बाद, <b>Level ${currentPrediction.level}</b> पर शानदार वापसी!\n💸 पिछला सारा लॉस कवर और हम फिर से प्रॉफिट में आ गए हैं।`;
                    bot.sendMessage(CHANNEL_CHAT_ID, recoveryMsg, { parse_mode: 'HTML' }).catch(()=>{});
                }
                botLevel = 1; 
                bot.sendSticker(CHANNEL_CHAT_ID, isJackpot ? STICKER_JACKPOT : STICKER_WIN).catch(()=>{});
            } else {
                stats.losses++;
                // 📉 Trust-Building: Loss Alert
                if (botLevel === 3 || botLevel === 5) {
                    bot.sendMessage(CHANNEL_CHAT_ID, `⚠️ <b>मार्केट थोड़ा कठिन चल रहा है (Level ${botLevel} Loss)</b>\nचिंता न करें, अपना 3X फंड तैयार रखें। AI ट्रेंड को एडजस्ट कर रहा है।`, { parse_mode: 'HTML' }).catch(()=>{});
                }
                botLevel++; 
                bot.sendSticker(CHANNEL_CHAT_ID, STICKER_LOSS).catch(()=>{});
            }
            if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
        }
    }
    const nextId = (BigInt(latestId) + 1n).toString();
    generatePrediction(nextId);
}

// ==========================================
// 📊 AUTO DAILY TRANSPARENCY REPORT (11:55 PM)
// ==========================================
setInterval(() => {
    const now = getISTTime();
    if (now.getHours() === 23 && now.getMinutes() === 55 && !dailyReportSent) {
        let levelTrackerText = "";
        Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
        const reportMsg = `📋 <b>TODAY'S FULL TRANSPARENCY REPORT</b> 📋\n\n🔥 <b>Total Signals:</b> ${stats.total}\n🛑 <b>Skipped (बचाए गए लॉस):</b> ${stats.skips}\n🌟 <b>Total Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Highest Level:</b> L${stats.maxLevelReached}\n\n🏆 <b>LEVEL CLEARANCE DETAILS:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "आज कोई डेटा नहीं है।"}\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ <i>कल मिलते हैं एक नए प्रॉफिट सेशन के साथ! गुड नाईट! 🌙</i>`;
        bot.sendMessage(CHANNEL_CHAT_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});
        dailyReportSent = true;
    }
    if (now.getHours() === 0 && now.getMinutes() === 5) dailyReportSent = false;
}, 60000); 

// ==========================================
// 💬 USER & ADMIN COMMANDS
// ==========================================
bot.onText(/\/start/, (msg) => {
    const welcomeMsg = `🌟 <b>WELCOME TO TRADE'S STAR V20 (SAFE AI)</b> 🌟\n\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - इन्वेस्टमेंट चार्ट\n👉 /rules - ट्रेडिंग नियम\n👉 /ai - AI से सवाल पूछें`;
    bot.sendMessage(msg.chat.id, welcomeMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/chart/, (msg) => {
    let chartMsg = `📊 <b>3X MARTINGALE INVESTMENT CHART</b> 📊\n💰 <b>Current Base Wallet:</b> ₹${walletBalance}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for(let i = 1; i <= 6; i++) {
        const bets = getDynamicBet(i, walletBalance / SCALE_BASE);
        chartMsg += `👉 <b>Level ${i}:</b> Size ₹${bets.bBet} | Nums ₹${bets.nBet} (Total: ₹${bets.bBet + (bets.nBet * 2)})\n`;
    }
    chartMsg += `━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ <i>हमेशा 6 लेवल का फंड मेंटेन रखें!</i>`;
    bot.sendMessage(msg.chat.id, chartMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/rules/, (msg) => {
    bot.sendMessage(msg.chat.id, `🛑 <b>VIP TRADING RULES</b> 🛑\n1️⃣ लालच न करें: दिन का 10-20% प्रॉफिट होते ही गेम बंद कर दें।\n2️⃣ फंड मैनेजमेंट: 6 लेवल का फंड रखें।\n3️⃣ AI को फॉलो करें: WAIT बोलता है, तो खुद से दांव न लगाएँ।\n4️⃣ नंबर हेजिंग (Numbers): जैकपॉट के लिए 2 नंबर्स पर भी लगाएँ।`, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/stats/, (msg) => {
    let levelTrackerText = "";
    Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
    const statsMsg = `📊 <b>LIVE BOT ACCURACY (SAFE MODE)</b> 📊\n\n🔥 <b>Signals:</b> ${stats.total} | 🛑 <b>Skipped:</b> ${stats.skips}\n🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Max Level:</b> L${stats.maxLevelReached}\n\n🏆 <b>LEVEL CLEARANCE HISTORY:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "अभी कोई डेटा नहीं है।"}`;
    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

// 🔒 Admin Commands
bot.onText(/\/level\s+(\d+)/, (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "❌ <b>ACCESS DENIED</b>", { parse_mode: 'HTML' });
    walletBalance = parseFloat(match[1]);
    bot.sendMessage(msg.chat.id, `✅ <b>ADMIN ACTION:</b> Wallet Configured to ₹${walletBalance}`, { parse_mode: 'HTML' });
});

bot.onText(/\/pause/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    isBotActive = false;
    bot.sendMessage(msg.chat.id, "🛑 बोट का प्रेडिक्शन रोक दिया गया है।");
    bot.sendMessage(CHANNEL_CHAT_ID, "⚠️ <b>SYSTEM UPDATE:</b> बोट को कुछ समय के लिए एडमिन द्वारा रोका गया है।", { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/resume/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    isBotActive = true;
    bot.sendMessage(msg.chat.id, "▶️ बोट का प्रेडिक्शन फिर से चालू कर दिया गया है।");
});

// 🤖 AI Q&A Console
bot.onText(/\/ai/, (msg) => {
    const opts = { reply_markup: { inline_keyboard: [
        [{ text: '🛑 Q1. WAIT क्यों बोलता है?', callback_data: 'ai_wait' }],
        [{ text: '💰 Q2. सुरक्षित ट्रेडिंग के लिए फंड?', callback_data: 'ai_fund' }],
        [{ text: '📈 Q3. क्या प्रेडिक्शन 100% सही है?', callback_data: 'ai_accuracy' }],
        [{ text: '🎯 Q4. नंबर्स पर पैसा क्यों लगाएँ?', callback_data: 'ai_numbers' }],
        [{ text: '🤬 Q5. 5-6 लॉस हो जाए तो?', callback_data: 'ai_loss' }]
    ]}};
    bot.sendMessage(msg.chat.id, '🤖 <b>TRADE\'S STAR AI प्रश्न कंसोल</b> 🤖\n\nसवालों के जवाब के लिए क्लिक करें:', { parse_mode: 'HTML', reply_markup: opts.reply_markup }).catch(() => {});
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id, data = callbackQuery.data;
    let replyText = "";
    try {
        await bot.answerCallbackQuery(callbackQuery.id);
        if (data === 'ai_wait') replyText = `🛑 <b>जवाब:</b> AI मार्केट के कचरा ट्रेंड या 0/5 आने पर दांव लगाने से मना कर देता है। पैसा बचाना ही पैसा कमाना है!`;
        else if (data === 'ai_fund') replyText = `💰 <b>जवाब:</b> हमेशा कम से कम <b>6 लेवल का फंड</b> मेंटेन रखें। इससे आपका रिस्क 0% हो जाता है।`;
        else if (data === 'ai_accuracy') replyText = `📈 <b>जवाब:</b> कोई सिस्टम 100% नहीं होता, लेकिन हमारा <b>Safe Defensive Mode</b> और <b>3X Recovery System</b> आपको प्रॉफिट में रखता है।`;
        else if (data === 'ai_numbers') replyText = `🎯 <b>जवाब:</b> सिर्फ BIG/SMALL पर 2X मिलता है, लेकिन नंबर्स पर सीधा <b>9X (नौ गुना) जैकपॉट</b> मिलता है!`;
        else if (data === 'ai_loss') replyText = `🤬 <b>जवाब:</b> घबराएं नहीं! 3X दांव लगाने पर पिछला सारा लॉस एक ही झटके में कवर हो जाएगा।`;
        if (replyText) await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML' });
    } catch (err) {}
});

setInterval(monitorLoop, 5000);
console.log("🚀 System Booted. Monitoring Wingo 1M with Ultra-Safe AI...");
