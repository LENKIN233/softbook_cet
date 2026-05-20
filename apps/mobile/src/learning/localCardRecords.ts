import { LearningCardRecord } from './sourceContract';

export const localLearningCardRecords: LearningCardRecord[] = [
  {
    card_id: '002001',
    track: 'cet4',
    knowledge_ref: '0020',
    interaction_id: 'flip',
    front: {
      eyebrow: '本轮卡组 | 逻辑关系',
      prompt: '短对话里听到 however，优先盯哪一半信息？',
      support: '先抓转折，不要被前半句带跑。',
      context: '考试语境里真正态度和结果常压在 however 后半句。',
    },
    back_text: '优先盯转折后的半句，再回头核对前面让步或铺垫的信息。',
    analysis: {
      title: '先抓态度转向，再判断答案',
      summary:
        '题目里的 however 往往不是装饰词，而是把说话人真正结论往后推。先抓后半句，能减少被前半句表面信息误导。',
      exam_tip: '听到转折词时先记“后半句优先”，再看选项有没有只复述前半句。',
    },
    hint_layer: {
      label: '提示层',
      content: '先问自己：说话人是在收回前面的判断，还是给出真正立场？',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '0020',
      library: '听力',
      group: '逻辑关系',
      box: '转折关系',
    },
  },
  {
    card_id: '002002',
    track: 'cet4',
    knowledge_ref: '0020',
    interaction_id: 'flip',
    front: {
      eyebrow: '本轮卡组 | 逻辑关系',
      prompt: '听到 but / however 之后，做题顺序应该先改哪里？',
      support: '先重算结论位，再补细节。',
      context: '同一句里前后态度相反时，答案通常落在后半句。',
    },
    back_text: '先更新结论位，再回补前面的限定条件，不要把前半句当最终态度。',
    analysis: {
      title: '结论位优先级高于铺垫位',
      summary:
        '题目里的转折都在重新分配信息权重。前半句可能只是铺垫，真正可用信息常被放在 but / however 之后。',
      exam_tip: '如果选项只复制转折前内容，通常要提高警惕。',
    },
    space_metadata: {
      box_ref: '0020',
      library: '听力',
      group: '逻辑关系',
      box: '转折关系',
    },
  },
  {
    card_id: '012101',
    track: 'cet4',
    knowledge_ref: '0121',
    interaction_id: 'lock',
    front: {
      eyebrow: '本轮卡组 | 长难句主干',
      prompt: '把句子主干锁出来，三个槽位都对才开锁。',
      support: '先抓主语，再找谓语和核心宾语。',
      context: '复杂修饰里先保住 S + V + O，读长句会轻很多。',
    },
    lock_slots: [
      {
        id: 'subject',
        label: '主语',
        options: ['The policy', 'reduces', 'test anxiety'],
      },
      {
        id: 'verb',
        label: '谓语',
        options: ['test anxiety', 'The policy', 'reduces'],
      },
      {
        id: 'object',
        label: '宾语',
        options: ['reduces', 'test anxiety', 'during revision'],
      },
    ],
    answer_key: {
      lock_pattern: ['The policy', 'reduces', 'test anxiety'],
    },
    auto_scoring: true,
    analysis: {
      title: '开锁的关键是别让修饰词抢主干',
      summary:
        '很多真题长句会把时间、方式和插入解释塞进句中。先锁主语、谓语、宾语，剩下修饰再慢慢挂回去，理解压力会明显下降。',
      exam_tip: '如果一句话太长，先问自己“是谁做了什么”，再补其他成分。',
    },
    hint_layer: {
      label: '提示层',
      content: '遇到长句先找有限动词，主语通常会围着它出现。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '0121',
      library: '仔细阅读',
      group: '长难句主干',
      box: '主谓宾',
    },
  },
  {
    card_id: '013001',
    track: 'cet4',
    knowledge_ref: '0130',
    interaction_id: 'elimination',
    front: {
      eyebrow: '本轮卡组 | 长难句关键修饰',
      prompt: '点掉应删除的干扰成分，保留句干。',
      support:
        '目标句：The students who review in short bursts usually remember the pattern before the test.',
      context: '先把修饰成分剥掉，再回到主谓宾。',
    },
    elimination_items: [
      { id: 'relative_clause', text: 'who review in short bursts' },
      { id: 'adverb', text: 'usually' },
      { id: 'object', text: 'the pattern' },
      { id: 'time_phrase', text: 'before the test' },
    ],
    answer_key: {
      correct_items: ['relative_clause', 'adverb', 'time_phrase'],
    },
    auto_scoring: true,
    analysis: {
      title: '去干扰不是乱删，是先保骨架',
      summary:
        '这句的句干是 The students remember the pattern。定语从句、频率副词和时间状语都能先剥离，帮助你看清核心结构。',
      exam_tip: '做细节判断时，先保住主干，才能更快判断选项是不是偷换信息。',
    },
    hint_layer: {
      label: '提示层',
      content: '先保留主语、谓语、核心宾语，状语和定语从句可以先暂存。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '0130',
      library: '仔细阅读',
      group: '长难句关键修饰',
      box: '定语',
    },
  },
  {
    card_id: '050301',
    track: 'cet4',
    knowledge_ref: '0503',
    interaction_id: 'swipe',
    front: {
      eyebrow: '本轮卡组 | 同义词替换',
      prompt: 'be likely to do 在表达转换里更接近哪一侧？',
      support: '用双态判断压低进入成本。',
      context: '别把 likely 误读成“喜欢”，它更常表达概率。',
    },
    swipe_states: [
      {
        id: 'safe',
        label: '可直接套用',
        description: '表达“很可能做某事”。',
      },
      {
        id: 'risky',
        label: '容易误用',
        description: '误写成“对某事很喜欢”。',
      },
    ],
    answer_key: {
      correct_state: 'safe',
    },
    auto_scoring: true,
    analysis: {
      title: '先稳住高频句式替换的中文落点',
      summary:
        'be likely to do 先落到“很可能……”最稳。如果把 likely 误解成 like，表达会直接偏题。',
      exam_tip:
        '表达转换高频结构时，优先记“最稳的中文落点”，比背一串近义表达更有用。',
    },
    space_metadata: {
      box_ref: '0503',
      library: '词汇',
      group: '同义词替换',
      box: '句式替换',
    },
  },
  {
    card_id: '052101',
    track: 'cet4',
    knowledge_ref: '0521',
    interaction_id: 'multiple_choice',
    front: {
      eyebrow: '本轮卡组 | 高频词',
      prompt:
        'The committee postponed the vote because several details were still ____.',
      support: '选出最符合句意的词。',
      context: '投票被推迟，说明关键信息还没有清楚。',
    },
    options: [
      { id: 'urgent', label: 'A', text: 'urgent' },
      { id: 'unclear', label: 'B', text: 'unclear' },
      { id: 'formal', label: 'C', text: 'formal' },
      { id: 'similar', label: 'D', text: 'similar' },
    ],
    answer_key: {
      correct_option: 'unclear',
    },
    auto_scoring: true,
    analysis: {
      title: '先顺着因果看语义',
      summary:
        '因为“细节还不清楚”才会推迟投票。urgent 和 formal 都能修饰 details，但和 postpone the vote 的因果不成立。',
      exam_tip: '四选一别孤立看词，先把它塞回原句，看前后逻辑是不是闭合。',
    },
    hint_layer: {
      label: '提示层',
      content: 'postpone 往往搭配“信息未定 / 条件未备齐”的原因。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '0521',
      library: '词汇',
      group: '高频词',
      box: '阅读高频词',
    },
  },
  {
    card_id: '052102',
    track: 'cet4',
    knowledge_ref: '0521',
    interaction_id: 'multiple_choice',
    front: {
      eyebrow: '本轮卡组 | 高频词',
      prompt:
        'The article offers a ____ explanation of why many students lose points on the first pass.',
      support: '优先选能和 explanation 形成高频搭配的词。',
      context: '句子强调“解释有说服力”，不是“解释很复杂”。',
    },
    options: [
      { id: 'compelling', label: 'A', text: 'compelling' },
      { id: 'casual', label: 'B', text: 'casual' },
      { id: 'equal', label: 'C', text: 'equal' },
      { id: 'silent', label: 'D', text: 'silent' },
    ],
    answer_key: {
      correct_option: 'compelling',
    },
    auto_scoring: true,
    analysis: {
      title: '高频词要连着搭配一起记',
      summary:
        'compelling explanation 表达“很有说服力的解释”，和文章论证语境更贴。其他选项和 explanation 的组合都不自然。',
      exam_tip:
        '做词义辨析时，别只背中文义，常见搭配才决定你能不能在真题里选对。',
    },
    space_metadata: {
      box_ref: '0521',
      library: '词汇',
      group: '高频词',
      box: '阅读高频词',
    },
  },
];
