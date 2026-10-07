# Arena Live — Deploy gratuito no Render

## Opção recomendada

O projeto está preparado como um **Render Web Service** usando Node.js + Nitro.
O arquivo `render.yaml` já define o plano `free`, build, start e health check.

### Deploy pelo GitHub

1. Crie um repositório no GitHub e envie todo o conteúdo desta pasta.
2. No Render, escolha **New → Blueprint** e conecte o repositório.
3. O Render detectará `render.yaml`.
4. Confirme o serviço `arena-live` no plano **Free**.
5. Aguarde o build.
6. O Render fornecerá uma URL `https://arena-live-....onrender.com`.

### Configuração equivalente manual

- Runtime: Node
- Plan: Free
- Build Command: `npm ci && NITRO_PRESET=node-server npm run build`
- Start Command: `npm start`
- Health Check: `/`
- Node: 22

## TikTok LIVE

A rota `/api/live` mantém a conexão de eventos do TikTok LIVE no servidor. O cliente recebe os eventos via Server-Sent Events (SSE).

Depois do deploy, o endereço do app será a URL do Render. O APK deve apontar para essa URL.

## Banco de dados

O projeto atualmente possui fallback PGLite quando `DATABASE_URL` não existe. Em uma instância Free do Render, o filesystem é efêmero, então dados locais não devem ser tratados como armazenamento permanente. Se o app precisar persistir contas/dados, configure um Postgres externo/pago adequado.

## Observação sobre o plano Free

O Render informa que serviços gratuitos podem entrar em suspensão após 15 minutos sem tráfego de entrada; uma nova requisição/conexão pode levar cerca de um minuto para acordar o serviço. WebSocket/SSE e conexões ativas também podem ser interrompidos quando a instância é reiniciada.
