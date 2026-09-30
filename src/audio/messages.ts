import type { CadenceAudioErrorCode } from './shared.js';

interface CadenceAudioMessages {
  start: string;
  stop: string;
  rendering: string;
  download: string;
  errors: Record<CadenceAudioErrorCode, string>;
}

export const cadenceAudioMessages: Record<'en' | 'zh', CadenceAudioMessages> = {
  en: {
    start: 'Start Metronome', stop: 'Stop Metronome',
    rendering: 'Rendering Audio Track...', download: 'Generate & Download Metronome Track',
    errors: {
      invalidSettings: 'Choose 120–210 spm and one of the available sounds and accent patterns.',
      invalidTarget: 'Enter a pace from 3:00 to 15:59 and a height from 120 to 230 cm (47.25–90.55 in).',
      invalidTapTime: 'Tap again to start a new cadence measurement.',
      invalidDuration: 'Choose an audio duration of 1 to 900 seconds.',
      invalidQuality: 'Choose an available MP3 or WAV format.',
      invalidPcm: 'The audio data could not be encoded. Please try again.',
      audioUnavailable: 'Audio is unavailable in this browser. Try a browser with Web Audio support.',
      audioResumeFailed: 'Audio could not start. Check your browser audio permissions, then try again.',
      mp3Unavailable: 'The MP3 encoder is unavailable. Check your connection or choose WAV.',
      renderFailed: 'The audio track could not be generated. Try a shorter track or WAV.',
      aborted: 'Audio export cancelled.',
    },
  },
  zh: {
    start: '开启节拍器', stop: '停止节拍器',
    rendering: '正在生成音频文件…', download: '生成并下载节拍音频',
    errors: {
      invalidSettings: '请选择 120～210 步/分钟，以及列表中的音色和重音模式。',
      invalidTarget: '请输入 3:00 至 15:59 的配速，以及 120～230 厘米的身高。',
      invalidTapTime: '请重新敲击，开始一次步频测量。',
      invalidDuration: '请选择 1～900 秒的音频时长。',
      invalidQuality: '请选择列表中的 MP3 或 WAV 格式。',
      invalidPcm: '音频数据无法编码，请重试。',
      audioUnavailable: '当前浏览器无法播放音频，请使用支持网页音频的浏览器。',
      audioResumeFailed: '音频未能启动，请检查浏览器的声音权限后重试。',
      mp3Unavailable: 'MP3 编码器暂不可用，请检查网络连接，或改选 WAV 格式。',
      renderFailed: '音频生成失败，请缩短时长，或改选 WAV 格式后重试。',
      aborted: '已取消音频导出。',
    },
  },
};
