(() => {
  const shell = document.querySelector('.app-shell');
  const main = document.querySelector('.page-main');
  const routeName = document.querySelector('.route-name');
  const navigation = Array.from(document.querySelectorAll('.nav-action'));
  const pages = Array.from(document.querySelectorAll('.page-section'));
  const dialog = document.querySelector('.dialog-layer');
  const panel = document.querySelector('.dialog-panel');
  const originCopy = document.querySelector('.exact-place');
  const message = document.querySelector('.result-message');
  const refreshAction = document.querySelector('.refresh-action');
  const closeAction = document.querySelector('.close-action');
  const mineAccessCopy = document.querySelector('.complete-access-copy');
  const mineAccessLabel = document.querySelector('.complete-access-label');
  const dialogAccessCopy = document.querySelector('.dialog-access-copy');
  const dialogAccessLabel = document.querySelector('.dialog-access-label');

  let currentPage = '学习';
  let returningTo = null;
  let pendingWork = 0;
  let refreshCount = 0;
  let busy = false;

  const pageNames = ['学习', '空间', '统计', '我的'];

  function showPage(name, moveFocus = true) {
    currentPage = name;
    routeName.textContent = name;

    navigation.forEach((action, index) => {
      if (pageNames[index] === name) {
        action.setAttribute('aria-current', 'page');
      } else {
        action.removeAttribute('aria-current');
      }
    });

    pages.forEach((page, index) => {
      page.hidden = pageNames[index] !== name;
    });

    if (moveFocus) {
      main.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  navigation.forEach((action, index) => {
    action.addEventListener('click', () => showPage(pageNames[index]));
  });

  document.querySelector('.space-actions .quiet-action').addEventListener('click', () => {
    showPage('学习');
  });

  document.querySelector('.study-card .button').addEventListener('click', (event) => {
    event.currentTarget.textContent = '主干：the team continued';
  });

  function placeCopy() {
    if (currentPage === '空间') {
      return '当前位置：仔细阅读馆 / 句子结构区 / 主谓学习盒 / 让步句主干';
    }
    if (currentPage === '我的') {
      return '当前位置：我的 / 访问详情';
    }
    return '当前位置：仔细阅读馆 / 句子结构区 / 主谓学习盒 / 让步句主干';
  }

  function returnLabel() {
    if (currentPage === '空间') return '返回当前空间';
    if (currentPage === '我的') return '返回我的';
    return '返回当前学习';
  }

  function openDialog(event) {
    returningTo = event.currentTarget;
    originCopy.textContent = placeCopy();
    closeAction.textContent = returnLabel();
    message.textContent = '你可以刷新访问状态，或继续当前位置。';
    busy = false;
    refreshAction.disabled = false;
    closeAction.disabled = false;
    dialog.removeAttribute('aria-busy');
    dialog.hidden = false;
    document.body.classList.add('dialog-open');
    shell.inert = true;
    shell.setAttribute('aria-hidden', 'true');
    panel.focus({ preventScroll: true });
  }

  function closeDialog() {
    if (busy) return;
    window.clearTimeout(pendingWork);
    busy = false;
    refreshAction.disabled = false;
    closeAction.disabled = false;
    dialog.removeAttribute('aria-busy');
    dialog.hidden = true;
    document.body.classList.remove('dialog-open');
    shell.inert = false;
    shell.removeAttribute('aria-hidden');
    returningTo?.focus({ preventScroll: true });
  }

  function showAccess(copy, label) {
    mineAccessCopy.textContent = copy;
    mineAccessLabel.textContent = label;
    dialogAccessCopy.textContent = copy;
    dialogAccessLabel.textContent = label;
  }

  document.querySelectorAll('.access-entry').forEach((action) => {
    action.addEventListener('click', openDialog);
  });

  closeAction.addEventListener('click', closeDialog);

  refreshAction.addEventListener('click', () => {
    window.clearTimeout(pendingWork);
    busy = true;
    refreshAction.disabled = true;
    closeAction.disabled = true;
    dialog.setAttribute('aria-busy', 'true');
    message.textContent = '正在确认可用范围…';

    pendingWork = window.setTimeout(() => {
      refreshCount += 1;
      busy = false;
      refreshAction.disabled = false;
      closeAction.disabled = false;
      dialog.removeAttribute('aria-busy');

      if (refreshCount % 3 === 1) {
        showAccess('完整卡片、完整学习安排和完整空间均可使用。基础账户保持不变。', '已开放');
        message.textContent = '完整访问已确认。返回后可以从刚才的位置继续。';
        return;
      }

      if (refreshCount % 3 === 2) {
        message.textContent = '这次没有确认成功。你可以重试，并按上次确认的范围继续使用。基础账户不会因此改变。';
        return;
      }

      showAccess('当前未开放；基础学习与原有会员权益不受影响。', '未开放');
      message.textContent = '当前没有完整访问。你仍可以继续基础学习。';
    }, 800);
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && !busy) closeDialog();
  });

  document.addEventListener('keydown', (event) => {
    if (dialog.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (!busy) closeDialog();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      panel.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
    );
    if (!focusable.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === panel)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
