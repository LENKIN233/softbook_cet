(() => {
  "use strict";

  const PLATFORMS = new Set(["ios", "android"]);
  const VIEWS = new Set(["learning", "space", "stats", "mine", "auth"]);
  const INTERACTIONS = ["flip", "multiple_choice", "lock", "elimination", "swipe"];
  const INTERACTION_SET = new Set(INTERACTIONS);
  const SPACE_PANELS = new Set(["library", "group", "box", "card", "sleep"]);
  const AUTH_STEPS = new Set(["phone", "code", "error", "done"]);
  const root = document.querySelector("[data-learner-surface]") || document.body;
  const initialText = new WeakMap();
  const sleepingInteractions = new Set();
  const swipePointers = new WeakMap();
  let activeUtterance = null;
  let activeAudioButton = null;
  let currentView = "learning";
  let currentInteraction = "flip";
  let currentSpacePanel = "library";
  let currentAuthStep = "phone";
  let phoneNumber = "";
  let lastAppliedAddress = "";

  function all(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  function one(selector, scope = document) {
    return scope.querySelector(selector);
  }

  function rememberText(element) {
    if (element && !initialText.has(element)) initialText.set(element, element.textContent);
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
    element.setAttribute("aria-hidden", String(hidden));
    if (hidden) element.setAttribute("inert", "");
    else element.removeAttribute("inert");
  }

  function focusElement(element, scroll = false) {
    if (!element || element.closest("[hidden]")) return;
    if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => {
      try {
        element.focus({ preventScroll: true });
      } catch (_error) {
        element.focus();
      }
      if (scroll && typeof element.scrollIntoView === "function") {
        element.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    });
  }

  function announce(message) {
    const region = one("[data-live]");
    if (!region) return;
    region.textContent = "";
    requestAnimationFrame(() => {
      region.textContent = message;
    });
  }

  function updateVisibleLabel(control, text, selectors) {
    const label = selectors ? one(selectors, control) : null;
    if (label) label.textContent = text;
    control.setAttribute("aria-label", text);
  }

  function parseHash() {
    const values = location.hash.replace(/^#/, "").split("/").filter(Boolean);
    return {
      view: VIEWS.has(values[0]) ? values[0] : null,
      interaction: INTERACTION_SET.has(values[1]) ? values[1] : null,
    };
  }

  function readAddress(preferHash = false) {
    const query = new URLSearchParams(location.search);
    const hash = parseHash();
    const queryPlatform = query.get("platform");
    const queryView = query.get("view");
    const queryInteraction = query.get("interaction");
    document.body.classList.toggle("large-text", query.get("text") === "large");
    const bodyPlatform = document.body.dataset.platform;
    const platform = PLATFORMS.has(queryPlatform)
      ? queryPlatform
      : PLATFORMS.has(bodyPlatform)
        ? bodyPlatform
        : "ios";
    const view = preferHash && hash.view
      ? hash.view
      : VIEWS.has(queryView)
        ? queryView
        : hash.view || "learning";
    const interaction = preferHash && hash.interaction
      ? hash.interaction
      : INTERACTION_SET.has(queryInteraction)
        ? queryInteraction
        : hash.interaction || "flip";
    return { platform, view, interaction };
  }

  function addressFor(view, interaction) {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("platform", document.body.dataset.platform);
    url.searchParams.set("view", view);
    url.searchParams.set("interaction", interaction);
    url.hash = `${view}/${interaction}`;
    return url;
  }

  function writeAddress(mode = "push") {
    const url = addressFor(currentView, currentInteraction);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const now = `${location.pathname}${location.search}${location.hash}`;
    if (mode === "none") {
      lastAppliedAddress = location.href;
      return;
    }
    if (mode === "replace" || next === now) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    lastAppliedAddress = location.href;
  }

  function routeTitle(view) {
    const section = one(`[data-view="${view}"]`);
    return section && (one("[data-route-title]", section) || one("h1, h2", section));
  }

  function applyView(view, focus = true) {
    currentView = VIEWS.has(view) ? view : "learning";
    document.body.dataset.currentView = currentView;
    all("[data-view]").forEach((section) => {
      const active = section.dataset.view === currentView;
      setHidden(section, !active);
      section.classList.toggle("is-active", active);
    });

    const selectedRoute = currentView === "auth" ? "mine" : currentView;
    all("[data-primary-nav] [data-route], [data-app-nav] [data-route]").forEach((control) => {
      const selected = control.dataset.route === selectedRoute;
      control.classList.toggle("is-active", selected);
      control.toggleAttribute("data-selected", selected);
      if (selected) control.setAttribute("aria-current", "page");
      else control.removeAttribute("aria-current");
      if (control.getAttribute("role") === "tab") {
        control.setAttribute("aria-selected", String(selected));
      }
    });

    all("[data-primary-nav], [data-app-nav]").forEach((nav) => setHidden(nav, currentView === "auth"));
    all("[data-app-header], body > [data-learner-surface] > header").forEach((header) => {
      setHidden(header, currentView === "auth");
    });
    if (currentView === "learning") ensureAwakeCurrent();
    if (focus) {
      focusElement(routeTitle(currentView));
      if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function navigate(view, options = {}) {
    const nextView = VIEWS.has(view) ? view : "learning";
    applyView(nextView, options.focus !== false);
    writeAddress(options.history || "push");
  }

  function interactionElement(name = currentInteraction) {
    return one(`[data-interaction="${name}"]`);
  }

  function resultElements(interaction) {
    const result = one("[data-result]", interaction);
    return {
      result,
      title: result && one("[data-result-title]", result),
      copy: result && one("[data-result-copy]", result),
      next: result && one("[data-next]", result),
    };
  }

  function setPressed(control, pressed) {
    control.setAttribute("aria-pressed", String(pressed));
    if (control.getAttribute("role") === "radio") {
      control.setAttribute("aria-checked", String(pressed));
    }
    control.toggleAttribute("data-selected", pressed);
    control.classList.toggle("is-selected", pressed);
  }

  function validationElement(interaction, trigger) {
    let validation = one("[data-interaction-validation]", interaction);
    if (validation) return validation;
    validation = document.createElement("p");
    validation.dataset.interactionValidation = "";
    validation.className = "interaction-validation";
    validation.id = `validation-${interaction.dataset.interaction}`;
    validation.setAttribute("role", "alert");
    validation.setAttribute("tabindex", "-1");
    const region = trigger && (trigger.closest(".task-action, .commit-row, .stable-action, .action-panel, .action-block, .decision-region, .task-controls, .work-sheet") || trigger.parentElement);
    if (region) region.insertBefore(validation, trigger.closest("button") || region.firstChild);
    else interaction.append(validation);
    return validation;
  }

  function showValidation(interaction, trigger, message) {
    if (!interaction) return;
    const validation = validationElement(interaction, trigger);
    validation.textContent = message;
    setHidden(validation, false);
    if (trigger) trigger.setAttribute("aria-describedby", validation.id);
    focusElement(validation, true);
    announce(message);
  }

  function clearValidation(interaction) {
    if (!interaction) return;
    const validation = one("[data-interaction-validation]", interaction);
    if (validation) setHidden(validation, true);
    all("[aria-describedby]", interaction).forEach((control) => {
      if (control.getAttribute("aria-describedby") === validation?.id) control.removeAttribute("aria-describedby");
    });
  }

  function hideSubmissionControls(interaction) {
    all("[data-action^=\"submit-\"]", interaction).forEach((button) => {
      setHidden(button, true);
      let region = button.parentElement;
      while (region && region !== interaction) {
        const visibleChildren = Array.from(region.children).filter((child) => !child.hidden && !child.matches("[data-interaction-validation]"));
        if (visibleChildren.length > 0) break;
        region.dataset.submitHidden = "";
        setHidden(region, true);
        region = region.parentElement;
      }
    });
  }

  function resetInteraction(interaction) {
    if (!interaction) return;
    interaction.dataset.phase = "question";
    interaction.removeAttribute("data-outcome");
    all("[data-choice], [data-lock-option], [data-eliminate], [data-swipe-state], [data-action=\"self-assess\"]", interaction).forEach((control) => {
      setPressed(control, false);
      control.disabled = false;
      control.removeAttribute("data-state");
    });
    all("[data-flip-answer]", interaction).forEach((answer) => setHidden(answer, true));
    all("[data-action=\"flip\"]", interaction).forEach((button) => setHidden(button, false));
    all("[data-flip-assess], [data-self-assess], [data-action=\"self-assess\"]", interaction).forEach((element) => setHidden(element, true));
    all("[data-submit-hidden]", interaction).forEach((region) => {
      region.removeAttribute("data-submit-hidden");
      setHidden(region, false);
    });
    all("[data-action^=\"submit-\"]", interaction).forEach((button) => setHidden(button, false));
    clearValidation(interaction);
    all("[data-swipe-card]", interaction).forEach((card) => {
      card.removeAttribute("data-direction");
      card.removeAttribute("data-dragging");
      card.style.removeProperty("--swipe-offset");
      card.style.removeProperty("--swipe-rotation");
      card.setAttribute("aria-valuenow", "0");
      card.setAttribute("aria-valuetext", "未选择");
    });
    const { result, title, copy, next } = resultElements(interaction);
    setHidden(result, true);
    setHidden(next, true);
    if (title) {
      rememberText(title);
      title.textContent = initialText.get(title);
    }
    if (copy) {
      rememberText(copy);
      copy.textContent = initialText.get(copy);
    }
  }

  function applyInteraction(name, focus = false) {
    currentInteraction = INTERACTION_SET.has(name) ? name : "flip";
    document.body.dataset.currentInteraction = currentInteraction;
    all("[data-interaction]").forEach((interaction) => {
      const active = interaction.dataset.interaction === currentInteraction;
      setHidden(interaction, !active);
      interaction.classList.toggle("is-active", active);
    });
    const position = INTERACTIONS.indexOf(currentInteraction) + 1;
    all("[data-card-position]").forEach((element) => { element.textContent = String(position); });
    all("[data-card-total]").forEach((element) => { element.textContent = String(INTERACTIONS.length); });
    all("[role=\"progressbar\"]").forEach((bar) => {
      bar.setAttribute("aria-valuemin", "1");
      bar.setAttribute("aria-valuemax", String(INTERACTIONS.length));
      bar.setAttribute("aria-valuenow", String(position));
    });
    if (focus && currentView === "learning") {
      const active = interactionElement();
      focusElement(
        one("[data-interaction-title]", active)
          || one(".prompt, [data-prompt], h2, h3", active),
      );
    }
  }

  function nextAwakeInteraction(fromName) {
    const start = INTERACTIONS.indexOf(fromName);
    for (let offset = 1; offset <= INTERACTIONS.length; offset += 1) {
      const nextName = INTERACTIONS[(start + offset) % INTERACTIONS.length];
      if (!sleepingInteractions.has(nextName)) return nextName;
    }
    return fromName;
  }

  function ensureAwakeCurrent() {
    if (!sleepingInteractions.has(currentInteraction)) return;
    applyInteraction(nextAwakeInteraction(currentInteraction), false);
  }

  function goToNextCard() {
    const nextName = nextAwakeInteraction(currentInteraction);
    const nextInteraction = interactionElement(nextName);
    resetInteraction(nextInteraction);
    applyInteraction(nextName, true);
    writeAddress("push");
    announce("已进入下一张。");
    if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "auto" });
  }

  function setResultCopy(interaction, outcome, titleText, copyText, showNext = true) {
    const { result, title, copy, next } = resultElements(interaction);
    if (!result) return;
    result.dataset.outcome = outcome;
    interaction.dataset.outcome = outcome;
    const isFlip = interaction.dataset.interaction === "flip";
    if (title) {
      const alternate = title.dataset[`${outcome}Title`];
      const original = initialText.get(title);
      title.textContent = alternate || (!isFlip && outcome === "correct" && original) || titleText;
      title.setAttribute("tabindex", "-1");
    }
    if (copy) {
      const alternate = copy.dataset[`${outcome}Copy`];
      const original = initialText.get(copy);
      copy.textContent = alternate || (!isFlip && original) || copyText;
    }
    setHidden(result, false);
    setHidden(next, !showNext);
    interaction.dataset.phase = showNext ? "complete" : "answer";
    if (showNext) {
      clearValidation(interaction);
      hideSubmissionControls(interaction);
    }
    focusElement(title, true);
  }

  function revealFlip(button) {
    const interaction = button.closest("[data-interaction=\"flip\"]");
    if (!interaction) return;
    all("[data-flip-answer]", interaction).forEach((answer) => setHidden(answer, false));
    setHidden(button, true);
    all("[data-flip-assess], [data-self-assess], [data-action=\"self-assess\"]", interaction).forEach((element) => setHidden(element, false));
    const { result, next } = resultElements(interaction);
    setHidden(result, true);
    setHidden(next, true);
    interaction.dataset.phase = "assess";
    announce("答案已揭晓，请选择有把握或再回看。");
  }

  function assessFlip(button) {
    const interaction = button.closest("[data-interaction=\"flip\"]");
    if (!interaction || interaction.dataset.phase !== "assess") return;
    const confident = button.dataset.value === "confident" || button.dataset.assessment === "confident";
    all("[data-action=\"self-assess\"]", interaction).forEach((control) => {
      setPressed(control, control === button);
      control.disabled = true;
    });
    setResultCopy(
      interaction,
      confident ? "confident" : "review",
      confident ? "已记为有把握" : "已加入回看",
      "这张已完成，可以继续下一张。",
      true,
    );
    announce(confident ? "已记为有把握，可以继续下一张。" : "已加入回看，可以继续下一张。");
  }

  function chooseOne(button, selector) {
    const interaction = button.closest("[data-interaction]");
    if (!interaction || interaction.dataset.phase === "complete") return;
    clearValidation(interaction);
    all(selector, interaction).forEach((control) => setPressed(control, control === button));
    announce("已选择，可以提交答案。");
  }

  function submitChoice(button) {
    const interaction = button.closest("[data-interaction=\"multiple_choice\"]");
    const selected = interaction && one("[data-choice][data-selected]", interaction);
    if (!selected) {
      showValidation(interaction, button, "请先选择一个答案，再确认。");
      return;
    }
    const correct = selected.dataset.correct === "true";
    all("[data-choice]", interaction).forEach((option) => {
      option.disabled = true;
      if (option.dataset.correct === "true") option.dataset.state = "correct";
      else if (option === selected) option.dataset.state = "incorrect";
    });
    setResultCopy(
      interaction,
      correct ? "correct" : "incorrect",
      correct ? "答对了" : "再看这一点",
      correct ? "答案和题意一致，查看解析后继续。" : "已保留你的选择，对照答案和解析后继续。",
      true,
    );
    announce(correct ? "答对了，可以查看解析并继续。" : "这题需要再看一点，可以对照解析后继续。");
  }

  function chooseLock(button) {
    const interaction = button.closest("[data-interaction=\"lock\"]");
    if (!interaction || interaction.dataset.phase === "complete") return;
    clearValidation(interaction);
    const slot = button.dataset.slot;
    all("[data-lock-option]", interaction).forEach((option) => {
      if (option.dataset.slot === slot) setPressed(option, option === button);
    });
    announce("这一处已选择。");
  }

  function submitLock(button) {
    const interaction = button.closest("[data-interaction=\"lock\"]");
    if (!interaction) return;
    const options = all("[data-lock-option]", interaction);
    const slots = new Set(options.map((option) => option.dataset.slot).filter(Boolean));
    const selected = all("[data-lock-option][data-selected]", interaction);
    const selectedSlots = new Set(selected.map((option) => option.dataset.slot).filter(Boolean));
    if (slots.size === 0 || selectedSlots.size !== slots.size) {
      showValidation(interaction, button, "请完成每一处选择，再确认顺序。");
      return;
    }
    const correct = selected.every((option) => option.dataset.correct === "true");
    options.forEach((option) => {
      option.disabled = true;
      if (option.dataset.correct === "true") option.dataset.state = "correct";
      else if (option.hasAttribute("data-selected")) option.dataset.state = "incorrect";
    });
    setResultCopy(
      interaction,
      correct ? "correct" : "incorrect",
      correct ? "顺序正确" : "顺序需要调整",
      correct ? "每一处都与句意衔接，查看解析后继续。" : "已保留你的选择，对照完整顺序后继续。",
      true,
    );
    announce(correct ? "顺序正确，可以继续。" : "顺序需要调整，请对照解析后继续。");
  }

  function toggleElimination(button) {
    const interaction = button.closest("[data-interaction=\"elimination\"]");
    if (!interaction || interaction.dataset.phase === "complete") return;
    clearValidation(interaction);
    const selected = !button.hasAttribute("data-selected");
    setPressed(button, selected);
    button.dataset.state = selected ? "eliminated" : "available";
    announce(selected ? "已划去这一项，再次轻点可以撤销。" : "已恢复这一项。");
  }

  function submitElimination(button) {
    const interaction = button.closest("[data-interaction=\"elimination\"]");
    if (!interaction) return;
    const options = all("[data-eliminate]", interaction);
    if (!options.some((option) => option.hasAttribute("data-selected"))) {
      showValidation(interaction, button, "请先划去不符合题意的内容，再保留主干。");
      return;
    }
    const correct = options.every((option) => (
      option.hasAttribute("data-selected") === (option.dataset.correct === "true")
    ));
    options.forEach((option) => {
      option.disabled = true;
      if (option.dataset.correct === "true") option.dataset.state = "correct";
      else if (option.hasAttribute("data-selected")) option.dataset.state = "incorrect";
    });
    setResultCopy(
      interaction,
      correct ? "correct" : "incorrect",
      correct ? "判断正确" : "还有一处要留意",
      correct ? "保留内容与句意一致，查看解析后继续。" : "已保留你的操作，对照句意和解析后继续。",
      true,
    );
    announce(correct ? "判断正确，可以继续。" : "还有一处要留意，请对照解析后继续。");
  }

  function selectSwipe(button) {
    const interaction = button.closest("[data-interaction=\"swipe\"]");
    if (!interaction || interaction.dataset.phase === "complete") return;
    clearValidation(interaction);
    all("[data-swipe-state]", interaction).forEach((control) => setPressed(control, control === button));
    const stage = one("[data-swipe-card]", interaction);
    const value = button.dataset.swipeState || button.dataset.value || "";
    const direction = value === "no" || value === "left" || value === "false" ? "left" : "right";
    if (stage) {
      stage.dataset.direction = direction;
      stage.style.setProperty("--swipe-offset", direction === "left" ? "-22px" : "22px");
      stage.style.setProperty("--swipe-rotation", direction === "left" ? "-1.5deg" : "1.5deg");
      stage.setAttribute("aria-valuenow", direction === "left" ? "-1" : "1");
      stage.setAttribute("aria-valuetext", direction === "left" ? "已选：不适合" : "已选：适合");
    }
    announce(direction === "left" ? "已选择向左：不适合，可以提交答案。" : "已选择向右：适合，可以提交答案。");
  }

  function swipeButtonFor(interaction, direction) {
    const controls = all("[data-swipe-state]", interaction);
    return controls.find((control) => {
      const value = control.dataset.swipeState || control.dataset.value || "";
      return direction === "left"
        ? value === "no" || value === "left" || value === "false"
        : value === "yes" || value === "right" || value === "true";
    }) || controls[direction === "left" ? 0 : 1];
  }

  function resetSwipePreview(card) {
    card.removeAttribute("data-dragging");
    const direction = card.dataset.direction;
    card.style.setProperty("--swipe-offset", direction === "left" ? "-22px" : direction === "right" ? "22px" : "0px");
    card.style.setProperty("--swipe-rotation", direction === "left" ? "-1.5deg" : direction === "right" ? "1.5deg" : "0deg");
  }

  function initializeSwipeCards() {
    all("[data-interaction=\"swipe\"] [data-swipe-card]").forEach((card) => {
      card.setAttribute("role", "slider");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "左右判断。向左是不适合，向右是适合");
      card.setAttribute("aria-valuemin", "-1");
      card.setAttribute("aria-valuemax", "1");
      card.setAttribute("aria-valuenow", "0");
      card.setAttribute("aria-valuetext", "未选择");

      card.addEventListener("pointerdown", (event) => {
        const interaction = card.closest("[data-interaction=\"swipe\"]");
        if (!interaction || interaction.dataset.phase === "complete" || (event.pointerType === "mouse" && event.button !== 0)) return;
        swipePointers.set(card, { pointerId: event.pointerId, startX: event.clientX, deltaX: 0 });
        card.dataset.dragging = "true";
        card.setPointerCapture(event.pointerId);
      });

      card.addEventListener("pointermove", (event) => {
        const state = swipePointers.get(card);
        if (!state || state.pointerId !== event.pointerId) return;
        const limit = Math.min(180, card.getBoundingClientRect().width * .45);
        state.deltaX = Math.max(-limit, Math.min(limit, event.clientX - state.startX));
        card.style.setProperty("--swipe-offset", `${state.deltaX}px`);
        card.style.setProperty("--swipe-rotation", `${state.deltaX / 24}deg`);
      });

      const finishPointer = (event, cancelled = false) => {
        const state = swipePointers.get(card);
        if (!state || state.pointerId !== event.pointerId) return;
        swipePointers.delete(card);
        if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
        const interaction = card.closest("[data-interaction=\"swipe\"]");
        const threshold = Math.max(44, Math.min(64, card.getBoundingClientRect().width * .16));
        if (!cancelled && interaction && Math.abs(state.deltaX) >= threshold) {
          const direction = state.deltaX < 0 ? "left" : "right";
          const control = swipeButtonFor(interaction, direction);
          if (control) selectSwipe(control);
        } else {
          resetSwipePreview(card);
          if (!cancelled && Math.abs(state.deltaX) > 8) announce("滑动距离不足，卡片已回到原位。");
        }
        card.removeAttribute("data-dragging");
      };
      card.addEventListener("pointerup", (event) => finishPointer(event, false));
      card.addEventListener("pointercancel", (event) => finishPointer(event, true));

      card.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const interaction = card.closest("[data-interaction=\"swipe\"]");
        const control = interaction && swipeButtonFor(interaction, event.key === "ArrowLeft" ? "left" : "right");
        if (control) selectSwipe(control);
      });
    });
  }

  function submitSwipe(button) {
    const interaction = button.closest("[data-interaction=\"swipe\"]");
    const selected = interaction && one("[data-swipe-state][data-selected]", interaction);
    if (!selected) {
      showValidation(interaction, button, "请先滑动卡片或选择一个方向，再确认判断。");
      return;
    }
    const correct = selected.dataset.correct === "true";
    all("[data-swipe-state]", interaction).forEach((control) => {
      control.disabled = true;
      if (control.dataset.correct === "true") control.dataset.state = "correct";
      else if (control === selected) control.dataset.state = "incorrect";
    });
    setResultCopy(
      interaction,
      correct ? "correct" : "incorrect",
      correct ? "判断正确" : "再看这一点",
      correct ? "方向与语义一致，查看解析后继续。" : "已保留你的判断，对照语义和解析后继续。",
      true,
    );
    announce(correct ? "判断正确，可以继续。" : "这题需要再看一点，请对照解析后继续。");
  }

  function toggleHint(button) {
    const interaction = button.closest("[data-interaction]");
    let panel = null;
    const controlledId = button.getAttribute("aria-controls");
    if (controlledId) panel = document.getElementById(controlledId);
    if (!panel && interaction) panel = one("[data-hint-panel], .hint-panel", interaction);
    if (!panel) return;
    if (!panel.id) panel.id = `hint-${INTERACTIONS.indexOf(interaction.dataset.interaction) + 1}`;
    button.setAttribute("aria-controls", panel.id);
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    setHidden(panel, expanded);
    const openLabel = button.dataset.openLabel || "查看提示";
    const closeLabel = button.dataset.closeLabel || "收起提示";
    updateVisibleLabel(button, expanded ? openLabel : closeLabel, "[data-action-label]");
    announce(expanded ? "提示已收起。" : "提示已展开。");
  }

  function audioStatus(button, message, state) {
    let status = button.parentElement && one("[data-audio-status]", button.parentElement);
    if (!status && button.parentElement) {
      status = document.createElement("span");
      status.dataset.audioStatus = "";
      status.className = "audio-status";
      status.setAttribute("role", "status");
      button.insertAdjacentElement("afterend", status);
    }
    if (status) {
      status.textContent = message;
      status.dataset.state = state;
    }
  }

  function setAudioControl(button, state, message) {
    const playing = state === "playing";
    button.setAttribute("aria-pressed", String(playing));
    button.dataset.state = state;
    const label = state === "playing" ? "暂停原句" : state === "paused" ? "继续播放" : "播放原句";
    const visibleLabel = one("[data-action-label], [data-audio-label]", button);
    if (visibleLabel) updateVisibleLabel(button, label, "[data-action-label], [data-audio-label]");
    else {
      button.textContent = state === "playing" ? "Ⅱ 暂停原句" : state === "paused" ? "▶ 继续播放" : "▶ 播放原句";
      button.setAttribute("aria-label", label);
    }
    audioStatus(button, message, state);
  }

  function toggleAudio(button) {
    const speech = window.speechSynthesis;
    if (!speech || typeof window.SpeechSynthesisUtterance !== "function") {
      setAudioControl(button, "error", "当前设备无法播放，请稍后重试");
      announce("当前设备无法播放原句，请稍后重试。");
      return;
    }
    if (activeAudioButton && activeAudioButton !== button) {
      speech.cancel();
      setAudioControl(activeAudioButton, "idle", "播放已停止");
      activeAudioButton = null;
      activeUtterance = null;
    }
    if (button.dataset.state === "playing") {
      speech.pause();
      setAudioControl(button, "paused", "已暂停");
      announce("已暂停播放。");
      return;
    }
    if (button.dataset.state === "paused" && speech.paused) {
      speech.resume();
      setAudioControl(button, "playing", "正在播放");
      announce("继续播放原句。");
      return;
    }

    speech.cancel();
    const interaction = button.closest("[data-interaction]");
    const visibleSource = interaction && one("[data-audio-copy], .source, .passage, .sentence, .task-copy", interaction);
    const spokenText = button.dataset.audioText || visibleSource?.textContent.trim();
    if (!spokenText) {
      setAudioControl(button, "error", "没有可播放的原句");
      announce("没有找到可播放的原句。");
      return;
    }
    const utterance = new window.SpeechSynthesisUtterance(spokenText);
    utterance.lang = "en-US";
    utterance.rate = .86;
    utterance.onstart = () => {
      if (activeUtterance !== utterance) return;
      setAudioControl(button, "playing", "正在播放");
    };
    utterance.onend = () => {
      if (activeUtterance !== utterance) return;
      setAudioControl(button, "idle", "播放完成");
      activeUtterance = null;
      activeAudioButton = null;
      announce("原句播放完成。");
    };
    utterance.onerror = () => {
      if (activeUtterance !== utterance) return;
      setAudioControl(button, "error", "播放失败，请重试");
      activeUtterance = null;
      activeAudioButton = null;
      announce("原句播放失败，请重试。");
    };
    activeUtterance = utterance;
    activeAudioButton = button;
    setAudioControl(button, "loading", "正在准备播放…");
    speech.speak(utterance);
  }

  function showSpacePanel(name, focus = true) {
    currentSpacePanel = SPACE_PANELS.has(name) ? name : "library";
    document.body.dataset.currentSpacePanel = currentSpacePanel;
    all("[data-space-panel]").forEach((panel) => {
      const active = panel.dataset.spacePanel === currentSpacePanel;
      setHidden(panel, !active);
      panel.classList.toggle("is-active", active);
    });
    if (focus) {
      const panel = one(`[data-space-panel="${currentSpacePanel}"]`);
      focusElement(panel && (one("[data-space-title]", panel) || one("h2, h3", panel)));
    }
  }

  function toggleFavorite(button) {
    const active = button.getAttribute("aria-pressed") === "true";
    const nextActive = !active;
    button.setAttribute("aria-pressed", String(nextActive));
    button.dataset.state = nextActive ? "saved" : "available";
    const label = nextActive ? "取消收藏" : "收藏";
    updateVisibleLabel(button, label, "[data-favorite-label], [data-action-label]");
    all("[data-favorite-status]").forEach((status) => {
      status.textContent = nextActive ? "已收藏" : "未收藏";
    });
    all("[data-favorite-tag]").forEach((tag) => setHidden(tag, !nextActive));
    announce(nextActive ? "已收藏这张卡片。" : "已取消收藏。");
  }

  function sleepCurrentCard() {
    sleepingInteractions.add(currentInteraction);
    document.body.dataset.cardSleeping = "true";
    all("[data-sleep]").forEach((button) => { button.disabled = true; });
    all("[data-wake]").forEach((button) => {
      button.disabled = false;
      setHidden(button, false);
    });
    all("[data-sleep-status], [data-card-status]").forEach((status) => { status.textContent = "正在稍后再学区"; });
    showSpacePanel("sleep", true);
    announce("这张卡片已移到稍后再学，返回学习后会继续下一张。");
  }

  function wakeCurrentCard() {
    sleepingInteractions.delete(currentInteraction);
    document.body.dataset.cardSleeping = "false";
    all("[data-sleep]").forEach((button) => { button.disabled = false; });
    all("[data-wake]").forEach((button) => {
      button.disabled = true;
      setHidden(button, true);
    });
    all("[data-sleep-status], [data-card-status]").forEach((status) => { status.textContent = "正在学习"; });
    showSpacePanel("card", true);
    announce("这张卡片已回到学习流程。");
  }

  function authStepElement(name = currentAuthStep) {
    return one(`[data-auth-step="${name}"]`);
  }

  function setAuthMessage(message, invalidInput = null) {
    const step = authStepElement();
    let region = step && one("[data-auth-message]", step);
    if (!region && step) {
      region = document.createElement("p");
      region.dataset.authMessage = "";
      region.className = "auth-message";
      region.setAttribute("role", "status");
      step.append(region);
    }
    if (region) region.textContent = message;
    if (invalidInput) {
      invalidInput.setAttribute("aria-invalid", "true");
      if (region && !region.id) region.id = `auth-message-${currentAuthStep}`;
      if (region) invalidInput.setAttribute("aria-describedby", region.id);
    }
    announce(message);
  }

  function showAuthStep(name, focus = true) {
    currentAuthStep = AUTH_STEPS.has(name) ? name : "phone";
    document.body.dataset.currentAuthStep = currentAuthStep;
    all("[data-auth-step]").forEach((step) => {
      const active = step.dataset.authStep === currentAuthStep;
      setHidden(step, !active);
      step.classList.toggle("is-active", active);
    });
    all("[data-auth-phone-display]").forEach((element) => { element.textContent = phoneNumber; });
    if (focus) {
      const step = authStepElement();
      const target = step && (one("[data-auth-title]", step) || one("h2, h3", step) || one("input", step));
      focusElement(target);
    }
  }

  function submitPhone() {
    const input = one("[data-auth-phone]");
    const value = input ? input.value.replace(/\s+/g, "") : "";
    if (!/^1[3-9]\d{9}$/.test(value)) {
      setAuthMessage("请输入正确的 11 位手机号。", input);
      return;
    }
    phoneNumber = value;
    input.removeAttribute("aria-invalid");
    showAuthStep("code", true);
    announce("验证码已发送，请查看短信。");
  }

  function submitCode() {
    const step = authStepElement("code");
    const input = (step && one("[data-auth-code]", step)) || one("[data-auth-code]");
    const value = input ? input.value.replace(/\s+/g, "") : "";
    if (!/^\d{6}$/.test(value)) {
      setAuthMessage("请输入 6 位验证码。", input);
      return;
    }
    if (value === "000000") {
      showAuthStep("error", true);
      setAuthMessage("验证码已失效，请重新发送后再试。", null);
      return;
    }
    if (input) input.removeAttribute("aria-invalid");
    showAuthStep("done", true);
    announce("登录成功，学习位置已保留。");
  }

  function resendCode() {
    showAuthStep("code", true);
    const input = one("[data-auth-step=\"code\"] [data-auth-code]");
    if (input) {
      input.value = "";
      input.removeAttribute("aria-invalid");
    }
    setAuthMessage("验证码已重新发送，请查看短信。", null);
  }

  function editPhone() {
    showAuthStep("phone", true);
    const input = one("[data-auth-step=\"phone\"] [data-auth-phone]") || one("[data-auth-phone]");
    if (input) {
      input.value = phoneNumber;
      focusElement(input);
    }
  }

  function ensureAuthReturn() {
    const view = one("[data-view=\"auth\"]");
    if (!view || one("[data-auth-back]", view)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.authBack = "";
    button.className = "auth-safe-back";
    button.textContent = "返回我的";
    view.prepend(button);
  }

  function initializeHints() {
    all("[data-action=\"hint\"]").forEach((button, index) => {
      let panel = null;
      const controlledId = button.getAttribute("aria-controls");
      if (controlledId) panel = document.getElementById(controlledId);
      if (!panel) {
        const interaction = button.closest("[data-interaction]");
        panel = interaction && one("[data-hint-panel], .hint-panel", interaction);
      }
      if (!panel) return;
      if (!panel.id) panel.id = `hint-${index + 1}`;
      button.setAttribute("aria-controls", panel.id);
      button.setAttribute("aria-expanded", "false");
      setHidden(panel, true);
    });
  }

  function initializeControls() {
    all("[data-action=\"audio\"]").forEach((button) => {
      button.setAttribute("aria-pressed", "false");
      button.dataset.state = "paused";
    });
    all("[data-favorite]").forEach((button) => button.setAttribute("aria-pressed", "false"));
    all("[data-wake]").forEach((button) => {
      button.disabled = true;
      setHidden(button, true);
    });
    all("[data-favorite-tag]").forEach((tag) => setHidden(tag, true));
    all("[data-route-title], [data-interaction-title], [data-space-title], [data-auth-title]").forEach((title) => {
      title.setAttribute("tabindex", "-1");
    });
    all("[data-interaction]").forEach(resetInteraction);
    initializeHints();
    initializeSwipeCards();
    ensureAuthReturn();
  }

  function syncFromAddress(preferHash = false) {
    if (location.href === lastAppliedAddress) return;
    const next = readAddress(preferHash);
    document.body.dataset.platform = next.platform;
    currentInteraction = next.interaction;
    applyInteraction(next.interaction, false);
    applyView(next.view, true);
    writeAddress("replace");
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const authBack = target.closest("[data-auth-back]");
    if (authBack) {
      event.preventDefault();
      navigate("mine");
      return;
    }
    if (target.closest("[data-auth-phone-submit]")) {
      event.preventDefault();
      submitPhone();
      return;
    }
    const codeSubmit = target.closest("[data-auth-code-submit]");
    if (codeSubmit) {
      event.preventDefault();
      if (codeSubmit.closest("[data-auth-step=\"error\"]")) resendCode();
      else submitCode();
      return;
    }
    if (target.closest("[data-auth-resend], [data-auth-retry]")) {
      event.preventDefault();
      resendCode();
      return;
    }
    if (target.closest("[data-auth-edit]")) {
      event.preventDefault();
      editPhone();
      return;
    }

    const returnLearning = target.closest("[data-return-learning]");
    if (returnLearning) {
      event.preventDefault();
      ensureAwakeCurrent();
      navigate("learning");
      return;
    }
    const favorite = target.closest("[data-favorite]");
    if (favorite) {
      event.preventDefault();
      toggleFavorite(favorite);
      return;
    }
    if (target.closest("[data-sleep]")) {
      event.preventDefault();
      sleepCurrentCard();
      return;
    }
    if (target.closest("[data-wake]")) {
      event.preventDefault();
      wakeCurrentCard();
      return;
    }
    const spaceGo = target.closest("[data-space-go]");
    if (spaceGo) {
      event.preventDefault();
      if (currentView !== "space") navigate("space", { focus: false });
      showSpacePanel(spaceGo.dataset.spaceGo, true);
      return;
    }

    const route = target.closest("[data-route], [data-auth-open]");
    if (route) {
      event.preventDefault();
      navigate(route.dataset.route || "auth");
      return;
    }

    const action = target.closest("[data-action]");
    if (!action) return;
    switch (action.dataset.action) {
      case "flip": revealFlip(action); break;
      case "self-assess": assessFlip(action); break;
      case "submit-choice": submitChoice(action); break;
      case "submit-lock": submitLock(action); break;
      case "submit-elimination": submitElimination(action); break;
      case "select-swipe": selectSwipe(action); break;
      case "submit-swipe": submitSwipe(action); break;
      case "next": goToNextCard(); break;
      case "hint": toggleHint(action); break;
      case "audio": toggleAudio(action); break;
      default: break;
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const choice = target.closest("[data-choice]");
    if (choice) chooseOne(choice, "[data-choice]");
    const lock = target.closest("[data-lock-option]");
    if (lock) chooseLock(lock);
    const eliminate = target.closest("[data-eliminate]");
    if (eliminate) toggleElimination(eliminate);
    const swipe = target.closest("[data-swipe-state]");
    if (swipe && swipe.dataset.action !== "select-swipe") selectSwipe(swipe);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (event.target instanceof Element && event.target.matches("[data-auth-phone]")) {
      event.preventDefault();
      submitPhone();
    } else if (event.target instanceof Element && event.target.matches("[data-auth-code]")) {
      event.preventDefault();
      submitCode();
    }
  });

  function initialize() {
    const initial = readAddress(false);
    document.body.dataset.platform = initial.platform;
    if (!one("[data-live]")) {
      const live = document.createElement("div");
      live.dataset.live = "";
      live.className = "sr-only";
      live.setAttribute("aria-live", "polite");
      live.setAttribute("aria-atomic", "true");
      root.append(live);
    }
    initializeControls();
    currentInteraction = initial.interaction;
    applyInteraction(initial.interaction, false);
    applyView(initial.view, false);
    showSpacePanel("library", false);
    showAuthStep("phone", false);
    document.body.dataset.ready = "true";
    writeAddress("replace");
  }

  window.addEventListener("popstate", () => syncFromAddress(false));
  window.addEventListener("hashchange", () => syncFromAddress(true));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
