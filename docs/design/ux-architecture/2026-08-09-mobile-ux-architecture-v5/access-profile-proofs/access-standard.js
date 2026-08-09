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
  const buyAction = document.querySelector('.buy-action');
  const restoreAction = document.querySelector('.restore-action');
  const closeAction = document.querySelector('.close-action');

  let currentPage = '学习';
  let returningTo = null;
  let pendingWork = 0;
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
    if (currentPage === '空间') return '取消，返回当前空间';
    if (currentPage === '我的') return '取消，返回我的';
    return '取消，返回当前学习';
  }

  function setBusy(isBusy) {
    busy = isBusy;
    buyAction.disabled = isBusy;
    restoreAction.disabled = isBusy;
    closeAction.disabled = isBusy;
    dialog.setAttribute('aria-busy', String(isBusy));
  }

  function openDialog(event) {
    returningTo = event.currentTarget;
    originCopy.textContent = placeCopy();
    closeAction.textContent = returnLabel();
    message.textContent = '选择下一步。你的现有访问不会因此改变。';
    buyAction.textContent = '继续购买';
    restoreAction.textContent = '找回已有购买';
    setBusy(false);
    dialog.hidden = false;
    document.body.classList.add('dialog-open');
    shell.inert = true;
    shell.setAttribute('aria-hidden', 'true');
    panel.focus({ preventScroll: true });
  }

  function closeDialog() {
    if (busy) return;
    window.clearTimeout(pendingWork);
    setBusy(false);
    dialog.hidden = true;
    document.body.classList.remove('dialog-open');
    shell.inert = false;
    shell.removeAttribute('aria-hidden');
    returningTo?.focus({ preventScroll: true });
  }

  document.querySelectorAll('.access-entry').forEach((action) => {
    action.addEventListener('click', openDialog);
  });

  closeAction.addEventListener('click', closeDialog);

  buyAction.addEventListener('click', () => {
    window.clearTimeout(pendingWork);
    setBusy(true);
    message.textContent = '正在打开购买服务…';
    pendingWork = window.setTimeout(() => {
      setBusy(false);
      buyAction.textContent = '重试购买';
      message.textContent = '当前无法打开购买服务，购买没有完成。你可以重试，也可以继续现有学习。';
    }, 800);
  });

  restoreAction.addEventListener('click', () => {
    window.clearTimeout(pendingWork);
    setBusy(true);
    message.textContent = '正在查找已有购买…';
    pendingWork = window.setTimeout(() => {
      setBusy(false);
      restoreAction.textContent = '再次查找';
      message.textContent = '没有找到可找回的购买。请确认当前登录账号和购买时使用的商店账号；现有学习不受影响。';
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
