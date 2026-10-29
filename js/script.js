/**
 * Moana Jump - Lógica do Jogo e Integração com Ranking MySQL (Laragon)
 *
 *  - 3 vidas, moedas e conchas dão pontos
 *  - velocidade e dificuldade crescentes (estilo jogo do dinossauro)
 *  - 4 personagens à escolha; fantasma aparece quando as vidas acabam
 */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    /* =====================================================
       CONFIGURAÇÃO (mexa aqui para ajustar a dificuldade)
       ===================================================== */
    const CFG = {
        groundY: 38,          // altura do "chão" em px
        startX: 100,          // posição do personagem na tela
        gravity: 2800,        // px/s²
        jumpV: 880,           // velocidade inicial do pulo
        
        // Curva de velocidade do nível 1 ao 15:
        levelSpeeds: [
            360,   // Nível 1
            430,   // Nível 2
            720,   // Nível 3
            760,   // Nível 4
            920,   // Nível 5
            1080,  // Nível 6
            1240,  // Nível 7
            1350,  // Nível 8
            1550,  // Nível 9
            2200,  // Nível 10: IMPOSSÍVEL!
            2600,  // Nível 11: IMPOSSÍVEL+
            3000,  // Nível 12: IMPOSSÍVEL++
            3500,  // Nível 13: EXTREMO!
            4000,  // Nível 14: VELOCIDADE MÁXIMA!
            4800   // Nível 15: LIMITE NORMAL!
        ],
        maxSpeed: 99999,      // Removido o teto limite para permitir a aceleração tripla
        speedEase: 5.0,       // Transição instantânea para acompanhar os saltos de velocidade
        levelEvery: 15,       // Segundos para subir de nível
        lives: 3,
        invulnTime: 1.5,
        coinValue: 10,
        shellValue: 50,
        distDivisor: 40
    };
    const CHARACTERS = [
        { src: 'assets/personagem-1.png', base: 'assets/personagem-1-base.png', run: ['assets/personagem-1-corre1.png', 'assets/personagem-1-corre2.png'], body: 0.50 },
        { src: 'assets/personagem-2.png', base: 'assets/personagem-2-base.png', run: ['assets/personagem-2-corre1.png', 'assets/personagem-2-corre2.png'], body: 0.38 },
        { src: 'assets/personagem-3.png', base: 'assets/personagem-3-base.png', run: ['assets/personagem-3-corre1.png', 'assets/personagem-3-corre2.png'], body: 0.50 },
        { src: 'assets/personagem-4.png', base: 'assets/personagem-4-base.png', run: ['assets/personagem-4-corre1.png', 'assets/personagem-4-corre2.png'], body: 0.50 }
    ];

    // Obstáculos (w/h = tamanho em px na tela). minLevel = nível em que passam a aparecer.
    const OBSTACLES = {
        pedra:      { src: 'assets/pedra.png',      w: 60,  h: 48, minLevel: 1, weight: 3 },
        coral:      { src: 'assets/coral.png',      w: 51,  h: 78, minLevel: 1, weight: 3 },
        tronco:     { src: 'assets/tronco.png',     w: 96,  h: 36, minLevel: 1, weight: 3 },
        pedras:     { src: 'assets/pedras.png',     w: 108, h: 51, minLevel: 2, weight: 3 },
        gaivota:    { src: 'assets/gaivota-1.png', alt: 'assets/gaivota-2.png', w: 66, h: 42, minLevel: 3, weight: 2, fly: [112, 134] },
        caranguejo: { src: 'assets/caranguejo.png', w: 57,  h: 39, minLevel: 4, weight: 2 }
    };

    const ITEMS = {
        moeda:  { src: 'assets/moeda.png',  w: 28, h: 28 },
        concha: { src: 'assets/concha.png', w: 36, h: 28 }
    };

    /* =====================================================
       ELEMENTOS
       ===================================================== */
    const board = document.getElementById('game-board');
    const cloudsEl = document.getElementById('layer-clouds');
    const worldEl = document.getElementById('layer-world');
    const sandStrip = document.getElementById('sand-strip');
    const playerEl = document.getElementById('player');
    const playerImg = document.getElementById('player-img');
    const ghostEl = document.getElementById('ghost');

    const hudPlayerName = document.getElementById('hud-player-name');
    const scoreDisplay = document.getElementById('score-display');
    const coinDisplay = document.getElementById('coin-display');
    const levelDisplay = document.getElementById('level-display');
    const livesDisplay = document.getElementById('lives-display');
    const jumpTip = document.getElementById('jump-tip');
    const levelBanner = document.getElementById('level-banner');
    const muteBtn = document.getElementById('mute-btn');

    const startModal = document.getElementById('start-modal');
    const startForm = document.getElementById('start-form');
    const playerInput = document.getElementById('player-input');
    const btnViewRanking = document.getElementById('btn-view-ranking');
    const charCards = Array.from(document.querySelectorAll('.char-card'));
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const tsName = document.getElementById('ts-name');
    const tsTop = document.getElementById('ts-top');

    const gameoverModal = document.getElementById('gameover-modal');
    const gameoverTitle = document.getElementById('gameover-title');
    const finalScoreValue = document.getElementById('final-score-value');
    const finalStats = document.getElementById('final-stats');
    const saveStatusMsg = document.getElementById('save-status-msg');
    const rankingBody = document.getElementById('ranking-body');
    const btnRestart = document.getElementById('btn-restart');
    const btnChangePlayer = document.getElementById('btn-change-player');

    /* =====================================================
       ESTADO
       ===================================================== */
    let state = 'menu';          // 'menu' | 'playing' | 'dying' | 'over'
    let currentPlayer = '';
    let selectedChar = 0;

    let rafId = null;
    let overTimer = null;
    let lastTs = null;

    let time, speed, level, distance, distPoints, bonus, score;
    let coins, shells, lives, invuln;
    let py, vy, onGround, jumpBuffer;
    let runFrame = -1, nextSpawnX, cloudTimer, lastObstacle, boardW, playerW, px;
    let camX = 0, vx = 0, facing = 1, runT = 0;
    const keys = { left: false, right: false };
    let obstacles = [], items = [], clouds = [];

    // Pré-carrega imagens
    [...Object.values(OBSTACLES).flatMap(o => [o.src, o.alt].filter(Boolean)),
     ...Object.values(ITEMS).map(i => i.src),
     ...CHARACTERS.flatMap(c => [c.src, c.base, ...c.run]),
     'assets/fantasma.png', 'assets/nuvem.png', 'assets/coracao.png', 'assets/coracao-vazio.png'
    ].forEach(src => { const im = new Image(); im.src = src; });

    /* =====================================================
       ÁUDIO (efeitos simples, gerados no navegador)
       ===================================================== */
    let audioCtx = null;
    let muted = localStorage.getItem('moana_jump_muted') === '1';

    function getCtx() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) audioCtx = new AC();
        }
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function tone(freq, start, dur, type, vol, endFreq) {
        const ctx = getCtx();
        if (!ctx) return;
        const t0 = ctx.currentTime + start;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t0);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
        g.gain.setValueAtTime(vol || 0.05, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    }

    function sfx(name) {
        if (muted) return;
        switch (name) {
            case 'jump':  tone(360, 0, 0.14, 'square', 0.04, 760); break;
            case 'coin':  tone(988, 0, 0.07, 'square', 0.045); tone(1319, 0.07, 0.14, 'square', 0.045); break;
            case 'shell': tone(880, 0, 0.07, 'triangle', 0.08); tone(1175, 0.07, 0.07, 'triangle', 0.08); tone(1568, 0.14, 0.18, 'triangle', 0.08); break;
            case 'hit':   tone(240, 0, 0.3, 'sawtooth', 0.06, 70); break;
            case 'level': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.12, 'square', 0.04)); break;
            case 'die':   tone(480, 0, 0.9, 'triangle', 0.09, 90); break;
        }
    }

    function applyMute() {
        muteBtn.classList.toggle('muted', muted);
        muteBtn.textContent = muted ? '×' : '♪';
    }

    function toggleMute() {
        muted = !muted;
        localStorage.setItem('moana_jump_muted', muted ? '1' : '0');
        applyMute();
    }

    applyMute();

    /* =====================================================
       UTILITÁRIOS
       ===================================================== */
    const rand = (min, max) => min + Math.random() * (max - min);
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
    const pad6 = n => String(Math.max(0, Math.floor(n))).padStart(6, '0');

    function setX(el, x) {
        el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function measurePlayer() {
        playerW = playerImg.getBoundingClientRect().width || 90;
    }
    playerImg.addEventListener('load', measurePlayer);

    /* =====================================================
       HUD
       ===================================================== */
    function renderLives(pulseIndex) {
        livesDisplay.innerHTML = '';
        for (let i = 0; i < CFG.lives; i++) {
            const img = document.createElement('img');
            img.src = i < lives ? 'assets/coracao.png' : 'assets/coracao-vazio.png';
            img.alt = i < lives ? 'Vida' : 'Vida perdida';
            if (i === pulseIndex) img.classList.add('pulse');
            livesDisplay.appendChild(img);
        }
    }

    function updateHud() {
        scoreDisplay.textContent = pad6(score);
        coinDisplay.textContent = String(coins).padStart(2, '0');
        levelDisplay.textContent = level;
    }

    function showBanner(text) {
        levelBanner.textContent = text;
        levelBanner.classList.remove('show');
        void levelBanner.offsetWidth;
        levelBanner.classList.add('show');
    }

    /* =====================================================
       JOGO: início / reset
       ===================================================== */
    function resetWorld() {
        worldEl.innerHTML = '';
        cloudsEl.innerHTML = '';
        obstacles = [];
        items = [];
        clouds = [];
    }

    function startGame() {
        cancelAnimationFrame(rafId);
        clearTimeout(overTimer);
        resetWorld();

        ghostEl.classList.remove('show');
        playerEl.style.display = '';
        playerEl.style.opacity = '1';
        playerImg.src = CHARACTERS[selectedChar].base;
        runFrame = -1;
        measurePlayer();

        time = 0;
        speed = CFG.levelSpeeds[0];
        level = 1;
        distance = 0;
        distPoints = 0;
        bonus = 0;
        score = 0;
        coins = 0;
        shells = 0;
        lives = CFG.lives;
        invuln = 0;
        py = 0;
        vy = 0;
        onGround = true;
        jumpBuffer = 0;
        lastObstacle = null;
        boardW = board.clientWidth;
        px = CFG.startX;
        camX = 0;
        vx = 0;
        facing = 1;
        runT = 0;
        keys.left = keys.right = false;
        playerImg.style.transform = '';
        nextSpawnX = CFG.startX + boardW * 0.9;   // o primeiro obstáculo entra pela direita
        cloudTimer = 0;

        // nuvens iniciais espalhadas pela tela
        for (let i = 0; i < 2; i++) spawnCloud(rand(boardW * 0.2, boardW * 0.9));

        hudPlayerName.textContent = currentPlayer || 'Jogador';
        renderLives();
        updateHud();
        setPlayerPos();
        jumpTip.style.opacity = '1';

        playerEl.classList.add('running', 'grounded');
        state = 'playing';
        lastTs = null;
        rafId = requestAnimationFrame(loop);
    }

    /* =====================================================
       LOOP PRINCIPAL
       ===================================================== */
    function loop(ts) {
        if (state !== 'playing') return;
        if (lastTs === null) lastTs = ts;
        const dt = Math.min(0.05, (ts - lastTs) / 1000);
        lastTs = ts;

        update(dt);

        if (state === 'playing') rafId = requestAnimationFrame(loop);
    }

    function update(dt) {
        boardW = board.clientWidth;
        if (!playerW) measurePlayer();

        // --- tempo, velocidade e nível (dificuldade crescente)
        time += dt;
        const ls = CFG.levelSpeeds;
        const targetSpeed = Math.min(CFG.maxSpeed, level <= ls.length
            ? ls[level - 1]
            : ls[ls.length - 1] + (level - ls.length) * CFG.speedStepAfter);
        speed += (targetSpeed - speed) * Math.min(1, dt * CFG.speedEase);
        const lv = 1 + Math.floor(time / CFG.levelEvery);
        if (lv !== level) {
            level = lv;
            showBanner('NÍVEL ' + level);
            sfx('level');
        }

        // --- o personagem fica no lugar correndo; o cenário passa cada vez mais rápido
        const oldCam = camX;
        camX += speed * dt;
        px = camX + CFG.startX;
        const camDx = camX - oldCam;
        const realV = speed;

        distance = Math.max(distance, px);
        distPoints = Math.max(0, (distance - CFG.startX) / CFG.distDivisor);
        score = distPoints + bonus;

        // --- pulo
        if (jumpBuffer > 0) jumpBuffer -= dt;
        if (onGround && jumpBuffer > 0) doJump();
        if (!onGround) {
            vy -= CFG.gravity * dt;
            py += vy * dt;
            if (py <= 0) {
                py = 0;
                vy = 0;
                onGround = true;
                if (jumpBuffer > 0) doJump();
            }
        }
        playerEl.classList.toggle('grounded', onGround);

        // animação de corrida (troca de quadros, como o GIF do Mario)
        const ch = CHARACTERS[selectedChar];
        runT += Math.abs(realV) * dt / 260;
        const frame = (onGround && Math.abs(realV) > 25) ? (Math.floor(runT / 0.11) % 2) : -1;
        playerImg.style.transform = facing < 0 ? 'scaleX(-1)' : '';
        if (frame !== runFrame) {
            runFrame = frame;
            playerImg.src = frame < 0 ? ch.base : ch.run[frame];
        }
        setPlayerPos();

        // --- invencibilidade (pisca)
        if (invuln > 0) {
            invuln -= dt;
            playerEl.style.opacity = (Math.floor(invuln * 12) % 2) ? '0.3' : '1';
            if (invuln <= 0) playerEl.style.opacity = '1';
        }

        // --- chão em movimento
        sandStrip.style.setProperty('--off', (-camX).toFixed(1) + 'px');

        // --- a fase vai sendo montada à frente da câmera (obstáculos parados)
        while (nextSpawnX < camX + boardW + 200) spawnObstacle();

        // --- nuvens
        cloudTimer -= dt;
        if (cloudTimer <= 0) {
            spawnCloud(boardW + 20);
            cloudTimer = rand(3.5, 8);
        }
        for (let i = clouds.length - 1; i >= 0; i--) {
            const c = clouds[i];
            c.x -= c.v * dt + camDx * 0.3;
            setX(c.el, c.x);
            if (c.x < -c.w - 20) { c.el.remove(); clouds.splice(i, 1); }
        }

        // --- obstáculos
        const pb = playerBox();
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i];
            setX(o.el, o.x - camX);

            if (o.def.alt) {                       // animação da gaivota
                o.animT += dt;
                if (o.animT >= 0.16) {
                    o.animT = 0;
                    o.frame = 1 - o.frame;
                    o.el.src = o.frame ? o.def.alt : o.def.src;
                }
            }

            if (o.x - camX < -o.def.w - 40) { o.el.remove(); obstacles.splice(i, 1); continue; }

            if (invuln <= 0 && overlaps(pb, obstacleBox(o))) {
                o.el.remove();
                obstacles.splice(i, 1);
                hit();
                if (state !== 'playing') return;
            }
        }

        // --- moedas e conchas
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            setX(it.el, it.x - camX);
            if (it.x - camX < -it.def.w - 40) { it.el.remove(); items.splice(i, 1); continue; }

            if (overlaps(pb, itemBox(it))) collect(it, i);
        }

        updateHud();
    }

    /* =====================================================
       COLISÕES
       ===================================================== */
    function playerBox() {
        const hw = Math.min(50, Math.max(34, playerW * 0.36));
        const body = CHARACTERS[selectedChar].body;
        const left = px + playerW * (facing >= 0 ? body : 1 - body) - hw / 2;
        return { l: left, r: left + hw, b: py + 6, t: py + 102 };
    }

    function obstacleBox(o) {
        return {
            l: o.x + 8,
            r: o.x + o.def.w - 8,
            b: o.fly + 4,
            t: o.fly + o.def.h - 5
        };
    }

    function itemBox(it) {
        return { l: it.x + 2, r: it.x + it.def.w - 2, b: it.b, t: it.b + it.def.h };
    }

    function overlaps(a, b) {
        return a.l < b.r && a.r > b.l && a.b < b.t && a.t > b.b;
    }

    /* =====================================================
       PULO
       ===================================================== */
    function doJump() {
        vy = CFG.jumpV;
        onGround = false;
        jumpBuffer = 0;
        sfx('jump');
        jumpTip.style.opacity = '0';
    }

    function jump() {
        if (state !== 'playing') return;
        if (onGround) doJump();
        else jumpBuffer = 0.12;          // pulo "guardado" se apertar um pouco antes de pousar
    }

    /* =====================================================
       OBSTÁCULOS
       ===================================================== */
    function pickObstacle() {
        const pool = Object.entries(OBSTACLES).filter(([, d]) => d.minLevel <= level);
        let total = pool.reduce((s, [, d]) => s + d.weight, 0);
        let r = Math.random() * total;
        for (const [name, d] of pool) {
            r -= d.weight;
            if (r <= 0) {
                // evita repetir gaivota/caranguejo duas vezes seguidas
                if (name === lastObstacle && (d.fly || d.extraSpeed)) return pool[0];
                return [name, d];
            }
        }
        return pool[0];
    }

    function setPlayerPos() {
        playerEl.style.transform = 'translate3d(' + (px - camX).toFixed(1) + 'px,' + (-(py || 0)).toFixed(1) + 'px,0)';
    }

    function spawnObstacle() {
        const [name, def] = pickObstacle();
        lastObstacle = name;
        const x = nextSpawnX;
        placeObstacle(x, name, def);

        // distância até o próximo: diminui com o nível (mais obstáculos)
        const maxFactor = Math.max(1.0, 1.5 - 0.07 * (level - 1));
        const gap = def.w + 40 + speed * rand(0.72, maxFactor);
        nextSpawnX = x + gap;
        spawnCollectibles(x, def, gap, false);
    }

    function placeObstacle(x, name, def) {
        const fly = def.fly ? randInt(def.fly[0], def.fly[1]) : 0;
        const el = document.createElement('img');
        el.className = 'obstacle';
        el.src = def.src;
        el.alt = '';
        el.draggable = false;
        el.style.bottom = (CFG.groundY + fly) + 'px';
        setX(el, x - camX);
        worldEl.appendChild(el);
        obstacles.push({ el, def, x, fly, frame: 0, animT: 0 });
    }

    /* =====================================================
       MOEDAS E CONCHAS
       ===================================================== */
    function addItem(kind, x, b) {
        const def = ITEMS[kind];
        const el = document.createElement('img');
        el.className = 'item';
        el.src = def.src;
        el.alt = '';
        el.draggable = false;
        el.style.bottom = (CFG.groundY + b) + 'px';
        setX(el, x - camX);
        worldEl.appendChild(el);
        items.push({ el, def, kind, x, b });
    }

    function spawnCollectibles(x, def, gap, skipArc) {
        const centerX = x + def.w / 2;

        if (def.fly) {
            // embaixo da gaivota: moedas no chão (premia quem NÃO pula)
            if (Math.random() < 0.6) {
                for (let i = 0; i < 3; i++) addItem('moeda', centerX - 60 + i * 44, 8);
            }
        } else if (!skipArc && Math.random() < 0.55) {
            // arco de moedas sobre o obstáculo (premia quem pula)
            const n = Math.random() < 0.5 ? 3 : 5;
            const mid = (n - 1) / 2;
            const base = def.h + 22;
            for (let i = 0; i < n; i++) {
                const k = (i - mid) / mid;
                const b = base + 44 * (1 - k * k);
                const kind = (i === Math.round(mid) && Math.random() < 0.18) ? 'concha' : 'moeda';
                addItem(kind, centerX - 14 + (i - mid) * 40, b);
            }
        }

        // no meio do intervalo até o próximo obstáculo
        if (gap > 480) {
            const midX = x + gap * 0.5;
            if (Math.random() < 0.35) {
                for (let i = 0; i < 3; i++) addItem('moeda', midX - 44 + i * 44, 8);
            } else if (Math.random() < 0.2) {
                addItem('concha', midX, 100);      // exige pulo, mais arriscado
            }
        }
    }

    function collect(it, index) {
        const isShell = it.kind === 'concha';
        const value = isShell ? CFG.shellValue : CFG.coinValue;
        bonus += value;
        if (isShell) shells++; else coins++;
        score = distPoints + bonus;
        sfx(isShell ? 'shell' : 'coin');

        const pop = document.createElement('div');
        pop.className = 'pop' + (isShell ? ' shell' : '');
        pop.textContent = '+' + value;
        pop.style.left = (it.x - camX) + 'px';
        pop.style.bottom = (CFG.groundY + it.b + it.def.h) + 'px';
        board.appendChild(pop);
        setTimeout(() => pop.remove(), 800);

        it.el.remove();
        items.splice(index, 1);
    }

    /* =====================================================
       NUVENS
       ===================================================== */
    function spawnCloud(x) {
        const w = randInt(90, 170);
        const el = document.createElement('img');
        el.className = 'cloud';
        el.src = 'assets/nuvem.png';
        el.alt = '';
        el.draggable = false;
        el.style.width = w + 'px';
        el.style.top = randInt(8, 130) + 'px';
        setX(el, x);
        cloudsEl.appendChild(el);
        clouds.push({ el, x, w, v: rand(14, 38) });
    }

    /* =====================================================
       DANO / MORTE
       ===================================================== */
    function hit() {
        lives--;
        invuln = CFG.invulnTime;
        sfx('hit');
        renderLives(lives);

        board.classList.remove('hit');
        void board.offsetWidth;
        board.classList.add('hit');

        if (lives <= 0) die();
    }

    function die() {
        state = 'dying';
        cancelAnimationFrame(rafId);
        sfx('die');

        // o personagem some e o fantasma sobe do mesmo lugar
        const ghostW = ghostEl.getBoundingClientRect().width || 90;
        ghostEl.style.left = (px - camX + Math.max(0, (playerW - ghostW) / 2)) + 'px';
        ghostEl.style.bottom = (CFG.groundY + py) + 'px';
        playerEl.style.display = 'none';
        playerEl.classList.remove('running');
        void ghostEl.offsetWidth;
        ghostEl.classList.add('show');

        updateHud();
        overTimer = setTimeout(showGameOver, 1900);
    }

    /* =====================================================
       GAME OVER + RANKING
       ===================================================== */
    function showGameOver() {
        state = 'over';
        const finalScore = Math.floor(score);

        gameoverTitle.textContent = 'GAME OVER';
        finalScoreValue.textContent = finalScore;
        finalStats.textContent = 'Moedas: ' + coins + '  •  Conchas: ' + shells + '  •  Nível: ' + level;
        saveStatusMsg.textContent = 'Salvando pontuação no banco...';
        saveStatusMsg.style.color = '#ffcc00';

        gameoverModal.classList.add('active');
        saveScore(currentPlayer, finalScore);
    }

    function setServerStatus(online) {
        statusDot.classList.toggle('online', online);
        statusDot.classList.toggle('offline', !online);
        statusText.textContent = online ? 'Conectado ao MySQL' : 'MySQL indisponível (o jogo funciona, mas não salva o ranking)';
    }

    function saveScore(playerName, finalScore) {
        fetch('salvar_ranking.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: playerName, pontos: finalScore })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                saveStatusMsg.textContent = 'Pontuação registrada no banco!';
                saveStatusMsg.style.color = '#10b981';
                if (data.ranking) renderRanking(data.ranking, playerName, finalScore);
            } else {
                saveStatusMsg.textContent = '⚠️ ' + (data.message || 'Erro ao registrar.');
                saveStatusMsg.style.color = '#ef4444';
            }
        })
        .catch(err => {
            console.error('Erro na requisição:', err);
            saveStatusMsg.textContent = '⚠️ Erro ao conectar ao servidor Laragon.';
            saveStatusMsg.style.color = '#ef4444';
        });
    }

    /**
     * Busca o ranking atualizado no banco
     */
    function fetchRanking() {
        fetch('obter_ranking.php')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.ranking) {
                    setServerStatus(true);
                    renderRanking(data.ranking);
                }
            })
            .catch(err => {
                console.error('Erro ao buscar ranking:', err);
                setServerStatus(false);
            });
    }

    /**
     * Atualiza a tabela HTML do ranking
     */
    function renderRanking(list, highlightName = null, highlightScore = null) {
        if (!rankingBody) return;
        rankingBody.innerHTML = '';

        if (!list || list.length === 0) {
            rankingBody.innerHTML = '<tr><td colspan="3" class="loading-cell">Nenhuma pontuação gravada ainda. Jogue para ser o 1º!</td></tr>';
            return;
        }

        if (tsTop) tsTop.textContent = pad6(list[0].pontos);

        let highlighted = false;

        list.forEach((item, index) => {
            const tr = document.createElement('tr');

            // Destaca a pontuação atual recém-salva se coincidir
            if (!highlighted && highlightName && item.nome === highlightName && parseInt(item.pontos, 10) === highlightScore) {
                tr.classList.add('highlight-current');
                highlighted = true;
            }

            let medal = (index + 1) + 'º';
            if (index === 0) medal = '🥇 1º';
            else if (index === 1) medal = '🥈 2º';
            else if (index === 2) medal = '🥉 3º';

            tr.innerHTML = `
                <td class="ranking-pos">${medal}</td>
                <td><strong>${escapeHtml(item.nome)}</strong></td>
                <td>${parseInt(item.pontos, 10)} pts</td>
            `;

            rankingBody.appendChild(tr);
        });
    }

    /* =====================================================
       TELA INICIAL: nome + personagem
       ===================================================== */
    function selectChar(index, save) {
        selectedChar = (index + CHARACTERS.length) % CHARACTERS.length;
        charCards.forEach((card, i) => {
            card.classList.toggle('selected', i === selectedChar);
            card.setAttribute('aria-pressed', i === selectedChar ? 'true' : 'false');
        });
        if (save) localStorage.setItem('moana_jump_char', String(selectedChar));
    }

    charCards.forEach((card, i) => {
        card.addEventListener('click', () => selectChar(i, true));
    });

    // Recupera último nome e personagem utilizados
    const savedName = localStorage.getItem('moana_jump_player');
    if (savedName) playerInput.value = savedName;
    const savedChar = parseInt(localStorage.getItem('moana_jump_char'), 10);
    selectChar(Number.isInteger(savedChar) ? savedChar : 0, false);

    function syncTitleName() {
        if (tsName) tsName.textContent = (playerInput.value.trim() || '---').toUpperCase().slice(0, 8);
    }
    playerInput.addEventListener('input', syncTitleName);
    syncTitleName();

    // Submit do Formulário de Início (INICIAR JOGO)
    startForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameValue = playerInput.value.trim();
        if (!nameValue) {
            playerInput.focus();
            return;
        }

        currentPlayer = nameValue;
        localStorage.setItem('moana_jump_player', currentPlayer);
        localStorage.setItem('moana_jump_char', String(selectedChar));

        getCtx();                                  // libera o áudio (precisa de um clique/tecla)
        startModal.classList.remove('active');
        startGame();
    });

    // Botão "VER RANKING" na tela inicial
    btnViewRanking.addEventListener('click', () => {
        fetchRanking();
        gameoverTitle.textContent = 'RANKING';
        finalScoreValue.textContent = '---';
        finalStats.textContent = '';
        saveStatusMsg.textContent = '';
        startModal.classList.remove('active');
        gameoverModal.classList.add('active');
    });

    // Botão "JOGAR NOVAMENTE" no Game Over
    btnRestart.addEventListener('click', () => {
        gameoverModal.classList.remove('active');
        if (!currentPlayer) {
            startModal.classList.add('active');
            playerInput.focus();
        } else {
            getCtx();
            startGame();
        }
    });

    // Botão "TROCAR JOGADOR / PERSONAGEM" no Game Over
    btnChangePlayer.addEventListener('click', () => {
        gameoverModal.classList.remove('active');
        state = 'menu';
        startModal.classList.add('active');
        playerInput.focus();
        playerInput.select();
    });

    /* =====================================================
       CONTROLES
       ===================================================== */
    document.addEventListener('keydown', (e) => {
        // Tela inicial: setas trocam o personagem (se não estiver digitando)
        if (startModal.classList.contains('active')) {
            if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
                !(document.activeElement === playerInput && playerInput.value.length > 0)) {
                e.preventDefault();
                selectChar(selectedChar + (e.key === 'ArrowRight' ? 1 : -1), true);
            }
            return;
        }

        if (e.code === 'KeyM') { toggleMute(); return; }


        if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp') {
            if (state === 'playing') {
                e.preventDefault();
                if (!e.repeat) jump();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    });
    window.addEventListener('blur', () => { keys.left = keys.right = false; });

    // Botões na tela (celular / toque)
    document.querySelectorAll('#touch-controls button').forEach((btn) => {
        const k = btn.dataset.key;
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            getCtx();
            if (k === 'jump') jump(); else keys[k] = true;
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
            btn.addEventListener(ev, () => { if (k !== 'jump') keys[k] = false; }));
    });

    // Clique / toque no tabuleiro também pula
    board.addEventListener('pointerdown', (e) => {
        if (e.target === muteBtn) return;
        jump();
    });

    muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMute();
    });

    // Verifica se o MySQL responde
    fetch('obter_ranking.php')
        .then(res => res.json())
        .then(data => setServerStatus(data.status === 'success'))
        .catch(() => setServerStatus(false));

    // Estado inicial do cenário (antes de começar)
    hudPlayerName.textContent = '---';
    lives = CFG.lives;
    renderLives();
    px = CFG.startX;
    py = 0;
    setPlayerPos();
    playerImg.src = CHARACTERS[selectedChar].base;
});
