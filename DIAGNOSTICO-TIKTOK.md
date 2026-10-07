# Modo de diagnóstico do TikTok LIVE

Este projeto foi alterado para registrar no terminal informações detalhadas da tentativa de conexão com o TikTok LIVE.

## Como ativar

1. Rode o projeto normalmente:

```bash
npm install
npm run dev
```

2. Abra o endereço da aplicação acrescentando `?diagnostic=1`:

```text
http://localhost:8080/?diagnostic=1
```

3. Dentro da aplicação, informe o @ da conta que está ao vivo e tente conectar.

4. Observe o terminal onde `npm run dev` está executando.

Você verá mensagens semelhantes a:

```text
[TikTok LIVE][diagnostic] Request received for @usuario
[TikTok LIVE][diagnostic][start] ...
[TikTok LIVE][diagnostic][websocketConnected] ...
[TikTok LIVE][diagnostic][connected] ...
```

Se houver falha, procure principalmente por:

- `connect-rejected`
- `error-event`
- `disconnected`
- `timeout`

O erro retornado pela biblioteca também é exibido na mensagem da aplicação quando a conexão falha.

## O que enviar para diagnóstico

Se ainda não conectar, copie o trecho do terminal começando em:

```text
[TikTok LIVE][diagnostic]
```

até a mensagem de erro final.

Não envie cookies, tokens, senhas ou chaves de API caso apareçam em algum log.
