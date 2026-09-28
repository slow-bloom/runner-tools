import type { RunnerToolsLocale } from './en.js';

export const zhLocale: RunnerToolsLocale = {
  locale: 'zh',
  vdot: {
    zones: {
      E: {
        name: '轻松跑 (E 配速)',
        shortName: '轻松跑',
        description: '建立扎实的有氧基础，促进身体恢复与毛细血管新生。',
      },
      M: {
        name: '马拉松配速 (M 配速)',
        shortName: '马拉松',
        description: '培养目标比赛配速的肌肉记忆与心肺耐力，提升长跑心理确定性。',
      },
      T: {
        name: '乳酸阈值跑 (T 配速)',
        shortName: '阈值跑',
        description: '舒适的艰苦。有效提高身体清除与耐受血乳酸的临界能力。',
      },
      I: {
        name: '间歇跑 (I 配速)',
        shortName: '间歇跑',
        description: '高强度刺激。直接扩张有氧动力上限与最大摄氧量 (VO₂ Max)。',
      },
      R: {
        name: '重复跑 (R 配速)',
        shortName: '重复跑',
        description: '高速短冲刺。纠正跑步步态神经协调，显著提升跑步经济性。',
      },
    },
    standardDistances: {
      k5: '5 公里 (5K)',
      k10: '10 公里 (10K)',
      halfMarathon: '半程马拉松 (21.0975 公里)',
      marathon: '全程马拉松 (42.195 公里)',
    },
    units: {
      km: '公里',
      mi: '英里',
      paceKm: '/公里',
      paceMi: '/英里',
    },
  },
};
