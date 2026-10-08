// Helper: ícone SVG inline (ICONS vem do icons.js)
function ic(name, cls = '') {
    return `<i class="icon ${cls}">${ICONS[name] || ''}</i>`;
}

// Mapa de ícones das criptos para um seletor visual
const COIN_ICONS = {
    btc: 'crypto-icons/btc.svg',
    eth: 'crypto-icons/eth.svg',
    sol: 'crypto-icons/sol.svg',
    bnb: 'crypto-icons/bnb.svg',
    usdt: 'crypto-icons/usdt.svg',
    mmt: 'crypto-icons/moon-token.png',
};

function coinIcon(coin, size = 20) {
    const src = COIN_ICONS[coin] || COIN_ICONS.mmt;
    return `<img src="${src}" alt="${coin.toUpperCase()}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:contain">`;
}

// =============================================
// MODAL SYSTEM
// =============================================
function openModal(title, bodyHTML, footerHTML = '') {
    // Remove TODOS os overlays antigos (sem animação) pra não duplicar ids no DOM
    document.querySelectorAll('#modal-overlay').forEach(o => o.remove());
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box glass" id="modal-box">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="icon-btn" id="modal-close-btn">${ic('voltar')}</button>
            </div>
            <div class="modal-body">${bodyHTML}</div>
            ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
        </div>
    `;
    document.getElementById('app-container').appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    return overlay;
}

function closeModal() {
    // Fecha apenas o modal ativo (sem a classe closing); os que já estão fechando terminam sozinhos
    document.querySelectorAll('#modal-overlay:not(.closing)').forEach(existing => {
        existing.classList.remove('open');
        existing.classList.add('closing');
        setTimeout(() => existing.remove(), 300);
    });
}

// --- State Management ---
const INITIAL_STATE = {
    usdBalance: 0.00,
    crypto: {
        btc: 0.00000000,
        mmt: 1000.00, // Moon Mining Token
        eth: 0.000000,
        sol: 0.000,
        bnb: 0.0000,
        usdt: 0.00,
    },
    ownedMiners: [],
    generators: [],
    vipLevel: 'Bronze I',
    profile: { name: 'Minerador', email: '', banner: 0, avatar: 0 },
    freeGenAvailable: false,
    freeGenClaimed: false,
    listings: [],
    lastSpin: 0
};

let state = JSON.parse(localStorage.getItem('moonMiningState')) || INITIAL_STATE;

// Reset versionado: versão 2 recomeça do zero (só 100 MMT) para o saldo condizer com as regras novas
const STATE_VERSION = 3;
if (localStorage.getItem('moonMiningVersion') !== String(STATE_VERSION)) {
    state = JSON.parse(JSON.stringify(INITIAL_STATE));
    localStorage.setItem('moonMiningVersion', String(STATE_VERSION));
    localStorage.setItem('moonMiningState', JSON.stringify(state));
}

// Migração de saves antigos (GMT -> MMT, novos campos)
if (state.crypto && state.crypto.mmt === undefined && state.crypto.gmt !== undefined) {
    state.crypto.mmt = state.crypto.gmt;
    delete state.crypto.gmt;
}
state.crypto = Object.assign({ btc: 0, mmt: 1000, eth: 0, sol: 0, bnb: 0, usdt: 0 }, state.crypto || {});
state.generators = state.generators || [];
state.profile = Object.assign({ name: 'Minerador', email: '', banner: 0, avatar: 0 }, state.profile || {});
state.freeGenAvailable = state.freeGenAvailable || false;
state.freeGenClaimed = state.freeGenClaimed || false;
state.listings = state.listings || [];
state.lastSpin = state.lastSpin || 0;
state.ownedMiners.forEach(m => { if (!m.coin) m.coin = 'btc'; m.components = m.components || {}; m.componentsValue = m.componentsValue || 0; if (!m.img) m.img = minerImgFor(m.id); });
state.listings.forEach(l => { if (!l.img) l.img = minerImgFor(l.id); });

function minerImgFor(id) {
    if (id === 'miner_3' || id === 'mm_2') return 'assets/mineradoras/mineradora3.png';
    if (id === 'miner_2' || id === 'mm_1') return 'assets/mineradoras/mineradora2.png';
    return 'assets/mineradoras/mineradora1.png';
}

// Market Items (Mock Data)
const marketMiners = [
    {
        id: 'miner_1',
        name: 'The Mine Box #267404',
        power: 3, // TH
        efficiency: 20, // W/TH
        roi: 56.98, // %
        priceMMT: 80.00,
        oldPriceMMT: 120.00,
        img: 'assets/mineradoras/mineradora1.png',
    },
    {
        id: 'miner_2',
        name: 'Pro Rack #883921',
        power: 10,
        efficiency: 22,
        roi: 62.40,
        priceMMT: 350.00,
        oldPriceMMT: 400.00,
        img: 'assets/mineradoras/mineradora2.png',
    },
    {
        id: 'miner_3',
        name: 'Elite ASIC #10923',
        power: 25,
        efficiency: 18,
        roi: 75.10,
        priceMMT: 800.00,
        oldPriceMMT: 950.00,
        img: 'assets/mineradoras/mineradora3.png',
    }
];

// Constants for simulation
const PRICES = {
    btc: 64230.00,
    eth: 3450.00,
    sol: 145.00,
    bnb: 580.00,
    usdt: 1.00,
    mmt: 0.32,
};
const BTC_PRICE = PRICES.btc;
const MMT_PRICE = PRICES.mmt;
// Cada TH gera ~$0.086/dia em cripto — taxa bem mais realista.
// A quantidade de tokens depende do preço da moeda escolhida (regra da economia).
const USD_REWARD_PER_TH_PER_SEC = 0.000001;

// --- DOM Elements ---
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const pageTitle = document.querySelector('.page-title');

// Displays
const elTotalBalance = document.getElementById('display-total-balance');
const elTotalPower = document.getElementById('display-total-power');
const elWalletBalance = document.getElementById('wallet-total-balance');
const elFarmPower = document.getElementById('farm-power');
const elBtcBalance = document.getElementById('asset-btc-balance');
const elBtcUsd = document.getElementById('asset-btc-usd');
const elMmtBalance = document.getElementById('asset-mmt-balance');
const elMmtUsd = document.getElementById('asset-mmt-usd');
const elEthBalance = document.getElementById('asset-eth-balance');
const elEthUsd = document.getElementById('asset-eth-usd');
const elUsdtBalance = document.getElementById('asset-usdt-balance');
const elUsdtUsd = document.getElementById('asset-usdt-usd');
const elBnbBalance = document.getElementById('asset-bnb-balance');
const elBnbUsd = document.getElementById('asset-bnb-usd');
const elSolBalance = document.getElementById('asset-sol-balance');
const elSolUsd = document.getElementById('asset-sol-usd');
const elFarmEnergy = document.getElementById('farm-energy');
const elEnergyBannerText = document.getElementById('energy-banner-text');
const elEnergyBannerStatus = document.getElementById('energy-banner-status');

const marketMinerList = document.getElementById('market-miner-list');
const ownedMinersList = document.getElementById('owned-miners-list');
const emptyMinersState = document.getElementById('empty-miners');
const toastContainer = document.getElementById('toast-container');

// --- Initialization ---
function init() {
    renderMarket();
    updateUI();
    setupEventListeners();
    startMiningLoop();
}

function saveState() {
    localStorage.setItem('moonMiningState', JSON.stringify(state));
}

// --- UI Updates ---
function updateUI() {
    // Calculate total USD value (todos os ativos)
    const assetUsd = {};
    let cryptoUsdTotal = 0;
    Object.keys(PRICES).forEach(coin => {
        const v = (state.crypto[coin] || 0) * PRICES[coin];
        assetUsd[coin] = v;
        cryptoUsdTotal += v;
    });
    const totalUsd = state.usdBalance + cryptoUsdTotal;

    // Calculate total power
    const totalPower = state.ownedMiners.reduce((sum, miner) => sum + miner.power, 0);

    // Energy
    const consumption = getTotalConsumption();
    const capacity = getEnergyCapacity();
    const factor = getEnergyFactor();

    // Update Home & Wallet
    const formattedTotal = `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elTotalBalance.textContent = formattedTotal;
    elWalletBalance.textContent = formattedTotal;
    elTotalPower.textContent = `${totalPower.toFixed(2)} TH`;
    elFarmPower.textContent = `${totalPower.toFixed(2)} TH`;

    // Update Assets
    elBtcBalance.textContent = (state.crypto.btc || 0).toFixed(8);
    elBtcUsd.textContent = `$${assetUsd.btc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    elMmtBalance.textContent = (state.crypto.mmt || 0).toFixed(2);
    elMmtUsd.textContent = `$${assetUsd.mmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (elEthBalance) {
        elEthBalance.textContent = (state.crypto.eth || 0).toFixed(6);
        elEthUsd.textContent = `$${assetUsd.eth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        elUsdtBalance.textContent = (state.crypto.usdt || 0).toFixed(2);
        elUsdtUsd.textContent = `$${assetUsd.usdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        elBnbBalance.textContent = (state.crypto.bnb || 0).toFixed(4);
        elBnbUsd.textContent = `$${assetUsd.bnb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        elSolBalance.textContent = (state.crypto.sol || 0).toFixed(4);
        elSolUsd.textContent = `$${assetUsd.sol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Energia na barra da fazenda + banner
    if (elFarmEnergy) elFarmEnergy.textContent = `${Math.round(capacity)}/${Math.round(consumption)} W`;
    if (elEnergyBannerText) {
        const status = factor >= 1 ? 'Estável' : (factor >= 0.7 ? 'Instável' : 'Crítica');
        elEnergyBannerText.textContent = `${Math.round(capacity)}W disponíveis · ${Math.round(consumption)}W em uso · produção a ${Math.round(factor * 100)}%`;
        if (elEnergyBannerStatus) {
            elEnergyBannerStatus.textContent = `— ${status}`;
            elEnergyBannerStatus.style.color = factor >= 1 ? 'var(--status-green)' : (factor >= 0.7 ? '#f59e0b' : '#ef4444');
        }
    }

    // VIP + Perfil
    const vip = getVipInfo();
    state.vipLevel = vip.name;
    const vipHome = document.getElementById('display-vip-level');
    if (vipHome) vipHome.textContent = vip.name;
    const vipBadge = document.getElementById('profile-vip-badge');
    if (vipBadge) vipBadge.innerHTML = `${ic(vip.icon, 'text-purple')} ${vip.name}`;
    const vipHomeIcon = document.getElementById('home-vip-icon');
    if (vipHomeIcon) { vipHomeIcon.setAttribute('data-icon', vip.icon); }
    const vipStatIcon = document.getElementById('profile-vip-icon');
    if (vipStatIcon) { vipStatIcon.setAttribute('data-icon', vip.icon); }
    if (window.injectIcons) window.injectIcons();
    const profName = document.getElementById('profile-name');
    if (profName) profName.textContent = state.profile.name || 'Minerador';
    const statMiners = document.getElementById('profile-stat-miners');
    if (statMiners) statMiners.textContent = state.ownedMiners.length;
    const statPower = document.getElementById('profile-stat-power');
    if (statPower) statPower.textContent = `${totalPower.toFixed(1)} TH`;
    const statEnergy = document.getElementById('profile-stat-energy');
    if (statEnergy) statEnergy.textContent = `${Math.round(capacity)} W`;
    const statVip = document.getElementById('profile-stat-vip');
    if (statVip) statVip.textContent = vip.name;
    const banner = document.getElementById('profile-banner');
    if (banner) {
        banner.style.background = `url('assets/banner/banner${(state.profile.banner % 3) + 1}.jpeg') center/cover no-repeat`;
    }
    const avatar = document.querySelector('#view-profile .profile-avatar');
    if (avatar) {
        avatar.innerHTML = `<img src="assets/perfil/perfil${(state.profile.avatar % 3) + 1}.jpeg" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    }

    renderOwnedMiners();
}

function openListingsModal() {
    const items = (state.listings || []).map(l => `
        <div class="glass" style="padding:14px;border-radius:12px;margin-bottom:10px;display:flex;gap:12px;align-items:center">
            <img src="${l.img || 'assets/mineradoras/mineradora1.png'}" alt="${l.name}" style="width:56px;height:56px;border-radius:10px;object-fit:cover;flex-shrink:0">
            <div style="flex:1">
            <h4 style="margin-bottom:4px">${l.name}</h4>
            <p class="text-secondary" style="font-size:12px">${l.power} TH · ${l.efficiency} W/TH · gerava ${(l.coin || 'btc').toUpperCase()}</p>
            <p style="font-size:14px;margin:6px 0">À venda por <strong class="text-green">${l.salePrice} MMT</strong> <span class="text-secondary" style="font-size:11px">(17% abaixo do preço original)</span></p>
            <div style="display:flex;gap:8px">
                <button class="btn-primary" style="flex:1" onclick="sellListing(${l.instanceId})">Vender</button>
                <button class="btn-primary" style="flex:1;background:transparent;border:1px solid rgba(255,255,255,0.2)" onclick="cancelListing(${l.instanceId})">Cancelar</button>
            </div>
            </div>
        </div>`).join('');
    openModal('Os meus listings',
        state.listings && state.listings.length > 0
            ? items
            : `<div style="text-align:center;padding:20px 0">
                <div style="font-size:48px;margin-bottom:16px">${ic('config','text-purple')}</div>
                <h3 style="margin-bottom:8px">Nenhum listing ativo</h3>
                <p class="text-secondary">Seus mineradores listados para venda aparecerão aqui.</p>
            </div>`,
        `<button class="btn-primary" onclick="switchView('miners');closeModal()">Ver Meus Mineradores</button>`
    );
}

window.listMiner = function (instanceId) {
    const idx = state.ownedMiners.findIndex(m => m.instanceId == instanceId);
    if (idx < 0) return;
    const m = state.ownedMiners[idx];
    const salePrice = Math.round((m.priceMMT || m.power * 40) * 0.83);
    state.listings.push({ ...m, salePrice });
    state.ownedMiners.splice(idx, 1);
    saveState(); updateUI(); closeModal();
    showToast(`${m.name} listado por ${salePrice} MMT. Conclua a venda em "Os meus listings".`, 'success');
}

window.sellListing = function (instanceId) {
    const idx = (state.listings || []).findIndex(l => l.instanceId == instanceId);
    if (idx < 0) return;
    const l = state.listings[idx];
    const salePrice = l.salePrice || Math.round((l.priceMMT || (l.power || 1) * 40) * 0.83);
    state.crypto.mmt += salePrice;
    state.listings.splice(idx, 1);
    saveState(); updateUI(); openListingsModal();
    showToast(`${l.name} vendido! +${salePrice} MMT`, 'success');
}

window.cancelListing = function (instanceId) {
    const idx = (state.listings || []).findIndex(l => l.instanceId == instanceId);
    if (idx < 0) return;
    const l = state.listings[idx];
    delete l.salePrice;
    state.ownedMiners.push(l);
    state.listings.splice(idx, 1);
    saveState(); updateUI(); openListingsModal();
    showToast(`${l.name} voltou para sua fazenda.`, 'info');
}

const BANNER_PRESETS = [
    'linear-gradient(135deg,#6C38FF,#00B0FF)',
    'linear-gradient(135deg,#f43f5e,#f59e0b)',
    'linear-gradient(135deg,#10b981,#06b6d4)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)',
];

const VIP_LEVELS = [
    { name: 'Bronze I', min: 0, icon: 'patente_bronze' },
    { name: 'Bronze II', min: 10, icon: 'patente_prata' },
    { name: 'Silver I', min: 30, icon: 'patente_ouro' },
    { name: 'Silver II', min: 75, icon: 'patente_platina' },
    { name: 'Gold I', min: 150, icon: 'patente_platina' },
    { name: 'Gold II', min: 400, icon: 'patente_diamante' },
    { name: 'Diamond', min: 1000, icon: 'patente_diamante' },
];

function getVipInfo() {
    const score = state.ownedMiners.reduce((s, m) => s + (m.power || 0), 0);
    let idx = 0;
    VIP_LEVELS.forEach((l, i) => { if (score >= l.min) idx = i; });
    const current = VIP_LEVELS[idx];
    const next = VIP_LEVELS[idx + 1] || null;
    const pct = next ? Math.min(100, Math.round((score - current.min) / (next.min - current.min) * 100)) : 100;
    return { name: current.name, icon: current.icon, next, pct, score };
}

function ensureMMT(needed) {
    if (state.crypto.mmt >= needed) return true;
    const missing = needed - state.crypto.mmt;
    const usdCost = missing * MMT_PRICE;
    if (state.usdBalance >= usdCost) {
        state.usdBalance -= usdCost;
        state.crypto.mmt += missing;
        showToast(`Convertidos $${usdCost.toFixed(2)} em ${missing.toFixed(2)} MMT automaticamente.`, 'info');
        return true;
    }
    showToast(`MMT insuficiente. Faltam ${missing.toFixed(2)} MMT (≈ $${usdCost.toFixed(2)}).`, 'error');
    return false;
}

// --- Energia ---
function getTotalConsumption() {
    return state.ownedMiners.reduce((sum, m) => sum + (m.power * m.efficiency), 0);
}

function getEnergyCapacity() {
    return state.generators.reduce((sum, g) => sum + g.output, 0);
}

function getEnergyFactor() {
    const consumption = getTotalConsumption();
    const capacity = getEnergyCapacity();
    if (consumption === 0) return 1;
    if (capacity === 0) return 0.15; // só "funciona" no limite
    return Math.min(1, capacity / consumption);
}

// --- Render Functions ---
function renderMarket() {
    renderMarketItems(marketMiners);
}

function renderOwnedMiners() {
    // Clear list but keep empty state element
    const emptyStateHTML = emptyMinersState.outerHTML;
    ownedMinersList.innerHTML = '';

    if (state.ownedMiners.length === 0) {
        ownedMinersList.innerHTML = emptyStateHTML;
        document.getElementById('empty-miners').style.display = 'flex';
        return;
    }

    state.ownedMiners.forEach((miner, index) => {
        const factor = getEnergyFactor();
        const usdPerDay = (miner.power || 0) * USD_REWARD_PER_TH_PER_SEC * 86400 * factor;
        const coin = miner.coin || 'btc';
        const tpd = usdPerDay / (PRICES[coin] || PRICES.btc);
        const tpdStr = tpd >= 100 ? tpd.toFixed(2) : tpd >= 1 ? tpd.toFixed(4) : tpd.toFixed(8);
        const item = document.createElement('div');
        item.className = 'owned-miner-card glass';
        item.style.cursor = 'pointer';
        item.style.animationDelay = `${index * 70}ms`;
        item.setAttribute('onclick', `openMinerDetail(${miner.instanceId})`);
        item.innerHTML = `
            <div class="owned-miner-icon moon-token-owned" style="overflow:hidden;border-radius:10px">
                <img src="${miner.img || 'assets/mineradoras/mineradora1.png'}" alt="${miner.name}" class="owned-moon-img" style="object-fit:cover">
            </div>
            <div class="owned-miner-details">
                <h4>${miner.name}</h4>
                <div style="display: flex; justify-content: space-between; font-size: 12px;" class="text-secondary">
                    <span>${miner.power} TH · ${miner.efficiency} W/TH · gerando ${coinIcon(coin, 14)} <strong>${coin.toUpperCase()}</strong></span>
                    <span class="text-green">Active</span>
                </div>
                <div style="font-size:12px;margin:2px 0" class="text-secondary">~${tpdStr} ${coin.toUpperCase()}/dia · ${ic('earn', 'text-purple')} ${miner.componentsValue || 0} MMT em componentes</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${100 - (index * 5)}%"></div>
                </div>
            </div>
        `;
        ownedMinersList.appendChild(item);
    });
}

// --- Actions ---
window.buyMiner = function (minerId, price, name, power, efficiency, roi) {
    // Support both old format (object lookup) and new format (inline params)
    let minerTemplate;
    if (price !== undefined) {
        minerTemplate = { id: minerId, name, power, efficiency, roi, priceMMT: price };
        // Recupera campos extras (type/boost) do catálogo pelo id
        const allItems = Object.values(marketCategories || {}).flat();
        const found = allItems.find(m => m.id === minerId);
        if (found) { minerTemplate.type = found.type; minerTemplate.boost = found.boost; minerTemplate.img = found.img; }
    } else {
        const allItems = Object.values(marketCategories || {}).flat();
        minerTemplate = allItems.find(m => m.id === minerId) || marketMiners.find(m => m.id === minerId);
    }
    if (!minerTemplate) return;

    // Chips de mercadorias: aumentam a potência das mineradoras existentes
    if (minerTemplate.type === 'chip') {
        if (state.ownedMiners.length === 0) { showToast('Compre uma mineradora primeiro!', 'error'); return; }
        if (!ensureMMT(minerTemplate.priceMMT)) return;
        showToast('Instalando chip...', 'info');
        setTimeout(() => {
            state.crypto.mmt -= minerTemplate.priceMMT;
            state.ownedMiners.forEach(m => { m.power = +(m.power + (minerTemplate.boost || 0)).toFixed(1); });
            saveState(); updateUI();
            const activeTab = document.querySelector('.market-tabs .tab-btn.active');
            if (activeTab) activeTab.click();
            showToast(`+${minerTemplate.boost} TH em cada mineradora!`, 'success');
        }, 1200);
        return;
    }

    if (ensureMMT(minerTemplate.priceMMT)) {
        showToast('Processando transação...', 'info');
        const buyBtn = event.target;
        buyBtn.innerHTML = '<span class="spinner"></span>';
        buyBtn.disabled = true;

        setTimeout(() => {
            let freeMsg = '';
            state.crypto.mmt -= minerTemplate.priceMMT;
            state.ownedMiners.push({ ...minerTemplate, coin: 'btc', components: {}, instanceId: Date.now() });
            // Primeira compra da básica libera um gerador grátis para COLETAR no modal de energia
            if (minerTemplate.id === 'miner_1' && !state.freeGenClaimed && !state.freeGenAvailable) {
                state.freeGenAvailable = true;
                freeMsg = ' Gerador grátis disponível para coletar na Energia!';
            }
            saveState();
            updateUI();
            // Re-render current tab
            const activeTab = document.querySelector('.market-tabs .tab-btn.active');
            const activeSub = document.querySelector('.market-subtabs .subtab-btn.active');
            if (activeTab) activeTab.click();
            showToast(`${minerTemplate.name} comprado!${freeMsg}`, 'success');
        }, 1500);

    } else {
        showToast('MMT insuficiente.', 'error');
    }
}

// --- Simulation Loop ---
function startMiningLoop() {
    setInterval(() => {
        const factor = getEnergyFactor();
        let produced = false;
        state.ownedMiners.forEach(miner => {
            const power = miner.power || 0;
            if (power <= 0) return;
            const usdReward = power * USD_REWARD_PER_TH_PER_SEC * factor;
            const price = PRICES[miner.coin] || PRICES.btc;
            const coin = miner.coin || 'btc';
            state.crypto[coin] = (state.crypto[coin] || 0) + (usdReward / price);
            produced = true;
        });
        if (produced) {
            // Atualiza só os elementos que mudam com frequência
            elBtcBalance.textContent = (state.crypto.btc || 0).toFixed(8);
            elBtcUsd.textContent = `$${((state.crypto.btc || 0) * PRICES.btc).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            elMmtBalance.textContent = (state.crypto.mmt || 0).toFixed(2);
            elMmtUsd.textContent = `$${((state.crypto.mmt || 0) * PRICES.mmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (elEthBalance) {
                elEthBalance.textContent = (state.crypto.eth || 0).toFixed(6);
                elEthUsd.textContent = `$${((state.crypto.eth || 0) * PRICES.eth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                elUsdtBalance.textContent = (state.crypto.usdt || 0).toFixed(2);
                elUsdtUsd.textContent = `$${((state.crypto.usdt || 0) * PRICES.usdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                elBnbBalance.textContent = (state.crypto.bnb || 0).toFixed(4);
                elBnbUsd.textContent = `$${((state.crypto.bnb || 0) * PRICES.bnb).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                elSolBalance.textContent = (state.crypto.sol || 0).toFixed(4);
                elSolUsd.textContent = `$${((state.crypto.sol || 0) * PRICES.sol).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }

            let cryptoUsdTotal = 0;
            Object.keys(PRICES).forEach(c => cryptoUsdTotal += (state.crypto[c] || 0) * PRICES[c]);
            const formattedTotal = `$${(state.usdBalance + cryptoUsdTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            elTotalBalance.textContent = formattedTotal;
            elWalletBalance.textContent = formattedTotal;

            // Save periodically
            if (Math.random() < 0.1) saveState();
        }
    }, 1000);
}

// --- Navigation & Listeners ---
function setupEventListeners() {
    // Bottom Nav
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            switchView(target);
        });
    });

    // Sidebar
    document.getElementById('open-sidebar').addEventListener('click', () => toggleSidebar(true));
    document.getElementById('close-sidebar').addEventListener('click', () => toggleSidebar(false));
    sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

    // Sidebar nav links — full handler
    document.querySelectorAll('.sidebar-nav .sidebar-link').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            const tab = item.dataset.tab;
            toggleSidebar(false);

            if (view === 'miners') { switchView('miners'); return; }
            if (view === 'wallet') { switchView('wallet'); return; }
            if (view === 'profile') { switchView('profile'); return; }
            if (view === 'home') { switchView('home'); return; }

            if (view === 'market') {
                switchView('market');
                // If a specific tab was requested, activate it after a short delay
                if (tab) {
                    setTimeout(() => {
                        const tabs = document.querySelectorAll('.market-tabs .tab-btn');
                        tabs.forEach(t => {
                            if (t.textContent.trim() === tab) t.click();
                        });
                    }, 50);
                }
                return;
            }

            // Special modal-based views
            if (view === 'bonus') { openBonusModal(); return; }
            if (view === 'earn') { openEarnModal(); return; }
            if (view === 'payment') { openPaymentModal(); return; }
            if (view === 'instant') { openInstantModal(); return; }
            if (view === 'listings') { openListingsModal(); return; }
        });
    });

    // Sidebar footer buttons
    const langBtn = document.getElementById('sidebar-lang-btn');
    langBtn && langBtn.addEventListener('click', () => {
        showToast('Seleção de idioma em breve!', 'info');
    });
    const themeBtn = document.getElementById('sidebar-theme-btn');
    themeBtn && themeBtn.addEventListener('click', () => {
        showToast('Modo claro em desenvolvimento!', 'info');
    });


    // Olho: mostrar / ocultar saldo
    const btnBalance = document.getElementById('toggle-balance');
    btnBalance.addEventListener('click', () => {
        const hidden = document.getElementById('app-container').classList.toggle('balance-hidden');
        btnBalance.innerHTML = ic(hidden ? 'olho_fechado' : 'olho_aberto');
    });

    // Coroa: abre o VIP
    const btnVip = document.getElementById('open-vip');
    btnVip && btnVip.addEventListener('click', openVIPModal);

    // Sino: ligar / desligar notificações
    const btnBell = document.getElementById('toggle-notifications');
    let notificationsOn = true;
    btnBell.addEventListener('click', () => {
        notificationsOn = !notificationsOn;
        btnBell.innerHTML = ic(notificationsOn ? 'sino_ligado' : 'sino_desligado');
        showToast(notificationsOn ? 'Notificações ativadas' : 'Notificações desativadas', 'info');
    });

    // ---- HOME Quick Actions ----
    const [btnCriar, btnCarregar, btnEarn, btnReferral] = document.querySelectorAll('#view-home .action-btn');

    btnCriar && btnCriar.addEventListener('click', openCriarModal);
    btnCarregar && btnCarregar.addEventListener('click', openCarregarModal);
    btnEarn && btnEarn.addEventListener('click', openEarnModal);
    btnReferral && btnReferral.addEventListener('click', openReferralModal);

    // Banner: Secure your account
    const securityBanner = document.querySelector('#view-home .banner');
    securityBanner && securityBanner.addEventListener('click', openSecurityModal);

    // Dashboard grid cards
    const gridCards = document.querySelectorAll('#view-home .grid-card');
    if (gridCards[0]) gridCards[0].addEventListener('click', openBonusModal);
    if (gridCards[1]) gridCards[1].addEventListener('click', openEnergyModal);
    if (gridCards[2]) gridCards[2].addEventListener('click', openVIPModal);
    if (gridCards[3]) gridCards[3].addEventListener('click', openCashbackModal);

    // ---- MARKET Tabs ----
    setupMarketTabs();

    // ---- MINERS Action Buttons ----
    const minerActions = document.querySelectorAll('.miners-action-row .icon-btn');
    if (minerActions[0]) minerActions[0].addEventListener('click', openMinerStatsModal);
    if (minerActions[1]) minerActions[1].addEventListener('click', openEnergyModal);
    if (minerActions[2]) minerActions[2].addEventListener('click', () => switchView('market'));
    if (minerActions[3]) minerActions[3].addEventListener('click', openMinerSettingsModal);

    // Banner de energia
    const energyBanner = document.getElementById('energy-banner');
    energyBanner && energyBanner.addEventListener('click', openEnergyModal);

    // ---- WALLET Actions ----
    const [wDeposit, wConvert, wInstant, wSacar] = document.querySelectorAll('#view-wallet .action-btn');
    wDeposit && wDeposit.addEventListener('click', openDepositModal);
    wConvert && wConvert.addEventListener('click', openConvertModal);
    wInstant && wInstant.addEventListener('click', openInstantModal);
    wSacar && wSacar.addEventListener('click', openSacarModal);

    // Stake banner
    const stakeBtn = document.querySelector('#view-wallet .btn-sm');
    stakeBtn && stakeBtn.addEventListener('click', openStakeModal);

    // ---- PROFILE ----
    const editBtn = document.querySelector('#view-profile .profile-header .icon-btn');
    editBtn && editBtn.addEventListener('click', openEditProfileModal);

    const copyIdBtn = document.querySelector('#view-profile .user-id .icon');
    copyIdBtn && (copyIdBtn.style.cursor = 'pointer') && copyIdBtn.addEventListener('click', () => {
        navigator.clipboard.writeText('5df51db2').then(() => showToast('ID copiado!', 'success'));
    });

    const profileMenuItems = document.querySelectorAll('#view-profile .menu-item');
    if (profileMenuItems[0]) profileMenuItems[0].addEventListener('click', openSecurityModal);
    if (profileMenuItems[1]) profileMenuItems[1].addEventListener('click', openPaymentModal);
    if (profileMenuItems[2]) profileMenuItems[2].addEventListener('click', openSupportModal);
    if (profileMenuItems[3]) profileMenuItems[3].addEventListener('click', openFAQModal);
}

// =============================================
// HOME MODALS
// =============================================
function openCriarModal() {
    openModal('Criar Minerador',
        `<p class="text-secondary" style="margin-bottom:20px">Crie um novo minerador personalizado usando seus tokens MMT.</p>
        <label class="modal-label">Nome do Minerador</label>
        <input class="modal-input" id="miner-name-input" placeholder="Ex: My ASIC Pro" />
        <label class="modal-label">Poder de Mineração</label>
        <select class="modal-input" id="miner-power-select">
            <option value="1">1 TH — 10 MMT</option>
            <option value="5">5 TH — 45 MMT</option>
            <option value="10">10 TH — 80 MMT</option>
        </select>`,
        `<button class="btn-primary" id="confirm-criar">Criar Minerador</button>`
    );
    document.getElementById('confirm-criar').addEventListener('click', () => {
        const name = document.getElementById('miner-name-input').value.trim();
        const power = parseInt(document.getElementById('miner-power-select').value);
        const costs = { 1: 10, 5: 45, 10: 80 };
        const cost = costs[power];
        if (!name) { showToast('Digite um nome para o minerador.', 'error'); return; }
        if (state.crypto.mmt < cost) { showToast(`MMT insuficiente. Necessário: ${cost} MMT`, 'error'); return; }
        state.crypto.mmt -= cost;
        state.ownedMiners.push({ id: `custom_${Date.now()}`, name, power, efficiency: 25, roi: 50, priceMMT: cost, coin: 'btc', components: {}, img: 'assets/mineradoras/mineradora1.png', instanceId: Date.now() });
        saveState(); updateUI(); closeModal();
        showToast(`Minerador "${name}" criado com sucesso!`, 'success');
    });
}

function openCarregarModal() {
    openModal('Carregar Conta',
        `<p class="text-secondary" style="margin-bottom:20px">Adicione saldo à sua conta via simulação.</p>
        <label class="modal-label">Valor (USD)</label>
        <input class="modal-input" id="deposit-amount" type="number" placeholder="100.00" min="1" />
        <label class="modal-label">Método</label>
        <select class="modal-input" id="deposit-method">
            <option>Cartão de Crédito</option>
            <option>PIX</option>
            <option>Transferência Bancária</option>
        </select>`,
        `<button class="btn-primary" id="confirm-carregar">Confirmar Depósito</button>`
    );
    document.getElementById('confirm-carregar').addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('deposit-amount').value);
        if (!amount || amount <= 0) { showToast('Digite um valor válido.', 'error'); return; }
        state.usdBalance += amount;
        saveState(); updateUI(); closeModal();
        showToast(`$${amount.toFixed(2)} adicionado com sucesso!`, 'success');
    });
}

function openEarnModal() {
    openModal('Earn — Staking & Rewards',
        `<div class="earn-options">
            <div class="earn-card glass" data-apy="8.5" data-token="BTC">
                <h4>${ic('earn')} Bitcoin Staking</h4>
                <p class="text-green" style="font-size:22px;font-weight:600;">8.5% APY</p>
                <p class="text-secondary">Bloqueio mínimo: 30 dias</p>
            </div>
            <div class="earn-card glass" data-apy="12.69" data-token="MMT">
                <h4>${ic('cpu')} MMT Staking</h4>
                <p class="text-green" style="font-size:22px;font-weight:600;">12.69% APY</p>
                <p class="text-secondary">Bloqueio mínimo: 7 dias</p>
            </div>
        </div>
        <p class="text-secondary" style="margin-top:16px;font-size:12px;">Clique em uma opção para fazer stake.</p>`,
        ''
    );
    document.querySelectorAll('.earn-card').forEach(card => {
        card.addEventListener('click', () => {
            const apy = card.dataset.apy;
            const token = card.dataset.token;
            closeModal();
            showToast(`Stake de ${token} ativado! APY: ${apy}%`, 'success');
        });
    });
}

function openReferralModal() {
    const code = 'MOON-' + Math.random().toString(36).substring(2,8).toUpperCase();
    openModal('Programa de Referral',
        `<div style="text-align:center">
            <p class="text-secondary" style="margin-bottom:16px">Convide amigos e ganhe 10% das compras deles!</p>
            <div class="referral-code-box glass">
                <span style="font-size:22px;font-weight:600;letter-spacing:4px;" id="referral-code">${code}</span>
            </div>
            <p class="text-secondary" style="margin-top:12px;font-size:12px;">Você ganhou: <strong class="text-green">0 MMT</strong> em referrals</p>
        </div>`,
        `<button class="btn-primary" id="copy-referral">Copiar Código</button>`
    );
    document.getElementById('copy-referral').addEventListener('click', () => {
        navigator.clipboard.writeText(code).then(() => showToast('Código copiado!', 'success'));
    });
}

function openBonusModal() {
    openModal('Bonus Rewards',
        `<div style="text-align:center;padding:10px 0">
            <div style="font-size:64px;margin-bottom:16px">${ic('present', 'text-purple')}</div>
            <h3 style="margin-bottom:8px">Próximo bônus em</h3>
            <p id="bonus-countdown" style="font-size:36px;font-weight:600;color:var(--primary-purple)">23:59:45</p>
            <p class="text-secondary" style="margin-top:12px">Complete tarefas diárias para desbloquear bônus extras.</p>
            <div style="margin-top:20px;text-align:left">
                <div class="bonus-task"><span>${ic('check','text-green')} Login diário</span><span class="text-green">+2 MMT</span></div>
                <div class="bonus-task"><span>${ic('raio','text-secondary')} Minerar 24h</span><span class="text-secondary">Pendente</span></div>
                <div class="bonus-task"><span>${ic('referal','text-secondary')} Fazer referral</span><span class="text-secondary">Pendente</span></div>
            </div>
            <div class="glass" style="margin-top:20px;padding:16px;border-radius:12px;text-align:center">
                <h4 style="margin-bottom:6px">${ic('present','text-purple')} Roleta Diária</h4>
                <p class="text-secondary" style="font-size:12px;margin-bottom:10px">Pode ganhar mineradora, gerador, chip ou MMT!</p>
                <button class="btn-primary" id="spin-roulette" ${canSpinRoulette() ? '' : 'disabled style="opacity:0.5"'}>${canSpinRoulette() ? 'Girar a roleta' : 'Volte amanhã!'}</button>
                <p id="roulette-result" style="margin-top:10px;font-weight:600"></p>
            </div>
        </div>`,
        ''
    );
    const spinBtn = document.getElementById('spin-roulette');
    spinBtn && spinBtn.addEventListener('click', spinRoulette);
    // Live countdown
    let secs = 86385;
    const el = document.getElementById('bonus-countdown');
    const timer = setInterval(() => {
        if (!el || !document.getElementById('modal-overlay')) { clearInterval(timer); return; }
        secs = Math.max(0, secs - 1);
        const h = String(Math.floor(secs/3600)).padStart(2,'0');
        const m = String(Math.floor((secs%3600)/60)).padStart(2,'0');
        const s = String(secs%60).padStart(2,'0');
        el.textContent = `${h}:${m}:${s}`;
    }, 1000);
}

function canSpinRoulette() {
    return !state.lastSpin || (Date.now() - state.lastSpin) > 24 * 60 * 60 * 1000;
}

window.spinRoulette = function () {
    if (!canSpinRoulette()) { showToast('Você já girou hoje. Volte amanhã!', 'error'); return; }
    state.lastSpin = Date.now();
    const prizes = [
        { p: 30, label: '25 MMT', apply: () => { state.crypto.mmt += 25; } },
        { p: 20, label: '60 MMT', apply: () => { state.crypto.mmt += 60; } },
        { p: 20, label: 'Gerador +100 W', apply: () => { state.generators.push({ id: 'spin_gen_' + Date.now(), name: 'Gerador da Roleta', output: 100, instanceId: Date.now() }); } },
        { p: 15, label: 'Chip +1 TH', apply: () => { if (state.ownedMiners.length > 0) { state.ownedMiners.forEach(m => m.power = +(m.power + 1).toFixed(1)); } else { state.crypto.mmt += 50; } } },
        { p: 10, label: 'Gerador Eólico +600 W', apply: () => { state.generators.push({ id: 'spin_gen_' + Date.now(), name: 'Turbina da Roleta', output: 600, instanceId: Date.now() }); } },
        { p: 5, label: 'Mine Box Básica!', apply: () => { state.ownedMiners.push({ id: 'miner_1', name: 'The Mine Box #Roleta', power: 3, efficiency: 20, roi: 56.98, priceMMT: 80, oldPriceMMT: 120, coin: 'btc', components: {}, img: 'assets/mineradoras/mineradora1.png', instanceId: Date.now() }); } },
    ];
    let roll = Math.random() * 100;
    let chosen = prizes[0];
    for (const prize of prizes) { roll -= prize.p; if (roll <= 0) { chosen = prize; break; } }
    chosen.apply();
    saveState(); updateUI();
    const el = document.getElementById('roulette-result');
    if (el) el.innerHTML = `${ic('confete', 'text-purple')} Você ganhou: ${chosen.label}!`;
    const btn = document.getElementById('spin-roulette');
    if (btn) { btn.disabled = true; btn.style.opacity = 0.5; btn.textContent = 'Volte amanhã!'; }
    showToast(`Roleta: ${chosen.label}!`, 'success');
}

function openVIPModal() {
    const vip = getVipInfo();
    openModal('VIP Progress',
        `<div style="text-align:center;padding:10px 0">
            <div style="font-size:48px;margin-bottom:12px">${ic(vip.icon, 'text-purple')}</div>
            <h3>${vip.name}</h3>
            <p class="text-secondary" style="margin:8px 0 20px">${vip.next ? `Progresso para ${vip.next.name}` : 'Nível máximo atingido!'}</p>
            <div class="progress-bar" style="height:10px;border-radius:5px;margin-bottom:8px">
                <div class="progress-fill" style="width:${vip.pct}%;background:var(--primary-purple)"></div>
            </div>
            <p class="text-secondary">${vip.pct}% · ${vip.score.toFixed(1)} TH ${vip.next ? `/ ${vip.next.min} TH para o próximo nível` : ''}</p>
            <div style="margin-top:20px;text-align:left">
                <p class="text-secondary" style="margin-bottom:8px">Como subir de nível:</p>
                <p>${ic('check','text-green')} Aumente seu poder total de mineração (TH)</p>
                <p>${ic('check','text-green')} Compre mineradoras no mercado</p>
                <p>${ic('check','text-green')} Use componentes para dar upgrade</p>
            </div>
        </div>`,
        ''
    );
}

function openCashbackModal() {
    openModal('Cashback Ativo',
        `<div style="text-align:center;padding:10px 0">
            <div style="font-size:48px;margin-bottom:12px">${ic('porcentagem', 'text-purple')}</div>
            <p class="text-secondary" style="margin-bottom:16px">Seu cashback acumulado este mês:</p>
            <h2 style="color:var(--status-green)">1.5%</h2>
            <p class="text-secondary" style="margin-top:8px">≈ $${(state.usdBalance * 0.015).toFixed(2)} USD</p>
            <p class="text-secondary" style="margin-top:20px;font-size:12px">O cashback é creditado automaticamente no início de cada mês.</p>
        </div>`,
        `<button class="btn-primary" id="claim-cashback">Resgatar Cashback</button>`
    );
    document.getElementById('claim-cashback').addEventListener('click', () => {
        const bonus = state.usdBalance * 0.015;
        state.usdBalance += bonus;
        saveState(); updateUI(); closeModal();
        showToast(`$${bonus.toFixed(2)} de cashback resgatado!`, 'success');
    });
}

function openSecurityModal() {
    openModal('Segurança da Conta',
        `<div class="security-item glass">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                ${ic('security','text-purple')}
                <div>
                    <h4>KYC — Verificação de Identidade</h4>
                    <span class="text-secondary" style="font-size:12px">Não verificado</span>
                </div>
            </div>
            <button class="btn-primary" id="start-kyc" style="margin-bottom:0">Iniciar KYC</button>
        </div>
        <div class="security-item glass" style="margin-top:12px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                ${ic('security','text-purple')}
                <div>
                    <h4>2FA — Autenticação em 2 Fatores</h4>
                    <span class="text-secondary" style="font-size:12px">Desativado</span>
                </div>
            </div>
            <button class="btn-primary" id="enable-2fa">Ativar 2FA</button>
        </div>`,
        ''
    );
    document.getElementById('start-kyc').addEventListener('click', () => { closeModal(); showToast('Processo KYC iniciado. Verifique seu e-mail.', 'info'); });
    document.getElementById('enable-2fa').addEventListener('click', () => { closeModal(); showToast('2FA ativado com sucesso!', 'success'); });
}

// =============================================
// MARKET TABS
// =============================================
const marketCategories = {
    'Mineiros': [
        { id:'miner_1', name:'The Mine Box #267404', power:3, efficiency:20, roi:56.98, priceMMT:80, oldPriceMMT:120, img:'assets/mineradoras/mineradora1.png' },
        { id:'miner_2', name:'Pro Rack #883921', power:10, efficiency:22, roi:62.40, priceMMT:350, oldPriceMMT:400, img:'assets/mineradoras/mineradora2.png' },
        { id:'miner_3', name:'Elite ASIC #10923', power:25, efficiency:18, roi:75.10, priceMMT:800, oldPriceMMT:950, img:'assets/mineradoras/mineradora3.png' }
    ],
    'MoonMiners': [
        { id:'mm_1', name:'Moon Starter #001', power:5, efficiency:19, roi:60.00, priceMMT:200, oldPriceMMT:250, img:'assets/mineradoras/mineradora2.png' },
        { id:'mm_2', name:'Moon Pro #088', power:15, efficiency:17, roi:70.00, priceMMT:500, oldPriceMMT:600, img:'assets/mineradoras/mineradora3.png' }
    ],
    'Mercadorias': [
        { id:'mc_1', name:'Hash Chip +1 TH', power:1, efficiency:0, roi:0, priceMMT:50, oldPriceMMT:70, type:'chip', boost:1, img:'assets/mercadorias/hashchip.jpeg' },
        { id:'mc_2', name:'Power Chip +3 TH', power:3, efficiency:0, roi:0, priceMMT:120, oldPriceMMT:160, type:'chip', boost:3, img:'assets/mercadorias/powerchip.jpeg' }
    ]
};

function setupMarketTabs() {
    const tabs = document.querySelectorAll('.market-tabs .tab-btn');
    const subtabs = document.querySelectorAll('.market-subtabs .subtab-btn');
    let activeCategory = 'Mineiros';
    let activeSubtab = 'Ofertas';

    function refreshMarket() {
        let items = marketCategories[activeCategory] || [];
        if (activeSubtab === 'Auction') {
            items = items.map(m => ({...m, priceMMT: Math.round(m.priceMMT * 0.7), oldPriceMMT: m.priceMMT, name: m.name + ' [AUCTION]'}));
        } else if (activeSubtab === 'Special') {
            items = items.filter((_, i) => i === 0).map(m => ({...m, priceMMT: Math.round(m.priceMMT * 0.5), oldPriceMMT: m.priceMMT, name: m.name + ' [SPECIAL]'}));
        }
        renderMarketItems(items);
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeCategory = tab.textContent.trim();
            refreshMarket();
        });
    });

    subtabs.forEach(sub => {
        sub.addEventListener('click', () => {
            subtabs.forEach(s => s.classList.remove('active'));
            sub.classList.add('active');
            activeSubtab = sub.textContent.trim();
            refreshMarket();
        });
    });
}

function renderMarketItems(items) {
    marketMinerList.innerHTML = '';
    if (items.length === 0) {
        marketMinerList.innerHTML = '<p class="text-secondary" style="text-align:center;padding:40px">Nenhum item disponível nesta categoria.</p>';
        return;
    }
    items.forEach((miner, index) => {
        const canAfford = state.crypto.mmt >= miner.priceMMT;
        const card = document.createElement('div');
        card.className = 'miner-card glass';
        card.style.animationDelay = `${index * 70}ms`;
        card.innerHTML = `
            <div class="miner-media ${miner.img ? 'has-photo' : ''}">
                <img src="${miner.img || 'crypto-icons/moon-token.png'}" alt="${miner.name}">
            </div>
            <div class="miner-info">
                <div class="miner-badges">
                    ${miner.type === 'chip'
                        ? `<span class="badge text-green">${ic('graph_up')}+${miner.boost} TH</span>`
                        : `<span class="badge">${ic('raio')}${miner.power} TH</span>
                    <span class="badge">${ic('cpu')}${miner.efficiency} W/TH</span>
                    <span class="badge text-green">${ic('graph_up')}${miner.roi}% ROI</span>`}
                </div>
                <h3>${miner.name}</h3>
                <div class="miner-price-row">
                    <span class="new-price">${ic('etiqueta_preco')} ${miner.priceMMT} MMT</span>
                    <span class="old-price">${miner.oldPriceMMT}</span>
                </div>
                <button class="btn-primary" onclick="buyMiner('${miner.id}', ${miner.priceMMT}, '${miner.name}', ${miner.power}, ${miner.efficiency}, ${miner.roi})" ${!canAfford ? 'disabled' : ''}>
                    ${canAfford ? 'Comprar' : 'Insuficiente MMT'}
                </button>
            </div>
        `;
        marketMinerList.appendChild(card);
    });
}

// =============================================
// MINERS VIEW MODALS
// =============================================
function openMinerStatsModal() {
    const totalPower = state.ownedMiners.reduce((s, m) => s + m.power, 0);
    const factor = getEnergyFactor();
    const dailyUSD = totalPower * USD_REWARD_PER_TH_PER_SEC * 86400 * factor;
    const consumption = getTotalConsumption();
    const capacity = getEnergyCapacity();
    openModal('Estatísticas da Farm',
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="glass" style="padding:16px;border-radius:12px;text-align:center">
                <p class="text-secondary">Poder Total</p>
                <h3>${totalPower.toFixed(2)} TH</h3>
            </div>
            <div class="glass" style="padding:16px;border-radius:12px;text-align:center">
                <p class="text-secondary">Mineradores</p>
                <h3>${state.ownedMiners.length}</h3>
            </div>
            <div class="glass" style="padding:16px;border-radius:12px;text-align:center">
                <p class="text-secondary">Energia</p>
                <h3 class="${factor >= 1 ? 'text-green' : 'text-secondary'}">${Math.round(consumption)}/${Math.round(capacity)} W</h3>
            </div>
            <div class="glass" style="padding:16px;border-radius:12px;text-align:center">
                <p class="text-secondary">USD/dia (est.)</p>
                <h3 class="text-green">$${dailyUSD.toFixed(2)}</h3>
            </div>
        </div>`,
        ''
    );
}

function openUpgradePowerModal() {
    openModal('Upgrade de Poder',
        `<p class="text-secondary" style="margin-bottom:20px">Compre boosters de poder para seus mineradores existentes.</p>
        <div class="earn-options">
            <div class="earn-card glass" style="cursor:pointer" data-boost="10" data-cost="50">
                <h4>+10 TH Booster</h4><p class="text-purple">50 MMT</p>
            </div>
            <div class="earn-card glass" style="cursor:pointer" data-boost="50" data-cost="200">
                <h4>+50 TH Booster</h4><p class="text-purple">200 MMT</p>
            </div>
            <div class="earn-card glass" style="cursor:pointer" data-boost="100" data-cost="350">
                <h4>+100 TH Booster</h4><p class="text-purple">350 MMT</p>
            </div>
        </div>`,
        ''
    );
    document.querySelectorAll('.earn-card').forEach(card => {
        card.addEventListener('click', () => {
            const boost = parseInt(card.dataset.boost);
            const cost = parseInt(card.dataset.cost);
            if (state.crypto.mmt < cost) { showToast(`MMT insuficiente. Necessário: ${cost}`, 'error'); return; }
            if (state.ownedMiners.length === 0) { showToast('Você não tem mineradores para dar upgrade.', 'error'); return; }
            state.crypto.mmt -= cost;
            state.ownedMiners[0].power += boost; // Boost the first miner
            saveState(); updateUI(); closeModal();
            showToast(`+${boost} TH adicionado com sucesso!`, 'success');
        });
    });
}

function openMinerSettingsModal() {
    openModal('Configurações dos Mineradores',
        `<div class="security-item glass" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div><h4>Reinvestimento Automático</h4><p class="text-secondary" style="font-size:12px">Reinveste lucros em novos mineradores</p></div>
                <label class="toggle-switch"><input type="checkbox" id="auto-reinvest"><span class="toggle-slider"></span></label>
            </div>
        </div>
        <div class="security-item glass" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div><h4>Alertas de Mineração</h4><p class="text-secondary" style="font-size:12px">Notificações ao atingir metas</p></div>
                <label class="toggle-switch"><input type="checkbox" id="mining-alerts" checked><span class="toggle-slider"></span></label>
            </div>
        </div>
        <div class="security-item glass">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div><h4>Modo Eficiência</h4><p class="text-secondary" style="font-size:12px">Reduz custo de energia em 15%</p></div>
                <label class="toggle-switch"><input type="checkbox" id="efficiency-mode"><span class="toggle-slider"></span></label>
            </div>
        </div>`,
        `<button class="btn-primary" id="save-settings">Salvar Configurações</button>`
    );
    document.getElementById('save-settings').addEventListener('click', () => { closeModal(); showToast('Configurações salvas!', 'success'); });
}

// --- Energia: geradores ---
const GENERATOR_CATALOG = [
    { id: 'gen_solar', name: 'Painel Solar X1', output: 150, priceMMT: 200 },
    { id: 'gen_eolico', name: 'Turbina Eólica M2', output: 600, priceMMT: 700 },
    { id: 'gen_reator', name: 'Reator Compacto K3', output: 2500, priceMMT: 2800 },
];

function openEnergyModal() {
    const factor = getEnergyFactor();
    const consumption = getTotalConsumption();
    const capacity = getEnergyCapacity();
    const grouped = {};
    state.generators.forEach(g => {
        grouped[g.id] = grouped[g.id] || { name: g.name, count: 0, output: 0 };
        grouped[g.id].count++;
        grouped[g.id].output += g.output;
    });
    const owned = Object.values(grouped).map(g =>
        `<p class="text-secondary" style="font-size:13px;margin-bottom:4px">${ic('raio_circulo', 'text-green')} ${g.name} × ${g.count} — ${g.output} W</p>`
    ).join('');
    const catalog = GENERATOR_CATALOG.map(g =>
        `<div class="earn-card glass" style="cursor:pointer;margin-bottom:10px" onclick="buyGenerator('${g.id}')">
            <h4>${ic('raio_circulo')} ${g.name}</h4>
            <p class="text-green" style="font-size:18px;font-weight:600;">${g.output} W</p>
            <p class="text-secondary">${g.priceMMT} MMT</p>
        </div>`
    ).join('');
    openModal('Energia da Fazenda',
        `<p class="text-secondary" style="margin-bottom:12px">Cada mineradora consome <em>poder × eficiência</em> watts. Geração ≥ consumo = produção 100%. Abaixo disso, a produção cai na mesma proporção — sem gerador, só 15%.</p>
        <div class="glass" style="padding:16px;border-radius:12px;margin-bottom:16px">
            <p class="text-secondary">Consumo: <strong>${Math.round(consumption)} W</strong> · Geração: <strong>${Math.round(capacity)} W</strong></p>
            <div class="progress-bar" style="margin:10px 0"><div class="progress-fill" style="width:${Math.min(100, consumption / Math.max(capacity, 1) * 100)}%;background:${factor >= 1 ? 'var(--status-green)' : '#ef4444'}"></div></div>
            <p class="${factor >= 1 ? 'text-green' : ''}" style="font-weight:600">Produção atual: ${Math.round(factor * 100)}% ${factor >= 1 ? '— estável' : factor >= 0.7 ? '— instável' : '— crítica'}</p>
            ${factor < 1 ? `<p class="text-secondary" style="font-size:12px;margin-top:6px">Faltam ~${Math.max(0, Math.round(consumption - capacity))} W de geração para produção em 100%.</p>` : '<p class="text-secondary" style="font-size:12px;margin-top:6px">Energia suficiente para todas as mineradoras.</p>'}
        </div>
        ${state.freeGenAvailable && !state.freeGenClaimed ? `<div class="glass" style="padding:16px;border-radius:12px;margin-bottom:16px;border:2px dashed var(--status-green)">
            <h4 style="margin-bottom:6px">${ic('raio_circulo', 'text-green')} Gerador Básico Grátis</h4>
            <p class="text-secondary" style="font-size:13px;margin-bottom:10px">Da sua primeira compra da Mine Box. Colete aqui para ativar 100 W.</p>
            <button class="btn-primary" onclick="claimFreeGenerator()">Coletar Gerador</button>
        </div>` : ''}
        ${owned ? `<h4 style="margin-bottom:8px">Seus geradores</h4>${owned}<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:12px 0">` : ''}
        <h4 style="margin-bottom:8px">Comprar geradores</h4>
        ${catalog}`,
        ''
    );
}

window.claimFreeGenerator = function () {
    if (!state.freeGenAvailable || state.freeGenClaimed) return;
    state.freeGenClaimed = true;
    state.freeGenAvailable = false;
    state.generators.push({ id: 'gen_free', name: 'Gerador Básico Grátis', output: 100, free: true, instanceId: Date.now() });
    saveState(); updateUI();
    showToast('Gerador Básico Grátis coletado: +100 W!', 'success');
    openEnergyModal();
}

window.buyGenerator = function (genId) {
    const g = GENERATOR_CATALOG.find(x => x.id === genId);
    if (!g) return;
    if (state.crypto.mmt < g.priceMMT) { showToast('MMT insuficiente.', 'error'); return; }
    state.crypto.mmt -= g.priceMMT;
    state.generators.push({ ...g, instanceId: Date.now() });
    saveState(); updateUI();
    showToast(`${g.name} instalado! +${g.output} W`, 'success');
    openEnergyModal(); // reabre para mostrar o novo status
}

// --- Mineradora: detalhes + componentes ---
const COMPONENTS = [
    { id: 'cooler', name: 'Cooler Pro', desc: 'Reduz o consumo em ~15%', cost: 60, img: 'assets/components/cooler.jpeg', apply: m => { m.efficiency = Math.max(5, +(m.efficiency * 0.85).toFixed(1)); } },
    { id: 'overclock', name: 'Chip Overclock', desc: '+20% de poder de mineração', cost: 120, img: 'assets/components/overclock.jpeg', apply: m => { m.power = +(m.power * 1.2).toFixed(1); } },
    { id: 'hashboard', name: 'Hashboard HD', desc: '+12% de poder de mineração', cost: 200, img: 'assets/components/hashboard.jpeg', apply: m => { m.power = +(m.power * 1.12).toFixed(1); } },
    { id: 'psu', name: 'PSU Turbo', desc: 'Reduz o consumo em ~10%', cost: 80, img: 'assets/components/psu.jpeg', apply: m => { m.efficiency = Math.max(5, +(m.efficiency * 0.9).toFixed(1)); } },
];

function componentCost(comp, ownedCount) {
    return Math.round(comp.cost * Math.pow(1.5, ownedCount));
}

window.openMinerDetail = function (instanceId) {
    const m = state.ownedMiners.find(x => x.instanceId == instanceId);
    if (!m) return;
    const componentsHTML = COMPONENTS.map(c => {
        const owned = (m.components && m.components[c.id]) || 0;
        const cost = componentCost(c, owned);
        return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
                <img src="${c.img}" alt="${c.name}" style="width:46px;height:46px;border-radius:10px;object-fit:cover;flex-shrink:0">
                <div style="min-width:0">
                    <h4 style="margin-bottom:2px">${c.name}${owned > 0 ? ` <span class="text-secondary" style="font-size:12px">(x${owned})</span>` : ''}</h4>
                    <p class="text-secondary" style="font-size:12px">${c.desc}</p>
                </div>
            </div>
            <button class="btn-primary" style="width:auto;white-space:nowrap;flex-shrink:0" onclick="buyComponent(${m.instanceId}, '${c.id}')">${cost} MMT</button>
        </div>`;
    }).join('');

    const coinOptions = Object.keys(PRICES).map(c => {
        const selected = m.coin === c;
        return `<button type="button" class="coin-option glass" data-coin="${c}" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:14px;border:2px solid ${selected ? 'var(--primary-purple)' : 'transparent'};cursor:pointer;color:inherit">
            ${coinIcon(c, 26)}
            <strong style="font-size:13px">${c.toUpperCase()}</strong>
            <span class="text-secondary" style="font-size:11px">$${PRICES[c].toLocaleString('en-US')}</span>
        </button>`;
    }).join('');

    const factor = getEnergyFactor();
    const usdPerDay = m.power * USD_REWARD_PER_TH_PER_SEC * 86400 * factor;
    const tokensPerDay = usdPerDay / (PRICES[m.coin] || PRICES.btc);
    const tpdStr = tokensPerDay >= 100 ? tokensPerDay.toFixed(2) : tokensPerDay >= 1 ? tokensPerDay.toFixed(4) : tokensPerDay.toFixed(8);

    const ownedTiles = COMPONENTS.filter(c => (m.components && m.components[c.id]) > 0).map(c =>
        `<div class="glass" style="width:72px;min-height:88px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;text-align:center;padding:6px 4px" title="${c.name}">
            <img src="${c.img}" alt="${c.name}" style="width:34px;height:34px;border-radius:8px;object-fit:cover">
            <strong style="font-size:11px;line-height:1.2">${c.name}</strong>
            <span class="text-secondary">×${m.components[c.id]}</span>
        </div>`
    ).join('');

    openModal(m.name,
        `<div class="glass" style="padding:14px;border-radius:12px;margin-bottom:16px">
            <p class="text-secondary">Poder: <strong>${m.power} TH</strong> · Eficiência: <strong>${m.efficiency} W/TH</strong></p>
            <p class="text-secondary">Consumo: <strong>${Math.round(m.power * m.efficiency)} W</strong></p>
            <p class="text-secondary" style="margin-top:4px">Produção estimada: <strong class="text-green">~${tpdStr} ${(m.coin || 'btc').toUpperCase()}/dia</strong> <span>(≈ $${usdPerDay.toFixed(2)}/dia)</span></p>
            <p class="text-secondary" style="margin-top:4px">Energia da fazenda: <strong class="${factor >= 1 ? 'text-green' : ''}">${Math.round(getEnergyCapacity())} W disponíveis / ${Math.round(getTotalConsumption())} W em uso (${Math.round(factor * 100)}%)</strong></p>
            <p class="text-secondary" style="margin-top:4px">${ic('earn', 'text-purple')} Valor em componentes: <strong class="text-purple">${m.componentsValue || 0} MMT</strong></p>
        </div>
        <label class="modal-label">Criptomoeda minerada</label>
        <div id="coin-picker" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">${coinOptions}</div>
        <p class="text-secondary" style="font-size:12px;margin-bottom:16px">Regra da economia: quanto mais cara a moeda, menos tokens ela rende — o valor em USD é proporcional.</p>
        <h4 style="margin-bottom:10px">Componentes instalados</h4>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
            ${ownedTiles}
            <button id="add-component-btn" title="Adicionar componente" style="width:64px;height:64px;border:2px dashed rgba(255,255,255,0.25);border-radius:14px;background:transparent;color:#9ca3af;font-size:30px;cursor:pointer;transition:border-color 0.2s">+</button>
        </div>
        <div id="component-catalog" style="display:none;animation:cardIn 0.3s ease both">
            <h4 style="margin-bottom:10px">Componentes disponíveis</h4>
            ${componentsHTML}
        </div>`,
        `<button class="btn-primary" style="background:#b91c1c" onclick="listMiner(${m.instanceId})">Listar para venda (−17%)</button>`
    );
    document.getElementById('add-component-btn').addEventListener('click', () => {
        const cat = document.getElementById('component-catalog');
        cat.style.display = cat.style.display === 'none' ? 'block' : 'none';
    });
    document.querySelectorAll('#coin-picker .coin-option').forEach(btn => {
        btn.addEventListener('click', () => {
            m.coin = btn.dataset.coin;
            document.querySelectorAll('#coin-picker .coin-option').forEach(b => {
                b.style.borderColor = b.dataset.coin === m.coin ? 'var(--primary-purple)' : 'transparent';
            });
            saveState(); updateUI();
            showToast(`Agora minerando ${m.coin.toUpperCase()}!`, 'success');
            openMinerDetail(m.instanceId); // reabre para atualizar a estimativa de tokens/dia
        });
    });
}

window.buyComponent = function (instanceId, compId) {
    const m = state.ownedMiners.find(x => x.instanceId == instanceId);
    const c = COMPONENTS.find(x => x.id === compId);
    if (!m || !c) return;
    m.components = m.components || {};
    const owned = m.components[compId] || 0;
    const cost = componentCost(c, owned);
    if (state.crypto.mmt < cost) { showToast('MMT insuficiente.', 'error'); return; }
    state.crypto.mmt -= cost;
    c.apply(m);
    m.components[compId] = owned + 1;
    m.componentsValue = (m.componentsValue || 0) + cost;
    saveState(); updateUI();
    showToast(`${c.name} instalado em ${m.name}!`, 'success');
    openMinerDetail(m.instanceId);
}

// =============================================
// WALLET MODALS
// =============================================
function openDepositModal() {
    openModal('Depositar',
        `<p class="text-secondary" style="margin-bottom:20px">Adicione fundos à sua conta.</p>
        <label class="modal-label">Valor (USD)</label>
        <input class="modal-input" id="w-deposit-amount" type="number" placeholder="100.00" min="1" />
        <label class="modal-label">Método de Pagamento</label>
        <select class="modal-input" id="w-deposit-method">
            <option>Cartão de Crédito</option>
            <option>PIX</option>
            <option>Transferência Bancária</option>
            <option>Cripto</option>
        </select>`,
        `<button class="btn-primary" id="confirm-deposit">Confirmar Depósito</button>`
    );
    document.getElementById('confirm-deposit').addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('w-deposit-amount').value);
        if (!amount || amount <= 0) { showToast('Digite um valor válido.', 'error'); return; }
        state.usdBalance += amount;
        saveState(); updateUI(); closeModal();
        showToast(`$${amount.toFixed(2)} depositado com sucesso!`, 'success');
    });
}

function openConvertModal() {
    openModal('Converter Moedas',
        `<p class="text-secondary" style="margin-bottom:20px">Converta entre os seus ativos.</p>
        <label class="modal-label">De</label>
        <select class="modal-input" id="convert-from">
            <option value="usd">USD ($${state.usdBalance.toFixed(2)})</option>
            <option value="mmt">MMT (${state.crypto.mmt.toFixed(2)})</option>
            <option value="btc">BTC (${state.crypto.btc.toFixed(8)})</option>
        </select>
        <label class="modal-label">Valor</label>
        <input class="modal-input" id="convert-amount" type="number" placeholder="0.00" />
        <label class="modal-label">Para</label>
        <select class="modal-input" id="convert-to">
            <option value="mmt">MMT</option>
            <option value="btc">BTC</option>
            <option value="usd">USD</option>
        </select>`,
        `<button class="btn-primary" id="confirm-convert">Converter</button>`
    );
    document.getElementById('confirm-convert').addEventListener('click', () => {
        const from = document.getElementById('convert-from').value;
        const to = document.getElementById('convert-to').value;
        const amount = parseFloat(document.getElementById('convert-amount').value);
        if (!amount || amount <= 0) { showToast('Digite um valor válido.', 'error'); return; }
        if (from === to) { showToast('Selecione moedas diferentes.', 'error'); return; }
        // Simple conversion rates
        const rates = { usd: 1, btc: 1/BTC_PRICE, mmt: 1/MMT_PRICE };
        const usdVal = amount / rates[from];
        if (from === 'usd' && state.usdBalance < amount) { showToast('Saldo USD insuficiente.', 'error'); return; }
        if (from === 'mmt' && state.crypto.mmt < amount) { showToast('Saldo MMT insuficiente.', 'error'); return; }
        if (from === 'btc' && state.crypto.btc < amount) { showToast('Saldo BTC insuficiente.', 'error'); return; }
        if (from === 'usd') state.usdBalance -= amount; else if (from === 'mmt') state.crypto.mmt -= amount; else state.crypto.btc -= amount;
        const received = usdVal * rates[to];
        if (to === 'usd') state.usdBalance += received; else if (to === 'mmt') state.crypto.mmt += received; else state.crypto.btc += received;
        saveState(); updateUI(); closeModal();
        showToast(`Convertido: −${amount} ${from.toUpperCase()} → +${received.toFixed(6)} ${to.toUpperCase()}`, 'success');
    });
}

function openInstantModal() {
    openModal('Instant Transfer',
        `<p class="text-secondary" style="margin-bottom:20px">Transfira MMT instantaneamente para outro usuário.</p>
        <label class="modal-label">ID do Destinatário</label>
        <input class="modal-input" id="instant-to" placeholder="Ex: a1b2c3d4" />
        <label class="modal-label">Quantidade (MMT)</label>
        <input class="modal-input" id="instant-amount" type="number" placeholder="0.00" />`,
        `<button class="btn-primary" id="confirm-instant">Enviar</button>`
    );
    document.getElementById('confirm-instant').addEventListener('click', () => {
        const to = document.getElementById('instant-to').value.trim();
        const amount = parseFloat(document.getElementById('instant-amount').value);
        if (!to) { showToast('Digite o ID do destinatário.', 'error'); return; }
        if (!amount || amount <= 0) { showToast('Digite um valor válido.', 'error'); return; }
        if (state.crypto.mmt < amount) { showToast('MMT insuficiente.', 'error'); return; }
        state.crypto.mmt -= amount;
        saveState(); updateUI(); closeModal();
        showToast(`${amount.toFixed(2)} MMT enviado para ${to}!`, 'success');
    });
}

function openSacarModal() {
    openModal('Sacar',
        `<p class="text-secondary" style="margin-bottom:20px">Saque fundos para sua carteira externa.</p>
        <div class="banner glass" style="margin-bottom:16px;cursor:default">${ic('security','text-purple')} <div class="banner-text"><h4>KYC necessário</h4><p class="text-secondary">Ative 2FA para saques.</p></div></div>
        <label class="modal-label">Moeda</label>
        <select class="modal-input" id="sacar-currency">
            <option value="btc">BTC</option>
            <option value="mmt">MMT</option>
        </select>
        <label class="modal-label">Endereço da Carteira</label>
        <input class="modal-input" id="sacar-address" placeholder="bc1q..." />
        <label class="modal-label">Quantidade</label>
        <input class="modal-input" id="sacar-amount" type="number" placeholder="0.00" />`,
        `<button class="btn-primary" id="confirm-sacar">Solicitar Saque</button>`
    );
    document.getElementById('confirm-sacar').addEventListener('click', () => {
        const addr = document.getElementById('sacar-address').value.trim();
        const amount = parseFloat(document.getElementById('sacar-amount').value);
        const currency = document.getElementById('sacar-currency').value;
        if (!addr) { showToast('Digite o endereço da carteira.', 'error'); return; }
        if (!amount || amount <= 0) { showToast('Digite um valor válido.', 'error'); return; }
        const bal = currency === 'btc' ? state.crypto.btc : state.crypto.mmt;
        if (bal < amount) { showToast('Saldo insuficiente.', 'error'); return; }
        if (currency === 'btc') state.crypto.btc -= amount; else state.crypto.mmt -= amount;
        saveState(); updateUI(); closeModal();
        showToast(`Saque de ${amount} ${currency.toUpperCase()} solicitado!`, 'info');
    });
}

function openStakeModal() {
    openModal('Staking — Earn up to 12.69% APR',
        `<div class="earn-options">
            <div class="earn-card glass" data-apr="6" data-days="7" data-token="MMT">
                <h4>Flexível</h4><p class="text-green" style="font-size:20px;font-weight:600;">6% APR</p><p class="text-secondary">Sem bloqueio</p>
            </div>
            <div class="earn-card glass" data-apr="10" data-days="30" data-token="MMT">
                <h4>30 Dias</h4><p class="text-green" style="font-size:20px;font-weight:600;">10% APR</p><p class="text-secondary">Bloqueio: 30 dias</p>
            </div>
            <div class="earn-card glass" data-apr="12.69" data-days="90" data-token="MMT">
                <h4>90 Dias</h4><p class="text-green" style="font-size:20px;font-weight:600;">12.69% APR</p><p class="text-secondary">Bloqueio: 90 dias</p>
            </div>
        </div>
        <label class="modal-label" style="margin-top:16px">Quantidade MMT para fazer stake</label>
        <input class="modal-input" id="stake-amount" type="number" placeholder="0.00" />`,
        `<button class="btn-primary" id="confirm-stake">Fazer Stake</button>`
    );
    document.querySelectorAll('.earn-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.earn-card').forEach(c => c.style.borderColor = '');
            card.style.borderColor = 'var(--primary-purple)';
            card.dataset.selected = 'true';
        });
    });
    document.getElementById('confirm-stake').addEventListener('click', () => {
        const selected = document.querySelector('.earn-card[data-selected]');
        const amount = parseFloat(document.getElementById('stake-amount').value);
        if (!selected) { showToast('Selecione um plano de staking.', 'error'); return; }
        if (!amount || amount <= 0) { showToast('Digite um valor válido.', 'error'); return; }
        if (state.crypto.mmt < amount) { showToast('MMT insuficiente.', 'error'); return; }
        state.crypto.mmt -= amount;
        saveState(); updateUI(); closeModal();
        showToast(`${amount.toFixed(2)} MMT em stake a ${selected.dataset.apr}% APR!`, 'success');
    });
}

// =============================================
// PROFILE MODALS
// =============================================
function openEditProfileModal() {
    let selAvatar = state.profile.avatar || 0;
    let selBanner = state.profile.banner || 0;
    const avatarBtns = [0, 1, 2].map(i => `
        <button type="button" class="avatar-pick" data-i="${i}" style="width:64px;height:64px;border-radius:50%;padding:0;border:3px solid ${i === selAvatar ? 'var(--primary-purple)' : 'transparent'};cursor:pointer;overflow:hidden;background:none">
            <img src="assets/perfil/perfil${i + 1}.jpeg" alt="Avatar ${i + 1}" style="width:100%;height:100%;object-fit:cover;display:block">
        </button>`).join('');
    const bannerBtns = [0, 1, 2].map(i => `
        <button type="button" class="banner-pick" data-i="${i}" style="height:52px;border-radius:10px;padding:0;border:3px solid ${i === selBanner ? 'var(--primary-purple)' : 'transparent'};cursor:pointer;overflow:hidden;background:none">
            <img src="assets/banner/banner${i + 1}.jpeg" alt="Banner ${i + 1}" style="width:100%;height:100%;object-fit:cover;display:block">
        </button>`).join('');
    openModal('Editar Perfil',
        `<div style="text-align:center;margin-bottom:20px">
            <div class="profile-avatar" style="width:80px;height:80px;font-size:40px;margin:0 auto 12px;overflow:hidden">
                <img id="edit-avatar-preview" src="assets/perfil/perfil${selAvatar + 1}.jpeg" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">
            </div>
        </div>
        <label class="modal-label">Foto de perfil — toque para escolher</label>
        <div style="display:flex;gap:12px;justify-content:center;margin-bottom:16px" id="avatar-picker">${avatarBtns}</div>
        <label class="modal-label">Banner do perfil — toque para escolher</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px" id="banner-picker">${bannerBtns}</div>
        <label class="modal-label">Nome de usuário</label>
        <input class="modal-input" id="edit-username" placeholder="Seu nome" />
        <label class="modal-label">E-mail</label>
        <input class="modal-input" id="edit-email" type="email" placeholder="seu@email.com" />`,
        `<button class="btn-primary" id="save-profile">Salvar Perfil</button>`
    );
    document.querySelectorAll('#avatar-picker .avatar-pick').forEach(btn => {
        btn.addEventListener('click', () => {
            selAvatar = parseInt(btn.dataset.i);
            document.querySelectorAll('#avatar-picker .avatar-pick').forEach(b => {
                b.style.borderColor = parseInt(b.dataset.i) === selAvatar ? 'var(--primary-purple)' : 'transparent';
            });
            document.getElementById('edit-avatar-preview').src = `assets/perfil/perfil${selAvatar + 1}.jpeg`;
        });
    });
    document.querySelectorAll('#banner-picker .banner-pick').forEach(btn => {
        btn.addEventListener('click', () => {
            selBanner = parseInt(btn.dataset.i);
            document.querySelectorAll('#banner-picker .banner-pick').forEach(b => {
                b.style.borderColor = parseInt(b.dataset.i) === selBanner ? 'var(--primary-purple)' : 'transparent';
            });
        });
    });
    document.getElementById('edit-username').value = state.profile.name || '';
    document.getElementById('edit-email').value = state.profile.email || '';
    document.getElementById('save-profile').addEventListener('click', () => {
        const name = document.getElementById('edit-username').value.trim();
        if (!name) { showToast('Digite um nome de usuário.', 'error'); return; }
        state.profile.name = name;
        state.profile.email = document.getElementById('edit-email').value.trim();
        state.profile.avatar = selAvatar;
        state.profile.banner = selBanner;
        saveState(); updateUI(); closeModal();
        showToast('Perfil atualizado com sucesso!', 'success');
    });
}

function openPaymentModal() {
    openModal('Métodos de Pagamento',
        `<p class="text-secondary" style="margin-bottom:16px">Seus métodos de pagamento cadastrados:</p>
        <div class="security-item glass" style="margin-bottom:12px;display:flex;align-items:center;gap:12px">
            ${ic('carteira','text-purple')}
            <div style="flex:1"><h4>Nenhum método cadastrado</h4><p class="text-secondary" style="font-size:12px">Adicione um cartão ou conta bancária</p></div>
        </div>`,
        `<button class="btn-primary" id="add-payment">Adicionar Método</button>`
    );
    document.getElementById('add-payment').addEventListener('click', () => { closeModal(); showToast('Redirecionando para cadastro de pagamento...', 'info'); });
}

function openSupportModal() {
    openModal('Suporte — 24/7',
        `<p class="text-secondary" style="margin-bottom:20px">Como podemos ajudar?</p>
        <label class="modal-label">Assunto</label>
        <select class="modal-input" id="support-subject">
            <option>Problema com pagamento</option>
            <option>Problema com minerador</option>
            <option>Saque não processado</option>
            <option>Outro</option>
        </select>
        <label class="modal-label">Mensagem</label>
        <textarea class="modal-input" id="support-msg" rows="4" placeholder="Descreva seu problema..." style="resize:vertical"></textarea>`,
        `<button class="btn-primary" id="send-support">Enviar Mensagem</button>`
    );
    document.getElementById('send-support').addEventListener('click', () => {
        const msg = document.getElementById('support-msg').value.trim();
        if (!msg) { showToast('Escreva uma mensagem.', 'error'); return; }
        closeModal();
        showToast('Mensagem enviada! Resposta em até 1h.', 'success');
    });
}

function openFAQModal() {
    openModal('FAQ — Perguntas Frequentes',
        `<div class="faq-item">
            <h4>Como comprar um minerador?</h4>
            <p class="text-secondary">Acesse o Mercado, escolha um minerador e clique em Comprar usando MMT.</p>
        </div>
        <div class="faq-item">
            <h4>Como funciona o mining?</h4>
            <p class="text-secondary">Seus mineradores geram BTC continuamente. O valor é baseado no poder total (TH).</p>
        </div>
        <div class="faq-item">
            <h4>Como sacar meus ganhos?</h4>
            <p class="text-secondary">Acesse Carteira → Sacar. KYC e 2FA são necessários para saques.</p>
        </div>
        <div class="faq-item">
            <h4>O que é MMT?</h4>
            <p class="text-secondary">MMT (Moon Mining Token) é a moeda interna usada para comprar mineradores, geradores e componentes.</p>
        </div>
        <div class="faq-item">
            <h4>Como funciona a economia da mineração?</h4>
            <p class="text-secondary">Cada TH gera um valor fixo em USD por segundo. Moedas caras como BTC rendem poucos tokens; moedas baratas como USDT rendem muitos tokens. Você escolhe qual cripto cada mineradora gera. Energia insuficiente derruba a produção.</p>
        </div>
        <div class="faq-item">
            <h4>Como melhorar minhas mineradoras?</h4>
            <p class="text-secondary">Clique em uma mineradora sua para abrir o detalhe dela: lá você troca a cripto minerada e instala componentes (cooler, overclock, hashboard, PSU) que aumentam o poder e reduzem o consumo.</p>
        </div>`,
        ''
    );
}

// Endereços de carteira por moeda (tela Wallet — clique no ativo)
const WALLET_ADDRESSES = {
    btc: { name: 'Bitcoin', addr: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
    mmt: { name: 'Moon Mining Token', addr: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
    eth: { name: 'Ethereum', addr: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2' },
    usdt: { name: 'Tether', addr: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' },
    bnb: { name: 'BNB', addr: 'bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2' },
    sol: { name: 'Solana', addr: '7EqQdEUaxGfamilyHmBusaK9BP8U9J6QFv8nD8Q8r8FpF' },
};

window.openWalletAddress = function (coin) {
    const info = WALLET_ADDRESSES[coin];
    if (!info) return;
    openModal(`Carteira ${info.name}`,
        `<div style="text-align:center;padding:10px 0">
            <div style="margin-bottom:12px">${coinIcon(coin, 48)}</div>
            <h4 style="margin-bottom:12px">Endereço de depósito (${coin.toUpperCase()})</h4>
            <p class="text-secondary" style="font-size:12px;word-break:break-all;background:rgba(255,255,255,0.05);padding:12px;border-radius:10px" id="wallet-addr">${info.addr}</p>
            <p class="text-secondary" style="font-size:12px;margin-top:10px">Envie apenas ${coin.toUpperCase()} para este endereço.</p>
        </div>`,
        `<button class="btn-primary" id="copy-addr">Copiar endereço</button>`
    );
    document.getElementById('copy-addr').addEventListener('click', () => {
        navigator.clipboard.writeText(info.addr).then(() => showToast('Endereço copiado!', 'success'));
    });
}

window.switchView = function (viewName) {
    // Update active nav button
    navBtns.forEach(btn => {
        if (btn.getAttribute('data-target') === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update active view
    views.forEach(view => {
        if (view.id === `view-${viewName}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    // Update Title
    const titles = {
        'home': 'Início',
        'market': 'Mercado',
        'miners': 'Meus Mineradores',
        'wallet': 'Carteira',
        'profile': 'Perfil'
    };
    pageTitle.textContent = titles[viewName];
    window.scrollTo(0, 0);
}

function toggleSidebar(show) {
    if (show) {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
    } else {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'security';
    if (type === 'error') icon = 'alerta';
    if (type === 'info') icon = 'sino_ligado';

    toast.innerHTML = `${ic(icon)} <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Tela de carregamento: some depois que tudo carregou (mínimo 1.8s para a logo aparecer)
const SPLASH_MIN_MS = 15000;
const splashStart = performance.now();
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - splashStart));
    setTimeout(() => {
        splash.classList.add('hide');
        splash.addEventListener('transitionend', () => splash.remove(), { once: true });
        setTimeout(() => splash.remove(), 1000); // garantia
    }, wait);
});

// Boot
document.addEventListener('DOMContentLoaded', init);

// --- Dev helpers (atalhos para testes) ---
window.devAdd = function () {
    state.crypto.mmt += 10000;
    state.usdBalance += 10000;
    state.crypto.btc += 0.005;
    saveState(); updateUI();
    showToast(`${ic('earn', 'text-purple')} DEV: +10.000 MMT, +$10.000 USD, +0.005 BTC`, 'success');
};
window.devFreeEnergy = function () {
    state.generators.push({ id: 'dev_gen_' + Date.now(), name: 'Gerador Dev', output: 5000, instanceId: Date.now() });
    saveState(); updateUI();
    showToast(`${ic('raio_circulo', 'text-purple')} DEV: Gerador de 5000 W adicionado`, 'success');
};
window.devReset = function () {
    localStorage.clear();
    location.reload();
};
