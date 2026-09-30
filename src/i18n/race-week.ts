export interface RaceWeekLocale {
  weekdays: string[];
  raceNames: string[];
  weekTitle: string;
  raceDay: string;
  target: string;
  easy: string;
  rest: string;
  strides: string;
  units: { km: string; mi: string; speedKm: string; speedMi: string };
  titles: Record<'recovery' | 'easy' | 'tuneup' | 'rest' | 'shakeout' | 'activation' | 'postrace', string>;
  notes: Record<'recovery' | 'easy' | 'tuneup' | 'rest' | 'shakeout' | 'activation' | 'postrace' | 'race', string>;
  timelineTitles: string[];
  timelineNotes: string[];
  fuelingTitles: string[];
  fuelingNotes: string[];
  phaseNames: string[];
  phaseNotes: string[];
  calendar: { race: string; breakfast: string; shakeout: string; tuneup: string };
  invalid: string;
  disclaimer: string;
}

export const enRaceWeek: RaceWeekLocale = {
  weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  raceNames: ['5K', '10K', 'Half Marathon', 'Marathon'],
  weekTitle: '{race} Race Week', raceDay: 'RACE DAY', target: 'Target', easy: 'Easy', rest: 'Rest',
  strides: 'Very light jog + 2 short strides', units: { km: 'km', mi: 'mi', speedKm: 'km/h', speedMi: 'mph' },
  titles: {
    recovery: 'Rest or Gentle Recovery', easy: 'Easy Aerobic + Strides',
    tuneup: 'Race-Pace Tune-Up', rest: 'Full Rest & Recovery', shakeout: 'Light Aerobic Shakeout',
    activation: 'Pre-Race Shakeout & Kit Check', postrace: 'Post-Race Recovery & Walking',
  },
  notes: {
    recovery: 'Keep effort gentle while recovering from the weekend. Rest instead if fatigue remains.',
    easy: 'Run at a comfortable effort. If familiar, finish with 4 relaxed short strides.',
    tuneup: 'Practice your target rhythm without racing the session. Include an easy warm-up and cooldown.',
    rest: 'Take a rest day. Prioritize sleep and familiar meals rather than adding last-minute training.',
    shakeout: 'Keep the run short and easy. Skip it if rest would leave you feeling better.',
    activation: 'Check your race shoes, bib and kit. Keep any shakeout familiar and relaxed.',
    postrace: 'Recover at your own pace. Gentle walking, familiar food and rest are enough.',
    race: 'Start patiently, follow the pacing you practiced and adjust to conditions and how you feel.',
  },
  timelineTitles: [
    'Wake Up & Breakfast', 'Final Gear Check & Anti-Chafing', 'Travel to the Start',
    'Bag Drop & Toilet Queue', 'Familiar Warm-up', 'Enter the Corral & Final Fuel', 'Race Start',
  ],
  timelineNotes: [
    'Choose a familiar carbohydrate-rich breakfast and fluids you have tolerated in training.',
    'Check bib, timing chip, shoes and any anti-chafing protection you normally use.',
    'Allow extra time for road closures, traffic and the walk to the start.',
    'Leave warm post-race clothes and allow time for queues.',
    'Use your usual easy jog and mobility routine without tiring yourself.',
    'Use only practiced pre-race fueling. Settle into your starting position calmly.',
    'Keep the first section controlled and adjust to conditions.',
  ],
  fuelingTitles: ['5K Fueling Template', '10K Fueling Template', 'Half Marathon Fueling Template', 'Marathon Fueling Template'],
  fuelingNotes: [
    'For a short race, on-course gels are usually unnecessary. Follow your practiced breakfast and hydration routine.',
    'A practiced pre-race gel is an option; longer finish times may call for additional fuel. Use familiar fluids.',
    'A starting template is a gel around 7 km and 14 km, with another later if needed. Adjust for duration, gel carbohydrate content and your training experience.',
    'A starting template is 40–60 g of carbohydrate per hour, using familiar products and fluids. Adjust for your needs and what you have practiced.',
  ],
  phaseNames: ['Phase 1: Controlled Start', 'Phase 2: Settle into Rhythm', 'Phase 3: Finish by Feel'],
  phaseNotes: [
    'Start a little slower than goal pace while the field settles. Avoid chasing an early time gain.',
    'Settle into your goal rhythm and follow your practiced fueling plan.',
    'If you feel comfortable, gradually increase effort. Otherwise maintain a sustainable rhythm.',
  ],
  calendar: { race: 'Race Day', breakfast: 'Race Morning Breakfast', shakeout: 'Pre-Race Shakeout & Kit Check', tuneup: 'Race-Pace Tune-Up' },
  invalid: 'Enter a valid race distance, weekly volume, goal time and start time.',
  disclaimer: 'This is a starting template, not an individualized training or nutrition prescription. Distances exclude the race; adjust to your usual routine.',
};

export const zhRaceWeek: RaceWeekLocale = {
  weekdays: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
  raceNames: ['5 公里', '10 公里', '半程马拉松', '马拉松'],
  weekTitle: '{race}比赛周', raceDay: '比赛日', target: '目标', easy: '轻松跑', rest: '休息',
  strides: '轻松慢跑与两次短加速', units: { km: '公里', mi: '英里', speedKm: '公里/小时', speedMi: '英里/小时' },
  titles: {
    recovery: '休息或轻松恢复', easy: '轻松跑与短加速', tuneup: '比赛配速热身课',
    rest: '充分休息', shakeout: '短距离轻松跑', activation: '赛前活动与装备检查', postrace: '赛后恢复与散步',
  },
  notes: {
    recovery: '延续周末训练后的恢复，如果仍感到疲劳，可以直接休息。',
    easy: '保持能轻松说话的强度；习惯短加速的跑者可在最后做四次。',
    tuneup: '熟悉目标配速的节奏，不把这次练习当比赛；留出轻松热身和放松。',
    rest: '不临时加练，把时间留给睡眠和熟悉的饮食。',
    shakeout: '保持短距离、低强度；如果休息更合适，就不必勉强出门。',
    activation: '检查跑鞋、号码布和装备，赛前活动保持熟悉而轻松。',
    postrace: '按自己的状态恢复，轻松散步、正常饮食和休息即可。',
    race: '耐心起跑，执行练过的节奏，并根据天气和体感调整。',
  },
  timelineTitles: ['起床与早餐', '装备与防磨检查', '前往起点', '存包与洗手间排队', '熟悉的热身', '入场与赛前补给', '起跑'],
  timelineNotes: [
    '选择训练时吃过的碳水早餐和饮水量，不临时尝试新品。',
    '检查号码布、计时芯片、鞋带和常用防磨用品。',
    '为封路、交通和走到起点的路程多留一些时间。',
    '存好赛后保暖衣物，并留出排队时间。',
    '按平时习惯慢跑和活动关节，不让热身造成额外疲劳。',
    '只使用练过的赛前补给，平静进入起跑区。',
    '前段控制强度，根据现场情况调整。',
  ],
  fuelingTitles: ['5 公里补给参考', '10 公里补给参考', '半马补给参考', '全马补给参考'],
  fuelingNotes: [
    '短距离比赛通常不需要途中吃胶，延续练过的早餐和饮水习惯即可。',
    '可按训练习惯选择赛前能量胶，完赛时间较长时再考虑途中补给，饮品以熟悉的为主。',
    '可从约 7 公里和 14 公里各一次补给开始安排，后程是否再补根据用时、每份碳水含量和训练经验决定。',
    '可参考每小时补充 40～60 克碳水，使用练过的产品和饮水方案，再按个人情况调整。',
  ],
  phaseNames: ['第一段：控制起跑', '第二段：稳定节奏', '第三段：按体感收尾'],
  phaseNotes: ['开头略慢于目标配速，不急于在人群中抢时间。', '稳定目标节奏，执行练过的补给计划。', '状态允许时逐渐加力，否则保持能持续的节奏。'],
  calendar: { race: '比赛日', breakfast: '比赛日早餐', shakeout: '赛前活动与装备检查', tuneup: '比赛配速练习' },
  invalid: '请输入有效的比赛距离、周跑量、目标用时和起跑时间。',
  disclaimer: '这是一份起始模板，并非个性化训练或营养处方。减量跑量不含比赛距离，请按平时习惯调整。',
};
