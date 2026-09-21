import type {LearningCardResultOutcome} from './model';

export function resultFeedback(outcome: LearningCardResultOutcome) {
  switch (outcome) {
    case 'correct': return {title: '回答正确', caption: '你的答案正确', badge: '已答对'};
    case 'incorrect': return {title: '需要复习', caption: '这张卡需要再练习', badge: '待复习'};
    case 'confident': return {title: '有把握', caption: '这是你的自评结果', badge: '有把握'};
    case 'review': return {title: '需要复习', caption: '已按你的选择加入复习', badge: '待复习'};
  }
}
