<?php

require_once 'conexao.php';

// Busca inicial do ranking para carregar rápido na primeira abertura
$rankingInicial = [];
try {
    $stmt = $pdo->query("
        SELECT id, nome, pontos, DATE_FORMAT(data_registro, '%d/%m/%Y %H:%i') as data
        FROM ranking
        ORDER BY pontos DESC, id ASC
        LIMIT 10
    ");
    $rankingInicial = $stmt->fetchAll();
} catch (Exception $e) {
    // Caso o banco ainda não possua registros
    $rankingInicial = [];
}

$topScore = !empty($rankingInicial) ? (int)$rankingInicial[0]['pontos'] : 0;
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maré Jump - Jogo com Ranking MySQL</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

    <div class="game-container">

        <header class="hud-bar">
            <div class="hud-item">
                <span class="label">JOGADOR</span>
                <span class="value" id="hud-player-name">---</span>
            </div>
            <div class="hud-item">
                <span class="label">PONTOS</span>
                <span class="value" id="score-display">000000</span>
            </div>
            <div class="hud-item">
                <span class="label">MOEDAS</span>
                <span class="value"><img class="hud-icon" src="assets/moeda.png" alt=""> x<span id="coin-display">00</span></span>
            </div>
            <div class="hud-item">
                <span class="label">NÍVEL</span>
                <span class="value" id="level-display">1</span>
            </div>
            <div class="hud-item">
                <span class="label">VIDAS</span>
                <span class="value hearts" id="lives-display"></span>
            </div>
        </header>

        <main class="game-board" id="game-board">
            <div class="layer layer-clouds" id="layer-clouds"></div>
            <div class="sand-strip" id="sand-strip"></div>
            <div class="layer layer-world" id="layer-world"></div>

            <div class="player" id="player">
                <img id="player-img" src="assets/personagem-1.png" alt="Personagem">
            </div>
            <img id="ghost" class="ghost" src="assets/fantasma.png" alt="Fantasma">

            <span class="jump-tip" id="jump-tip">Pressione ESPAÇO, ↑ ou clique para pular</span>
            <div class="level-banner" id="level-banner"></div>
            <button type="button" class="mute-btn" id="mute-btn" title="Som (M)">♪</button>
        </main>

        <div class="touch-controls" id="touch-controls">
            <button type="button" data-key="jump" aria-label="Pular">PULAR</button>
        </div>
    </div>

    <!-- 1. TELA DE INÍCIO (estilo Mario clássico): nome + personagem -->
    <div class="title-screen active" id="start-modal">

        <div class="ts-hud">
            <div><span>JOGADOR</span><br><b id="ts-name">---</b></div>
            <div><span>PONTOS</span><br><b>000000</b></div>
            <div><span>MOEDAS</span><br><b>x00</b></div>
            <div><span>MUNDO</span><br><b>1-1</b></div>
            <div><span>TOP</span><br><b id="ts-top"><?= str_pad((string)$topScore, 6, '0', STR_PAD_LEFT) ?></b></div>
        </div>

        <img class="ts-cloud c1" src="assets/nuvem.png" alt="">
        <img class="ts-cloud c2" src="assets/nuvem.png" alt="">
        <img class="ts-cloud c3" src="assets/nuvem.png" alt="">

        <div class="ts-content">
            <h1 class="ts-title">
                <span class="t1">MARÉ</span>
                <span class="t2">JUMP</span>
            </h1>
            <p class="ts-sub">Atravesse a praia, pule os obstáculos e pegue moedas e conchas!</p>

            <form class="start-form" id="start-form">
                <div class="input-group">
                    <label for="player-input">DIGITE SEU NOME</label>
                    <input
                        type="text"
                        id="player-input"
                        placeholder="SEU NOME"
                        maxlength="30"
                        required
                        autocomplete="off"
                        autofocus
                    >
                </div>

                <div class="char-label">ESCOLHA SEU PERSONAGEM</div>
                <div class="char-select" id="char-select">
                    <button type="button" class="char-card" data-index="0" aria-label="Personagem 1">
                        <span class="char-arrow">&#9660;</span>
                        <img src="assets/personagem-1.png" alt="">
                        <span class="char-block">1</span>
                    </button>
                    <button type="button" class="char-card" data-index="1" aria-label="Personagem 2">
                        <span class="char-arrow">&#9660;</span>
                        <img src="assets/personagem-2.png" alt="">
                        <span class="char-block">2</span>
                    </button>
                    <button type="button" class="char-card" data-index="2" aria-label="Personagem 3">
                        <span class="char-arrow">&#9660;</span>
                        <img src="assets/personagem-3.png" alt="">
                        <span class="char-block">3</span>
                    </button>
                    <button type="button" class="char-card" data-index="3" aria-label="Personagem 4">
                        <span class="char-arrow">&#9660;</span>
                        <img src="assets/personagem-4.png" alt="">
                        <span class="char-block">4</span>
                    </button>
                </div>

                <div class="ts-menu">
                    <button type="submit" class="menu-btn is-default" id="btn-start"><span class="cursor">&#9654;</span> INICIAR JOGO</button>
                    <button type="button" class="menu-btn" id="btn-view-ranking"><span class="cursor">&#9654;</span> VER RANKING</button>
                </div>
            </form>

            <div class="server-status" id="server-status">
                <span class="status-dot" id="status-dot"></span> <span id="status-text">Verificando MySQL...</span>
            </div>
        </div>

        <div class="ts-ground"></div>
    </div>

    <!-- 2. TELA DE GAME OVER & RANKING -->
    <div class="modal-overlay" id="gameover-modal">
        <div class="modal-card gameover-card">
            <div class="modal-header">
                <h2 class="gameover-title" id="gameover-title">GAME OVER</h2>
                <div class="final-score-box">
                    <div class="final-score-label">SUA PONTUAÇÃO</div>
                    <div class="final-score-num" id="final-score-value">0</div>
                    <div class="final-stats" id="final-stats"></div>
                    <div class="save-status" id="save-status-msg"></div>
                </div>
            </div>

            <!-- Tabela com o TOP 10 -->
            <div class="ranking-container">
                <h3 class="ranking-title">🏆 TOP 10 MELHORES PONTUAÇÕES</h3>
                <div class="table-wrapper">
                    <table class="ranking-table">
                        <thead>
                            <tr>
                                <th>POS</th>
                                <th>JOGADOR</th>
                                <th>PONTUAÇÃO</th>
                            </tr>
                        </thead>
                        <tbody id="ranking-body">
                            <?php if (!empty($rankingInicial)): ?>
                                <?php foreach ($rankingInicial as $i => $row): ?>
                                    <tr>
                                        <td class="ranking-pos">
                                            <?= $i === 0 ? '🥇 1º' : ($i === 1 ? '🥈 2º' : ($i === 2 ? '🥉 3º' : ($i + 1) . 'º')) ?>
                                        </td>
                                        <td><strong><?= htmlspecialchars($row['nome']) ?></strong></td>
                                        <td><?= (int)$row['pontos'] ?> pts</td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php else: ?>
                                <tr>
                                    <td colspan="3" class="loading-cell">Nenhuma pontuação gravada ainda. Jogue para ser o 1º!</td>
                                </tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn btn-primary" id="btn-restart">JOGAR NOVAMENTE</button>
                <button type="button" class="btn btn-secondary" id="btn-change-player">TROCAR JOGADOR / PERSONAGEM</button>
            </div>
        </div>
    </div>

    <script src="js/script.js" defer></script>
</body>
</html>
