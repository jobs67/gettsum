# Manual do usuário — Gettsum

O Gettsum transforma a câmera do celular em um leitor de código de barras para o computador.
Você aponta o celular para o código, e o número aparece no campo em que o cursor está no
computador, como se tivesse sido digitado.

**Sumário**

1. [O que você precisa](#1-o-que-você-precisa)
2. [Instalar no computador](#2-instalar-no-computador)
3. [Conectar o celular (primeira vez)](#3-conectar-o-celular-primeira-vez)
4. [Ler códigos no dia a dia](#4-ler-códigos-no-dia-a-dia)
5. [Tela do celular](#5-tela-do-celular)
6. [Tela do computador](#6-tela-do-computador)
7. [Configurações recomendadas por situação](#7-configurações-recomendadas-por-situação)
8. [Gerenciar celulares](#8-gerenciar-celulares)
9. [Mensagens e o que fazer](#9-mensagens-e-o-que-fazer)
10. [Problemas comuns](#10-problemas-comuns)
11. [Dicas para uma leitura melhor](#11-dicas-para-uma-leitura-melhor)
12. [Privacidade e segurança](#12-privacidade-e-segurança)
13. [Perguntas frequentes](#13-perguntas-frequentes)

---

## 1. O que você precisa

| Item | Requisito |
|---|---|
| Computador | Windows 10 ou 11 |
| Celular | Android 8+ com Chrome, ou iPhone com Safari (iOS 15+). Câmera traseira funcionando. |
| Rede | Computador e celular **na mesma rede Wi-Fi/local**. Não precisa de internet. |
| Instalação no celular | Nenhuma. O Gettsum do celular abre no navegador. |

> Redes de visitantes ("Guest") e algumas redes corporativas isolam os aparelhos entre si. Nelas
> o celular não enxerga o computador. Veja [Problemas comuns](#10-problemas-comuns).

---

## 2. Instalar no computador

Há duas versões:

- **`Gettsum Setup x.y.z.exe`**: instalador. Cria atalho no Menu Iniciar e permite iniciar com o
  Windows. Recomendado.
- **`Gettsum x.y.z.exe`**: versão portátil. Não instala nada; basta executar.

Passo a passo:

1. Execute o arquivo. Na primeira execução, o Windows pode mostrar **"O Windows protegeu o
   computador"** (SmartScreen), porque o programa ainda não tem assinatura digital. Clique em
   **Mais informações → Executar assim mesmo**.
2. O Windows pergunta se o Gettsum pode se comunicar na rede. Marque **Redes privadas** e clique em
   **Permitir acesso**.
   - Se você clicou em *Cancelar* por engano, veja
     [O celular não conecta](#o-celular-não-conecta-sem-conexão).
3. A janela do Gettsum abre com um QR Code. O Gettsum também fica na **bandeja do sistema**, ao lado
   do relógio (ícone verde quando há celular conectado, cinza quando não há).

---

## 3. Conectar o celular (primeira vez)

O pareamento autoriza aquele celular a enviar leituras para este computador. Ele é feito uma
vez só; depois o celular reconecta sozinho.

1. Conecte o celular **ao mesmo Wi-Fi** do computador.
2. Abra a **câmera do celular** (ou um leitor de QR) e aponte para o QR Code da janela do Gettsum.
   Toque no link que aparecer.
3. **Aviso de segurança, só na primeira vez.** O navegador mostra "Sua conexão não é
   particular" ou "Esta conexão não é privada". Isso é esperado: a conexão é criptografada, mas o
   certificado foi criado pelo seu próprio computador, não por uma empresa certificadora.
   - **Android (Chrome):** toque em **Avançado → Continuar para 192.168.x.x (não seguro)**.
   - **iPhone (Safari):** toque em **Mostrar detalhes → visitar este site → Visitar site**.
4. O celular mostra **"Pareado com <nome do computador>"**.
5. Toque em **Ativar câmera** e, quando o navegador perguntar, **permita** o uso da câmera.

Pronto. No computador, o celular aparece em **Celulares pareados** e o indicador do topo fica
verde: **"Conectado: <nome do celular>"**.

### Sem conseguir ler o QR Code

Abaixo do QR Code o Gettsum mostra um endereço (ex.: `https://192.168.0.10:47800`) e um código
de 6 números.

1. No navegador do celular, digite o endereço **exatamente** como aparece, incluindo `https://`
   e a porta (`:47800`).
2. Aceite o aviso de segurança (passo 3 acima).
3. Digite o código de 6 números e toque em **Conectar**.

O código vale por **5 minutos** e só pode ser usado **uma vez**. O tempo restante aparece abaixo
do QR Code. Se expirar, clique em **Gerar novo código**.

### Deixar o Gettsum como "app" no celular (recomendado)

Depois de pareado, adicione o Gettsum à tela inicial para abri-lo com um toque:

- **Android (Chrome):** menu **⋮ → Adicionar à tela inicial** (ou **Instalar app**).
- **iPhone (Safari):** botão **Compartilhar → Adicionar à Tela de Início**.

---

## 4. Ler códigos no dia a dia

1. Deixe o Gettsum aberto no computador (pode estar só na bandeja).
2. Abra o Gettsum no celular (ícone na tela inicial ou o mesmo endereço). Ele reconecta sozinho.
3. **No computador, clique no campo onde o código deve entrar.** Pode ser uma planilha, um
   sistema de estoque, um site, o Bloco de Notas, etc.
4. Aponte o celular para o código de barras, deixando-o dentro do retângulo branco.
5. Ao ler, o celular **bipa e vibra**, e em seguida mostra **"✓ Inserido em <nome da janela>"**.
   O número aparece no campo, na posição do cursor.
6. Para o próximo código, posicione o cursor no próximo campo (ou use o sufixo *Tab*/*Enter*, veja a
   [seção 7](#7-configurações-recomendadas-por-situação)) e leia de novo.

**Importante:** o Gettsum digita na **janela que está em primeiro plano** no computador. Se a
própria janela do Gettsum estiver em foco, ele recusa e pede para clicar no campo do formulário.
Confira sempre o nome da janela mostrado no celular.

### Proteção contra leitura duplicada

Se o celular continuar apontado para o mesmo código, ele **não** envia o valor de novo. Para
enviar o mesmo código outra vez (ex.: duas unidades do mesmo produto), use **↻ Repetir último** ou
afaste o celular e aponte novamente depois de um instante.

---

## 5. Tela do celular

```
┌──────────────────────────────────┐
│ ● Conectado a ESCRITORIO-PC   ⚙ │  ← indicador de conexão e configurações
├──────────────────────────────────┤
│                                  │
│     ┌────────────────────┐       │
│     │ ────────────────── │       │  ← mire o código dentro do retângulo
│     └────────────────────┘       │
│   Aponte para o código de barras │
├──────────────────────────────────┤
│ 7891234567895                    │  ← último valor lido
│ ✓ Inserido em “Pedido - Excel”   │  ← resultado no computador
├──────────────────────────────────┤
│ 🔦 Lanterna │ ↻ Repetir │ ⏸ Pausar│
└──────────────────────────────────┘
```

| Elemento | Função |
|---|---|
| **Indicador** (topo) | Verde: conectado ao computador. Vermelho piscando: sem conexão, tentando de novo sozinho. Cinza: não pareado. |
| **⚙** | Abre as configurações do celular. |
| **🔦 Lanterna** | Liga/desliga o flash. Só aparece se o celular e o navegador permitirem. |
| **↻ Repetir último** | Envia de novo o último valor lido (útil para quantidades). |
| **⏸ Pausar / ▶ Retomar** | Para de ler sem fechar a câmera, por exemplo para trocar de caixa sem ler códigos sem querer. |

### Configurações do celular (⚙)

| Opção | Para que serve | Padrão |
|---|---|---|
| Nome deste celular | Nome exibido no computador e no histórico. | "Android" ou "iPhone" |
| Som ao ler | Bipe a cada leitura. | Ligado |
| Vibrar ao ler | Vibração a cada leitura (não disponível no iPhone). | Ligado |
| **Confirmar antes de enviar** | Mostra o valor e pergunta **Enviar / Ler novamente / Cancelar** antes de mandar. Use quando a precisão importa mais que a velocidade. | Desligado |
| Tipos de código | Quais formatos o leitor procura. Menos tipos = leitura mais rápida e menos falsos positivos. | EAN-13, EAN-8, UPC-A, UPC-E, Code 128 |
| Desconectar este celular | Remove a autorização. Para voltar a usar, será preciso parear de novo. | — |

Tipos opcionais: **QR Code**, **Code 39**, **ITF (Interleaved 2 of 5)** e **Data Matrix**.

---

## 6. Tela do computador

| Área | O que mostra / faz |
|---|---|
| **Indicador do topo** | *Aguardando pareamento*, *Aguardando o celular abrir o Gettsum*, *Conectado: <celular>*, *Recepção pausada* ou *Servidor parado*. |
| **Conectar um celular** | QR Code, endereço, código de 6 números e tempo de validade. **Gerar novo código** invalida o anterior. Se o computador tiver mais de uma rede, aparece **Endereço usado no QR Code** para escolher a correta (normalmente a do Wi-Fi). |
| **Celulares pareados** | Lista com status (Conectado / Visto há X min). **Renomear** e **Remover**. |
| **Inserção** | Como inserir o valor, tecla após o valor e **Pausar recepção** (ver [seção 7](#7-configurações-recomendadas-por-situação)). |
| **Preferências** | Nome do computador, ocultar valores no histórico, iniciar com o Windows, manter na bandeja ao fechar, porta de rede. |
| **Últimas leituras** | Hora, celular, valor e resultado (*Inserido*, *Copiado*, *Pausado*, *Erro*) das últimas 20 leituras. Fica só na memória e some ao fechar o Gettsum. |

### Ícone na bandeja

Clique com o botão direito no ícone ao lado do relógio para ver:

- **Abrir**: mostra a janela;
- **Pausar recepção / Retomar recepção**;
- **Sair**: encerra o Gettsum. Com a opção *Ao fechar, manter na bandeja* ligada, fechar a
  janela no **X** apenas a esconde.

---

## 7. Configurações recomendadas por situação

### "Como inserir o valor"

| Opção | Quando usar |
|---|---|
| **Digitar no campo ativo** *(recomendado)* | A maioria dos programas: Excel, navegadores, ERPs, Bloco de Notas. Não mexe na área de transferência. |
| **Colar no campo ativo (Ctrl+V)** | Programas que ignoram digitação simulada: acesso remoto (RDP, Citrix, AnyDesk), alguns sistemas legados e terminais. O Gettsum restaura o que estava na área de transferência logo depois. |
| **Somente copiar** | Quando você quer decidir onde colar. O valor vai para a área de transferência e você cola com **Ctrl+V**. |

### "Depois do valor, pressionar"

| Opção | Efeito | Exemplo de uso |
|---|---|---|
| **Nada** *(padrão)* | Só o número é inserido. | Preenchimento manual, conferência. |
| **Tab** | Vai para o próximo campo. | Formulários com vários campos em sequência. |
| **Enter** | Confirma. **Pode enviar o formulário.** | Planilha (desce para a linha de baixo), PDV, campo de busca. |

> ⚠ Ative **Enter** somente se tiver certeza de que o Enter não vai enviar um formulário
> incompleto ou confirmar uma operação sem revisão.

### Receitas prontas

| Tarefa | Inserção | Tecla após | No celular |
|---|---|---|---|
| Lista de códigos no **Excel/Google Planilhas** (um por linha) | Digitar | Enter | — |
| **Conferência de estoque** com quantidades | Digitar | Enter | Use **↻ Repetir último** para cada unidade extra |
| **Cadastro de produto** (código + outros campos) | Digitar | Tab | Ative **Confirmar antes de enviar** |
| Sistema via **acesso remoto/Citrix** | Colar (Ctrl+V) | conforme o sistema | — |
| Ler **QR Codes** (links, etiquetas internas) | Digitar | Nada | Ative **QR Code** em Tipos de código |
| Trabalhar com **vários celulares** no mesmo PC | Digitar | Enter | Dê nomes diferentes a cada celular |

---

## 8. Gerenciar celulares

- **Vários celulares**: pareie quantos quiser; todos enviam para o mesmo computador, em ordem
  de chegada.
- **Renomear**: em *Celulares pareados*, clique em **Renomear**, digite o nome e pressione Enter
  (Esc cancela; clicar fora também salva). No celular, o nome também pode ser alterado em ⚙.
- **Remover (perdi o celular / troquei de funcionário)**: clique em **Remover**. O celular perde
  a autorização na hora e não consegue mais enviar nada.
- **Usar o mesmo celular em outro computador**: pareie com o outro computador pelo QR Code dele.
  Cada computador tem seu próprio endereço.

---

## 9. Mensagens e o que fazer

### No celular

| Mensagem | Significado | O que fazer |
|---|---|---|
| ✓ Inserido em “…” | Deu certo. | Confira se o nome da janela é o esperado. |
| Copiado para a área de transferência do computador — cole com Ctrl+V | O valor não foi digitado, mas está pronto para colar. | Clique no campo no computador e pressione **Ctrl+V**. |
| “…” é executado como administrador e não aceita digitação de outros apps | O programa de destino roda com privilégios elevados (restrição do Windows). | Cole com Ctrl+V, ou feche o Gettsum e abra-o com **Executar como administrador**. |
| A janela do Gettsum está em foco | O cursor estava na própria janela do Gettsum. | Clique no campo do formulário e toque em **Tentar novamente**. |
| Nenhuma janela ativa no computador | Nenhum programa em primeiro plano (ex.: área de trabalho). | Clique no campo do formulário e tente de novo. |
| Recepção pausada no computador | Alguém pausou no computador. | Desmarque **Pausar recepção** no Gettsum ou use *Retomar recepção* na bandeja. |
| Não foi possível confirmar o envio… o valor não será digitado duas vezes | A rede falhou no meio do envio. | Toque em **Tentar novamente**. Se o valor já tinha chegado, ele não é repetido. |
| Sem conexão — tentando de novo… | O celular não alcança o computador. | Veja [O celular não conecta](#o-celular-não-conecta-sem-conexão). |
| Código inválido ou expirado | O código de 6 números está errado ou passou de 5 minutos. | Confira o código no computador ou clique em **Gerar novo código**. |
| Muitas tentativas. Aguarde alguns segundos e use o novo código | 5 códigos errados seguidos; bloqueio de segurança de 30 s. | Espere e use o **novo** código exibido. |
| Este celular não está mais autorizado neste computador | O celular foi removido no computador. | Pareie novamente. |
| O acesso à câmera foi negado | A permissão da câmera foi recusada. | Libere a câmera nas configurações do navegador (veja abaixo) e toque em **Ativar câmera**. |

### No computador

| Mensagem | O que fazer |
|---|---|
| A porta 47800 já está em uso | Outro programa usa a porta. Feche-o ou troque a **Porta de rede** em Preferências (os celulares precisarão ler o novo QR Code). |
| O endereço do computador mudou: os celulares precisarão aceitar o certificado novamente | O IP mudou (outra rede/roteador). Leia o QR Code de novo no celular. |
| Muitas tentativas de pareamento inválidas. Um novo código foi gerado | Alguém errou o código 5 vezes. Se não foi você, verifique quem está na rede. |

---

## 10. Problemas comuns

### O celular não conecta ("Sem conexão")

Verifique, nesta ordem:

1. **O Gettsum está aberto no computador?** Procure o ícone na bandeja (talvez escondido na seta
   **^** ao lado do relógio).
2. **Mesmo Wi-Fi?** Confira o nome da rede nos dois aparelhos. Desligue os **dados móveis** do
   celular se ele insistir em sair por eles.
3. **Rede de visitantes ou corporativa?** Elas costumam isolar os aparelhos. Use a rede principal
   ou peça ao TI para liberar a porta **47800** (TCP) na rede local.
4. **Firewall do Windows:** abra *Configurações → Privacidade e segurança → Segurança do
   Windows → Firewall e proteção de rede → Permitir um aplicativo pelo firewall* e marque
   **Gettsum** em **Privada**. Confira também se a rede do Windows está como **Privada**
   (*Configurações → Rede e Internet → Wi-Fi/Ethernet → Tipo de perfil de rede*).
5. **Endereço errado:** se o computador tem cabo e Wi-Fi, ou VPN, escolha a rede certa em
   **Endereço usado no QR Code** e leia o QR Code de novo.
6. **IP mudou:** depois de reiniciar o roteador, o endereço pode mudar. Leia o QR Code de novo. Para
   evitar, peça uma *reserva de DHCP* para o computador no roteador.

### A câmera não abre

- **Permissão negada:**
  - Android/Chrome: toque no ícone à esquerda do endereço → **Permissões → Câmera → Permitir**.
  - iPhone: *Ajustes → Safari → Câmera → Permitir*, ou **aA** na barra de endereço → *Ajustes do
    Site*.
- Outro app usando a câmera (videochamada, outro leitor): feche-o.
- Navegador não suportado: use **Chrome** no Android e **Safari** no iPhone.

### O código não é lido

- Ative a **lanterna** em ambientes escuros.
- Afaste o celular até o código ocupar cerca de 2/3 do retângulo; muito perto fica fora de foco.
- Evite reflexos em embalagens brilhantes inclinando levemente o celular.
- Confira se o tipo do código está ativo em **⚙ → Tipos de código**. Por exemplo, etiquetas
  internas costumam usar Code 39 ou ITF, que vêm desligados.
- Códigos danificados, muito pequenos ou impressos com pouco contraste podem não ser lidos.

### O valor não aparece no programa

- Confira o nome da janela que o celular mostrou: o cursor estava no lugar certo?
- Programas como administrador: veja a mensagem correspondente na [seção 9](#no-celular).
- Acesso remoto, Citrix, jogos e terminais: troque para **Colar (Ctrl+V)**.
- **Pausar recepção** está marcado?

### Aparecem caracteres trocados ou a mais

- O Gettsum remove quebras de linha, tabulações e caracteres de controle do código lido. Enter/Tab
  só são enviados pela opção **Depois do valor, pressionar**.
- Se o programa de destino tiver autocompletar, ele pode alterar o texto digitado. Teste no
  Bloco de Notas para comparar.

### O aviso de segurança aparece de novo

Isso acontece quando o endereço do computador muda ou o certificado é renovado (uma vez por
ano). Aceite novamente como no [passo 3](#3-conectar-o-celular-primeira-vez).

---

## 11. Dicas para uma leitura melhor

- Segure o celular **paralelo** ao código, a uns 10–20 cm.
- Mantenha o código **dentro do retângulo**, com a linha vermelha atravessando as barras.
- Boa iluminação faz mais diferença que proximidade.
- Desative tipos de código que você não usa: a leitura fica mais rápida.
- Para ler muitos itens seguidos, use o sufixo **Enter** ou **Tab** e não precisará tocar no
  computador entre uma leitura e outra.
- O celular não apaga a tela enquanto o leitor está aberto (quando o navegador permite).

---

## 12. Privacidade e segurança

- **Nenhuma imagem sai do celular.** A leitura do código é feita no próprio aparelho; só o texto
  decodificado é enviado.
- **Só rede local.** Nada passa pela internet nem por servidores externos.
- **Criptografia:** toda comunicação usa HTTPS.
- **Só celulares autorizados** enviam leituras. O pareamento usa código temporário (5 minutos, uso
  único) e é bloqueado após 5 tentativas erradas.
- Você pode **remover** um celular a qualquer momento, com efeito imediato.
- As leituras **não são gravadas em disco**. O histórico fica só na memória e some ao fechar o
  Gettsum. Ative **Ocultar valores no histórico** se outras pessoas veem sua tela.

---

## 13. Perguntas frequentes

**Funciona sem internet?**
Sim. Só precisa da rede local (Wi-Fi/roteador) ligando os dois aparelhos.

**Funciona no Mac ou Linux?**
Nesta versão, a digitação automática é só para Windows. Em outros sistemas o valor é copiado para
a área de transferência e você cola com Ctrl/Cmd+V.

**Preciso deixar a janela do Gettsum aberta?**
Não. Ele pode ficar só na bandeja. Ative **Iniciar com o Windows** para não precisar abrir
manualmente.

**A tela do celular pode apagar?**
Se apagar, a câmera para. Ao reabrir, o Gettsum reconecta e volta a ler.

**Posso usar dois celulares ao mesmo tempo?**
Sim. As leituras entram no computador na ordem em que chegam.

**O que acontece se a rede cair no meio de um envio?**
O celular mostra **Tentar novamente**. Cada leitura tem uma identificação única, então o
computador nunca digita o mesmo envio duas vezes.

**Por que o navegador diz que o site "não é seguro"?**
A conexão é criptografada, mas o certificado foi gerado pelo seu computador e não por uma
autoridade pública (que exigiria um domínio na internet). O aviso aparece só na primeira vez em
cada celular, ou quando o endereço muda.
