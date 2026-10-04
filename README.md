# Gettsum

Use a câmera do celular como leitor de código de barras do computador. O celular lê o código,
envia **apenas o texto** pela rede local e o Gettsum o insere no campo em foco, na posição do
cursor, como se tivesse sido digitado.

- **Computador:** app Windows (Electron) com ícone na bandeja.
- **Celular:** nada para instalar. Basta ler um QR Code; a interface abre no navegador (Android/Chrome, iPhone/Safari).
- **Rede:** somente local, com criptografia (HTTPS). Nenhuma imagem da câmera sai do celular.

Arquitetura, alternativas avaliadas, limitações e escopo: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

```
gettsum/
├─ desktop/              App do computador (Electron)
│  ├─ src/main.js        Processo principal: bandeja, janela, IPC, inicialização
│  ├─ src/server.js      Servidor HTTPS: API + interface móvel
│  ├─ src/pairing.js     Token do QR e código de 6 dígitos (temporários, uso único)
│  ├─ src/devices.js     Celulares pareados (guarda só o hash do segredo)
│  ├─ src/scan-processor.js  Fila, idempotência e saneamento das leituras
│  ├─ src/injector/      Inserção no campo ativo (Win32 SendInput) e área de transferência
│  ├─ src/cert.js        Certificado autoassinado persistente
│  ├─ src/renderer/      Interface do computador
│  └─ test/              Testes de integração e E2E (simulador de celular)
├─ mobile/               Interface do celular (compilada para desktop/mobile-dist)
└─ docs/ARQUITETURA.md
```

---

## Uso (usuário final)

1. Abra o **Gettsum** no computador. Na primeira vez, o Windows pergunta se o app pode usar a
   rede: marque **Redes privadas** e clique em **Permitir**.
2. Com o celular **no mesmo Wi-Fi**, aponte a câmera para o QR Code exibido pelo Gettsum.
3. Na primeira vez, o navegador do celular avisa que a conexão "não é particular". Isso é
   esperado, porque o certificado é gerado pelo seu próprio computador e não por uma autoridade
   pública. Toque em **Avançado → Continuar para…** (Android) ou **Mostrar detalhes → visitar
   este site** (iPhone).
4. Toque em **Ativar câmera** e permita o acesso.
5. No computador, **clique no campo** do formulário. No celular, aponte para o código de barras.
6. O celular bipa e vibra ao ler e depois mostra **"✓ Inserido em <janela>"**. Se algo falhar,
   aparece **Tentar novamente** (o valor nunca é digitado duas vezes).

Sem QR Code: abra no navegador do celular o endereço exibido (ex.: `https://192.168.0.10:47800`)
e digite o código de 6 dígitos.

**Dica:** no celular, use "Adicionar à tela inicial" para abrir o Gettsum como um app.

### Configurações

| Onde | Opção | Padrão |
|---|---|---|
| Computador | Como inserir: *Digitar*, *Colar (Ctrl+V)* ou *Somente copiar* | Digitar |
| Computador | Tecla após o valor: *Nada*, *Tab* ou *Enter* | **Nada** (evita enviar formulários sem querer) |
| Computador | Pausar recepção, nome do computador, ocultar valores no histórico, iniciar com o Windows, porta | — |
| Computador | Remover/renomear celulares pareados | — |
| Celular | Nome, som, vibração, confirmar antes de enviar, tipos de código | Som e vibração ligados; confirmação desligada |
| Celular | Desconectar este celular | — |

Tipos de código: EAN-13, EAN-8, UPC-A, UPC-E e Code 128 (ativos por padrão); QR Code,
Code 39, ITF e Data Matrix (opcionais).

### Quando a conexão cai

O indicador no topo do celular fica vermelho ("Sem conexão — tentando de novo…") e ele tenta
reconectar sozinho. Verifique se:
- o Gettsum está aberto no computador (ícone na bandeja);
- os dois aparelhos estão no mesmo Wi-Fi (redes de visitantes costumam isolar os aparelhos);
- a rede do Windows está como **Privada** e o firewall permite o Gettsum.

Se o IP do computador mudar, leia o QR Code de novo. Para evitar isso, configure uma reserva
de DHCP no roteador.

### Limitações (importante)

- **Inserção direta só no Windows** nesta versão. Em macOS/Linux, o valor vai para a área de
  transferência e o celular avisa para colar com Ctrl/Cmd+V.
- Programas **executados como administrador** não aceitam digitação de apps comuns (UIPI do
  Windows). O Gettsum detecta o caso, copia o valor e avisa. Para digitar nesses programas,
  execute o Gettsum também como administrador.
- Alguns programas (acesso remoto/Citrix, jogos, terminais legados) ignoram a digitação
  simulada. Use o modo **Colar (Ctrl+V)**.
- O Gettsum digita na **janela em primeiro plano**; não é possível saber, em todo programa, se o
  foco está num campo de texto. Por isso o celular mostra o nome da janela que recebeu o valor.
- Caracteres de controle (quebras de linha, tabulações, separadores GS1) são removidos da
  leitura. Enter/Tab só são enviados pela opção de sufixo.
- iPhone: o Safari não permite vibração; a lanterna só aparece se o navegador a suportar.

---

## Desenvolvimento

Requisitos: **Windows 10/11** e **Node.js 20+**.

```bash
cd mobile  && npm install
cd ../desktop && npm install
npm start          # compila a interface móvel e abre o app
```

### Testes

```bash
cd desktop
npm test           # integração do servidor: pareamento, autenticação, idempotência, fila, saneamento
```

**E2E (celular simulado):** abre um Chromium com **câmera falsa** exibindo um EAN-13, pareia
com o Gettsum em execução, abre um formulário WinForms em foco e confere o texto inserido, a
anti-duplicata e o "Repetir último".

```powershell
cd desktop
npm start                                   # em outro terminal; anote o código de 6 dígitos
$env:GETTSUM_URL  = "https://127.0.0.1:47800"
$env:GETTSUM_CODE = "123456"                # código exibido no Gettsum
npm run test:e2e
# esperado: FORM TEXT: "AB|78912345678957891234567895|CD"  (1 leitura + 1 repetição)
```

Não clique em outras janelas durante o E2E: o texto vai para a janela em primeiro plano.

### Empacotar

```bash
cd desktop
npm run dist       # gera dist/Gettsum Setup x.y.z.exe (instalador) e dist/Gettsum x.y.z.exe (portátil)
```

O executável não é assinado digitalmente. Sem assinatura de código, o Windows SmartScreen
mostra um aviso na primeira execução.

### Onde ficam os dados

`%APPDATA%\gettsum-desktop\`:
- `settings.json`: configurações;
- `devices.json`: celulares pareados (nome e **hash** do segredo);
- `tls.json`: certificado e chave privada do servidor local.

As leituras **não são gravadas em disco**. O histórico existe só na memória (últimas 20) e
some ao fechar o app.

### API (celular → computador)

Todas as rotas são HTTPS/JSON no mesmo endereço que serve a página. As rotas autenticadas usam
`Authorization: Bearer <deviceId>.<secret>`.

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/pair` | `{ token \| code, name }` | `{ deviceId, secret, deviceName, desktopName }` · 401 inválido · 429 bloqueado |
| `GET /api/status` | — | `{ desktopName, deviceName, paused, mode, suffix, directInsert }` |
| `POST /api/scan` | `{ id, value, format }` | `{ status: inserted\|copied\|paused\|error, target, message, duplicate? }` |
| `POST /api/device` | `{ name }` | `{ name }` |
| `POST /api/unpair` | — | `{ ok }` |

`id` identifica a leitura. Reenviar o mesmo `id` devolve o resultado anterior sem inserir de
novo.
