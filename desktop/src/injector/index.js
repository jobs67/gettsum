'use strict';

// Chooses how a scanned value reaches the focused field.
//   mode "type"      -> keystrokes (Windows only)
//   mode "paste"     -> clipboard + Ctrl+V (Windows only), previous clipboard text restored
//   mode "clipboard" -> clipboard only; the user pastes manually
// Platforms without direct insertion always fall back to "clipboard" and say so.

const PASTE_RESTORE_DELAY_MS = 600;

function loadNative() {
  if (process.platform !== 'win32') return null;
  try {
    return require('./windows');
  } catch (err) {
    console.error('[injector] Win32 indisponível:', err);
    return null;
  }
}

/**
 * @param {{ clipboard: { readText(): string, writeText(t: string): void }, ownPid?: number, native?: object|null }} deps
 */
function createInjector({ clipboard, ownPid = process.pid, native = loadNative() }) {
  const directInsert = Boolean(native);

  function copyOnly(text, reason) {
    clipboard.writeText(text);
    return {
      status: 'copied',
      target: null,
      message: reason
        ? `${reason} O valor foi copiado — cole com Ctrl+V.`
        : 'Copiado para a área de transferência — cole com Ctrl+V.',
    };
  }

  async function insert(text, { mode = 'type', suffix = 'none' } = {}) {
    if (!directInsert) {
      return copyOnly(text, 'Inserção direta não é suportada neste sistema.');
    }
    if (mode === 'clipboard') return copyOnly(text);

    const target = native.foregroundTarget();
    if (!target) {
      return { status: 'error', target: null, message: 'Nenhuma janela ativa no computador. Clique no campo do formulário.' };
    }
    if (target.pid === ownPid) {
      return { status: 'error', target: target.title, message: 'A janela do Gettsum está em foco. Clique no campo do formulário e tente novamente.' };
    }
    if (target.blockedByUipi) {
      return copyOnly(text, `"${target.title}" é executado como administrador e não aceita digitação de outros apps.`);
    }

    if (mode === 'paste') {
      const previous = clipboard.readText();
      clipboard.writeText(text);
      native.pressPaste(suffix);
      setTimeout(() => {
        // Only restore if nobody replaced the clipboard in the meantime.
        if (clipboard.readText() === text) clipboard.writeText(previous);
      }, PASTE_RESTORE_DELAY_MS);
    } else {
      native.typeText(text, suffix);
    }
    return { status: 'inserted', target: target.title, message: null };
  }

  return { insert, directInsert };
}

module.exports = { createInjector };
