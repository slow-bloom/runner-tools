import type { StrengthLocale } from './messages.js';
import type { StrengthExercise, StrengthWorkout } from './workout.js';

const exercises = {
  plank: { work: 45, en: ['Plank', 'Keep elbows under shoulders and brace your trunk without arching your lower back.'], zh: ['平板支撑', '手肘置于肩下，收紧核心与臀大肌，避免腰部塌陷'] },
  side_left: { work: 30, en: ['Side plank · left', 'Lift the hips and keep the spine neutral without rotating.'], zh: ['侧桥 · 左侧', '骨盆向上提顶，维持脊柱中立，避免躯干前后扭曲'] },
  side_right: { work: 30, en: ['Side plank · right', 'Lift the hips and keep the spine neutral without rotating.'], zh: ['侧桥 · 右侧', '骨盆向上提顶，维持脊柱中立，避免躯干前后扭曲'] },
  dead_bug: { reps: 12, en: ['Dead bug', 'Alternate sides; each extension counts as one rep toward the total. Keep the lower back against the floor while slowly extending opposite arm and leg.'], zh: ['死虫式', '左右交替，向一侧伸展算 1 次，两侧次数合计。下背部贴地，对侧手脚轻缓延展，控制核心'] },
  bird_dog: { reps: 12, en: ['Bird dog', 'Alternate sides; each extension counts as one rep toward the total. Extend opposite arm and leg while keeping the pelvis level.'], zh: ['鸟狗式', '左右交替，向一侧伸展算 1 次，两侧次数合计。伸展对侧手脚，骨盆保持水平，避免腰部旋转'] },
  russian_twist: { reps: 20, en: ['Russian twist', 'Count each turn as one rep toward the total, alternating sides. Sit tall with bent knees and turn the trunk with control.'], zh: ['俄罗斯转体', '左右交替，向一侧转动算 1 次，两侧次数合计。坐骨支撑，双膝微屈，核心带动胸腔缓慢转动'] },
  split_left: { reps: 10, en: ['Bulgarian split squat · left', 'Complete the target reps on the left leg. Support the rear foot and press through the front foot with control.'], zh: ['保加利亚分腿蹲 · 左腿', '目标次数均由左腿完成。后脚搭在稳固台阶上，前脚全掌蹬地，躯干微前倾'] },
  split_right: { reps: 10, en: ['Bulgarian split squat · right', 'Complete the target reps on the right leg. Support the rear foot and press through the front foot with control.'], zh: ['保加利亚分腿蹲 · 右腿', '目标次数均由右腿完成。后脚搭在稳固台阶上，前脚全掌蹬地，躯干微前倾'] },
  bridge_left: { reps: 12, en: ['Single-leg bridge · left', 'Complete the target reps on the left leg. Lift the right foot and press the left heel down to raise the pelvis.'], zh: ['单腿臀桥 · 左腿', '目标次数均由左腿完成。右脚离地，左脚跟下压地面，靠左臀顶起骨盆'] },
  bridge_right: { reps: 12, en: ['Single-leg bridge · right', 'Complete the target reps on the right leg. Lift the left foot and press the right heel down to raise the pelvis.'], zh: ['单腿臀桥 · 右腿', '目标次数均由右腿完成。左脚离地，右脚跟下压地面，靠右臀顶起骨盆'] },
  lunges: { reps: 16, en: ['Alternating walking lunge', 'Count each step as one rep toward the total, alternating sides. Step forward with control and lower the rear knee gently.'], zh: ['交替前进箭步蹲', '左右交替，每迈一步算 1 次，两侧次数合计。前膝沿脚尖方向移动，后膝轻缓下落'] },
  clamshell: { reps: 15, en: ['Side-lying clamshell', 'Complete the target reps on each side. Keep heels together and the pelvis still while opening the top knee.'], zh: ['侧卧蚌式开合', '两侧各完成目标次数。脚跟并拢，上侧膝盖向上打开，骨盆保持稳定'] },
  clamshell_left: { reps: 15, en: ['Side-lying clamshell · left', 'Complete the target reps on the left side. Lie on your right side, keep heels together, and open the left knee without rolling the pelvis back.'], zh: ['侧卧蚌式开合 · 左侧', '目标次数均由左侧完成。右侧卧，脚跟并拢，向上打开左膝，骨盆不要后倒'] },
  clamshell_right: { reps: 15, en: ['Side-lying clamshell · right', 'Complete the target reps on the right side. Lie on your left side, keep heels together, and open the right knee without rolling the pelvis back.'], zh: ['侧卧蚌式开合 · 右侧', '目标次数均由右侧完成。左侧卧，脚跟并拢，向上打开右膝，骨盆不要后倒'] },
  calf_raise: { reps: 12, en: ['Eccentric calf raise', 'Rise onto the forefoot and lower slowly over three seconds.'], zh: ['双腿离心提踵', '前脚掌踩在台阶边缘，踮起后用 3 秒缓慢下落'] },
  calf_left: { reps: 10, en: ['Single-leg calf raise · left', 'Complete the target reps on the left leg. Lower slowly; use a wall for balance.'], zh: ['单腿离心提踵 · 左腿', '目标次数均由左腿完成，控制缓慢下放，可扶墙保持平衡'] },
  calf_right: { reps: 10, en: ['Single-leg calf raise · right', 'Complete the target reps on the right leg. Lower slowly; use a wall for balance.'], zh: ['单腿离心提踵 · 右腿', '目标次数均由右腿完成，控制缓慢下放，可扶墙保持平衡'] },
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
    en: ['Runner core · 2-round circuit', 'Two rounds mixing timed holds and one rep-based set per movement in each round. Practice controlled trunk movement.'],
    zh: ['跑者核心 · 2 轮循环', '计时支撑与按次数动作搭配，每轮每个动作做 1 组，共 2 轮，练习躯干与骨盆控制'] },
  glute_legs: { prefix: 'g', rounds: 2, roundRest: 60, rest: 15,
    exercises: ['split_left', 'split_right', 'bridge_left', 'bridge_right', 'lunges', 'clamshell_left', 'clamshell_right'],
    en: ['Glutes and single-leg stability · 2-round circuit', 'One rep-based set per movement in each of two rounds. Practice controlled support and hip stability on both sides.'],
    zh: ['臀腿与单腿稳定性 · 2 轮循环', '每轮每个动作做 1 组，共 2 轮，留意左右两侧支撑时的稳定程度，练习臀腿控制与平衡'] },
  ankle_foot: { prefix: 'a', rounds: 2, roundRest: 45, rest: 15,
    exercises: ['calf_raise', 'calf_left', 'calf_right', 'soleus', 'hops'],
    en: ['Feet and ankles · 2-round circuit', 'Two rounds combining one set of reps per calf-raise movement with timed holds and light hops.'],
    zh: ['足踝与提踵 · 2 轮循环', '每轮各做 1 组提踵，搭配计时静蹲与轻跳，共 2 轮，留意足踝发力与落地体感'] },
  tabata: { prefix: 't', rounds: 2, roundRest: 30, rest: 10,
    exercises: ['squat_jump', 'high_knees', 'jumping_jacks', 'climber'],
    en: ['Tabata · 4-minute work/rest block', 'Follow eight 20-second efforts, with 10-second rests between exercises and a 30-second recovery between rounds.'],
    zh: ['经典 Tabata 燃脂唤醒 4 分钟', '完成 8 组 20 秒动作，动作间休息 10 秒，轮间改为休息 30 秒'] },
  stretch: { prefix: 's', rounds: 1, roundRest: 0, rest: 15,
    exercises: ['quad_left', 'quad_right', 'hamstring_left', 'hamstring_right', 'pigeon_left', 'pigeon_right', 'wall_left', 'wall_right'],
    en: ['Post-run stretching · 8-minute routine', 'Ease into comfortable stretches and notice areas that feel stiff.'],
    zh: ['跑后深层肌肉拉伸 8 分钟', '跑后在舒适幅度内慢慢拉伸，留意腿部紧绷与关节活动感受'] },
};

/** Returns editable copies; changing a builder never modifies future presets. */
export function getStrengthExerciseCatalog(locale: StrengthLocale = 'en'): Record<StrengthExerciseKey, StrengthExercise> {
  return Object.fromEntries(Object.entries(exercises).map(([id, exercise]) => [
    id, { id, name: exercise[locale][0], tip: exercise[locale][1],
      ...('reps' in exercise ? { mode: 'reps', sets: 1, reps: exercise.reps } : { work: exercise.work }),
      rest: ['squat_jump', 'high_knees', 'jumping_jacks', 'climber'].includes(id) ? 10 : 15 },
  ])) as Record<StrengthExerciseKey, StrengthExercise>;
}

export function getStrengthWorkoutPresets(locale: StrengthLocale = 'en'): Record<StrengthPresetKey, StrengthWorkout> {
  const catalog = getStrengthExerciseCatalog(locale);
  return Object.fromEntries(Object.entries(routines).map(([key, routine]) => [
    key, {
      name: routine[locale][0], description: routine[locale][1],
      rounds: routine.rounds, roundRest: routine.roundRest, prepTime: 5,
      exercises: routine.exercises.map((id, index) => ({
        ...catalog[id], id: routine.prefix + (index + 1),
        rest: index === routine.exercises.length - 1 ? 0 : routine.rest,
      })),
    },
  ])) as Record<StrengthPresetKey, StrengthWorkout>;
}
