const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const GoalFollow = require('mineflayer-pathfinder').goals.GoalFollow;
const GoalBlock = require('mineflayer-pathfinder').goals.GoalBlock;
const autoeat = require('mineflayer-auto-eat').plugin;
const pvp = require('mineflayer-pvp').plugin; 

// =========================================================================
// ⚠️ 1. AYARLAR: LÜTFEN SADECE AŞAĞIDAKİ ÜÇ BİLGİYİ DOLDURUN
// =========================================================================

const SUNUCU_ADRESI = 'SUNUCU_IPSI_BURAYA_GELECEK'; // Örnek: 'oyun.sunucum.com'
const BOT_VERSION = 'SUNUCU_SURUMU_BURAYA_GELECEK'; // Örnek: '1.20.4'
const MAIN_PLAYER_NAME = 'LUTFEN_KENDI_OYUNCU_ADINIZI_GIRIN'; // KORUNACAK KİŞİ ADI

// SİZİN TEK HESAP BİLGİNİZ
const BOT_HESABI_EMAIL = 'e21309094@gmail.com'; 
const BOT_HESABI_SIFRE = 'enes1357924680';

// DİNAMİK KOORDİNATLAR
let KAPI_KOORDINAT = null; // /kapı ayarla ile botun nöbet tutacağı yer

// =========================================================================
// 2. BOT DURUM YÖNETİMİ
// =========================================================================

const STATE = {
    FOLLOWING: 'takip',
    GUARDING_GATE: 'kapinobeti',
    FIGHTING: 'savunma'
};

let current_state = STATE.FOLLOWING;

// =========================================================================
// 3. ÇEKİRDEK GÖREVLER
// =========================================================================

// En iyi silahı kuşanma
function equipBestWeapon(bot) {
    // RAM optimizasyonu için NBT okuma kaldırılmıştır.
    const bestWeapon = bot.inventory.items().reduce((best, item) => {
        if (!item || (!item.name.includes('sword') && !item.name.includes('axe'))) return best;
        return item; 
    }, null);

    if (bestWeapon) bot.equip(bestWeapon, 'hand');
}

// Oyuncuyu Takip Etme ve Koruma
function startFollowing(bot) {
    if (current_state !== STATE.FOLLOWING) {
        bot.pvp.stop();
        bot.pathfinder.stop();
    }
    current_state = STATE.FOLLOWING;
    bot.chat('Sizi takip modundayım.');
    
    // Oyuncuyu bul
    const player = bot.players[MAIN_PLAYER_NAME]?.entity;
    if (player) {
        // 5 blok mesafeden takip et
        bot.pathfinder.setGoal(new GoalFollow(player, 5), true);
    } else {
        // Oyuncu yoksa kapı nöbetine geç
        bot.chat('Kullanıcı sunucuda değil. Kapı nöbetine geçiyorum.');
        startGateGuard(bot);
    }
}

// Kapı Nöbeti Modu
function startGateGuard(bot) {
    if (!KAPI_KOORDINAT) {
        bot.chat('HATA: Kapı koordinatları ayarlanmamış. Takibe dönüyorum.');
        startFollowing(bot); 
        return;
    }
    
    current_state = STATE.GUARDING_GATE;
    bot.pvp.stop();
    bot.chat('Kapı nöbeti görevine başlıyorum.');

    // Kapı koordinatına git ve orada kal
    bot.pathfinder.setGoal(new GoalBlock(KAPI_KOORDINAT.x, KAPI_KOORDINAT.y, KAPI_KOORDINAT.z), true);
}


// =========================================================================
// 4. BOT BAŞLATMA VE OLAY YÖNETİMİ
// =========================================================================

const bot = mineflayer.createBot({
    host: SUNUCU_ADRESI,
    port: 25565,
    username: BOT_HESABI_EMAIL,
    password: BOT_HESABI_SIFRE,
    auth: 'microsoft',
    version: BOT_VERSION
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(autoeat);
bot.loadPlugin(pvp);

bot.on('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);
    
    bot.chat(`[Savunma Botu] Hazır! Sayın ${MAIN_PLAYER_NAME}, sizi bekliyorum.`);
    equipBestWeapon(bot);
    startFollowing(bot); 
});

// PvP: Düşman Görünce Saldırı
bot.on('physic', () => {
    // Sadece takip/nöbet modundayken otomatik saldırı
    if (current_state === STATE.FOLLOWING || current_state === STATE.GUARDING_GATE) {
        const hedef = bot.nearestEntity((entity) => {
            // Mob'a veya korunan kişi dışındaki oyuncuya saldır
            return entity.type === 'mob' || (entity.type === 'player' && entity.username !== MAIN_PLAYER_NAME && bot.pvp.target === null);
        });

        if (hedef) {
            bot.pvp.attack(hedef);
            current_state = STATE.FIGHTING;
        } else if (bot.pvp.target && !bot.pvp.target.isValid) {
            bot.pvp.stop();
            // Savaşı bitirince ana göreve dön
            if (current_state === STATE.FIGHTING) startFollowing(bot);
        }
    }
});

// Can ve Açlık Kontrolü (Otonom Hayatta Kalma)
bot.on('health', () => {
    if (bot.health < 10 && current_state !== STATE.FIGHTING) {
        bot.chat(`Yardım! Canım çok az: ${Math.floor(bot.health)}`);
    }
});

// Chat Komutları (Mod Değiştirme)
bot.on('chat', (username, message) => {
    if (username !== MAIN_PLAYER_NAME) return;

    const msg = message.toLowerCase();
    
    if (msg.includes('kapı ayarla')) {
        const pos = bot.entity.position; 
        KAPI_KOORDINAT = pos.clone();
        bot.chat(`[AYAR] Kapı nöbet koordinatı ayarlandı.`);
        startGateGuard(bot); // Ayarlayınca hemen nöbete başla
    } else if (msg.includes('takip et')) {
        startFollowing(bot);
    } 
});

// Hata ve Yeniden Bağlanma Yönetimi (7/24 Fix)
bot.on('end', () => {
    console.log('[ÇIKTI] Yeniden bağlanmaya çalışılıyor...');
    setTimeout(() => process.exit(1), 15000); 
});

// Render'ın sürekli çalıştığını gösteren HTTP sunucusu
const http = require('http');
http.createServer((req, res) => {
  res.write('Savunma botu calisiyor...');
  res.end();
}).listen(process.env.PORT || 3000);
