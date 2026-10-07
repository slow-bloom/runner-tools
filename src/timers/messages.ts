import type { StrengthTimerErrorCode } from './workout.js';

export type StrengthLocale = 'en' | 'zh';
export type StrengthStageType = 'prep' | 'work' | 'rest' | 'round_rest' | 'done';

interface StrengthMessages {
  phases: Record<StrengthStageType, string>;
  prepName: string;
  prepTip: string;
  restName: string;
  restTip(nextName: string): string;
  roundRestName(round: number): string;
  roundRestTip(nextRound: number): string;
  doneName: string;
  doneTip: string;
  errors: Record<StrengthTimerErrorCode, string>;
}

export const strengthTimerMessages: Record<StrengthLocale, StrengthMessages> = {
  en: {
    phases: { prep: 'Get ready', work: 'Work', rest: 'Recovery', round_rest: 'Round recovery', done: 'Workout complete' },
    prepName: 'Get ready', prepTip: 'Set up for the first exercise.',
    restName: 'Recovery', restTip: next => `Breathe and relax. Next: ${next}`,
    roundRestName: round => `Round ${round} complete — recovery`,
    roundRestTip: next => `Take a drink and prepare for round ${next}.`,
    doneName: 'Workout complete!', doneTip: 'Take a moment to cool down and note how you feel.',
    errors: {
      invalidJson: 'The file is not valid JSON. Choose a saved workout JSON file.',
      invalidWorkout: 'The workout contains missing or invalid text fields. Keep names within 200 characters and tips within 1,000.',
      invalidExercise: 'Keep at least one exercise, with a name and numeric work/rest durations.',
      invalidDuration: 'Use whole seconds: preparation 3–30, work 5–600, and recovery 0–300.',
      invalidRounds: 'Choose a whole number of rounds from 1 to 10.',
      unsupportedVersion: 'This workout version is not supported. Use a version 1.0 export.',
      tooLarge: 'Use a JSON file no larger than 1 MiB and a workout with at most 100 exercises.',
      invalidMetadata: 'The workout export metadata is invalid.',
      invalidClock: 'The timer clock moved backwards or is invalid. Restart the workout.',
      invalidAction: 'This timer action is not supported.',
      audioUnavailable: 'Audio is unavailable. The visual timer still works.',
      audioResumeFailed: 'Sound is paused by the browser. Tap Enable / test sound to retry; the visual timer keeps running.',
      cueFailed: 'A sound or voice cue could not play. Tap Enable / test sound to retry; the visual timer keeps running.',
    },
  },
  zh: {
    phases: { prep: '准备', work: '训练中', rest: '间歇休息', round_rest: '轮间休息', done: '训练完成' },
    prepName: '准备倒计时', prepTip: '调整姿势，做好第一组动作准备',
    restName: '间歇休息', restTip: next => `调整呼吸 · 准备：${next}`,
    roundRestName: round => `第 ${round} 轮完成 · 轮间休息`,
    roundRestTip: next => `补充水分，深长呼吸 · 准备第 ${next} 轮`,
    doneName: '🎉 训练完成！', doneTip: '今天的核心与力量课已完成，放松一下，记录此刻的体感',
    errors: {
      invalidJson: '文件不是有效的 JSON，请选择之前保存的课表文件。',
      invalidWorkout: '课表的文字字段缺失或格式不正确。名称最多 200 字，动作提示最多 1000 字。',
      invalidExercise: '请至少保留 1 个动作，并填写名称、训练秒数和休息秒数。',
      invalidDuration: '秒数须为整数：准备 3～30 秒、训练 5～600 秒、休息 0～300 秒。',
      invalidRounds: '循环轮次须为 1～10 的整数。',
      unsupportedVersion: '暂不支持这个课表版本，请使用 1.0 版课表文件。',
      tooLarge: '课表文件不能超过 1 兆字节，动作数量不能超过 100 个。',
      invalidMetadata: '课表的导出信息格式不正确。',
      invalidClock: '计时器时钟异常，请重新开始训练。',
      invalidAction: '暂不支持这个计时操作。',
      audioUnavailable: '当前浏览器无法播放提示音，画面计时仍可正常使用。',
      audioResumeFailed: '浏览器暂停了声音，请点「开启 / 试听声音」重试。画面计时仍在继续。',
      cueFailed: '提示音未能播放，请点「开启 / 试听声音」重试。画面计时仍在继续。',
    },
  },
};
