# Gettsum — Arquitetura

Gettsum transforma a câmera do smartphone em um leitor de código de barras para o computador:
o celular decodifica o código e envia **apenas o texto** ao computador, que o insere no campo
em foco como se tivesse sido digitado.

Plataformas prioritárias: **Windows** (computador) e **Android/iOS** (smartphone).

---

## 1. Opções de arquitetura e tecnologias

### 1.1 Componente no computador

O requisito decisivo é **inserir texto no campo ativo de qualquer aplicativo**. Isso só é
possível com APIs do sistema operacional; uma página web comum não consegue fazê-lo.

| Opção | Inserção no Windows | Multiplataforma | Instalação / manutenção | Observações |
|---|---|---|---|---|
| **Electron (Node.js) + FFI (koffi) para `SendInput`** | Sim (Win32 `SendInput` com `KEYEVENTF_UNICODE`) | Windows, macOS, Linux (UI e servidor); inserção por SO | Um instalador; ~100 MB | UI web, bandeja, área de transferência e notificações prontos. Ecossistema JS compartilhado com o app móvel. |
| .NET (WinForms/WPF/Avalonia) | Sim (P/Invoke nativo) | Avalonia: sim | Executável enxuto | Excelente no Windows; exige .NET SDK (ausente neste ambiente). |
| Tauri (Rust) | Sim (crate `enigo`/Win32) | Sim | Instalador pequeno (~10 MB) | Exige toolchain Rust + WebView2; curva maior. |
| Python (ctypes + Tk/Qt) | Sim | Sim | Empacotamento (PyInstaller) frágil, antivírus costumam alertar | Bom para protótipo. |
| Extensão de navegador | Só em páginas web | Navegadores Chromium/Firefox | Publicação em loja | Não alcança apps desktop/ERP. Útil apenas como complemento. |

**Limitações do SO para inserir texto no campo ativo**

| SO | Mecanismo | Restrições |
|---|---|---|
| Windows | `SendInput` (eventos de teclado Unicode) | **UIPI**: um processo comum não consegue enviar teclas a janelas executadas como administrador. Alguns apps (jogos, RDP/Citrix, terminais legados) ignoram eventos Unicode — nesses casos o modo "Colar (Ctrl+V)" costuma funcionar. |
| macOS | `CGEventPost` / `CGEventKeyboardSetUnicodeString` | Exige permissão de **Acessibilidade** concedida manualmente pelo usuário. |
| Linux X11 | XTest (`xdotool`) | Funciona sem permissões especiais. |
| Linux Wayland | Bloqueado por design | Requer portal `RemoteDesktop`/`ydotool` com privilégios; não há solução universal. |

### 1.2 Aplicativo/interface móvel

| Opção | Leitura | Instalação | Limitações |
|---|---|---|---|
| **Página web (PWA leve) servida pelo próprio computador** | `BarcodeDetector` nativo (Chrome Android) ou ZXing em WebAssembly (iOS e demais) | **Nenhuma** — basta ler o QR Code com a câmera | A câmera exige HTTPS; com certificado autoassinado o navegador mostra **um aviso** na primeira vez. iOS não vibra; lanterna depende do navegador. |
| Flutter (`mobile_scanner`: ML Kit/AVFoundation) | Excelente, nativa | Lojas (Play Store/App Store) ou sideload | Exige Flutter + Android SDK; iOS exige Mac + conta Apple. Sem aviso de certificado (fixação por impressão digital). |
| React Native / Kotlin + Swift nativos | Excelente | Lojas | Dois códigos (nativo) ou toolchain pesada; publicação em lojas. |

### 1.3 Comunicação

| Opção | Prós | Contras |
|---|---|---|
| **Rede local direta (HTTPS)** | Latência mínima, sem servidor externo, dados não saem da rede | Exige mesma rede; redes com "isolamento de clientes" (Wi-Fi de visitantes) bloqueiam. Firewall do Windows pede permissão. |
| Serviço remoto (relay WebSocket / WebRTC com sinalização) | Funciona entre redes diferentes | Infraestrutura a manter, dados trafegam pela internet (exige E2E), custo. |
| Bluetooth (BLE/HID) | Sem rede | Web Bluetooth indisponível no iOS; HID requer app nativo. |

Pareamento: **QR Code** (contém endereço + token temporário de uso único) e, como alternativa,
**código numérico de 6 dígitos** com expiração e limite de tentativas.

---

## 2. Abordagem recomendada (v1) e limitações

**Computador:** aplicativo **Electron** com ícone na bandeja, que:
- roda um servidor **HTTPS** na rede local (porta 47800) com certificado autoassinado gerado na
  primeira execução;
- serve a interface móvel (não é preciso instalar nada no celular);
- gerencia pareamento, dispositivos autorizados e configurações;
- insere o texto via `SendInput` no Windows; nos demais SOs usa **área de transferência** (ver abaixo).

**Celular:** página web leve, aberta ao ler o QR Code, com leitura por câmera
(`BarcodeDetector` nativo quando disponível; senão ZXing WebAssembly empacotado localmente — sem CDN).

**Transporte:** requisições HTTPS (`fetch`) para o mesmo endereço. Optou-se por HTTP em vez de
WebSocket porque o Safari do iOS não aplica a exceção de certificado aceita pelo usuário a
conexões WebSocket; `fetch` funciona nos dois sistemas. A resposta ao envio de uma leitura **é a
própria confirmação de inserção**, e uma consulta periódica (`/api/status`, a cada 3 s) mantém o
indicador de conexão nos dois lados.

**Por que esta escolha:** zero instalação no celular, um único instalador no PC, um só
ecossistema (JavaScript) para manter e funcionamento idêntico em Android e iOS.

**Limitações conhecidas (v1)**
1. **Aviso de certificado** no primeiro acesso do celular (e novamente se o IP do PC mudar). O
   usuário precisa tocar em "Avançado → Continuar". É o preço de não instalar app. A v2 com app
   nativo elimina isso (fixação de certificado pela impressão digital contida no QR).
2. **Mesma rede local** obrigatória; Wi-Fi com isolamento de clientes não funciona.
3. **Mudança de IP do PC** invalida o pareamento salvo no celular (o navegador associa os dados
   ao endereço). Recomenda-se reserva de DHCP. Basta parear de novo.
4. **Inserção direta só no Windows** nesta versão. macOS/Linux: o valor vai para a área de
   transferência e o celular informa "Copiado — pressione Ctrl/Cmd+V". Não é apresentado como
   universal.
5. Apps executados **como administrador** não aceitam teclas de um app comum (UIPI). O Gettsum
   detecta o caso e cai para a área de transferência, avisando o usuário.
6. iOS: sem vibração (API indisponível no Safari); lanterna só aparece se o navegador a expuser.
7. Não é possível saber, de forma universal, se o foco está **num campo de texto** — o Gettsum
   envia para a janela em primeiro plano e devolve ao celular o título dessa janela, para que o
   usuário confirme visualmente onde o valor entrou.

---

## 3. Fluxo entre smartphone, computador e formulário

```
 Smartphone (navegador)                Computador (Gettsum desktop)              Formulário
 ─────────────────────                 ─────────────────────────────              ──────────
                                       1. Inicia; gera certificado e
                                          servidor HTTPS :47800
                                       2. Mostra QR: https://IP:47800/#p=TOKEN
 3. Lê o QR com a câmera ─────────────▶   (+ código de 6 dígitos alternativo)
    aceita o certificado (1ª vez)
    POST /api/pair {token, nome} ─────▶ valida token (uso único, 5 min)
    ◀──────────────────────────────── {deviceId, segredo}  (salvo no celular;
                                          PC guarda apenas o hash do segredo)
    GET /api/status (a cada 3 s) ◀───▶ "Conectado: <PC>" / "Conectado: <celular>"
                                                                                  4. Usuário clica
                                                                                     no campo
 5. Aponta para o código de barras
 6. Decodifica localmente (sem enviar
    imagem); bipe/vibração; opcional:
    confirmar/cancelar/ler de novo
    POST /api/scan {id, valor, formato} ▶ 7. Verifica id (idempotência),
                                          remove caracteres de controle,
                                          SendInput Unicode ─────────────────────▶ texto inserido
                                          + sufixo opcional (Enter/Tab)            na posição do
                                                                                   cursor
    ◀──────────────────────────────── {status: inserted | copied | error,
                                          janela-alvo}
 8. Mostra "Inserido em <janela>" ou
    "Falhou — Tentar novamente"
    (reenvio usa o MESMO id ⇒ nunca
     digita duas vezes)
```

**Garantias de confiabilidade**
- Cada leitura tem um `id` único. Reenvios após timeout usam o mesmo `id`; o PC devolve o
  resultado já registrado em vez de digitar de novo (**sem duplicação**).
- Envio só é considerado concluído quando o PC responde com o resultado da inserção
  (**sem envio silencioso**). Falha → o valor permanece na tela com "Tentar novamente".
- Leituras são processadas **em fila**, na ordem de chegada.
- "Repetir último envio" é uma ação explícita e gera novo `id`.
- No celular, o mesmo código não é reenviado enquanto continuar no enquadramento (anti-duplicata).

---

## 4. Instalação, permissões e conectividade

**Computador (Windows 10/11)**
- Instalar o Gettsum (instalador NSIS ou versão portátil) — ou, em desenvolvimento, Node.js 20+.
- Na primeira execução, o **Firewall do Windows** pergunta se o app pode aceitar conexões:
  permitir em **Redes privadas**. A rede Wi-Fi deve estar marcada como *Privada*.
- Não precisa de privilégios de administrador. (Para inserir em apps executados como
  administrador, o Gettsum também precisaria ser executado como administrador.)

**Celular (Android 8+ com Chrome; iOS 15+ com Safari)**
- Mesma rede Wi-Fi do computador.
- Permissão de **câmera** (solicitada com explicação antes do pedido do sistema).
- Aceitar o certificado do computador uma vez.

**Rede**
- Porta TCP **47800** acessível na rede local; sem internet necessária.
- Os dados trafegam **somente pela rede local**, criptografados (TLS). Nenhum serviço remoto é usado.

---

## 5. Escopo da primeira versão (v1)

**Incluído**
- Desktop: servidor HTTPS local, QR de pareamento + código de 6 dígitos (expiram em 5 min, uso
  único, bloqueio após 5 tentativas), lista de dispositivos (renomear/remover), indicação de
  conexão, inserção Windows (`SendInput`), modos *Digitar*, *Colar (Ctrl+V)* e *Somente área de
  transferência*, sufixo (Nenhum — padrão —, Enter, Tab), pausar recepção, histórico **apenas
  em memória** (últimas 20 leituras, valores podem ser ocultados), bandeja, iniciar com o Windows.
- Celular: leitura EAN-13, EAN-8, UPC-A, UPC-E, Code 128 (padrão) e, opcionalmente, QR Code,
  Code 39, ITF e Data Matrix; lanterna (quando suportada), foco contínuo, anti-duplicata,
  confirmação antes do envio (configurável), bipe/vibração, repetir último envio, indicador de
  conexão com reconexão automática, configurações (nome, som, vibração, confirmação, formatos).
- Segurança: TLS, pareamento temporário, segredo por dispositivo (PC guarda só o hash),
  remoção de dispositivo revoga acesso imediatamente, nenhuma imagem sai do celular.

**Fora da v1 (próximas versões)**
- App nativo (Flutter) com fixação de certificado — elimina o aviso de certificado.
- Inserção direta em macOS (Acessibilidade) e Linux X11 (XTest).
- Relay remoto com criptografia ponta a ponta para redes diferentes.
- Extensão de navegador para inserir em páginas sem foco de teclado.
