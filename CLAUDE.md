# CLAUDE.md

Gettsum: o celular lê código de barras pela câmera (página web servida pelo próprio PC) e envia
só o texto, via HTTPS na rede local, para um app Electron no Windows que o digita no campo em
foco. Visão de uso e API: [README.md](README.md). Decisões e limitações: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Comandos

```bash
cd mobile  && npm install && npm run build   # esbuild → desktop/mobile-dist (não versionado)
cd desktop && npm install
npm start          # build:mobile + electron .
npm test           # node --test test/server.test.js (13 testes de integração)
npm run test:e2e   # precisa de GETTSUM_URL e GETTSUM_CODE com o app rodando (ver README)
npm run dist       # instalador NSIS + portátil em desktop/dist
```

Não use `node --test test/` — pegaria os arquivos de `test/e2e`.

## Estrutura

- `desktop/src/main.js` — cola do Electron: bandeja, janela, IPC, settings (`SETTINGS_DEFAULTS`), histórico em memória (20).
- `desktop/src/server.js` — HTTPS: `/api/pair|status|scan|device|unpair` + estáticos de `mobile-dist`. Limite de corpo 16 KB (413 drenando o corpo, sem `req.destroy()` imediato).
- `pairing.js` (token 128 bits no fragmento `#p=` + código de 6 dígitos, TTL 5 min, uso único, bloqueio após 5 falhas), `devices.js` (guarda só sha256 do segredo; `Bearer <id>.<secret>`), `scan-processor.js` (idempotência por `deviceId:scanId`, fila serial, saneamento de caracteres de controle), `cert.js` (autoassinado, 397 dias, persistido).
- `desktop/src/injector/` — `windows.js` usa koffi → Win32 `SendInput` com `KEYEVENTF_UNICODE` e detecção de UIPI; `index.js` escolhe modo (type/paste/clipboard) e cai para a área de transferência quando não dá para digitar.
- `desktop/src/renderer/` — UI do PC (HTML/CSS/JS puros, `contextIsolation` + `preload.js`).
- `mobile/src/` — JS puro empacotado por esbuild (IIFE). `scanner.js` usa `BarcodeDetector` nativo ou o ponyfill `barcode-detector` + `zxing-wasm`; o `.wasm` é servido localmente.
- `desktop/test/e2e/` — simulador de celular em Electron com câmera falsa (Y4M gerado com EAN-13) + formulário WinForms (`test-form.ps1`).

## Convenções e cuidados

- Código, identificadores e commits em inglês; documentação e textos de UI em pt-BR.
- Sem framework no front; manter dependências mínimas.
- Nunca enviar imagens da câmera — só o valor decodificado.
- Não afirmar suporte universal: inserção direta só no Windows; demais SOs usam área de transferência.
- Sufixo (Enter/Tab) desligado por padrão; Enter/Tab só via opção de sufixo, nunca vindo da leitura.
- CSP da página móvel precisa de `'wasm-unsafe-eval'` para o ZXing.
- Os dois CSS têm `[hidden] { display: none !important; }` — não remover (regras `display:grid` sobrescreviam `hidden`).
- Electron não suporta `prompt()`; usar edição inline.
- koffi precisa ficar em `asarUnpack` no electron-builder.
- O E2E digita na janela em primeiro plano; testes deixam dados em `%APPDATA%\gettsum-desktop\` e `%APPDATA%\phone-sim` — limpar depois.
- Ainda não validado em celulares reais (aviso de certificado, Safari iOS, lanterna). Executável sem assinatura e com ícone padrão do Electron.
