import type { RunnerToolsLocale } from './en.js';

export const zhLocale: RunnerToolsLocale = {
  locale: 'zh',
  files: {
    defaultActivityName: '运动记录',
    emptyActivityName: '空活动',
    mergedActivitySuffix: ' (合并)',
  },
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
  racePredictor: {
    distances: {
      k5: '5 公里 (5K)',
      k10: '10 公里 (10K)',
      halfMarathon: '半程马拉松 (21.0975 公里)',
      marathon: '全程马拉松 (42.195 公里)',
    },
    exponents: {
      elite: '1.06 - Riegel 经典标准（有氧底子扎实 / 严肃跑者）',
      recreational: '1.08 - 大众跑者推荐（日常周跑量适中）',
      beginner: '1.10 - 跑量较少 / 刚进阶长距离跑者',
    },
  },
  heartRateZones: {
    zones: {
      z1: {
        name: 'Zone 1',
        category: '恢复排酸',
        description: '用于运动前热身激活与高强度后排酸恢复。',
      },
      z2: {
        name: 'Zone 2',
        category: '有氧基础耐力 (轻松跑)',
        description: '刺激线粒体与毛细血管生长，高效燃烧脂肪。',
      },
      z3: {
        name: 'Zone 3',
        category: '节奏/马拉松区间',
        description: '强化心血管泵血效率与马拉松专项巡航能力。',
      },
      z4: {
        name: 'Zone 4',
        category: '乳酸阈值',
        description: '提高身体在极限配速下的抗乳酸疲劳能力。',
      },
      z5: {
        name: 'Zone 5',
        category: '无氧极限',
        description: '最大限度刺激最大摄氧量与神经肌肉爆发力。',
      },
    },
    basis: {
      maxhr: '最大心率比例',
      karvonen: 'HRR 比例',
      lthr: 'LTHR 比例',
    },
    methods: {
      maxhr: {
        title: '最大心率法参数',
        description: '输入年龄估算或直接输入已知最大心率，按百分比划分区间。',
      },
      karvonen: {
        title: '卡沃宁储备心率法参数',
        description: '输入最大心率与静息心率，结合生理缓冲空间划分区间（推荐）。',
      },
      lthr: {
        title: '乳酸阈值心率法参数',
        description: '输入 30 分钟计时测得的乳酸阈值心率 (LTHR)，划分专业耐力区间。',
      },
    },
  },
  ageGrading: {
    levels: {
      worldClass: '世界顶尖级 (World Class)',
      nationalClass: '国家精英级 (National Class)',
      regionalClass: '省市高水平级 (Regional Class)',
      localClass: '大众健将级 (Local Class)',
      activeRunner: '规律跑者级 (Active Runner)',
      recreationalRunner: '健康休闲跑者 (Recreational Runner)',
    },
    errors: {
      ageOutOfRange: '年龄范围需在 5 至 100 岁之间。',
      invalidTime: '请输入有效的完赛用时。',
      standardNotFound: '未找到该年龄与距离的官方世界纪录标准。',
    },
  },
  runningEfficiency: {
    verticalRatio: {
      elite: {
        label: '顶尖精英 (< 6.0%)',
        desc: '卓越的水平转化率，几乎零多余垂直颠簸浪费。',
      },
      advanced: {
        label: '优秀进阶 (6.0% ～ 8.0%)',
        desc: '非常经济的跑姿步态，成熟马拉松跑者的典型区间。',
      },
      average: {
        label: '大众平均 (8.1% ～ 10.0%)',
        desc: '存在轻微能量垂直浪费，适当提高 5 spm 步频可收紧起伏轨迹。',
      },
      needsImprovement: {
        label: '有待改善 (> 10.0%)',
        desc: '垂直颠簸过大或跨大步刹车，严重损耗向前推进动能。',
      },
    },
    dutyFactor: {
      elite: '顶尖弹性蓄能 (< 30%)',
      advanced: '进阶腾空相 (30% ～ 39%)',
      recreational: '大众基础级 (40% ～ 50%)',
    },
    efficiencyFactor: {
      developing: '有氧基础初建期 (< 1.10)',
      solid: '扎实有氧平台期 (1.10 ～ 1.35)',
      advanced: '高阶有氧发动机 (1.36 ～ 1.60)',
      elite: '精英级心泵能力 (> 1.60)',
      unitLabel: '米/跳',
      metersPerBeat: '米/心跳',
    },
    speed: {
      metersPerSec: '米/秒',
      kmPerHour: '公里/小时',
    },
  },
  pace: {
    units: {
      minPerKm: '分/公里',
      minPerMi: '分/英里',
      kmPerHour: '公里/小时',
      milesPerHour: '英里/小时',
      metersPerSec: '米/秒',
      km: '公里',
      mi: '英里',
    },
    labels: {
      distance: '跑步距离',
      pace: '配速',
      time: '用时',
      finishTime: '完赛用时',
      speed: '时速',
      targetPace: '目标配速',
    },
    distances: {
      k5: '5 公里 (5K)',
      k10: '10 公里 (10K)',
      halfMarathon: '半程马拉松 (21.0975 公里)',
      marathon: '全程马拉松 (42.195 公里)',
    },
  },
  weeklyMileage: {
    units: {
      km: '公里',
      mi: '英里',
    },
    status: {
      base: '基准跑量',
      build: '跑量增长',
      deload: '减量恢复周',
      target: '达成目标',
    },
    labels: {
      week: '周',
      weeks: '周',
      distance: '周总跑量',
      status: '阶段状态',
      change: '环比增幅',
    },
  },
};
