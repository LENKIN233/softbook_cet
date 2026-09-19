const CET4_CARD_RECORDS = [
  {
    card_id: '002001',
    track: 'cet4',
    knowledge_ref: '0020',
    interaction_id: 'flip',
    front: {
      eyebrow: '听力 | 逻辑关系',
      prompt: '短对话里听到 however，优先盯哪一半信息？',
      support: '先抓转折，不要被前半句带跑。',
      context: 'CET 听力里真正态度和结果常压在 however 后半句。',
    },
    back_text: '优先盯转折后的半句，再回头核对前面让步或铺垫的信息。',
    analysis: {
      title: '先抓态度转向，再判断答案',
      summary: '听力里的 however 往往不是装饰词，而是把说话人真正结论往后推。',
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
    card_id: '012101',
    track: 'cet4',
    knowledge_ref: '0121',
    interaction_id: 'lock',
    front: {
      eyebrow: '仔细阅读 | 长难句主干',
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
        '很多真题长句会把时间、方式和插入解释塞进句中。先锁主语、谓语、宾语，阅读压力会明显下降。',
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
    card_id: '052101',
    track: 'cet4',
    knowledge_ref: '0521',
    interaction_id: 'multiple_choice',
    front: {
      eyebrow: '词汇 | 阅读高频词',
      prompt:
        'The committee postponed the vote because several details were still ____.',
      support: '选出最符合句意的词。',
      context: '投票被推迟，说明关键信息还没有清楚。',
    },
    options: [
      {id: 'urgent', label: 'A', text: 'urgent'},
      {id: 'unclear', label: 'B', text: 'unclear'},
      {id: 'formal', label: 'C', text: 'formal'},
      {id: 'similar', label: 'D', text: 'similar'},
    ],
    answer_key: {
      correct_option: 'unclear',
    },
    auto_scoring: true,
    analysis: {
      title: '先顺着因果看语义',
      summary:
        '因为“细节还不清楚”才会推迟投票。urgent 和 formal 都能修饰 details，但和因果不成立。',
      exam_tip: '四选一别孤立看词，先把它塞回原句，看前后逻辑是不是闭合。',
    },
    space_metadata: {
      box_ref: '0521',
      library: '词汇',
      group: '高频词',
      box: '阅读高频词',
    },
  },
  {
    card_id: '013001',
    track: 'cet4',
    knowledge_ref: '0130',
    interaction_id: 'elimination',
    front: {
      eyebrow: '仔细阅读 | 长难句关键修饰',
      prompt: '点掉应删除的干扰成分，保留句干。',
      support:
        '目标句：The students who review in short bursts usually remember the pattern before the test.',
      context: '先把修饰成分剥掉，再回到主谓宾。',
    },
    elimination_items: [
      {id: 'relative_clause', text: 'who review in short bursts'},
      {id: 'adverb', text: 'usually'},
      {id: 'object', text: 'the pattern'},
      {id: 'time_phrase', text: 'before the test'},
    ],
    answer_key: {
      correct_items: ['relative_clause', 'adverb', 'time_phrase'],
    },
    auto_scoring: true,
    analysis: {
      title: '去干扰不是乱删，是先保骨架',
      summary:
        '这句的句干是 The students remember the pattern。定语从句、频率副词和时间状语都能先剥离，帮助你看清核心结构。',
      exam_tip: '做阅读细节题时，先保住主干，才能更快判断选项是不是偷换信息。',
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
      eyebrow: '词汇 | 同义词替换',
      prompt: 'be likely to do 在翻译里更接近哪一侧？',
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
        'be likely to do 先落到“很可能……”最稳。如果误解成 like，翻译会直接偏题。',
      exam_tip: '翻译高频结构时，优先记“最稳的中文落点”。',
    },
    space_metadata: {
      box_ref: '0503',
      library: '词汇',
      group: '同义词替换',
      box: '句式替换',
    },
  },
];

const CET6_CARD_RECORDS = [
  {
    card_id: '102001',
    track: 'cet6',
    knowledge_ref: '1020',
    interaction_id: 'flip',
    front: {
      eyebrow: '听力 | 逻辑关系',
      prompt: '讲座里出现 nevertheless，后面通常承担什么作用？',
      support: '先把它当作立场修正信号。',
      context: 'CET6 长听力常用让步后转折来给出真正观点。',
    },
    back_text: 'nevertheless 后面更可能是说话人要保留的核心判断。',
    analysis: {
      title: '让步后转折更接近答案位',
      summary:
        'CET6 听力会把背景、限制和真正观点拆开。听到 nevertheless，要把注意力重新落到后半句。',
      exam_tip: '选项如果只复述让步信息，通常不是最终答案。',
    },
    hint_layer: {
      label: '提示层',
      content: '先判断后半句是在补充、让步，还是改写前面的结论。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '1020',
      library: '听力',
      group: '逻辑关系',
      box: '转折关系',
    },
  },
  {
    card_id: '112101',
    track: 'cet6',
    knowledge_ref: '1121',
    interaction_id: 'lock',
    front: {
      eyebrow: '仔细阅读 | 长难句主干',
      prompt: '锁出学术长句的主谓宾，避免被限定语打断。',
      support: '先抓 subject / verb / object 三个槽。',
      context: 'CET6 阅读常把主干藏在多层修饰和限定语后。',
    },
    lock_slots: [
      {
        id: 'subject',
        label: '主语',
        options: [
          'The limited evidence',
          'shaped',
          'the preliminary conclusion',
        ],
      },
      {
        id: 'verb',
        label: '谓语',
        options: [
          'the preliminary conclusion',
          'The limited evidence',
          'shaped',
        ],
      },
      {
        id: 'object',
        label: '宾语',
        options: ['shaped', 'the preliminary conclusion', 'in the report'],
      },
    ],
    answer_key: {
      lock_pattern: [
        'The limited evidence',
        'shaped',
        'the preliminary conclusion',
      ],
    },
    auto_scoring: true,
    analysis: {
      title: '先抽主干，再处理限定语',
      summary:
        'CET6 长句常用限定语和插入信息拉长句子。先锁定主语、谓语和宾语，才能判断后面的限定是不是改变结论强度。',
      exam_tip: '遇到学术长句，先问“谁影响了什么”，再回头补条件、范围和态度。',
    },
    space_metadata: {
      box_ref: '1121',
      library: '仔细阅读',
      group: '长难句主干',
      box: '主谓宾',
    },
  },
  {
    card_id: '152101',
    track: 'cet6',
    knowledge_ref: '1521',
    interaction_id: 'multiple_choice',
    front: {
      eyebrow: '词汇 | 高频词',
      prompt:
        'The findings should be treated with ____ because the sample was small.',
      support: '选出最符合学术语境的词。',
      context: '样本小意味着结论需要谨慎处理。',
    },
    options: [
      {id: 'caution', label: 'A', text: 'caution'},
      {id: 'frequency', label: 'B', text: 'frequency'},
      {id: 'comfort', label: 'C', text: 'comfort'},
      {id: 'volume', label: 'D', text: 'volume'},
    ],
    answer_key: {
      correct_option: 'caution',
    },
    auto_scoring: true,
    analysis: {
      title: '小样本对应谨慎解释',
      summary: 'with caution 是学术阅读高频搭配，表示结论不能被过度推广。',
      exam_tip: '遇到 sample / evidence limited，优先寻找谨慎、限制类表达。',
    },
    space_metadata: {
      box_ref: '1521',
      library: '词汇',
      group: '高频词',
      box: '阅读高频词',
    },
  },
  {
    card_id: '113001',
    track: 'cet6',
    knowledge_ref: '1130',
    interaction_id: 'elimination',
    front: {
      eyebrow: '仔细阅读 | 长难句关键修饰',
      prompt: '点掉削弱原句论证主线的干扰信息。',
      support:
        '目标句：Researchers who relied on a narrow sample cautiously framed the result as preliminary.',
      context: 'CET6 阅读更常考限定语和结论强度，不要把修饰误当主结论。',
    },
    elimination_items: [
      {id: 'relative_clause', text: 'who relied on a narrow sample'},
      {id: 'adverb', text: 'cautiously'},
      {id: 'verb', text: 'framed'},
      {id: 'complement', text: 'the result as preliminary'},
    ],
    answer_key: {
      correct_items: ['relative_clause', 'adverb'],
    },
    auto_scoring: true,
    analysis: {
      title: '先保住研究者做出的核心判断',
      summary:
        '这句主线是 Researchers framed the result as preliminary。样本限制和 cautiously 是重要限定，但先剥离它们能帮助你看清主干。',
      exam_tip:
        'CET6 长句里，限定语常影响态度强度；先拆主干，再把限定语补回判断。',
    },
    hint_layer: {
      label: '提示层',
      content: '先保留主语、谓语和补足语，再判断限定语如何改变语气。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '1130',
      library: '仔细阅读',
      group: '长难句关键修饰',
      box: '定语',
    },
  },
  {
    card_id: '150301',
    track: 'cet6',
    knowledge_ref: '1503',
    interaction_id: 'swipe',
    front: {
      eyebrow: '词汇 | 同义词替换',
      prompt: '“This proves that...” 在弱证据段落里属于哪一侧？',
      support: '判断论证强度是否过满。',
      context: 'CET6 写作更需要控制 claims 的力度。',
    },
    swipe_states: [
      {
        id: 'safe',
        label: '力度合适',
        description: '证据强时才适合使用。',
      },
      {
        id: 'risky',
        label: '容易过度',
        description: '弱证据下更适合 suggests / indicates。',
      },
    ],
    answer_key: {
      correct_state: 'risky',
    },
    auto_scoring: true,
    analysis: {
      title: '证据弱时别把结论写满',
      summary:
        'proves 会把论证强度拉到很高。样本、数据或来源有限时，suggests 更稳。',
      exam_tip: '写作里先匹配证据强度，再选择 claims 的动词。',
    },
    space_metadata: {
      box_ref: '1503',
      library: '词汇',
      group: '同义词替换',
      box: '句式替换',
    },
  },
];

module.exports = {cet4: CET4_CARD_RECORDS, cet6: CET6_CARD_RECORDS};
