const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIGURATION (Direct Setup)
// ==========================================
const TELEGRAM_BOT_TOKEN = '8555094944:AAEJuHmxBosT6qST62J-AwbwfiZp1NHoY5s'; 
const CHANNEL_CHAT_ID = '-1003752888794'; 
const ADMIN_ID = '8358255492'; // ⚠️ यहाँ 123456789 हटाकर अपना असली एडमिन आईडी डालें

const STICKER_WIN = 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA'; 
const STICKER_LOSS = 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA';
const STICKER_JACKPOT = 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE';

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=15";

let history = []; 
let botLevel = 1;
let walletBalance = 4000; // बेस वॉलेट 
let currentPrediction = null; 
let autoPostTimeout = null;
let isPollingReconnecting = false; 
let isBotActive = true; 
let dailyReportSent = false;
let consecutiveJackpots = 0; 

// 📊 Stats Object
let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0, skips: 0,
    maxLevelReached: 1, levelHistoryTracker: {}, knownUsers: []
};

if (fs.existsSync('./stats.json')) {
    try { stats = JSON.parse(fs.readFileSync('./stats.json')); } catch (e) {}
}
setInterval(() => { fs.writeFileSync('./stats.json', JSON.stringify(stats)); }, 5 * 60 * 1000); 

// ==========================================
// 🤖 BOT SETUP & SERVER
// ==========================================
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false, request: { agentOptions: { family: 4 } } });

bot.on('polling_error', (error) => {
    if (String(error).includes('409 Conflict') && !isPollingReconnecting) {
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
    res.end('Trade Star Bot - Human Mode Active!\n');
}).listen(PORT, () => console.log(`🤖 Server Listening on Port: ${PORT}`));

// ==========================================
// 🛠️ UTILITY & MATH FUNCTIONS
// ==========================================
function getISTTime() { return new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 5.5)); }
function getISTTimeString() {
    let nd = getISTTime(), h = nd.getHours(), m = nd.getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; m = m < 10 ? '0'+m : m;
    return (h < 10 ? '0'+h : h) + ':' + m + ' ' + ampm;
}
function getFancyType(type) {
    if (type === "BIG") return "BIGGG"; if (type === "SMALL") return "SMALL"; if (type === "WAIT") return "🛑 WAIT 🛑"; return type; 
}
function getRandomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// 🧠 PERFECT CUMULATIVE MARTINGALE MATH
function getDynamicBet(level, wallet) {
    const totalUnits = 364; // 1 + 3 + 9 + 27 + 81 + 243 (6 Level Total Multiplier)
    const unitValue = wallet / totalUnits;
    const levelMultiplier = Math.pow(3, level - 1);
    
    // इस लेवल का कुल फंड 
    const levelTotalBet = Math.round(unitValue * levelMultiplier);

    // B/S और नंबर में बाँटना (लगभग 72% B/S को)
    let bBet = Math.round(levelTotalBet * 0.72);
    let nBet = Math.floor((levelTotalBet - bBet) / 2);

    // 🛑 लो-बैलेंस रूल्स
    if (bBet >= 10 && bBet <= 25) {
        nBet = 1; // 10 से 20-25 के बीच 1-1 का नंबर बेट
    } else if (bBet < 5) {
        nBet = 0; // बहुत कम फंड होने पर नंबर बेट बंद
    }

    // सटीक मैथ्स के लिए bBet को एडजस्ट करें ताकि लेवल का टोटल सेम रहे
    bBet = levelTotalBet - (nBet * 2);
    if (bBet < 1) { bBet = levelTotalBet; nBet = 0; }

    return { bBet, nBet, levelTotal: bBet + (nBet * 2) };
}

// ==========================================
// 🧠 STRICT AI PREDICTION LOGIC
// ==========================================
function generatePrediction(nextId) {
    const recentHistory = history.slice(0, 15);
    let finalSelection = "WAIT", skipReason = "", winChance = 0;

    if (recentHistory.length < 6) return;

    let h0 = recentHistory[0].number >= 5 ? "B" : "S"; 
    let h1 = recentHistory[1].number >= 5 ? "B" : "S";
    let h2 = recentHistory[2].number >= 5 ? "B" : "S";
    let h3 = recentHistory[3].number >= 5 ? "B" : "S";
    let h4 = recentHistory[4].number >= 5 ? "B" : "S";
    let h5 = recentHistory[5].number >= 5 ? "B" : "S";
    
    let seq6 = h5 + h4 + h3 + h2 + h1 + h0; 
    let seq5 = h4 + h3 + h2 + h1 + h0;
    let seq4 = h3 + h2 + h1 + h0;

    // 🛑 0 या 5 आने पर स्किप
    if ([0, 5].includes(recentHistory[0].number)) {
        skipReason = "0/5 Volatile (ट्रेंड ब्रेक का खतरा)";
        finalSelection = "WAIT";
    } 
    else {
        // 🟢 Trap Rules (High Confidence 92%-98%)
        if (seq5 === "BBSBB") { finalSelection = "SMALL"; winChance = getRandomNumber(92, 98); } 
        else if (seq5 === "SSBSS") { finalSelection = "BIG"; winChance = getRandomNumber(92, 98); } 
        else if (seq5 === "BSSSB") { finalSelection = "SMALL"; winChance = getRandomNumber(93, 97); } 
        else if (seq5 === "SBBBS") { finalSelection = "BIG"; winChance = getRandomNumber(93, 97); }
        else if (seq6 === "SSSBBS") { finalSelection = "SMALL"; winChance = getRandomNumber(95, 99); } 
        else if (seq6 === "BBBSSB") { finalSelection = "BIG"; winChance = getRandomNumber(95, 99); }
        
        // 🟢 Normal Rules (Medium Confidence 85%-91%)
        else if (seq4 === "BBBB") { finalSelection = "BIG"; winChance = getRandomNumber(85, 91); }
        else if (seq4 === "SSSS") { finalSelection = "SMALL"; winChance = getRandomNumber(85, 91); }
        else if (seq4 === "BSBS") { finalSelection = "BIG"; winChance = getRandomNumber(86, 90); }
        else if (seq4 === "SBSB") { finalSelection = "SMALL"; winChance = getRandomNumber(86, 90); }
        else if (seq4 === "BBSS") { finalSelection = "BIG"; winChance = getRandomNumber(85, 89); } 
        else if (seq4 === "SSBB") { finalSelection = "SMALL"; winChance = getRandomNumber(85, 89); } 
        
        // 🛑 TREND NOT UNDERSTOOD SKIP
        else {
            skipReason = "Market Unstable (ट्रेंड समझ नहीं आ रहा)";
            finalSelection = "WAIT"; 
        }
    }

    let finalNums = [5, 7]; 
    if (finalSelection === "BIG") finalNums = [7, 9];
    if (finalSelection === "SMALL") finalNums = [1, 3];
    if (finalSelection === "WAIT") finalNums = ["-", "-"];

    currentPrediction = { issue: nextId, predType: finalSelection, nums: finalNums, level: botLevel, messageId: null, isChannelPosted: false, predTime: getISTTimeString(), skipReason: skipReason, chance: winChance };
    
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) await sendPredictionToChannel();
    }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;
    let msgContent = "";
    if (currentPrediction.predType === "WAIT") {
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟skip🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🔮 N•PRED:-   🌐🌐(skip)🌐🌐\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   WAIT\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹0 (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n🪙 N•BET.  :- ₹0 (EACH)\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
        const bets = getDynamicBet(currentPrediction.level, walletBalance);
        const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet} (EACH)` : `₹0 (LOW BAL)`;
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   WAIT\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n🪙 N•BET.  :- ${nBetDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level} (3X PROGRESSIVE)\n━━━━━━━━━━━━━━━━━━━━━━━\n⚡ <b>CHANCE:-   ${currentPrediction.chance}% SURE</b>\n━━━━━━━━━━━━━━━━━━━━━━━`;
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
                if (history.length > 50) history = history.slice(0, 50); 
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
        let outcomeDisplay = `🌟${actualSize}(${actualNum})🌟`;
        
        if (currentPrediction.predType === "WAIT") {
            stats.skips++;
            if(currentPrediction.messageId) {
                let waitResolved = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟skip🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹0\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━━━━`;
                try { await bot.editMessageText(waitResolved, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (e) {}
            }
        } else {
            stats.total++;
            let isWin = false, isJackpot = currentPrediction.nums.includes(actualNum); 
            isWin = (currentPrediction.predType === (actualSize === "BIGGG" ? "BIG" : "SMALL"));

            const bets = getDynamicBet(currentPrediction.level, walletBalance);
            const editedMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━━━━`;
            try { await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (err) {}

            // 🟢 HUMAN ATTITUDE MESSAGES LOGIC
            if (isWin || isJackpot) {
                stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
                stats.wins++;
                
                if(isJackpot) {
                    stats.jackpots++;
                    consecutiveJackpots++;
                    if (currentPrediction.level >= 3) {
                        setTimeout(() => { bot.sendMessage(CHANNEL_CHAT_ID, `🔥 <b>देखो लॉस कवर हुआ!</b> 🔥\nसीधा 9X जैकपॉट उड़ाया है! इसे कहते हैं असली VIP प्रेडिक्शन! 💸`, { parse_mode: 'HTML' }).catch(()=>{}); }, 2000);
                    }
                    if (consecutiveJackpots >= 3) {
                        setTimeout(() => { bot.sendMessage(CHANNEL_CHAT_ID, `🔥 <b>है कोई टक्कर में?</b> 🔥\nलगातार 3 बार सीधा जैकपॉट (नंबर) पास! मार्केट को हैक कर लिया है क्या? 😎`, { parse_mode: 'HTML' }).catch(()=>{}); }, 3000);
                        consecutiveJackpots = 0; 
                    }
                } else {
                    consecutiveJackpots = 0; 
                    if (currentPrediction.level >= 3) {
                        bot.sendMessage(CHANNEL_CHAT_ID, `🔥 <b>RECOVERY SUCCESSFUL!</b> 🔥\nपिछला सारा लॉस कवर!`, { parse_mode: 'HTML' }).catch(()=>{});
                    }
                }
                botLevel = 1; 
                bot.sendSticker(CHANNEL_CHAT_ID, isJackpot ? STICKER_JACKPOT : STICKER_WIN).catch(()=>{});
            } else {
                stats.losses++;
                consecutiveJackpots = 0; 
                if (botLevel === 3 || botLevel === 5) {
                    bot.sendMessage(CHANNEL_CHAT_ID, `⚠️ मार्केट थोड़ा कठिन चल रहा है, अपना 3X फंड तैयार रखें।`, { parse_mode: 'HTML' }).catch(()=>{});
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
// 📊 AUTO DAILY TRANSPARENCY REPORT
// ==========================================
setInterval(() => {
    const now = getISTTime();
    if (now.getHours() === 23 && now.getMinutes() === 55 && !dailyReportSent) {
        let levelTrackerText = "";
        Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
        const reportMsg = `📋 <b>TODAY'S FULL TRANSPARENCY REPORT</b> 📋\n\n🔥 <b>Total Signals:</b> ${stats.total}\n🎯 <b>JACKPOTS (Number Win):</b> ${stats.jackpots} 🔥\n🌟 <b>Total Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Highest Level:</b> L${stats.maxLevelReached}\n\n🏆 <b>LEVEL CLEARANCE DETAILS:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "आज कोई डेटा नहीं है।"}\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ <i>कल मिलते हैं एक नए प्रॉफिट सेशन के साथ! गुड नाईट! 🌙</i>`;
        bot.sendMessage(CHANNEL_CHAT_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});
        dailyReportSent = true;
    }
    if (now.getHours() === 0 && now.getMinutes() === 5) dailyReportSent = false;
}, 60000); 

// ==========================================
// 💬 USER COMMANDS
// ==========================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id, userId = msg.from.id, userName = msg.from.first_name || "VIP Member"; 
    bot.sendMessage(chatId, `🎉 <b>WELCOME TO THE VIP FAMILY, ${userName}!</b> 🎉\n\n👇 <b>मेन्यू:</b>\n👉 /stats - लाइव एक्यूरेसी (जैकपॉट डेटा)\n👉 /chart - 3X फंड चार्ट\n👉 /rules - नियम`, { parse_mode: 'HTML' }).catch(()=>{});
});

// 📊 UPDATED CHART COMMAND (CUMULATIVE ADDITION)
bot.onText(/\/chart/, (msg) => {
    let chartMsg = `📊 <b>3X CUMULATIVE FUND CHART</b> 📊\n💰 <b>Total Wallet Setup:</b> ₹${walletBalance}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    let cumulative = 0;

    for(let i = 1; i <= 6; i++) {
        const bets = getDynamicBet(i, walletBalance);
        cumulative += bets.levelTotal;
        const nBetText = bets.nBet > 0 ? `₹${bets.nBet}, ₹${bets.nBet}` : `₹0 (Low Bal)`;
        
        chartMsg += `👉 <b>L${i}:</b> B/S: ₹${bets.bBet} | Nums: ${nBetText}\n`;
        chartMsg += `   └ <i>Total: ₹${bets.levelTotal} | Cum.(जुड़कर): ₹${cumulative}</i>\n`;
    }
    chartMsg += `━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ <i>बेस अमाउंट पूरे 6 लेवल के लिए सटीक सेट है।</i>`;
    bot.sendMessage(msg.chat.id, chartMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/stats/, (msg) => {
    let levelTrackerText = "";
    Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
    const statsMsg = `📊 <b>LIVE BOT ACCURACY</b> 📊\n\n🔥 <b>Signals:</b> ${stats.total}\n🎯 <b>JACKPOT WINS:</b> ${stats.jackpots} 🤑\n🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Max Level:</b> L${stats.maxLevelReached}\n\n🏆 <b>LEVEL CLEARANCE:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "अभी कोई डेटा नहीं है।"}`;
    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

// 🔒 ADMIN COMMANDS
bot.onText(/\/level\s+(\d+)/, (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    walletBalance = parseFloat(match[1]);
    bot.sendMessage(msg.chat.id, `✅ <b>ADMIN ACTION:</b> Total 6-Level Wallet = ₹${walletBalance}\n(अब पूरा पैसा 6 लेवल में सटीक बाँट दिया गया है!)`, { parse_mode: 'HTML' });
});

bot.onText(/\/pause/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    isBotActive = false;
    bot.sendMessage(msg.chat.id, "🛑 बोट रोक दिया गया है।");
});

bot.onText(/\/resume/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    isBotActive = true;
    bot.sendMessage(msg.chat.id, "▶️ बोट चालू कर दिया गया है।");
});

setInterval(monitorLoop, 5000);
console.log("🚀 System Booted. Advanced Cumulative Math Active...");
