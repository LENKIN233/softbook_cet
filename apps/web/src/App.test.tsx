import { vi } from "vitest";
vi.mock(
  "../../mobile/src/learning/session",
  () => import("../../mobile/__tests__/fixtures/interactionSession")
);
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import axe from "axe-core";
import { App } from "./App";
import { createLocalLearningSession } from "../../mobile/__tests__/fixtures/interactionSession";
import type { LearningCard } from "../../mobile/src/learning/model";
const cards = createLocalLearningSession("cet4").catalogCards;
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterEach(async () => {
  cleanup();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  vi.restoreAllMocks();
  localStorage.clear();
});
async function enter() {
  const view = render(<App />);
  const start = await screen.findByRole("button", {
    name: /^(开始学习|继续学习)$/,
  }, {timeout: 10000});
  await waitFor(() => expect(start).toBeEnabled());
  fireEvent.click(start);
  await screen.findByRole("article");
  return view;
}
function current() {
  return cards.find(
    (card) => screen.queryAllByText(card.front.prompt).length > 0
  )!;
}
function answer(card = current(), wrong = false) {
  switch (card.interaction_id) {
    case "flip":
      fireEvent.click(screen.getByRole("button", { name: "翻面看答案" }));
      fireEvent.click(
        screen.getByRole("button", { name: wrong ? "需要复习" : "有把握" })
      );
      break;
    case "multiple_choice": {
      const index = card.options.findIndex((option) =>
        wrong
          ? option.id !== card.answer_key.correct_option
          : option.id === card.answer_key.correct_option
      );
      fireEvent.click(
        within(screen.getByRole("group", { name: "四选一选项" })).getAllByRole(
          "button"
        )[index]
      );
      fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
      break;
    }
    case "swipe": {
      const index = card.swipe_states.findIndex((option) =>
        wrong
          ? option.id !== card.answer_key.correct_state
          : option.id === card.answer_key.correct_state
      );
      fireEvent.click(
        within(
          screen.getByRole("group", { name: "左右滑动判断" })
        ).getAllByRole("button")[index]
      );
      break;
    }
    case "lock": {
      if (wrong) {
        const slot = card.lock_slots[0];
        fireEvent.click(
          within(
            screen.getByRole("group", { name: `${slot.label}选项` })
          ).getByRole("button", {
            name: slot.options.find(
              (option) => option !== card.answer_key.lock_pattern[0]
            )!,
          })
        );
      }
      card.lock_slots.forEach((slot, index) =>
        fireEvent.click(
          within(
            screen.getByRole("group", { name: `${slot.label}选项` })
          ).getByRole("button", {
            name: card.answer_key.lock_pattern[index],
          })
        )
      );
      break;
    }
    case "elimination": {
      const group = screen.getByRole("group", { name: /选择要删除/ });
      const ids = wrong
        ? [card.elimination_items[0].id]
        : card.answer_key.correct_items;
      for (const id of ids)
        fireEvent.click(
          within(group).getByRole("button", {
            name: card.elimination_items.find((item) => item.id === id)!.text,
          })
        );
      fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
      break;
    }
  }
}
function advance() {
  fireEvent.click(screen.getByRole("button", { name: /^(下一张|完成本组)$/ }));
}
function reach(kind: LearningCard["interaction_id"]) {
  for (let n = 0; n < cards.length; n++) {
    if (screen.queryByRole("heading", { name: "本组完成" }))
      fireEvent.click(screen.getByRole("button", { name: "继续下一组" }));
    const card = current();
    if (card?.interaction_id === kind) return card;
    answer(card);
    advance();
  }
  throw new Error(`Missing ${kind}`);
}
async function saved() {
  await waitFor(() => {
    const raw = localStorage.getItem("softbook-cet/study/v2/cet4");
    expect(raw).not.toBeNull();
    const state = JSON.parse(raw!).state;
    expect(state.frame.ids).not.toHaveLength(0);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("local study user journey", () => {
  it("starts answer review at the top of its reading area", async () => {
    await enter();
    const body = screen.getByRole('article').querySelector('.paper-body')!;
    body.scrollTop = 180;
    answer();
    expect(body.scrollTop).toBe(0);
    expect(screen.getByRole('region', {name: '答案对照'})).toBeInTheDocument();
  }, 20000); // This test is first and includes the lazy module's cold transform.

  it("offers track selection and learning without phone or fake code fields", async () => {
    render(<App />);
    expect(
      await screen.findByRole("button", { name: "英语四级" }, {timeout: 10000})
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "英语六级" })).toBeEnabled();
    expect(screen.queryByLabelText("手机号")).toBeNull();
    expect(
      await screen.findByRole("button", { name: "开始学习" })
    ).toBeEnabled();
  }, 20000); // The first render includes the lazy module's cold transform.
  it("keeps the canonical route order and focuses the first card", async () => {
    await enter();
    expect(
      within(screen.getByRole("navigation", { name: "主要导航" }))
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["学习", "空间", "统计", "我的"]);
    expect(current().card_id).toBe("002001");
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
  });
  it("opening help does not count as requesting hint content", async () => {
    await enter();
    fireEvent.click(screen.getByText("需要帮助", { selector: "summary" }));
    answer();
    fireEvent.click(screen.getByRole("button", { name: "统计" }));
    expect(screen.getByText("使用提示").closest("div")).toHaveTextContent("0");
    expect(screen.getByText("今日完成").closest("div")).toHaveTextContent(
      "1 张"
    );
    expect(screen.getByText("累计学过").closest("div")).toHaveTextContent(
      "1 张"
    );
  });
  it("retains hint use after closing help and preserves it through Space", async () => {
    await enter();
    fireEvent.click(screen.getByText("需要帮助", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "查看提示" }));
    fireEvent.click(screen.getByRole("button", { name: "收起提示" }));
    fireEvent.click(screen.getByRole("button", { name: "空间" }));
    fireEvent.click(screen.getByRole("button", { name: "继续学习" }));
    answer();
    fireEvent.click(screen.getByRole("button", { name: "统计" }));
    expect(screen.getByText("使用提示").closest("div")).toHaveTextContent("1");
  });
  it("requires reveal and exactly two light self-assessment choices", async () => {
    await enter();
    expect(screen.queryByRole("group", { name: "自我评估" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "翻面看答案" }));
    const group = screen.getByRole("group", { name: "自我评估" });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
    fireEvent.click(within(group).getByRole("button", { name: "有把握" }));
    expect(screen.queryByText("回答正确")).toBeNull();
    expect(screen.getByLabelText("答案对照")).toBeInTheDocument();
  });
  it("shows the full wrong choice and correct answer, then removes stale feedback", async () => {
    await enter();
    const card = reach("multiple_choice");
    answer(card, true);
    const comparison = screen.getByLabelText("答案对照");
    expect(comparison).toHaveTextContent("你的选择");
    expect(comparison).toHaveTextContent("正确答案");
    expect(comparison).toHaveTextContent("B · unclear");
    advance();
    expect(screen.queryByLabelText("答案对照")).toBeNull();
  });
  it("remembers a lock mistake across Space navigation", async () => {
    await enter();
    const card = reach("lock");
    if (card.interaction_id !== "lock") throw new Error();
    const slot = card.lock_slots[0];
    fireEvent.click(
      within(
        screen.getByRole("group", { name: `${slot.label}选项` })
      ).getByRole("button", {
        name: slot.options.find(
          (value) => value !== card.answer_key.lock_pattern[0]
        )!,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "空间" }));
    fireEvent.click(screen.getByRole("button", { name: "继续学习" }));
    answer(card);
    expect(screen.getByText("已解锁，稍后复习。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "统计" }));
    expect(screen.getByText("待复习").closest("div")).toHaveTextContent("1 张");
  });
  it("filters favorites with the original box address and keeps the active learning card", async () => {
    await enter();
    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    fireEvent.click(screen.getByRole("button", { name: "空间" }));
    fireEvent.click(screen.getByRole("button", { name: "只看收藏" }));
    const found = screen.getByRole("region", { name: "筛选结果" });
    expect(found).toHaveTextContent("听力 / 逻辑关系 / 转折关系");
    fireEvent.click(
      within(found).getByRole("button", { name: /短对话里听到 however/ })
    );
    fireEvent.click(screen.getByRole("button", { name: "继续学习" }));
    expect(current().card_id).toBe("002001");
  });
  it("pausing a card changes only its availability, not its box or the rest of the group", async () => {
    await enter();
    fireEvent.click(screen.getByRole("button", { name: "空间" }));
    fireEvent.click(screen.getByRole("button", { name: "暂不学习这张卡" }));
    expect(
      screen.getByRole("region", { name: "盒内休眠区" })
    ).toHaveTextContent(cards[0].front.prompt);
    fireEvent.click(screen.getByRole("button", { name: "继续学习" }));
    expect(current().card_id).toBe("002002");
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });
  it("restores an unfinished answer after page reload and leaving local study", async () => {
    const first = await enter();
    reach("multiple_choice");
    fireEvent.click(screen.getByRole("button", { name: /A.*urgent/ }));
    await saved();
    const question = current().card_id;
    first.unmount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "继续学习" }));
    expect(current().card_id).toBe(question);
    expect(screen.getByRole("button", { name: /A.*urgent/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "我的" }));
    fireEvent.click(screen.getByRole("button", { name: "返回首页" }));
    const resume = await screen.findByRole("button", { name: "继续学习" });
    fireEvent.click(resume);
    expect(current().card_id).toBe(question);
  });
  it("returns to the original draft after a failed review and keeps the card pending", async () => {
    await enter();
    answer(current(), true);
    advance();
    reach("multiple_choice");
    fireEvent.click(screen.getByRole("button", { name: /A.*urgent/ }));
    const original = current().card_id;
    fireEvent.click(screen.getByRole("button", { name: "统计" }));
    fireEvent.click(screen.getByRole("button", { name: "开始复习" }));
    answer(current(), true);
    advance();
    fireEvent.click(screen.getByRole("button", { name: "回到原来的学习" }));
    expect(current().card_id).toBe(original);
    expect(screen.getByRole("button", { name: /A.*urgent/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "统计" }));
    expect(screen.getByText("待复习").closest("div")).toHaveTextContent("1 张");
  });
  it("preserves the completion receipt after pausing an old card", async () => {
    await enter();
    for (let i = 0; i < 5; i++) {
      answer();
      advance();
    }
    expect(
      screen.getByRole("heading", { name: "本组完成" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看卡片" }));
    fireEvent.click(screen.getByRole("button", { name: "暂不学习这张卡" }));
    fireEvent.click(screen.getByRole("button", { name: "继续学习" }));
    expect(
      screen.getByRole("heading", { name: "本组完成" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续下一组" }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });
  it("supports every interaction and ends the available new-card sequence explicitly", async () => {
    await enter();
    const seen = new Set<string>();
    for (let i = 0; i < cards.length; i++) {
      if (screen.queryByRole("heading", { name: "本组完成" }))
        fireEvent.click(screen.getByRole("button", { name: "继续下一组" }));
      const card = current();
      seen.add(card.interaction_id);
      answer(card);
      advance();
    }
    expect(seen.size).toBe(5);
    fireEvent.click(screen.getByRole("button", { name: "检查复习安排" }));
    expect(
      screen.getByRole("heading", { name: "当前安排已完成" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
  });
  it("keeps independent CET4 and CET6 progress", async () => {
    await enter();
    answer();
    advance();
    const original = current().card_id;
    fireEvent.click(screen.getByRole("button", { name: "我的" }));
    fireEvent.click(screen.getByRole("button", { name: "英语六级" }));
    await screen.findByRole("article");
    await waitFor(() => expect(screen.getByText("1 / 5")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "我的" }));
    fireEvent.click(screen.getByRole("button", { name: "英语四级" }));
    await screen.findByRole("article");
    expect(current().card_id).toBe(original);
  });
  it("retries a failed check-in save from the statistics action", async () => {
    await enter();
    answer();
    await saved();
    const write = Storage.prototype.setItem;
    const failure = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key.startsWith("softbook-cet/study/")) throw new Error("Quota");
        return write.call(this, key, value);
      });
    fireEvent.click(screen.getByRole("button", { name: "统计" }));
    fireEvent.click(screen.getByRole("button", { name: "签到" }));
    await screen.findByRole("alert");
    failure.mockRestore();
    const stats = screen
      .getByRole("heading", { name: "学习统计" })
      .closest("section")!;
    fireEvent.click(within(stats).getByRole("button", { name: "重试保存" }));
    expect(
      await screen.findByRole("button", { name: "今日已签到" })
    ).toBeDisabled();
  });
  it("provides recovery actions without destroying malformed records", async () => {
    localStorage.setItem("softbook-cet/study/v2/cet4", "{broken");
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("原内容已保留");
    expect(screen.getByRole("button", { name: "开始学习" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出学习备份" })).toBeEnabled();
    expect(localStorage.getItem("softbook-cet/study/v2/cet4")).toBe("{broken");
  });
  it("keeps keyboard choice selection and continuation available", async () => {
    await enter();
    reach("multiple_choice");
    fireEvent.keyDown(document.body, { key: "2" });
    expect(screen.getByRole("button", { name: /B.*unclear/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(screen.queryByLabelText("答案对照")).toBeNull();
  });
  it("has no automatic accessibility violations in Learning and Space", async () => {
    await enter();
    expect(
      (
        await axe.run(document, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations
    ).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "空间" }));
    expect(
      (
        await axe.run(document, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations
    ).toEqual([]);
  });
});
