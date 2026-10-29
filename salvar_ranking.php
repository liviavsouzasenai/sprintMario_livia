<?php
/**
 * Endpoint para salvar uma pontuação e devolver o TOP 10 atualizado
 */
header('Content-Type: application/json; charset=utf-8');
require_once 'conexao.php';

$dados = json_decode(file_get_contents('php://input'), true);

$nome   = trim((string)($dados['nome'] ?? ''));
$pontos = filter_var($dados['pontos'] ?? null, FILTER_VALIDATE_INT);

if ($nome === '' || $pontos === false || $pontos < 0 || $pontos > 10000000) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Dados inválidos.'
    ]);
    exit;
}

$nome = mb_substr($nome, 0, 30);

try {
    $stmt = $pdo->prepare('INSERT INTO ranking (nome, pontos) VALUES (:nome, :pontos)');
    $stmt->execute([
        ':nome'   => $nome,
        ':pontos' => $pontos
    ]);

    $stmt = $pdo->query("
        SELECT id, nome, pontos, DATE_FORMAT(data_registro, '%d/%m/%Y %H:%i') AS data
        FROM ranking
        ORDER BY pontos DESC, id ASC
        LIMIT 10
    ");

    echo json_encode([
        'status'  => 'success',
        'ranking' => $stmt->fetchAll()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Erro ao salvar pontuação: ' . $e->getMessage()
    ]);
}
