// Helper: ícone SVG inline (ICONS vem do icons.js)
function ic(name, cls = '') {
    return `<i class="icon ${cls}">${ICONS[name] || ''}</i>`;
}

// =============================================
// MODAL SYSTEM
// =============================================
function openModal(title, bodyHTML, footerHTML = '') {
    // Remove existing modal
    closeModal();
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
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    return overlay;
}

function closeModal() {
    const existing = document.getElementById('modal-overlay');
    if (existing) existing.remove();
}

// --- State Management ---
const INITIAL_STATE = {
    usdBalance: 1500.00,
    crypto: {
        btc: 0.00000000,
        gmt: 100.00, // Moon Mining Token
    },
    ownedMiners: [],
    vipLevel: 'Bronze I'
};

let state = JSON.parse(localStorage.getItem('moonMiningState')) || INITIAL_STATE;

// Market Items (Mock Data)
const marketMiners = [
    {
        id: 'miner_1',
        name: 'The Mine Box #267404',
        power: 3, // TH
        efficiency: 20, // W/TH
        roi: 56.98, // %
        priceGMT: 120.00,
        oldPriceGMT: 150.00,
    },
    {
        id: 'miner_2',
        name: 'Pro Rack #883921',
        power: 10,
        efficiency: 22,
        roi: 62.40,
        priceGMT: 350.00,
        oldPriceGMT: 400.00,
    },
    {
        id: 'miner_3',
        name: 'Elite ASIC #10923',
        power: 25,
        efficiency: 18,
        roi: 75.10,
        priceGMT: 800.00,
        oldPriceGMT: 950.00,
    }
];

// Constants for simulation
const BTC_PRICE = 64230.00;
const GMT_PRICE = 0.32;
const BTC_REWARD_PER_TH_PER_SEC = 0.00000001; // Fake rate for simulation

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
const elGmtBalance = document.getElementById('asset-gmt-balance');
const elGmtUsd = document.getElementById('asset-gmt-usd');

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
    // Calculate total USD value
    const btcUsdVal = state.crypto.btc * BTC_PRICE;
    const gmtUsdVal = state.crypto.gmt * GMT_PRICE;
    const totalUsd = state.usdBalance + btcUsdVal + gmtUsdVal;

    // Calculate total power
    const totalPower = state.ownedMiners.reduce((sum, miner) => sum + miner.power, 0);

    // Update Home & Wallet
    const formattedTotal = `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elTotalBalance.textContent = formattedTotal;
    elWalletBalance.textContent = formattedTotal;
    elTotalPower.textContent = `${totalPower.toFixed(2)} TH`;
    elFarmPower.textContent = `${totalPower.toFixed(2)} TH`;

    // Update Assets
    elBtcBalance.textContent = state.crypto.btc.toFixed(8);
    elBtcUsd.textContent = `$${btcUsdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    elGmtBalance.textContent = state.crypto.gmt.toFixed(2);
    elGmtUsd.textContent = `$${gmtUsdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    renderOwnedMiners();
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
        const item = document.createElement('div');
        item.className = 'owned-miner-card glass';
        item.innerHTML = `
            <div class="owned-miner-icon moon-token-owned">
                <img src="crypto-icons/moon-token.png" alt="Moon Token" class="owned-moon-img">
            </div>
            <div class="owned-miner-details">
                <h4>${miner.name}</h4>
                <div style="display: flex; justify-content: space-between; font-size: 12px;" class="text-secondary">
                    <span>${miner.power} TH</span>
                    <span class="text-green">Active</span>
                </div>
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
        minerTemplate = { id: minerId, name, power, efficiency, roi, priceGMT: price };
    } else {
        const allItems = Object.values(marketCategories || {}).flat();
        minerTemplate = allItems.find(m => m.id === minerId) || marketMiners.find(m => m.id === minerId);
    }
    if (!minerTemplate) return;

    if (state.crypto.gmt >= minerTemplate.priceGMT) {
        showToast('Processando transação...', 'info');
        const buyBtn = event.target;
        buyBtn.innerHTML = '<span class="spinner"></span>';
        buyBtn.disabled = true;

        setTimeout(() => {
            state.crypto.gmt -= minerTemplate.priceGMT;
            state.ownedMiners.push({ ...minerTemplate, instanceId: Date.now() });
            saveState();
            updateUI();
            // Re-render current tab
            const activeTab = document.querySelector('.market-tabs .tab-btn.active');
            const activeSub = document.querySelector('.market-subtabs .subtab-btn.active');
            if (activeTab) activeTab.click();
            showToast(`${minerTemplate.name} comprado com sucesso!`, 'success');
        }, 1500);

    } else {
        showToast('GMT insuficiente.', 'error');
    }
}

// --- Simulation Loop ---
function startMiningLoop() {
    setInterval(() => {
        const totalPower = state.ownedMiners.reduce((sum, miner) => sum + miner.power, 0);
        if (totalPower > 0) {
            const reward = totalPower * BTC_REWARD_PER_TH_PER_SEC;
            state.crypto.btc += reward;
            // Only update DOM elements that change frequently to save performance
            elBtcBalance.textContent = state.crypto.btc.toFixed(8);

            const btcUsdVal = state.crypto.btc * BTC_PRICE;
            elBtcUsd.textContent = `$${btcUsdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            const gmtUsdVal = state.crypto.gmt * GMT_PRICE;
            const totalUsd = state.usdBalance + btcUsdVal + gmtUsdVal;
            const formattedTotal = `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
            if (view === 'listings') {
                openModal('Os meus listings',
                    `<div style="text-align:center;padding:20px 0">
                        <div style="font-size:48px;margin-bottom:16px">${ic('config','text-purple')}</div>
                        <h3 style="margin-bottom:8px">Nenhum listing ativo</h3>
                        <p class="text-secondary">Seus mineradores listados para venda aparecerão aqui.</p>
                    </div>`,
                    `<button class="btn-primary" onclick="switchView('miners');closeModal()">Ver Meus Mineradores</button>`
                );
                return;
            }
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
    if (gridCards[1]) gridCards[1].addEventListener('click', () => switchView('miners'));
    if (gridCards[2]) gridCards[2].addEventListener('click', openVIPModal);
    if (gridCards[3]) gridCards[3].addEventListener('click', openCashbackModal);

    // ---- MARKET Tabs ----
    setupMarketTabs();

    // ---- MINERS Action Buttons ----
    const minerActions = document.querySelectorAll('.miners-action-row .icon-btn');
    if (minerActions[0]) minerActions[0].addEventListener('click', openMinerStatsModal);
    if (minerActions[1]) minerActions[1].addEventListener('click', openUpgradePowerModal);
    if (minerActions[2]) minerActions[2].addEventListener('click', () => switchView('market'));
    if (minerActions[3]) minerActions[3].addEventListener('click', openMinerSettingsModal);

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
        `<p class="text-secondary" style="margin-bottom:20px">Crie um novo minerador personalizado usando seus tokens GMT.</p>
        <label class="modal-label">Nome do Minerador</label>
        <input class="modal-input" id="miner-name-input" placeholder="Ex: My ASIC Pro" />
        <label class="modal-label">Poder de Mineração</label>
        <select class="modal-input" id="miner-power-select">
            <option value="1">1 TH — 10 GMT</option>
            <option value="5">5 TH — 45 GMT</option>
            <option value="10">10 TH — 80 GMT</option>
        </select>`,
        `<button class="btn-primary" id="confirm-criar">Criar Minerador</button>`
    );
    document.getElementById('confirm-criar').addEventListener('click', () => {
        const name = document.getElementById('miner-name-input').value.trim();
        const power = parseInt(document.getElementById('miner-power-select').value);
        const costs = { 1: 10, 5: 45, 10: 80 };
        const cost = costs[power];
        if (!name) { showToast('Digite um nome para o minerador.', 'error'); return; }
        if (state.crypto.gmt < cost) { showToast(`GMT insuficiente. Necessário: ${cost} GMT`, 'error'); return; }
        state.crypto.gmt -= cost;
        state.ownedMiners.push({ id: `custom_${Date.now()}`, name, power, efficiency: 25, roi: 50, priceGMT: cost, instanceId: Date.now() });
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
            <div class="earn-card glass" data-apy="12.69" data-token="GMT">
                <h4>${ic('cpu')} GMT Staking</h4>
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
            <p class="text-secondary" style="margin-top:12px;font-size:12px;">Você ganhou: <strong class="text-green">0 GMT</strong> em referrals</p>
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
                <div class="bonus-task"><span>${ic('check','text-green')} Login diário</span><span class="text-green">+2 GMT</span></div>
                <div class="bonus-task"><span>${ic('raio','text-secondary')} Minerar 24h</span><span class="text-secondary">Pendente</span></div>
                <div class="bonus-task"><span>${ic('referal','text-secondary')} Fazer referral</span><span class="text-secondary">Pendente</span></div>
            </div>
        </div>`,
        ''
    );
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

function openVIPModal() {
    openModal('VIP Progress',
        `<div style="text-align:center;padding:10px 0">
            <div style="font-size:48px;margin-bottom:12px">${ic('coroa', 'text-purple')}</div>
            <h3>Bronze II</h3>
            <p class="text-secondary" style="margin:8px 0 20px">Progresso para Silver I</p>
            <div class="progress-bar" style="height:10px;border-radius:5px;margin-bottom:8px">
                <div class="progress-fill" style="width:45%;background:var(--primary-purple)"></div>
            </div>
            <p class="text-secondary">45% / 100% completado</p>
            <div style="margin-top:20px;text-align:left">
                <p class="text-secondary" style="margin-bottom:8px">Benefícios atuais (Bronze II):</p>
                <p>${ic('check','text-green')} 10% de desconto em mineradores</p>
                <p>${ic('check','text-green')} Suporte prioritário</p>
                <p>${ic('check','text-secondary')} Cashback de 1.5%</p>
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
        { id:'miner_1', name:'The Mine Box #267404', power:3, efficiency:20, roi:56.98, priceGMT:120, oldPriceGMT:150 },
        { id:'miner_2', name:'Pro Rack #883921', power:10, efficiency:22, roi:62.40, priceGMT:350, oldPriceGMT:400 },
        { id:'miner_3', name:'Elite ASIC #10923', power:25, efficiency:18, roi:75.10, priceGMT:800, oldPriceGMT:950 }
    ],
    'MoonMiners': [
        { id:'mm_1', name:'Moon Starter #001', power:5, efficiency:19, roi:60.00, priceGMT:200, oldPriceGMT:250 },
        { id:'mm_2', name:'Moon Pro #088', power:15, efficiency:17, roi:70.00, priceGMT:500, oldPriceGMT:600 }
    ],
    'Viagem': [
        { id:'vi_1', name:'Lunar Express #333', power:8, efficiency:21, roi:65.00, priceGMT:280, oldPriceGMT:320 }
    ],
    'Mercadorias': [
        { id:'mc_1', name:'Hash Boost Pack', power:2, efficiency:30, roi:45.00, priceGMT:50, oldPriceGMT:70 },
        { id:'mc_2', name:'Power Bundle XL', power:20, efficiency:16, roi:80.00, priceGMT:700, oldPriceGMT:850 }
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
            items = items.map(m => ({...m, priceGMT: Math.round(m.priceGMT * 0.7), oldPriceGMT: m.priceGMT, name: m.name + ' [AUCTION]'}));
        } else if (activeSubtab === 'Special') {
            items = items.filter((_, i) => i === 0).map(m => ({...m, priceGMT: Math.round(m.priceGMT * 0.5), oldPriceGMT: m.priceGMT, name: m.name + ' [SPECIAL]'}));
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
    items.forEach(miner => {
        const canAfford = state.crypto.gmt >= miner.priceGMT;
        const card = document.createElement('div');
        card.className = 'miner-card glass';
        card.innerHTML = `
            <div class="miner-image-placeholder">
                <img src="crypto-icons/moon-token.png" alt="Moon Token" class="miner-moon-token">
                <div class="miner-badges">
                    <span class="badge">${ic('raio')}${miner.power} TH</span>
                    <span class="badge">${ic('cpu')}${miner.efficiency} W/TH</span>
                    <span class="badge text-green">${ic('graph_up')}${miner.roi}% ROI</span>
                </div>
            </div>
            <div class="miner-info">
                <h3>${miner.name}</h3>
                <div class="miner-price-row">
                    <span class="new-price">${ic('etiqueta_preco')} ${miner.priceGMT} GMT</span>
                    <span class="old-price">${miner.oldPriceGMT}</span>
                </div>
                <button class="btn-primary" onclick="buyMiner('${miner.id}', ${miner.priceGMT}, '${miner.name}', ${miner.power}, ${miner.efficiency}, ${miner.roi})" ${!canAfford ? 'disabled' : ''}>
                    ${canAfford ? 'Comprar' : 'Insuficiente GMT'}
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
    const dailyBTC = totalPower * BTC_REWARD_PER_TH_PER_SEC * 86400;
    const dailyUSD = dailyBTC * BTC_PRICE;
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
                <p class="text-secondary">BTC/dia</p>
                <h3 class="text-green">${dailyBTC.toFixed(6)}</h3>
            </div>
            <div class="glass" style="padding:16px;border-radius:12px;text-align:center">
                <p class="text-secondary">USD/dia</p>
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
                <h4>+10 TH Booster</h4><p class="text-purple">50 GMT</p>
            </div>
            <div class="earn-card glass" style="cursor:pointer" data-boost="50" data-cost="200">
                <h4>+50 TH Booster</h4><p class="text-purple">200 GMT</p>
            </div>
            <div class="earn-card glass" style="cursor:pointer" data-boost="100" data-cost="350">
                <h4>+100 TH Booster</h4><p class="text-purple">350 GMT</p>
            </div>
        </div>`,
        ''
    );
    document.querySelectorAll('.earn-card').forEach(card => {
        card.addEventListener('click', () => {
            const boost = parseInt(card.dataset.boost);
            const cost = parseInt(card.dataset.cost);
            if (state.crypto.gmt < cost) { showToast(`GMT insuficiente. Necessário: ${cost}`, 'error'); return; }
            if (state.ownedMiners.length === 0) { showToast('Você não tem mineradores para dar upgrade.', 'error'); return; }
            state.crypto.gmt -= cost;
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
            <option value="gmt">GMT (${state.crypto.gmt.toFixed(2)})</option>
            <option value="btc">BTC (${state.crypto.btc.toFixed(8)})</option>
        </select>
        <label class="modal-label">Valor</label>
        <input class="modal-input" id="convert-amount" type="number" placeholder="0.00" />
        <label class="modal-label">Para</label>
        <select class="modal-input" id="convert-to">
            <option value="gmt">GMT</option>
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
        const rates = { usd: 1, btc: 1/BTC_PRICE, gmt: 1/GMT_PRICE };
        const usdVal = amount / rates[from];
        if (from === 'usd' && state.usdBalance < amount) { showToast('Saldo USD insuficiente.', 'error'); return; }
        if (from === 'gmt' && state.crypto.gmt < amount) { showToast('Saldo GMT insuficiente.', 'error'); return; }
        if (from === 'btc' && state.crypto.btc < amount) { showToast('Saldo BTC insuficiente.', 'error'); return; }
        if (from === 'usd') state.usdBalance -= amount; else if (from === 'gmt') state.crypto.gmt -= amount; else state.crypto.btc -= amount;
        const received = usdVal * rates[to];
        if (to === 'usd') state.usdBalance += received; else if (to === 'gmt') state.crypto.gmt += received; else state.crypto.btc += received;
        saveState(); updateUI(); closeModal();
        showToast(`Convertido! Recebeu ${received.toFixed(6)} ${to.toUpperCase()}`, 'success');
    });
}

function openInstantModal() {
    openModal('Instant Transfer',
        `<p class="text-secondary" style="margin-bottom:20px">Transfira GMT instantaneamente para outro usuário.</p>
        <label class="modal-label">ID do Destinatário</label>
        <input class="modal-input" id="instant-to" placeholder="Ex: a1b2c3d4" />
        <label class="modal-label">Quantidade (GMT)</label>
        <input class="modal-input" id="instant-amount" type="number" placeholder="0.00" />`,
        `<button class="btn-primary" id="confirm-instant">Enviar</button>`
    );
    document.getElementById('confirm-instant').addEventListener('click', () => {
        const to = document.getElementById('instant-to').value.trim();
        const amount = parseFloat(document.getElementById('instant-amount').value);
        if (!to) { showToast('Digite o ID do destinatário.', 'error'); return; }
        if (!amount || amount <= 0) { showToast('Digite um valor válido.', 'error'); return; }
        if (state.crypto.gmt < amount) { showToast('GMT insuficiente.', 'error'); return; }
        state.crypto.gmt -= amount;
        saveState(); updateUI(); closeModal();
        showToast(`${amount.toFixed(2)} GMT enviado para ${to}!`, 'success');
    });
}

function openSacarModal() {
    openModal('Sacar',
        `<p class="text-secondary" style="margin-bottom:20px">Saque fundos para sua carteira externa.</p>
        <div class="banner glass" style="margin-bottom:16px;cursor:default">${ic('security','text-purple')} <div class="banner-text"><h4>KYC necessário</h4><p class="text-secondary">Ative 2FA para saques.</p></div></div>
        <label class="modal-label">Moeda</label>
        <select class="modal-input" id="sacar-currency">
            <option value="btc">BTC</option>
            <option value="gmt">GMT</option>
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
        const bal = currency === 'btc' ? state.crypto.btc : state.crypto.gmt;
        if (bal < amount) { showToast('Saldo insuficiente.', 'error'); return; }
        if (currency === 'btc') state.crypto.btc -= amount; else state.crypto.gmt -= amount;
        saveState(); updateUI(); closeModal();
        showToast(`Saque de ${amount} ${currency.toUpperCase()} solicitado!`, 'info');
    });
}

function openStakeModal() {
    openModal('Staking — Earn up to 12.69% APR',
        `<div class="earn-options">
            <div class="earn-card glass" data-apr="6" data-days="7" data-token="GMT">
                <h4>Flexível</h4><p class="text-green" style="font-size:20px;font-weight:600;">6% APR</p><p class="text-secondary">Sem bloqueio</p>
            </div>
            <div class="earn-card glass" data-apr="10" data-days="30" data-token="GMT">
                <h4>30 Dias</h4><p class="text-green" style="font-size:20px;font-weight:600;">10% APR</p><p class="text-secondary">Bloqueio: 30 dias</p>
            </div>
            <div class="earn-card glass" data-apr="12.69" data-days="90" data-token="GMT">
                <h4>90 Dias</h4><p class="text-green" style="font-size:20px;font-weight:600;">12.69% APR</p><p class="text-secondary">Bloqueio: 90 dias</p>
            </div>
        </div>
        <label class="modal-label" style="margin-top:16px">Quantidade GMT para fazer stake</label>
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
        if (state.crypto.gmt < amount) { showToast('GMT insuficiente.', 'error'); return; }
        state.crypto.gmt -= amount;
        saveState(); updateUI(); closeModal();
        showToast(`${amount.toFixed(2)} GMT em stake a ${selected.dataset.apr}% APR!`, 'success');
    });
}

// =============================================
// PROFILE MODALS
// =============================================
function openEditProfileModal() {
    openModal('Editar Perfil',
        `<div style="text-align:center;margin-bottom:20px">
            <div class="profile-avatar" style="width:80px;height:80px;font-size:40px;margin:0 auto 12px">${ic('perfil','text-purple')}</div>
            <button class="btn-sm" style="background:var(--primary-purple);border:none;padding:8px 16px;border-radius:20px;color:white;cursor:pointer" id="change-avatar">Trocar Avatar</button>
        </div>
        <label class="modal-label">Nome de usuário</label>
        <input class="modal-input" id="edit-username" placeholder="Seu nome" />
        <label class="modal-label">E-mail</label>
        <input class="modal-input" id="edit-email" type="email" placeholder="seu@email.com" />`,
        `<button class="btn-primary" id="save-profile">Salvar Perfil</button>`
    );
    document.getElementById('change-avatar').addEventListener('click', () => showToast('Funcionalidade de avatar em breve!', 'info'));
    document.getElementById('save-profile').addEventListener('click', () => {
        const name = document.getElementById('edit-username').value.trim();
        if (!name) { showToast('Digite um nome de usuário.', 'error'); return; }
        closeModal();
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
            <p class="text-secondary">Acesse o Mercado, escolha um minerador e clique em Comprar usando GMT.</p>
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
            <h4>O que é GMT?</h4>
            <p class="text-secondary">GMT (Moon Mining Token) é a moeda interna usada para comprar mineradores e serviços.</p>
        </div>`,
        ''
    );
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
    pageTitle.innerHTML = `${titles[viewName]} ${ic('seta_baixo_sanfona', 'text-secondary')}`;
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
    if (type === 'error') icon = 'graph_down';
    if (type === 'info') icon = 'sino_ligado';

    toast.innerHTML = `${ic(icon)} <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Tela de carregamento: some depois que tudo carregou (mínimo 1.8s para a logo aparecer)
const SPLASH_MIN_MS = 1800;
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