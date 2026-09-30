import type { StrengthLocale } from './messages.js';
import type { StrengthExercise, StrengthWorkout } from './workout.js';

const exercises = {
  plank: { work: 45, en: ['Plank', 'Keep elbows under shoulders and brace your trunk without arching your lower back.'], zh: ['平板支撑', '手肘置于肩下，收紧核心与臀大肌，避免腰部塌陷'] },
  side_left: { work: 30, en: ['Side plank · left', 'Lift the hips and keep the spine neutral without rotating.'], zh: ['侧桥 · 左侧', '骨盆向上提顶，维持脊柱中立，避免躯干前后扭曲'] },
  side_right: { work: 30, en: ['Side plank · right', 'Lift the hips and keep the spine neutral without rotating.'], zh: ['侧桥 · 右侧', '骨盆向上提顶，维持脊柱中立，避免躯干前后扭曲'] },
  dead_bug: { work: 40, en: ['Dead bug', 'Keep the lower back against the floor while slowly extending opposite arm and leg.'], zh: ['死虫式', '下背部完全压平地面，对侧手脚轻缓延展，控制核心'] },
  bird_dog: { work: 40, en: ['Bird dog', 'Extend opposite arm and leg while keeping the pelvis level.'], zh: ['鸟狗式', '手足对侧伸展，避免腰椎旋转，感受臀部与后背收缩'] },
  russian_twist: { work: 35, en: ['Russian twist', 'Sit tall with bent knees and turn the trunk with control.'], zh: ['俄罗斯转体', '坐骨支撑，双膝微屈，核心发力带动胸腔左右均匀转动'] },
  split_left: { work: 40, en: ['Bulgarian split squat · left', 'Support the rear foot and press through the front foot with control.'], zh: ['保加利亚分腿蹲 · 左腿', '后脚搭在沙发或台阶上，前脚全掌蹬地，躯干微前倾'] },
  split_right: { work: 40, en: ['Bulgarian split squat · right', 'Support the rear foot and press through the front foot with control.'], zh: ['保加利亚分腿蹲 · 右腿', '后脚搭在沙发或台阶上，前脚全掌蹬地，躯干微前倾'] },
  bridge_left: { work: 35, en: ['Single-leg bridge · left', 'Lift the right foot and press the left heel down to raise the pelvis.'], zh: ['单腿臀桥 · 左腿', '右脚离地伸直，左脚跟下压地面，靠左臀顶起骨盆'] },
  bridge_right: { work: 35, en: ['Single-leg bridge · right', 'Lift the left foot and press the right heel down to raise the pelvis.'], zh: ['单腿臀桥 · 右腿', '左脚离地伸直，右脚跟下压地面，靠右臀顶起骨盆'] },
  lunges: { work: 45, en: ['Alternating walking lunge', 'Step forward with control and lower the rear knee gently.'], zh: ['交替前进箭步蹲', '大步向前迈出，前膝沿脚尖方向移动，后膝轻缓下落'] },
  clamshell: { work: 35, en: ['Side-lying clamshell', 'Keep heels together and the pelvis still while opening the top knee.'], zh: ['侧卧蚌式开合', '脚跟并拢，膝盖外展向上，骨盆保持稳定'] },
  calf_raise: { work: 40, en: ['Eccentric calf raise', 'Rise onto the forefoot and lower slowly over three seconds.'], zh: ['双腿离心提踵', '前脚掌踩在台阶边缘，踮起后用 3 秒缓慢下落'] },
  calf_left: { work: 35, en: ['Single-leg calf raise · left', 'Lower slowly on the left leg; use a wall for balance.'], zh: ['单腿离心提踵 · 左腿', '左腿控制缓慢下放，可扶墙保持平衡'] },
  calf_right: { work: 35, en: ['Single-leg calf raise · right', 'Lower slowly on the right leg; use a wall for balance.'], zh: ['单腿离心提踵 · 右腿', '右腿控制缓慢下放，可扶墙保持平衡'] },
  soleus: { work: 45, en: ['Bent-knee wall hold', 'Support your back against the wall and slightly lift the heels.'], zh: ['比目鱼肌靠墙静蹲', '屈膝靠墙背贴平，脚跟微抬 2 厘米，保持呼吸'] },
  balance: { work: 35, en: ['Single-leg balance with knee lift', 'Keep the standing foot steady while lifting the opposite knee.'], zh: ['单腿平衡提膝', '足底三点踩稳，对侧提膝，保持身体平衡'] },
  hops: { work: 30, en: ['Small forefoot hops', 'Use small, controlled hops with soft knees.'], zh: ['前掌弹性小跳', '双膝微曲，前脚掌轻快回弹，控制跳跃幅度'] },
  squat_jump: { work: 20, en: ['Bodyweight squat jump', 'Squat within a comfortable range and land softly.'], zh: ['徒手深蹲跳', '在舒适幅度内下蹲，轻快跃起，落地保持缓冲'] },
  high_knees: { work: 20, en: ['High knees', 'Lift alternating knees and keep the arm swing compact.'], zh: ['高抬腿原地跑', '交替提膝，手臂紧凑有力前后摆动'] },
  jumping_jacks: { work: 20, en: ['Jumping jacks', 'Jump the feet apart and together while moving the arms overhead.'], zh: ['开合跳', '双脚前掌轻盈跳开并拢，双臂在头顶顺畅合掌'] },
  climber: { work: 20, en: ['Mountain climber', 'Hold a stable plank while alternating knee drives.'], zh: ['俯卧登山者', '保持俯卧撑姿势，双膝交替向胸口提拉'] },
  quad_left: { work: 45, en: ['Standing quadriceps stretch · left', 'Use a wall for balance and gently bring the left heel toward the hip.'], zh: ['股四头肌站姿拉伸 · 左侧', '一手扶墙，左手轻拉左脚踝靠近臀部，双膝靠拢直立'] },
  quad_right: { work: 45, en: ['Standing quadriceps stretch · right', 'Use a wall for balance and gently bring the right heel toward the hip.'], zh: ['股四头肌站姿拉伸 · 右侧', '一手扶墙，右手轻拉右脚踝靠近臀部，双膝靠拢直立'] },
  hamstring_left: { work: 45, en: ['Hamstring stretch · left', 'Place the left heel forward and hinge gently at the hips.'], zh: ['腘绳肌大腿后侧拉伸 · 左侧', '左脚前伸脚跟着地，脊柱平直微屈右腿，臀部向后坐'] },
  hamstring_right: { work: 45, en: ['Hamstring stretch · right', 'Place the right heel forward and hinge gently at the hips.'], zh: ['腘绳肌大腿后侧拉伸 · 右侧', '右脚前伸脚跟着地，脊柱平直微屈左腿，臀部向后坐'] },
  pigeon_left: { work: 45, en: ['Pigeon stretch · left', 'Support the left leg in front and ease into a comfortable hip stretch.'], zh: ['臀肌与髂胫束鸽子式 · 左侧', '左小腿放于身前垫上，右腿向后平伸，在舒适范围内下压'] },
  pigeon_right: { work: 45, en: ['Pigeon stretch · right', 'Support the right leg in front and ease into a comfortable hip stretch.'], zh: ['臀肌与髂胫束鸽子式 · 右侧', '右小腿放于身前垫上，左腿向后平伸，在舒适范围内下压'] },
  wall_left: { work: 45, en: ['Wall calf stretch · left', 'Keep the left heel down behind you and gently lean toward the wall.'], zh: ['腓肠肌与比目鱼肌推墙拉伸 · 左侧', '双手推墙，左腿后迈，脚跟踩实地面，感受小腿轻度牵拉'] },
  wall_right: { work: 45, en: ['Wall calf stretch · right', 'Keep the right heel down behind you and gently lean toward the wall.'], zh: ['腓肠肌与比目鱼肌推墙拉伸 · 右侧', '双手推墙，右腿后迈，脚跟踩实地面，感受小腿轻度牵拉'] },
} as const;

export type StrengthExerciseKey = keyof typeof exercises;
export type StrengthPresetKey = 'core' | 'glute_legs' | 'ankle_foot' | 'tabata' | 'stretch';

const routines: Record<StrengthPresetKey, {
  prefix: string; rounds: number; roundRest: number; rest: number;
  exercises: readonly StrengthExerciseKey[]; en: readonly [string, string]; zh: readonly [string, string];
}> = {
  core: { prefix: 'e', rounds: 2, roundRest: 60, rest: 15,
    exercises: ['plank', 'side_left', 'side_right', 'dead_bug', 'bird_dog', 'russian_twist'],
    en: ['Runner core · 10-minute routine', 'Practice trunk control and notice how your posture feels as you tire.'],
    zh: ['跑者黄金核心 10 分钟', '留意疲劳时的躯干与骨盆位置，练习核心控制与抗旋转动作'] },
  glute_legs: { prefix: 'g', rounds: 2, roundRest: 60, rest: 15,
    exercises: ['split_left', 'split_right', 'bridge_left', 'bridge_right', 'lunges', 'clamshell'],
    en: ['Glutes and single-leg stability · 12-minute routine', 'Practice controlled single-leg support and hip stability.'],
    zh: ['臀腿与单腿稳定性 12 分钟', '感受单腿支撑时的稳定程度，练习臀腿控制与平衡'] },
  ankle_foot: { prefix: 'a', rounds: 2, roundRest: 45, rest: 15,
    exercises: ['calf_raise', 'calf_left', 'calf_right', 'soleus', 'hops'],
    en: ['Feet and ankles · 8-minute routine', 'Practice controlled calf raises and light, comfortable landings.'],
    zh: ['足踝刚度与跟腱激活 8 分钟', '留意足踝发力与落地体感，练习提踵控制和轻快回弹'] },
  tabata: { prefix: 't', rounds: 2, roundRest: 30, rest: 10,
    exercises: ['squat_jump', 'high_knees', 'jumping_jacks', 'climber'],
    en: ['Tabata · 4-minute work/rest block', 'Follow eight 20-second efforts with 10-second recoveries, plus preparation and round recovery.'],
    zh: ['经典 Tabata 燃脂唤醒 4 分钟', '跟随 20 秒训练、10 秒休息完成 8 组动作，另含准备与轮间休息'] },
  stretch: { prefix: 's', rounds: 1, roundRest: 0, rest: 15,
    exercises: ['quad_left', 'quad_right', 'hamstring_left', 'hamstring_right', 'pigeon_left', 'pigeon_right', 'wall_left', 'wall_right'],
    en: ['Post-run stretching · 8-minute routine', 'Ease into comfortable stretches and notice areas that feel stiff.'],
    zh: ['跑后深层肌肉拉伸 8 分钟', '跑后在舒适幅度内慢慢拉伸，留意腿部紧绷与关节活动感受'] },
};

/** Returns editable copies; changing a builder never modifies future presets. */
export function getStrengthExerciseCatalog(locale: StrengthLocale = 'en'): Record<StrengthExerciseKey, StrengthExercise> {
  return Object.fromEntries(Object.entries(exercises).map(([id, exercise]) => [
    id, { id, name: exercise[locale][0], tip: exercise[locale][1], work: exercise.work,
      rest: ['squat_jump', 'high_knees', 'jumping_jacks', 'climber'].includes(id) ? 10 : 15 },
  ])) as Record<StrengthExerciseKey, StrengthExercise>;
}

export function getStrengthWorkoutPresets(locale: StrengthLocale = 'en'): Record<StrengthPresetKey, StrengthWorkout> {
  const catalog = getStrengthExerciseCatalog(locale);
  return Object.fromEntries(Object.entries(routines).map(([key, routine]) => [
    key, {
      name: routine[locale][0], description: routine[locale][1],
      rounds: routine.rounds, roundRest: routine.roundRest, prepTime: 5,
      exercises: routine.exercises.map((id, index) => ({ ...catalog[id], id: routine.prefix + (index + 1), rest: routine.rest })),
    },
  ])) as Record<StrengthPresetKey, StrengthWorkout>;
}
