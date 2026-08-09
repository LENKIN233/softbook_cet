(() => {
  const body = document.body;
  const view = document.querySelector("[data-view]");
  const context = document.querySelector("[data-context]");
  const sheetRoot = document.querySelector("[data-sheet-root]");
  const live = document.querySelector("[data-live]");
  const nav = document.querySelector("[data-main-nav]");
  const back = document.querySelector("[data-back]");
  const title = document.querySelector("[data-title]");
  const subtitle = document.querySelector("[data-subtitle]");
  const appFrame = document.querySelector(".app-frame");
  const usesTopLevelHistory = body.classList.contains("platform-android");

  const families = ["flip", "choice", "lock", "elimination", "swipe"];
  const familyNames = {
    flip: "翻面",
    choice: "四选一",
    lock: "开锁",
    elimination: "消除",
    swipe: "滑动",
  };
  const familyCardLabels = {
    flip: "让步句中的主句",
    choice: "转折关系中的连接词",
    lock: "让步句的语序",
    elimination: "让步句中的主干",
    swipe: "让步关系判断",
  };
  const routeNames = {
    learning: "学习",
    space: "空间",
    statistics: "统计",
    mine: "我的",
  };
  const publicLibraries = [
    "听力馆",
    "仔细阅读馆",
    "选词填空馆",
    "写作馆",
    "翻译馆",
    "词汇馆",
    "语法馆",
  ];
  const spaceCatalog = {
    听力馆: [
      { name: "听前判断主题", boxes: ["从选项判断主题", "从选项判断考点", "从选项寻找提示语"] },
      { name: "听清语音变化", boxes: ["听清连在一起的发音", "听清弱化的发音", "听清省略的爆破音"] },
      { name: "听懂句间关系", boxes: ["辨认转折", "辨认因果", "辨认递进"] },
    ],
    仔细阅读馆: [
      { name: "长难句里的主干", boxes: ["找出主语和谓语", "找出主语、谓语和宾语", "辨认主语与表语"] },
      { name: "找到关键信息", boxes: ["找到人名和数字", "找到关键名词", "找到限定词"] },
      { name: "排除干扰答案", boxes: ["识别无依据答案", "识别绝对说法", "识别相反说法"] },
    ],
    选词填空馆: [
      { name: "先判断词的作用", boxes: ["名词所在的位置", "形容词所在的位置", "动词所在的位置"] },
      { name: "用句子结构判断空格", boxes: ["空格需要名词", "空格需要形容词", "空格需要动词"] },
      { name: "识别常见搭配", boxes: ["动词与介词的搭配", "形容词与名词的搭配", "名词与介词的搭配"] },
    ],
    写作馆: [
      { name: "先判断写作任务", boxes: ["完成应用类写作", "完成议论类写作", "完成说明类写作"] },
      { name: "组织文章句子", boxes: ["引出观点", "展开论证", "总结观点"] },
    ],
    翻译馆: [
      { name: "组织复杂句", boxes: ["并列表达", "补充说明", "突出重点"] },
      { name: "按主题理解例句", boxes: ["历史文化表达", "社会发展表达", "地理生态表达"] },
      { name: "用短语压缩信息", boxes: ["把动作改成名词", "把修饰信息改成短语"] },
    ],
    词汇馆: [
      { name: "换一种表达", boxes: ["替换相近意思", "变化词的作用", "用短语替换"] },
      { name: "理解中国特色表达", boxes: ["政治主题表达", "经济主题表达", "文化主题表达"] },
      { name: "掌握常见词", boxes: ["听力常见词", "阅读常见词", "写作提升词"] },
    ],
    语法馆: [
      { name: "判断时间", boxes: ["写作中的时间", "听力中的时间"] },
      { name: "拆解复杂句", boxes: ["作名词使用的从句", "修饰名词的从句", "说明状态的从句"] },
      { name: "理解假设语气", boxes: ["听力中的假设", "阅读中的假设", "翻译中的假设"] },
    ],
  };
  const lockAnswer = ["Although", "the task was difficult", "the team", "continued"];
  const eliminationAnswer = ["Although", "the task was difficult"];
  const navigationLimit = 12;
  const focusAttributes = [
    "data-action",
    "data-route",
    "data-choice",
    "data-lock-word",
    "data-strike",
    "data-swipe",
    "data-library",
    "data-group",
    "data-box",
    "data-card",
    "data-back",
  ];

  const model = {
    signedIn: false,
    authStep: "phone",
    authBusy: "",
    authError: "",
    phone: "",
    code: "",
    resendRemaining: 0,
    route: "learning",
    familyIndex: 0,
    sessionState: "idle",
    pendingFamilyIndex: 0,
    phase: "ready",
    selected: "",
    lockWords: [],
    strikes: [],
    pendingOutcome: null,
    resolvedOutcome: null,
    lockExplanationOpen: false,
    hintOpen: false,
    peekOpen: false,
    inlineError: "",
    favoriteBusy: false,
    favoriteTarget: "",
    favoriteLabels: new Set(),
    sleepingLabels: new Set(),
    learningLocation: {
      library: "仔细阅读馆",
      group: "长难句里的主干",
      box: "找出主语和谓语",
      card: "让步句中的主句",
    },
    learningOrigin: null,
    currentCardExcluded: false,
    spaceDepth: "libraries",
    chosenLibrary: "仔细阅读馆",
    chosenGroup: "长难句里的主干",
    chosenBox: "找出主语和谓语",
    chosenCard: "让步句中的主句",
    spaceBusy: false,
    spaceTarget: "",
    access: "not-started",
    sheet: "",
    sheetInvoker: null,
    purchaseBusy: false,
    purchaseResult: "",
    restoreBusy: false,
    restoreResult: "",
    accountBusy: false,
    checkInState: "idle",
    checkInConfirmed: false,
  };

  const navigationStack = [];
  const navigationForwardStack = [];
  const routeNavigationStacks = Object.fromEntries(Object.keys(routeNames).map((route) => [route, []]));
  const routeNavigationForwardStacks = Object.fromEntries(Object.keys(routeNames).map((route) => [route, []]));
  let historyPosition = 0;
  let resendTimer = 0;
  let sessionTimer = 0;
  let completionTimer = 0;
  let checkInTimer = 0;

  function announce(message) {
    live.textContent = "";
    window.requestAnimationFrame(() => {
      live.textContent = message;
    });
  }

  function later(callback, delay = 360) {
    return window.setTimeout(callback, delay);
  }

  function describeFocus(element = document.activeElement) {
    if (!(element instanceof HTMLElement) || element === body) return null;
    if (element.id) return { kind: "id", value: element.id };
    for (const attribute of focusAttributes) {
      if (element.hasAttribute(attribute)) {
        return { kind: "attribute", attribute, value: element.getAttribute(attribute) ?? "" };
      }
    }
    return null;
  }

  function findFocusTarget(descriptor) {
    if (!descriptor) return null;
    if (descriptor.kind === "id") return document.getElementById(descriptor.value);
    if (descriptor.kind === "attribute") {
      return [...document.querySelectorAll(`[${descriptor.attribute}]`)].find(
        (element) => element.getAttribute(descriptor.attribute) === descriptor.value,
      ) ?? null;
    }
    return null;
  }

  function focusLater({ descriptor = null, selector = "", heading = false } = {}) {
    later(() => {
      const target =
        (selector ? document.querySelector(selector) : null) ??
        findFocusTarget(descriptor) ??
        (heading ? view.querySelector("h2") : null);
      if (target instanceof HTMLElement && !target.matches(":disabled") && !target.closest("[inert]")) {
        target.focus();
      }
    }, 0);
  }

  function selectedFamily() {
    return families[model.familyIndex];
  }

  function updateLearningCardLabel() {
    model.learningLocation.card = familyCardLabels[selectedFamily()];
  }

  function isCurrentLearningSelection() {
    return (
      model.chosenLibrary === model.learningLocation.library &&
      model.chosenGroup === model.learningLocation.group &&
      model.chosenBox === model.learningLocation.box &&
      model.chosenCard === model.learningLocation.card
    );
  }

  function setHeader() {
    if (!model.signedIn) {
      title.textContent = "软书四六级";
      subtitle.textContent = model.authStep === "phone" ? "登录" : "输入验证码";
      nav.hidden = true;
      back.hidden = model.authStep === "phone";
      return;
    }

    title.textContent = routeNames[model.route];
    subtitle.textContent = model.route === "learning" ? model.learningLocation.library : "软书四六级";
    nav.hidden = false;
    back.hidden = model.route !== "space" || model.spaceDepth === "libraries";
    document.querySelectorAll("[data-route]").forEach((control) => {
      const active = control.dataset.route === model.route;
      control.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function authView() {
    if (model.authStep === "phone") {
      const sending = model.authBusy === "send";
      return `
        <section class="surface surface--auth" aria-labelledby="auth-title">
          <div class="stack">
            <header class="surface-header">
              <p class="eyebrow">继续你的备考</p>
              <h2 id="auth-title" tabindex="-1">手机号登录</h2>
              <p class="support-copy">用于保留学习进度、空间位置与会员状态。</p>
            </header>
            <form class="stack" data-auth-phone novalidate>
              <div class="field">
                <label for="phone">手机号</label>
                <input id="phone" name="phone" inputmode="numeric" autocomplete="tel" maxlength="11" value="${model.phone}" aria-invalid="${model.authError ? "true" : "false"}" aria-describedby="phone-help phone-error" data-autofocus>
                <p id="phone-help" class="field-hint">请输入常用的 11 位手机号。</p>
                <p id="phone-error" class="field-error" ${model.authError ? "" : "hidden"}>${model.authError}</p>
              </div>
              <button class="primary-action" type="submit" ${sending ? "disabled" : ""}>${sending ? "正在发送…" : "获取验证码"}</button>
            </form>
            ${sending ? `<p class="status-message" role="status" tabindex="-1" data-auth-pending>正在发送验证码…</p>` : ""}
            <p class="quiet-copy">继续即表示你已阅读并同意用户协议与隐私政策。</p>
          </div>
        </section>`;
    }

    const verifying = model.authBusy === "verify";
    const resending = model.authBusy === "resend";
    const resendDisabled = Boolean(model.authBusy) || model.resendRemaining > 0;
    const resendLabel = resending
      ? "正在重新发送…"
      : model.resendRemaining > 0
        ? `${model.resendRemaining} 秒后可重新发送`
        : "重新发送";
    return `
      <section class="surface surface--auth" aria-labelledby="auth-title">
        <div class="stack">
          <header class="surface-header">
            <p class="eyebrow">验证码已发送</p>
            <h2 id="auth-title" tabindex="-1">输入 6 位验证码</h2>
            <p class="support-copy">请查看刚才填写的手机号。</p>
          </header>
          <form class="stack" data-auth-code novalidate>
            <div class="field">
              <label for="code">验证码</label>
              <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${model.code}" aria-invalid="${model.authError ? "true" : "false"}" aria-describedby="code-help code-error" data-autofocus ${model.authBusy ? "disabled" : ""}>
              <p id="code-help" class="field-hint">可直接粘贴完整验证码。</p>
              <p id="code-error" class="field-error" ${model.authError ? "" : "hidden"}>${model.authError}</p>
            </div>
            <button class="primary-action" type="submit" ${model.authBusy ? "disabled" : ""}>${verifying ? "正在确认…" : "登录"}</button>
          </form>
          <div class="cluster">
            <button class="text-action" type="button" data-action="resend" ${resendDisabled ? "disabled" : ""}>${resendLabel}</button>
            <button class="text-action" type="button" data-action="edit-phone" ${model.authBusy ? "disabled" : ""}>修改手机号</button>
          </div>
          ${verifying ? `<p class="status-message" role="status" tabindex="-1" data-auth-pending>正在确认验证码…</p>` : ""}
          ${resending ? `<p class="status-message" role="status" tabindex="-1" data-auth-pending>正在重新发送验证码…</p>` : ""}
        </div>
      </section>`;
  }

  function sessionPendingView() {
    const copy = model.sessionState === "initial-pending" ? "正在准备当前学习" : "正在准备下一张";
    return `
      <section class="surface" aria-labelledby="learning-title">
        <header class="surface-header">
          <p class="eyebrow">${model.learningLocation.library} · ${model.learningLocation.group} · ${model.learningLocation.box}</p>
          <h2 id="learning-title" tabindex="-1" data-session-focus>${copy}</h2>
          <p>请稍候，准备好后会回到学习任务。</p>
        </header>
      </section>`;
  }

  function favoriteButton(label) {
    const liked = model.favoriteLabels.has(label);
    const pending = model.favoriteBusy && model.favoriteTarget === label;
    const mutationBusy = model.favoriteBusy || model.spaceBusy;
    return `<button class="secondary-action" type="button" data-action="like" aria-pressed="${liked}" aria-disabled="${mutationBusy}">${pending ? "正在保存…" : liked ? "已喜欢" : "喜欢"}</button>`;
  }

  function learningToolbar() {
    if (model.phase === "pending") return "";
    return `
      <div class="cluster" aria-label="${model.learningLocation.card}的辅助操作">
        <button class="secondary-action" type="button" data-action="hint" aria-expanded="${model.hintOpen}">${model.hintOpen ? "收起提示" : "提示"}</button>
        <button class="secondary-action" type="button" data-action="peek" aria-expanded="${model.peekOpen}">${model.peekOpen ? "收起查看" : "先看一眼"}</button>
        ${favoriteButton(model.learningLocation.card)}
      </div>
      ${model.hintOpen ? `<aside class="support-region" aria-label="提示"><strong>提示</strong><p>先确认句子表达的转折关系，再看选项。</p></aside>` : ""}
      ${model.peekOpen ? `<aside class="support-region" aria-label="快速查看"><strong>先看一眼</strong><p>注意连接词前后的语义方向是否一致。</p></aside>` : ""}`;
  }

  function pendingBlock() {
    return `
      <section class="support-region" role="status" tabindex="-1" data-completion-status>
        <strong>正在核对这次作答…</strong>
        <p>请稍候，当前选择会保留在这一张。</p>
      </section>`;
  }

  function resultBlock(message, explanation, { canAdvance = false } = {}) {
    return `
      <section class="result-region" aria-labelledby="result-title" tabindex="-1" data-result-focus>
        <h3 id="result-title">${message}</h3>
        <p>${explanation}</p>
        ${canAdvance ? `<button class="primary-action" type="button" data-action="next">下一张</button>` : ""}
      </section>`;
  }

  function correctionBlock(title, explanation, action, actionLabel, extra = "") {
    return `
      <section class="correction-region" aria-labelledby="correction-title" tabindex="-1" data-correction-focus>
        <h3 id="correction-title">${title}</h3>
        <p>${explanation}</p>
        ${extra}
        <button class="primary-action" type="button" data-action="${action}">${actionLabel}</button>
      </section>`;
  }

  function flipInteraction() {
    if (model.phase === "pending") return pendingBlock();
    if (model.phase === "result") {
      return resultBlock(
        "已保存",
        model.resolvedOutcome.answer === "confident"
          ? "保持当前节奏，继续下一张。"
          : "这张会在合适的时候再次出现。",
        { canAdvance: true },
      );
    }
    if (model.phase === "revealed") {
      return `
        <div class="interaction">
          <div class="support-region" tabindex="-1" data-reveal-focus>
            <strong>解释</strong>
            <p>Although 引出让步关系，主句表达的结果没有因此改变。</p>
          </div>
          <div class="swipe-labels" aria-label="选择你的掌握感受">
            <button class="secondary-action" type="button" data-action="assess" data-value="confident">有把握</button>
            <button class="secondary-action" type="button" data-action="assess" data-value="review">再回看</button>
          </div>
        </div>`;
    }
    return `
      <div class="interaction">
        <p class="task-body">Although the task was difficult, the team continued.</p>
        <button class="primary-action" type="button" data-action="reveal">查看解释</button>
      </div>`;
  }

  function choiceResultOptions() {
    const options = [
      ["therefore", "A. therefore"],
      ["however", "B. however"],
      ["because", "C. because"],
      ["although", "D. although"],
    ];
    return options
      .map(([value, label]) => {
        const selected = model.resolvedOutcome.answer === value;
        const correct = value === "however";
        const stateLabel = selected && correct
          ? "你的答案，正确"
          : selected
            ? "你的答案，不正确"
            : correct
              ? "正确答案"
              : "";
        const result = correct ? "correct" : selected ? "incorrect" : "";
        return `<button class="choice" type="button" disabled ${result ? `data-result="${result}"` : ""} aria-label="${label}${stateLabel ? `，${stateLabel}` : ""}"><span>${label}</span>${stateLabel ? `<small>${stateLabel}</small>` : ""}</button>`;
      })
      .join("");
  }

  function choiceInteraction() {
    if (model.phase === "pending") return pendingBlock();
    if (model.phase === "result") {
      return `
        <div class="choice-grid" aria-label="作答结果">
          ${choiceResultOptions()}
        </div>
        ${resultBlock(
          model.resolvedOutcome.correct ? "回答正确" : "这次答案不正确",
          "前句说明困难，后句仍继续，however 最能表达这一转折。",
          { canAdvance: true },
        )}`;
    }

    const options = [
      ["therefore", "A. therefore"],
      ["however", "B. however"],
      ["because", "C. because"],
      ["although", "D. although"],
    ];
    return `
      <div class="interaction">
        <div class="choice-grid" role="group" aria-label="四个选项">
          ${options.map(([value, label]) => `<button class="choice" type="button" data-choice="${value}" aria-pressed="${model.selected === value}">${label}</button>`).join("")}
        </div>
        <p class="field-error" ${model.inlineError ? "" : "hidden"}>${model.inlineError}</p>
        <button class="primary-action" type="button" data-action="submit-choice">确认答案</button>
      </div>`;
  }

  function lockRows(words = model.lockWords) {
    if (!words.length) return `<p class="quiet-copy lock-empty">依次选择下方语块</p>`;
    return `
      <div class="lock-rows" aria-label="已选择的顺序">
        ${words.map((word, index) => `
          <div class="lock-row">
            <span class="lock-row__icon" aria-hidden="true"></span>
            <strong>${index + 1}</strong>
            <span>${word}</span>
          </div>`).join("")}
      </div>`;
  }

  function lockInteraction() {
    if (model.phase === "pending") return pendingBlock();
    if (model.phase === "correction") {
      return `
        <div class="interaction">
          ${lockRows(model.resolvedOutcome.answer)}
          ${correctionBlock(
            "顺序还需要调整",
            "保留了你刚才的排列。可以回到这一张调整，也可以先查看为什么。",
            "adjust-lock",
            "调整顺序",
            `<button class="secondary-action" type="button" data-action="show-lock-explanation" aria-expanded="${model.lockExplanationOpen}">${model.lockExplanationOpen ? "收起解释" : "查看解释"}</button>${model.lockExplanationOpen ? `<div class="attached-explanation"><strong>排列提示</strong><p>先放 Although 引出的让步部分，再放 the team continued 这条主线。</p></div>` : ""}`,
          )}
        </div>`;
    }
    if (model.phase === "result") {
      return `
        ${lockRows(model.resolvedOutcome.answer)}
        ${resultBlock(
          "顺序正确",
          "让步从句在前，主句随后给出仍然继续的结果。",
          { canAdvance: true },
        )}`;
    }
    const words = ["Although", "the task was difficult", "the team", "continued"];
    return `
      <div class="interaction">
        ${lockRows()}
        <div class="tile-row" role="group" aria-label="可选语块">
          ${words.map((word) => `<button class="tile" type="button" data-lock-word="${word}" ${model.lockWords.includes(word) ? "disabled" : ""}>${word}</button>`).join("")}
        </div>
        <div class="cluster">
          <button class="secondary-action" type="button" data-action="undo-lock" ${model.lockWords.length ? "" : "disabled"}>撤销一步</button>
          <button class="primary-action" type="button" data-action="submit-lock">确认顺序</button>
        </div>
        <p class="field-error" ${model.inlineError ? "" : "hidden"}>${model.inlineError}</p>
      </div>`;
  }

  function eliminationInteraction() {
    if (model.phase === "pending") return pendingBlock();
    if (model.phase === "result" && !model.resolvedOutcome.correct) {
      return `
        <div class="answer-comparison" aria-label="划掉内容对比">
          <div class="answer-comparison__group">
            <strong>你实际划掉的内容</strong>
            <div class="answer-tags">${model.resolvedOutcome.answer.map((piece) => `<span class="answer-tag"><small>你的选择</small>${piece}</span>`).join("")}</div>
          </div>
          <div class="answer-comparison__group">
            <strong>这题应划掉的内容</strong>
            <div class="answer-tags">${eliminationAnswer.map((piece) => `<span class="answer-tag"><small>应划掉</small>${piece}</span>`).join("")}</div>
          </div>
        </div>
        ${resultBlock(
          "这次保留的主干不正确",
          "去掉让步部分后，主干应保留为 the team continued。",
          { canAdvance: true },
        )}`;
    }
    if (model.phase === "result") {
      return resultBlock(
        "主干已找到",
        "去掉让步部分后，主干应保留为 the team continued。",
        { canAdvance: true },
      );
    }
    const pieces = ["Although", "the task was difficult", "the team", "continued"];
    return `
      <div class="interaction">
        <p class="support-copy">划掉不属于句子主干的部分。</p>
        <div class="stack" role="group" aria-label="句子组成">
          ${pieces.map((piece) => `<button class="strike-option" type="button" data-strike="${piece}" aria-pressed="${model.strikes.includes(piece)}"><span>${piece}</span></button>`).join("")}
        </div>
        <div class="cluster">
          <button class="secondary-action" type="button" data-action="undo-strike" ${model.strikes.length ? "" : "disabled"}>撤销上一步</button>
          <button class="primary-action" type="button" data-action="submit-elimination">确认保留内容</button>
        </div>
        <p class="field-error" ${model.inlineError ? "" : "hidden"}>${model.inlineError}</p>
      </div>`;
  }

  function swipeInteraction() {
    if (model.phase === "pending") return pendingBlock();
    if (model.phase === "result" && !model.resolvedOutcome.correct) {
      const learnerMeaning = model.resolvedOutcome.answer === "left" ? "不符合" : "符合";
      return `
        <div class="answer-comparison answer-comparison--columns" aria-label="判断方向对比">
          <div class="answer-comparison__group"><strong>你的判断</strong><p><span class="direction-label">向${model.resolvedOutcome.answer === "left" ? "左" : "右"}</span>${learnerMeaning}</p></div>
          <div class="answer-comparison__group"><strong>正确判断</strong><p><span class="direction-label">向右</span>符合</p></div>
        </div>
        ${resultBlock(
          "这次判断不正确",
          "Although 表示即使存在困难，后面的行动仍然继续。",
          { canAdvance: true },
        )}`;
    }
    if (model.phase === "result") {
      return resultBlock(
        "判断正确",
        "Although 表示即使存在困难，后面的行动仍然继续。",
        { canAdvance: true },
      );
    }
    return `
      <div class="interaction">
        <div class="swipe-stage">
          <div class="swipe-trails" aria-hidden="true"><span>← 不符合</span><span>符合 →</span></div>
          <div class="swipe-deck">
            <div class="swipe-card swipe-card--back swipe-card--far" aria-hidden="true"></div>
            <div class="swipe-card swipe-card--back swipe-card--near" aria-hidden="true"></div>
            <div class="swipe-object swipe-card swipe-card--top" tabindex="0" role="group" aria-label="最上方判断卡片。向左是不符合，向右是符合" data-swipe-object>
              <strong>这句话表达让步关系。</strong>
            </div>
          </div>
          <div class="swipe-labels">
            <button class="secondary-action" type="button" data-swipe="left">不符合</button>
            <button class="secondary-action" type="button" data-swipe="right">符合</button>
          </div>
        </div>
        <p class="status-message" data-swipe-note hidden>已回到中间，尚未作答。</p>
      </div>`;
  }

  function learningView() {
    if (model.sessionState !== "ready") return sessionPendingView();
    const family = selectedFamily();
    const interactions = {
      flip: flipInteraction,
      choice: choiceInteraction,
      lock: lockInteraction,
      elimination: eliminationInteraction,
      swipe: swipeInteraction,
    };
    return `
      <section class="surface" aria-labelledby="learning-title">
        <header class="surface-header split">
          <div>
            <p class="eyebrow">${model.learningLocation.library} · ${model.learningLocation.group} · ${model.learningLocation.box}</p>
            <h2 id="learning-title" tabindex="-1">${model.learningLocation.card}</h2>
          </div>
          <button class="text-action" type="button" data-action="open-space">查看所在空间</button>
        </header>
        <article class="task-object" aria-label="当前学习卡片：${model.learningLocation.card}">
          <div class="context-line"><strong>${familyNames[family]}</strong><span>${model.learningLocation.group} · ${model.learningLocation.box}</span></div>
          <p class="task-prompt">根据句子关系完成当前任务。</p>
          ${interactions[family]()}
          ${learningToolbar()}
        </article>
      </section>`;
  }

  function catalogGroups(library = model.chosenLibrary) {
    return spaceCatalog[library] ?? [];
  }

  function catalogBoxes(library = model.chosenLibrary, groupName = model.chosenGroup) {
    return catalogGroups(library).find((group) => group.name === groupName)?.boxes ?? [];
  }

  function selectedCardLabels() {
    if (
      model.chosenLibrary === model.learningLocation.library &&
      model.chosenGroup === model.learningLocation.group &&
      model.chosenBox === model.learningLocation.box
    ) {
      return [model.learningLocation.card, "让步句中的谓语"];
    }
    return [`${model.chosenBox}要点`, `${model.chosenBox}辨析`];
  }

  function spaceLibraries() {
    return `
      <header class="surface-header">
        <p class="eyebrow">你的学习空间</p>
        <h2 id="space-title" tabindex="-1">选择一个馆</h2>
        <p>每张卡片都保留自己的所在位置。</p>
      </header>
      <div class="space-list">
        ${publicLibraries.map((name) => `<button class="space-object" type="button" data-library="${name}"><strong>${name}</strong><small>${name === model.learningLocation.library ? `${model.learningLocation.card}在这里` : "查看馆内知识分组"}</small></button>`).join("")}
      </div>`;
  }

  function spaceGroups() {
    return `
      <div class="space-path"><span>${model.chosenLibrary}</span></div>
      <header class="surface-header">
        <p class="eyebrow">馆内知识分组</p>
        <h2 id="space-title" tabindex="-1">选择知识分组</h2>
      </header>
      <div class="space-list">
        ${catalogGroups().map((group) => `<button class="space-object" type="button" data-group="${group.name}"><strong>${group.name}</strong><small>${model.chosenLibrary === model.learningLocation.library && group.name === model.learningLocation.group ? `${model.learningLocation.card}属于这里` : "查看分组中的学习盒"}</small></button>`).join("")}
      </div>`;
  }

  function spaceBoxes() {
    return `
      <div class="space-path"><span>${model.chosenLibrary}</span><span>${model.chosenGroup}</span></div>
      <header class="surface-header">
        <p class="eyebrow">分组内学习盒</p>
        <h2 id="space-title" tabindex="-1">选择学习盒</h2>
      </header>
      <div class="space-list">
        ${catalogBoxes().map((boxName) => `<button class="space-object" type="button" data-box="${boxName}"><strong>${boxName}</strong><small>${model.chosenLibrary === model.learningLocation.library && model.chosenGroup === model.learningLocation.group && boxName === model.learningLocation.box ? `${model.learningLocation.card}在这里` : "查看盒内卡片"}</small></button>`).join("")}
      </div>`;
  }

  function spaceCards() {
    return `
      <div class="space-path"><span>${model.chosenLibrary}</span><span>${model.chosenGroup}</span><span>${model.chosenBox}</span></div>
      <header class="surface-header">
        <p class="eyebrow">学习盒内</p>
        <h2 id="space-title" tabindex="-1">查看卡片</h2>
      </header>
      <div class="space-list">
        ${selectedCardLabels().map((cardName) => `<button class="space-object" type="button" data-card="${cardName}"><strong>${cardName}</strong><small>${cardName === model.learningLocation.card ? "与正在进行的学习相连" : "查看卡片位置"}</small></button>`).join("")}
      </div>`;
  }

  function spaceCard() {
    const sleeping = model.sleepingLabels.has(model.chosenCard);
    const sleepPending = model.spaceBusy && model.spaceTarget === model.chosenCard;
    return `
      <div class="space-path"><span>${model.chosenLibrary}</span><span>${model.chosenGroup}</span><span>${model.chosenBox}</span><span>${model.chosenCard}</span></div>
      <article class="task-object">
        <header>
          <p class="eyebrow">卡片位置</p>
          <h2 id="space-title" tabindex="-1">${model.chosenCard}</h2>
        </header>
        <p>这张卡片属于上方学习盒。喜欢只是标记，休眠会让它暂时不再出现在学习流中。</p>
        <div class="cluster">
          ${favoriteButton(model.chosenCard)}
          <button class="secondary-action" type="button" data-action="toggle-sleep" aria-disabled="${model.spaceBusy || model.favoriteBusy}">${sleepPending ? "正在保存…" : sleeping ? "唤醒卡片" : "让卡片休眠"}</button>
        </div>
        <button class="primary-action" type="button" data-action="return-learning">回到学习</button>
      </article>`;
  }

  function spaceView() {
    const content = {
      libraries: spaceLibraries,
      groups: spaceGroups,
      boxes: spaceBoxes,
      cards: spaceCards,
      card: spaceCard,
    }[model.spaceDepth]();
    return `<section class="surface" aria-labelledby="space-title">${content}</section>`;
  }

  function statisticsView() {
    const state = model.checkInState;
    const pending = ["pending", "retry-pending", "refresh-pending"].includes(state);
    let checkInContent = `
      <div class="check-in-status"><strong>今天尚未签到。</strong><p>签到只确认今天已经开始学习。</p></div>
      <button class="primary-action" type="button" data-action="check-in" aria-pressed="false">签到</button>`;
    if (state === "pending") {
      checkInContent = `<div class="check-in-status" role="status" tabindex="-1" data-check-in-status><strong>正在确认今天的签到…</strong><p>请稍候，确认完成前无需再次操作。</p></div>`;
    } else if (state === "queued") {
      checkInContent = `
        <div class="check-in-status" role="status" tabindex="-1" data-check-in-status><strong>暂时无法连接，已保留这次签到。</strong><p>${navigator.onLine ? "连接已恢复，可以重试。" : "恢复连接后重试即可。"}</p></div>
        <button class="primary-action" type="button" data-action="retry-check-in">重试</button>`;
    } else if (state === "retry-pending") {
      checkInContent = `<div class="check-in-status" role="status" tabindex="-1" data-check-in-status><strong>正在重新提交已保留的签到…</strong><p>完成后会再次更新状态。</p></div>`;
    } else if (state === "refresh-pending") {
      checkInContent = `<div class="check-in-status" role="status" tabindex="-1" data-check-in-status><strong>今天的签到已确认，正在更新状态…</strong><p>请稍候，不需要再次操作。</p></div>`;
    } else if (state === "reconciled") {
      checkInContent = `
        <div class="check-in-status" role="status" tabindex="-1" data-check-in-status><strong>签到状态已更新：今天已经确认。</strong><p>保留的签到与当前状态一致。</p></div>
        <button class="secondary-action" type="button" data-action="refresh-check-in">刷新状态</button>`;
    }
    return `
      <section class="surface" aria-labelledby="statistics-title">
        <header class="surface-header">
          <p class="eyebrow">本周学习</p>
          <h2 id="statistics-title" tabindex="-1">最近完成的学习</h2>
          <p>按日期回看已经完成的任务。</p>
        </header>
        <article class="panel check-in-panel" aria-labelledby="check-in-title" aria-busy="${pending}">
          <p class="eyebrow">今天</p>
          <h3 id="check-in-title">学习签到</h3>
          ${checkInContent}
        </article>
        <ol class="timeline" aria-label="最近学习记录">
          <li class="timeline-row"><strong>8 月 9 日</strong><small>完成四选一与翻面练习</small></li>
          <li class="timeline-row"><strong>8 月 8 日</strong><small>完成滑动练习</small></li>
          <li class="timeline-row"><strong>8 月 7 日</strong><small>没有学习记录</small></li>
        </ol>
      </section>`;
  }

  function accessLabel() {
    if (model.access === "premium") return "完整体验";
    if (model.access === "free") return "基础体验";
    if (model.access === "trial") return "完整试用 · 剩余 7 天";
    return "尚未开始试用";
  }

  function mineView() {
    const accessCopy = model.access === "free"
      ? "基础学习仍可继续，完整空间与更多内容需要完整体验。"
      : model.access === "not-started"
        ? "进入学习并准备好第一张后，才会开始完整试用。"
        : model.access === "trial"
          ? "本次试用有效至 8 月 16 日 23:59；结束后基础学习仍可继续。"
          : "当前可以使用完整学习、空间与复习能力。";
    return `
      <section class="surface" aria-labelledby="mine-title">
        <header class="surface-header">
          <p class="eyebrow">账号</p>
          <h2 id="mine-title" tabindex="-1">我的软书</h2>
          <p>学习进度、空间位置和会员状态会随账号保留。</p>
        </header>
        <article class="membership-card stack">
          <div><p class="eyebrow">当前体验</p><h3>${accessLabel()}</h3></div>
          <p>${accessCopy}</p>
          <button class="primary-action" type="button" data-action="open-membership">${model.access === "premium" ? "管理完整体验" : model.access === "not-started" ? "了解完整体验" : "查看完整体验"}</button>
        </article>
        <div class="cluster">
          <button class="secondary-action" type="button" data-action="sign-out">退出登录</button>
          <button class="quiet-action" type="button" data-action="delete-account">注销账号</button>
        </div>
      </section>`;
  }

  function isSheetBusy() {
    return model.purchaseBusy || model.restoreBusy || model.accountBusy;
  }

  function membershipSheet() {
    const commerceBusy = model.purchaseBusy || model.restoreBusy;
    const message = model.purchaseBusy
      ? "正在连接购买服务…"
      : model.restoreBusy
        ? "正在查找可恢复的购买…"
        : model.purchaseResult || model.restoreResult;
    return `
      <div class="sheet-backdrop" data-backdrop>
        <section class="sheet stack" role="dialog" aria-modal="true" aria-labelledby="membership-title">
          <header>
            <p class="eyebrow">完整体验</p>
            <h2 id="membership-title" tabindex="-1">继续使用完整学习与空间</h2>
          </header>
          <div class="panel"><strong>试用</strong><p>在试用期内使用完整卡片、学习安排与空间。</p></div>
          <div class="panel"><strong>基础体验</strong><p>试用结束后仍可正常进行基础学习，并保留接近一半的卡片。</p></div>
          <div class="panel"><strong>完整体验</strong><p>继续使用完整卡片、学习安排与全部空间。</p></div>
          <p class="status-message" role="status" tabindex="-1" data-sheet-status ${message ? "" : "hidden"}>${message}</p>
          ${model.access === "premium" ? "" : `<button class="primary-action" type="button" data-action="purchase" ${commerceBusy ? "disabled" : ""}>${model.purchaseBusy ? "正在连接…" : "继续订阅"}</button>`}
          <button class="secondary-action" type="button" data-action="restore" ${commerceBusy ? "disabled" : ""}>${model.restoreBusy ? "正在查找…" : "恢复购买"}</button>
          <button class="quiet-action" type="button" data-action="close-sheet" ${commerceBusy ? "disabled" : ""}>暂时不用</button>
        </section>
      </div>`;
  }

  function confirmationSheet(kind) {
    const deleting = kind === "delete";
    return `
      <div class="sheet-backdrop" data-backdrop>
        <section class="sheet stack" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <header><p class="eyebrow">请确认</p><h2 id="confirm-title" tabindex="-1">${deleting ? "注销账号" : "退出登录"}</h2></header>
          <p>${deleting ? "注销后将无法继续使用当前账号。确认前不会发生改变。" : "退出后，本机将回到登录页面。"}</p>
          <p class="status-message" role="status" tabindex="-1" data-sheet-status ${model.accountBusy ? "" : "hidden"}>${deleting ? "正在注销账号…" : "正在退出…"}</p>
          <button class="primary-action" type="button" data-action="confirm-${kind}" ${model.accountBusy ? "disabled" : ""}>${model.accountBusy ? deleting ? "正在注销…" : "正在退出…" : deleting ? "确认注销" : "确认退出"}</button>
          <button class="secondary-action" type="button" data-action="close-sheet" ${model.accountBusy ? "disabled" : ""}>取消</button>
        </section>
      </div>`;
  }

  function setBackgroundInert(active) {
    if (!appFrame) return;
    appFrame.inert = active;
    if (active) appFrame.setAttribute("aria-hidden", "true");
    else appFrame.removeAttribute("aria-hidden");
  }

  function renderSheet({ focusHeading = false, focusStatus = false, descriptor = null } = {}) {
    if (!model.sheet) {
      sheetRoot.innerHTML = "";
      setBackgroundInert(false);
      return;
    }
    setBackgroundInert(true);
    sheetRoot.innerHTML = model.sheet === "membership" ? membershipSheet() : confirmationSheet(model.sheet);
    focusLater({
      selector: focusStatus
        ? "[data-sheet-status]:not([hidden])"
        : focusHeading
          ? ".sheet h2"
          : "",
      descriptor,
    });
  }

  function openSheet(kind, invoker) {
    if (model.sheet) return;
    model.sheet = kind;
    model.sheetInvoker = describeFocus(invoker);
    model.purchaseResult = "";
    model.restoreResult = "";
    renderSheet({ focusHeading: true });
  }

  function closeSheet({ restoreFocus = true } = {}) {
    if (!model.sheet || isSheetBusy()) {
      if (isSheetBusy()) announce("请稍候，当前操作完成后再关闭。 ");
      return;
    }
    const invoker = model.sheetInvoker;
    model.sheet = "";
    model.sheetInvoker = null;
    renderSheet();
    if (restoreFocus) focusLater({ descriptor: invoker });
  }

  function renderContext() {
    if (!context) return;
    if (!model.signedIn) {
      context.innerHTML = "";
      return;
    }
    if (model.route === "learning" && ["result", "correction"].includes(model.phase) && model.resolvedOutcome) {
      context.innerHTML = `<section class="panel"><p class="eyebrow">本张要点</p><h3>${model.learningLocation.card}</h3><p>${model.resolvedOutcome.explanation}</p></section>`;
      return;
    }
    if (model.route === "space" && model.spaceDepth !== "libraries") {
      context.innerHTML = `<section class="panel"><p class="eyebrow">当前位置</p><h3>${model.chosenLibrary}</h3><p>${model.chosenGroup} · ${model.chosenBox}</p></section>`;
      return;
    }
    context.innerHTML = "";
  }

  function render({ focusHeading = false, focusSelector = "", focusDescriptor = null, preserveFocus = true } = {}) {
    const previousFocus = preserveFocus ? describeFocus() : null;
    setHeader();
    if (!model.signedIn) {
      view.innerHTML = authView();
    } else {
      const routes = {
        learning: learningView,
        space: spaceView,
        statistics: statisticsView,
        mine: mineView,
      };
      view.innerHTML = routes[model.route]();
    }
    renderContext();
    if (!model.sheet) renderSheet();
    bindSwipe();
    focusLater({
      selector: focusSelector,
      descriptor: focusDescriptor ?? previousFocus,
      heading: focusHeading,
    });
  }

  function resetLearning() {
    model.phase = "ready";
    model.selected = "";
    model.lockWords = [];
    model.strikes = [];
    model.pendingOutcome = null;
    model.resolvedOutcome = null;
    model.lockExplanationOpen = false;
    model.inlineError = "";
    model.hintOpen = false;
    model.peekOpen = false;
  }

  function learningSnapshot() {
    return {
      familyIndex: model.familyIndex,
      sessionState: model.sessionState,
      phase: model.phase,
      selected: model.selected,
      lockWords: [...model.lockWords],
      strikes: [...model.strikes],
      pendingOutcome: model.pendingOutcome ? { ...model.pendingOutcome } : null,
      resolvedOutcome: model.resolvedOutcome ? { ...model.resolvedOutcome } : null,
      lockExplanationOpen: model.lockExplanationOpen,
      hintOpen: model.hintOpen,
      peekOpen: model.peekOpen,
      location: { ...model.learningLocation },
    };
  }

  function restoreLearningSnapshot(snapshot) {
    if (!snapshot) return;
    model.familyIndex = snapshot.familyIndex;
    model.sessionState = snapshot.sessionState;
    model.phase = snapshot.phase;
    model.selected = snapshot.selected;
    model.lockWords = [...snapshot.lockWords];
    model.strikes = [...snapshot.strikes];
    model.pendingOutcome = snapshot.pendingOutcome ? { ...snapshot.pendingOutcome } : null;
    model.resolvedOutcome = snapshot.resolvedOutcome ? { ...snapshot.resolvedOutcome } : null;
    model.lockExplanationOpen = Boolean(snapshot.lockExplanationOpen);
    model.hintOpen = snapshot.hintOpen;
    model.peekOpen = snapshot.peekOpen;
    model.learningLocation = { ...snapshot.location };
  }

  function navigationSnapshot(route = model.route) {
    const isCurrentRoute = route === model.route;
    const activeFocus = isCurrentRoute ? describeFocus() : null;
    const focus = activeFocus?.kind === "attribute" && activeFocus.attribute === "data-route" && activeFocus.value !== model.route
      ? { kind: "id", value: `${model.route}-title` }
      : activeFocus ?? { kind: "id", value: `${route}-title` };
    return {
      route,
      spaceDepth: model.spaceDepth,
      chosenLibrary: model.chosenLibrary,
      chosenGroup: model.chosenGroup,
      chosenBox: model.chosenBox,
      chosenCard: model.chosenCard,
      focus,
      scrollX: isCurrentRoute ? window.scrollX : 0,
      scrollY: isCurrentRoute ? window.scrollY : 0,
    };
  }

  function navigationStacksFor(route = model.route) {
    if (usesTopLevelHistory) return { backStack: navigationStack, forwardStack: navigationForwardStack };
    return {
      backStack: routeNavigationStacks[route],
      forwardStack: routeNavigationForwardStacks[route],
    };
  }

  function pushNavigationSnapshot(snapshot = navigationSnapshot(), route = model.route) {
    const { backStack, forwardStack } = navigationStacksFor(route);
    backStack.push(snapshot);
    if (backStack.length > navigationLimit) backStack.shift();
    forwardStack.length = 0;
    if (!usesTopLevelHistory) return;
    historyPosition += 1;
    try {
      window.history.pushState({ position: historyPosition }, "", window.location.href);
    } catch {
      // The bounded in-memory stack remains available when history is unavailable.
    }
  }

  function applyNavigationSnapshot(snapshot) {
    model.route = snapshot.route;
    model.spaceDepth = snapshot.spaceDepth;
    model.chosenLibrary = snapshot.chosenLibrary;
    model.chosenGroup = snapshot.chosenGroup;
    model.chosenBox = snapshot.chosenBox;
    model.chosenCard = snapshot.chosenCard;
  }

  function renderNavigationSnapshot(snapshot) {
    render({ focusDescriptor: snapshot.focus, focusHeading: true, preserveFocus: false });
    later(() => {
      window.scrollTo({ left: snapshot.scrollX ?? 0, top: snapshot.scrollY ?? 0, behavior: "auto" });
    }, 0);
  }

  function navigate(next, { record = true, focusHeading = true } = {}) {
    if (model.sheet) {
      announce("请先完成或关闭当前窗口。 ");
      return false;
    }
    if (model.spaceBusy || model.favoriteBusy) {
      announce("请稍候，卡片状态保存后再离开。 ");
      return false;
    }
    if (record) pushNavigationSnapshot();
    Object.assign(model, next);
    render({ focusHeading, preserveFocus: false });
    return true;
  }

  function restorePreviousNavigation() {
    const { backStack, forwardStack } = navigationStacksFor();
    const snapshot = backStack.pop();
    if (!snapshot) return false;
    forwardStack.push(navigationSnapshot());
    if (forwardStack.length > navigationLimit) forwardStack.shift();
    applyNavigationSnapshot(snapshot);
    if (model.route === "learning" && model.currentCardExcluded) {
      model.learningOrigin = null;
      requestLearningSession("replacement");
      return true;
    }
    if (model.route === "learning" && model.learningOrigin) {
      restoreLearningSnapshot(model.learningOrigin);
      model.learningOrigin = null;
    }
    renderNavigationSnapshot(snapshot);
    return true;
  }

  function restoreNextNavigation() {
    const { backStack, forwardStack } = navigationStacksFor();
    const snapshot = forwardStack.pop();
    if (!snapshot) return false;
    backStack.push(navigationSnapshot());
    if (backStack.length > navigationLimit) backStack.shift();
    applyNavigationSnapshot(snapshot);
    if (model.route === "learning" && model.currentCardExcluded) {
      model.learningOrigin = null;
      requestLearningSession("replacement");
      return true;
    }
    renderNavigationSnapshot(snapshot);
    return true;
  }

  function requestNavigationBack() {
    if (model.sheet) {
      closeSheet();
      return;
    }
    if (model.spaceBusy || model.favoriteBusy) {
      announce("请稍候，卡片状态保存后再返回。 ");
      return;
    }
    if (!model.signedIn && model.authStep === "code") {
      editPhone();
      return;
    }
    if (!navigationStacksFor().backStack.length) return;
    if (!usesTopLevelHistory) {
      restorePreviousNavigation();
      return;
    }
    try {
      window.history.back();
    } catch {
      restorePreviousNavigation();
    }
  }

  function goRoute(route) {
    if (route === model.route) return;
    if (model.sheet) {
      announce("请先完成或关闭当前窗口。 ");
      return;
    }
    const recordTopLevel = usesTopLevelHistory;
    if (route === "learning" && model.currentCardExcluded) {
      if (navigate({ route: "learning" }, { record: recordTopLevel })) requestLearningSession("replacement");
      return;
    }
    if (route === "learning" && model.learningOrigin) {
      restoreLearningSnapshot(model.learningOrigin);
      model.learningOrigin = null;
    }
    navigate({ route }, { record: recordTopLevel });
  }

  function startResendCountdown(seconds = 5) {
    window.clearTimeout(resendTimer);
    model.resendRemaining = seconds;
    const tick = () => {
      if (model.signedIn || model.authStep !== "code") return;
      model.resendRemaining = Math.max(0, model.resendRemaining - 1);
      render();
      if (model.resendRemaining > 0) resendTimer = later(tick, 1000);
    };
    resendTimer = later(tick, 1000);
  }

  function editPhone() {
    window.clearTimeout(resendTimer);
    model.authStep = "phone";
    model.authBusy = "";
    model.authError = "";
    model.code = "";
    model.resendRemaining = 0;
    render({ focusSelector: "#phone", preserveFocus: false });
  }

  function requestLearningSession(kind) {
    window.clearTimeout(sessionTimer);
    const initial = kind === "initial";
    if (!initial) model.learningOrigin = null;
    model.sessionState = initial ? "initial-pending" : kind === "replacement" ? "replacement-pending" : "next-pending";
    model.pendingFamilyIndex = initial ? model.familyIndex : (model.familyIndex + 1) % families.length;
    render({ focusSelector: "[data-session-focus]", preserveFocus: false });
    announce(initial ? "正在准备当前学习。 " : "正在准备下一张。 ");
    const expectedState = model.sessionState;
    sessionTimer = later(() => {
      if (!model.signedIn || model.sessionState !== expectedState) return;
      model.familyIndex = model.pendingFamilyIndex;
      resetLearning();
      updateLearningCardLabel();
      model.currentCardExcluded = false;
      model.sessionState = "ready";
      if (initial && model.access === "not-started") model.access = "trial";
      const learningIsVisible = model.route === "learning";
      render({ focusHeading: learningIsVisible, preserveFocus: !learningIsVisible });
      if (learningIsVisible) announce("当前学习已准备好。 ");
    }, 620);
  }

  function arraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function sameSet(left, right) {
    return left.length === right.length && left.every((value) => right.includes(value));
  }

  function beginCompletion(outcome) {
    if (["pending", "result", "correction"].includes(model.phase)) return;
    window.clearTimeout(completionTimer);
    model.pendingOutcome = { ...outcome };
    model.phase = "pending";
    render({ focusSelector: "[data-completion-status]", preserveFocus: false });
    announce("正在核对这次作答。 ");
    completionTimer = later(() => {
      if (model.phase !== "pending" || !model.pendingOutcome) return;
      model.resolvedOutcome = { ...model.pendingOutcome };
      model.pendingOutcome = null;
      model.phase = model.resolvedOutcome.advanceable ? "result" : "correction";
      const learningIsVisible = model.route === "learning";
      render({
        focusSelector: learningIsVisible
          ? model.phase === "result" ? "[data-result-focus]" : "[data-correction-focus]"
          : "",
        preserveFocus: !learningIsVisible,
      });
      if (learningIsVisible) announce(model.phase === "result" ? "这次作答已保存。 " : "请在这一张继续调整。 ");
    }, 520);
  }

  function chooseSwipe(direction) {
    model.selected = direction;
    beginCompletion({
      answer: direction,
      correct: direction === "right",
      advanceable: true,
      explanation: "Although 表示即使存在困难，后面的行动仍然继续。",
    });
  }

  function renderCheckInState() {
    const visible = model.route === "statistics";
    render({
      focusSelector: visible ? "[data-check-in-status]" : "",
      preserveFocus: !visible,
    });
  }

  function finishCheckIn(nextState, message, delay = 480) {
    window.clearTimeout(checkInTimer);
    checkInTimer = later(() => {
      model.checkInState = nextState;
      if (["acknowledged", "reconciled"].includes(nextState)) model.checkInConfirmed = true;
      renderCheckInState();
      if (model.route === "statistics") announce(message);
    }, delay);
  }

  function beginCheckIn() {
    if (model.checkInState !== "idle") return;
    if (!navigator.onLine) {
      model.checkInState = "queued";
      renderCheckInState();
      announce("暂时无法连接，已保留这次签到。 ");
      return;
    }
    model.checkInState = "pending";
    renderCheckInState();
    announce("正在确认今天的签到。 ");
    window.clearTimeout(checkInTimer);
    checkInTimer = later(() => {
      model.checkInConfirmed = true;
      model.checkInState = "refresh-pending";
      renderCheckInState();
      if (model.route === "statistics") announce("今天的签到已确认，正在更新状态。 ");
      finishCheckIn("reconciled", "签到状态已更新：今天已经确认。 ");
    }, 480);
  }

  function retryCheckIn() {
    if (model.checkInState !== "queued") return;
    if (!navigator.onLine) {
      renderCheckInState();
      announce("仍然无法连接，签到继续保留。 ");
      return;
    }
    model.checkInState = "retry-pending";
    renderCheckInState();
    announce("正在重新提交已保留的签到。 ");
    window.clearTimeout(checkInTimer);
    checkInTimer = later(() => {
      model.checkInConfirmed = true;
      model.checkInState = "refresh-pending";
      renderCheckInState();
      if (model.route === "statistics") announce("正在更新签到状态。 ");
      finishCheckIn("reconciled", "签到状态已更新：今天已经确认。 ");
    }, 480);
  }

  function refreshCheckIn() {
    if (!model.checkInConfirmed || !["acknowledged", "reconciled"].includes(model.checkInState)) return;
    model.checkInState = "refresh-pending";
    renderCheckInState();
    announce("正在更新签到状态。 ");
    finishCheckIn("reconciled", "签到状态已更新：今天已经确认。 ");
  }

  function bindSwipe() {
    const object = view.querySelector("[data-swipe-object]");
    if (!object) return;
    let start = 0;
    let delta = 0;
    let active = false;
    const reset = () => {
      object.style.setProperty("--drag-x", "0px");
      object.dataset.dragging = "false";
      active = false;
    };
    object.addEventListener("pointerdown", (event) => {
      active = true;
      start = event.clientX;
      delta = 0;
      object.dataset.dragging = "true";
      object.setPointerCapture(event.pointerId);
    });
    object.addEventListener("pointermove", (event) => {
      if (!active) return;
      delta = Math.max(-130, Math.min(130, event.clientX - start));
      object.style.setProperty("--drag-x", `${delta}px`);
    });
    object.addEventListener("pointerup", () => {
      if (!active) return;
      if (Math.abs(delta) >= 72) {
        chooseSwipe(delta > 0 ? "right" : "left");
      } else {
        reset();
        const note = view.querySelector("[data-swipe-note]");
        if (note) note.hidden = false;
        announce("尚未作答。 ");
      }
    });
    object.addEventListener("pointercancel", reset);
    object.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") chooseSwipe("left");
      if (event.key === "ArrowRight") chooseSwipe("right");
    });
  }

  function beginFavorite(label) {
    if (model.favoriteBusy || model.spaceBusy) return;
    const originRoute = model.route;
    const nextLiked = !model.favoriteLabels.has(label);
    model.favoriteBusy = true;
    model.favoriteTarget = label;
    render({ focusSelector: "[data-action=like]", preserveFocus: false });
    announce("正在保存喜欢标记。 ");
    later(() => {
      if (nextLiked) model.favoriteLabels.add(label);
      else model.favoriteLabels.delete(label);
      model.favoriteBusy = false;
      model.favoriteTarget = "";
      const originIsVisible = model.route === originRoute;
      render({
        focusSelector: originIsVisible ? "[data-action=like]" : "",
        preserveFocus: !originIsVisible,
      });
      if (originIsVisible) announce(nextLiked ? "已标记为喜欢。 " : "已取消喜欢。 ");
    }, 480);
  }

  function beginSleep() {
    if (model.spaceBusy || model.favoriteBusy) return;
    const originRoute = model.route;
    const label = model.chosenCard;
    const nextSleeping = !model.sleepingLabels.has(label);
    const affectsCurrent = isCurrentLearningSelection();
    model.spaceBusy = true;
    model.spaceTarget = label;
    render({ focusSelector: "[data-action=toggle-sleep]", preserveFocus: false });
    announce(nextSleeping ? "正在让卡片休眠。 " : "正在唤醒卡片。 ");
    later(() => {
      if (nextSleeping) model.sleepingLabels.add(label);
      else model.sleepingLabels.delete(label);
      if (nextSleeping && affectsCurrent) model.currentCardExcluded = true;
      model.spaceBusy = false;
      model.spaceTarget = "";
      const originIsVisible = model.route === originRoute;
      render({
        focusSelector: originIsVisible ? "[data-action=toggle-sleep]" : "",
        preserveFocus: !originIsVisible,
      });
      if (originIsVisible) announce(nextSleeping ? "卡片已休眠。 " : "卡片已唤醒。 ");
    }, 520);
  }

  function returnToLearning() {
    if (model.learningOrigin && !model.currentCardExcluded) restoreLearningSnapshot(model.learningOrigin);
    const needsReplacement = model.currentCardExcluded;
    model.learningOrigin = null;
    if (!navigate({ route: "learning" }, { record: usesTopLevelHistory })) return;
    if (needsReplacement) requestLearningSession("replacement");
  }

  function sheetFocusableElements() {
    return [...sheetRoot.querySelectorAll("button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.hasAttribute("hidden"));
  }

  function beginPurchase() {
    if (model.purchaseBusy || model.restoreBusy) return;
    model.purchaseBusy = true;
    model.purchaseResult = "";
    model.restoreResult = "";
    renderSheet({ focusStatus: true });
    later(() => {
      if (!model.purchaseBusy) return;
      model.purchaseBusy = false;
      model.purchaseResult = "暂时无法完成购买，请稍后再试。";
      renderSheet({ focusStatus: true });
      announce(model.purchaseResult);
    }, 620);
  }

  function beginRestore() {
    if (model.purchaseBusy || model.restoreBusy) return;
    model.restoreBusy = true;
    model.purchaseResult = "";
    model.restoreResult = "";
    renderSheet({ focusStatus: true });
    later(() => {
      if (!model.restoreBusy) return;
      model.restoreBusy = false;
      model.restoreResult = "暂时无法查找可恢复的购买，请稍后再试。";
      renderSheet({ focusStatus: true });
      announce(model.restoreResult);
    }, 620);
  }

  function beginAccountExit(kind) {
    if (model.accountBusy) return;
    model.accountBusy = true;
    renderSheet({ focusStatus: true });
    later(() => {
      if (!model.accountBusy || model.sheet !== kind) return;
      model.accountBusy = false;
      model.sheet = "";
      model.sheetInvoker = null;
      model.signedIn = false;
      model.authStep = "phone";
      model.authBusy = "";
      model.authError = "";
      model.code = "";
      model.sessionState = "idle";
      model.access = "not-started";
      navigationStack.length = 0;
      navigationForwardStack.length = 0;
      Object.values(routeNavigationStacks).forEach((stack) => { stack.length = 0; });
      Object.values(routeNavigationForwardStacks).forEach((stack) => { stack.length = 0; });
      historyPosition = 0;
      try {
        window.history.replaceState({ position: 0 }, "", window.location.href);
      } catch {
        // Signed-out rendering remains correct without a history marker.
      }
      if (kind === "delete") model.phone = "";
      window.clearTimeout(checkInTimer);
      model.checkInState = "idle";
      model.checkInConfirmed = false;
      renderSheet();
      render({ focusSelector: "#phone", preserveFocus: false });
    }, 520);
  }

  view.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.matches("[data-auth-phone]")) {
      if (model.authBusy) return;
      const value = new FormData(event.target).get("phone").toString().replace(/\D/g, "");
      model.phone = value;
      if (value.length !== 11) {
        model.authError = "请检查手机号是否为 11 位。";
        render({ focusSelector: "#phone", preserveFocus: false });
        announce(model.authError);
        return;
      }
      model.authError = "";
      model.authBusy = "send";
      render({ focusSelector: "[data-auth-pending]", preserveFocus: false });
      later(() => {
        if (model.authBusy !== "send") return;
        model.authBusy = "";
        model.authStep = "code";
        model.code = "";
        startResendCountdown();
        render({ focusSelector: "#code", preserveFocus: false });
        announce("验证码已发送。 ");
      });
      return;
    }
    if (event.target.matches("[data-auth-code]")) {
      if (model.authBusy) return;
      const value = new FormData(event.target).get("code").toString().replace(/\D/g, "");
      model.code = value;
      if (value.length !== 6) {
        model.authError = "请输入完整的 6 位验证码。";
        render({ focusSelector: "#code", preserveFocus: false });
        announce(model.authError);
        return;
      }
      model.authError = "";
      model.authBusy = "verify";
      render({ focusSelector: "[data-auth-pending]", preserveFocus: false });
      later(() => {
        if (model.authBusy !== "verify") return;
        window.clearTimeout(resendTimer);
        model.authBusy = "";
        model.signedIn = true;
        model.route = "learning";
        model.resendRemaining = 0;
        model.access = "not-started";
        announce("已登录。 ");
        requestLearningSession("initial");
      });
    }
  });

  document.addEventListener("click", (event) => {
    const route = event.target.closest("[data-route]")?.dataset.route;
    if (route) {
      goRoute(route);
      return;
    }
    if (event.target.closest("[data-back]")) {
      requestNavigationBack();
      return;
    }
    const actionControl = event.target.closest("[data-action]");
    const action = actionControl?.dataset.action;
    if (!action) return;

    if (action === "edit-phone") editPhone();
    if (action === "resend") {
      if (model.authBusy || model.resendRemaining > 0) return;
      model.authBusy = "resend";
      render({ focusSelector: "[data-auth-pending]", preserveFocus: false });
      later(() => {
        if (model.authBusy !== "resend") return;
        model.authBusy = "";
        startResendCountdown();
        render({ focusSelector: "#code", preserveFocus: false });
        announce("验证码已重新发送。 ");
      });
    }
    if (action === "reveal") {
      model.phase = "revealed";
      render({ focusSelector: "[data-reveal-focus]", preserveFocus: false });
      announce("解释已展开。 ");
    }
    if (action === "assess") {
      const answer = actionControl.dataset.value;
      model.selected = answer;
      beginCompletion({
        answer,
        correct: null,
        advanceable: true,
        explanation: answer === "confident" ? "保持当前节奏，继续下一张。" : "这张会在合适的时候再次出现。",
      });
    }
    if (action === "submit-choice") {
      if (!model.selected) {
        model.inlineError = "请先选择一个答案。";
        render({ focusSelector: "[data-action=submit-choice]", preserveFocus: false });
        announce(model.inlineError);
      } else {
        const correct = model.selected === "however";
        beginCompletion({
          answer: model.selected,
          correct,
          advanceable: true,
          explanation: "前句说明困难，后句仍继续，however 最能表达这一转折。",
        });
      }
    }
    if (action === "undo-lock") {
      model.lockWords.pop();
      render({ focusSelector: "[data-action=undo-lock]", preserveFocus: false });
    }
    if (action === "submit-lock") {
      if (model.lockWords.length !== lockAnswer.length) {
        model.inlineError = "请先完成全部顺序。";
        render({ focusSelector: "[data-action=submit-lock]", preserveFocus: false });
        announce(model.inlineError);
      } else {
        const correct = arraysEqual(model.lockWords, lockAnswer);
        beginCompletion({
          answer: [...model.lockWords],
          correct,
          advanceable: correct,
          explanation: correct
            ? "让步从句在前，主句随后给出仍然继续的结果。"
            : "刚才的排列已保留，可以在这一张继续调整。",
        });
      }
    }
    if (action === "undo-strike") {
      model.strikes.pop();
      render({ focusSelector: "[data-action=undo-strike]", preserveFocus: false });
    }
    if (action === "submit-elimination") {
      if (!model.strikes.length) {
        model.inlineError = "请先划掉不属于主干的部分。";
        render({ focusSelector: "[data-action=submit-elimination]", preserveFocus: false });
        announce(model.inlineError);
      } else {
        const correct = sameSet(model.strikes, eliminationAnswer);
        beginCompletion({
          answer: [...model.strikes],
          correct,
          advanceable: true,
          explanation: "去掉让步部分后，主干应保留为 the team continued。",
        });
      }
    }
    if (action === "retry-choice") {
      model.phase = "ready";
      model.resolvedOutcome = null;
      model.inlineError = "";
      render({ focusSelector: "[data-choice]", preserveFocus: false });
      announce("可以重新选择。 ");
    }
    if (action === "adjust-lock") {
      model.phase = "ready";
      model.resolvedOutcome = null;
      model.inlineError = "";
      model.lockExplanationOpen = false;
      render({ focusSelector: model.lockWords.length ? "[data-action=undo-lock]" : "[data-lock-word]", preserveFocus: false });
      announce("可以调整刚才的顺序。 ");
    }
    if (action === "show-lock-explanation") {
      model.lockExplanationOpen = !model.lockExplanationOpen;
      render({ focusSelector: "[data-action=show-lock-explanation]", preserveFocus: false });
      announce(model.lockExplanationOpen ? "解释已展开。 " : "解释已收起。 ");
    }
    if (action === "retry-elimination") {
      model.phase = "ready";
      model.resolvedOutcome = null;
      model.inlineError = "";
      render({ focusSelector: "[data-strike]", preserveFocus: false });
      announce("可以重新调整划掉的内容。 ");
    }
    if (action === "retry-swipe") {
      model.phase = "ready";
      model.resolvedOutcome = null;
      model.selected = "";
      render({ focusSelector: "[data-swipe-object]", preserveFocus: false });
      announce("可以重新判断。 ");
    }
    if (action === "next" && model.phase === "result" && model.resolvedOutcome?.advanceable) requestLearningSession("next");
    if (action === "check-in") beginCheckIn();
    if (action === "retry-check-in") retryCheckIn();
    if (action === "refresh-check-in") refreshCheckIn();
    if (action === "hint") {
      model.hintOpen = !model.hintOpen;
      render();
    }
    if (action === "peek") {
      model.peekOpen = !model.peekOpen;
      render();
    }
    if (action === "like") {
      const label = model.route === "space" ? model.chosenCard : model.learningLocation.card;
      beginFavorite(label);
    }
    if (action === "open-space") {
      model.learningOrigin = learningSnapshot();
      const destination = {
        route: "space",
        spaceDepth: "card",
        chosenLibrary: model.learningLocation.library,
        chosenGroup: model.learningLocation.group,
        chosenBox: model.learningLocation.box,
        chosenCard: model.learningLocation.card,
      };
      if (!usesTopLevelHistory) {
        const previousSpace = navigationSnapshot("space");
        const opensDifferentSpacePosition = previousSpace.spaceDepth !== destination.spaceDepth
          || previousSpace.chosenLibrary !== destination.chosenLibrary
          || previousSpace.chosenGroup !== destination.chosenGroup
          || previousSpace.chosenBox !== destination.chosenBox
          || previousSpace.chosenCard !== destination.chosenCard;
        if (opensDifferentSpacePosition) pushNavigationSnapshot(previousSpace, "space");
      }
      navigate(destination, { record: usesTopLevelHistory });
    }
    if (action === "return-learning") returnToLearning();
    if (action === "toggle-sleep") beginSleep();
    if (action === "open-membership") openSheet("membership", actionControl);
    if (action === "close-sheet") closeSheet();
    if (action === "purchase") beginPurchase();
    if (action === "restore") beginRestore();
    if (action === "sign-out") openSheet("sign-out", actionControl);
    if (action === "delete-account") openSheet("delete", actionControl);
    if (action === "confirm-sign-out") beginAccountExit("sign-out");
    if (action === "confirm-delete") beginAccountExit("delete");
  });

  view.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-choice]")?.dataset.choice;
    if (choice) {
      model.selected = choice;
      model.inlineError = "";
      render();
      return;
    }
    const word = event.target.closest("[data-lock-word]")?.dataset.lockWord;
    if (word && !model.lockWords.includes(word)) {
      model.lockWords.push(word);
      model.inlineError = "";
      const nextSelector = model.lockWords.length === lockAnswer.length
        ? "[data-action=submit-lock]"
        : "[data-lock-word]:not([disabled])";
      render({ focusSelector: nextSelector, preserveFocus: false });
      return;
    }
    const strike = event.target.closest("[data-strike]")?.dataset.strike;
    if (strike) {
      if (model.strikes.includes(strike)) model.strikes = model.strikes.filter((item) => item !== strike);
      else model.strikes.push(strike);
      model.inlineError = "";
      render();
      return;
    }
    const direction = event.target.closest("[data-swipe]")?.dataset.swipe;
    if (direction) {
      chooseSwipe(direction);
      return;
    }
    const library = event.target.closest("[data-library]")?.dataset.library;
    if (library) {
      const firstGroup = catalogGroups(library)[0];
      navigate({
        spaceDepth: "groups",
        chosenLibrary: library,
        chosenGroup: firstGroup?.name ?? "",
        chosenBox: firstGroup?.boxes[0] ?? "",
        chosenCard: "",
      });
      return;
    }
    const group = event.target.closest("[data-group]")?.dataset.group;
    if (group) {
      navigate({
        spaceDepth: "boxes",
        chosenGroup: group,
        chosenBox: catalogBoxes(model.chosenLibrary, group)[0] ?? "",
        chosenCard: "",
      });
      return;
    }
    const box = event.target.closest("[data-box]")?.dataset.box;
    if (box) {
      model.chosenBox = box;
      const firstDisplayCard = selectedCardLabels()[0] ?? "";
      navigate({ spaceDepth: "cards", chosenBox: box, chosenCard: firstDisplayCard });
      return;
    }
    const card = event.target.closest("[data-card]")?.dataset.card;
    if (card) {
      navigate({ spaceDepth: "card", chosenCard: card });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!model.sheet) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = sheetFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!focusable.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("popstate", (event) => {
    if (!usesTopLevelHistory) return;
    if (model.sheet) {
      if (isSheetBusy()) {
        try {
          window.history.pushState({ position: historyPosition }, "", window.location.href);
        } catch {
          // Keep the current operation intact when history cannot be restored.
        }
        announce("请稍候，当前操作完成后再返回。 ");
      } else {
        try {
          window.history.pushState({ position: historyPosition }, "", window.location.href);
        } catch {
          // Closing the sheet still preserves its in-app origin.
        }
        closeSheet();
      }
      return;
    }
    if (model.spaceBusy || model.favoriteBusy) {
      try {
        window.history.pushState({ position: historyPosition }, "", window.location.href);
      } catch {
        // The visible card remains in place until its state is saved.
      }
      announce("请稍候，卡片状态保存后再返回。 ");
      return;
    }
    const targetPosition = Number(event.state?.position);
    if (!Number.isFinite(targetPosition)) return;
    if (targetPosition < historyPosition) {
      historyPosition = targetPosition;
      restorePreviousNavigation();
    } else if (targetPosition > historyPosition) {
      historyPosition = targetPosition;
      restoreNextNavigation();
    }
  });

  window.addEventListener("online", () => {
    if (model.signedIn && model.route === "statistics" && model.checkInState === "queued") {
      render({ focusSelector: "[data-check-in-status]", preserveFocus: false });
      announce("连接已恢复，可以重试签到。 ");
    }
  });

  window.addEventListener("offline", () => {
    if (model.signedIn && model.route === "statistics" && model.checkInState === "queued") {
      render({ focusSelector: "[data-check-in-status]", preserveFocus: false });
    }
  });

  try {
    window.history.replaceState({ position: 0 }, "", window.location.href);
  } catch {
    // The in-memory navigation stack is sufficient for the visible Back control.
  }
  render({ focusHeading: true, preserveFocus: false });
})();
