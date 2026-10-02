export interface TrackAnalysisLocale {
  loading: string;
  failed: string;
  unsupported: string;
  noCoordinates: string;
  alignmentError: string;
  uploadOther: string;
  alignment: string;
  comparisonAlignment: string;
  autoAlignment: string;
  timeAlignment: string;
  progressAlignment: string;
  alignedTime: string;
  alignedProgress: string;
  noMatch: string;
  recorded: string;
  raw: string;
  time: string;
  points: string;
  rawPointsZoom: string;
  rawPointsVisible: string;
  rawPointsEmpty: string;
  progress: string;
  separation: string;
  delta: string;
  paceDelta: string;
  maxGap: string;
  interval: string;
  splitTitle: string;
  splitTime: string;
  splitProgress: string;
  splitSingle: string;
  summaryEstimate: string;
  gpsOnly: string;
  trackA: string;
  trackB: string;
  kilometer: string;
  finish: string;
  possibleDrift: string;
  diagnostics: {
    noReference: string;
    distanceClose: string;
    distanceDifferent: string;
    samplingUnknown: string;
    samplingDense: string;
    samplingSparse: string;
    samplingSimilar: string;
    samplingDifferent: string;
    pauseUnknown: string;
    pauseShort: string;
    pauseLong: string;
    pauseSimilar: string;
    pauseDifferent: string;
    elevationUnknown: string;
    elevationLow: string;
    elevationHigh: string;
    spatialUnknown: string;
    spatialClose: string;
    spatialDifferent: string;
  };
  units: { km: string; m: string; seconds: string; pace: string };
}

export const enTrackAnalysis: TrackAnalysisLocale = {
  loading: 'Reading and analyzing locally...',
  failed: 'This file could not be analyzed. Check the file or reload the page and try again.',
  unsupported: 'Choose a FIT, GPX or TCX file.',
  noCoordinates: 'This analysis needs at least two valid GPS points. Indoor or GPS-redacted records cannot be compared on the map.',
  alignmentError: 'These tracks have no overlapping timestamps. Choose automatic or route-progress alignment.',
  uploadOther: 'Track {track} is loaded. Add the other track to compare them.',
  alignment: 'Compare using',
  comparisonAlignment: 'Metrics, splits and diagnostics alignment',
  autoAlignment: 'Automatic (shared timestamps when available)',
  timeAlignment: 'Shared timestamps',
  progressAlignment: 'Relative route progress',
  alignedTime: 'Aligned by overlapping timestamps; gaps over 60 seconds are not interpolated.',
  alignedProgress: 'Aligned by relative route progress, not the same clock time. Separation can reflect pacing or route differences.',
  noMatch: 'No matched sample at this position.',
  recorded: 'Recorded distance',
  raw: 'Raw GPS distance',
  time: 'Time',
  points: 'points',
  rawPointsZoom: 'More than {limit} GPS points are in view. Zoom in to inspect individual GPS points. Only the route outline is shown; samples are not downsampled.',
  rawPointsVisible: 'Showing all {count} recorded GPS points in the visible map area. No downsampling.',
  rawPointsEmpty: 'No recorded GPS points in this view. Pan back to the route to inspect them.',
  progress: 'Progress',
  separation: 'Separation',
  delta: 'Difference',
  paceDelta: 'Pace difference',
  maxGap: 'Max sampled separation',
  interval: 'Average sampling interval',
  splitTitle: 'Kilometer split comparison',
  splitTime: 'Track A GPS milestones, interpolated against Track B at the same timestamps. Missing intervals remain unavailable.',
  splitProgress: 'Track A GPS milestones compared at equal relative route progress. Each full-row difference is the overall raw-distance ratio by construction, not measured local drift.',
  splitSingle: 'Recorded distance versus raw GPS at interpolated kilometer milestones.',
  summaryEstimate: 'Only a recorded total is available: per-split distance is a proportional estimate, not measured local drift.',
  gpsOnly: 'No independent recorded distance is available. GPS distance alone cannot establish device drift.',
  trackA: 'Track A',
  trackB: 'Track B',
  kilometer: 'Km {value}',
  finish: 'Finish',
  possibleDrift: 'Possible stationary GPS movement: {meters}; speed-spike candidates: {count}. These are indicators, not confirmed errors.',
  diagnostics: {
    noReference: 'No independent device-distance reference is available. This file cannot establish a recorded-versus-GPS discrepancy.',
    distanceClose: 'Recorded and raw GPS totals are close. Agreement does not independently establish GPS accuracy.',
    distanceDifferent: 'Recorded and raw GPS totals differ by more than 50 m. Sensor processing, missing samples and GPS noise can all contribute; the file alone cannot identify the cause.',
    samplingUnknown: 'Sampling interval is unavailable because there are too few valid timestamps.',
    samplingDense: 'Samples are relatively frequent. Frequency alone does not establish positional accuracy.',
    samplingSparse: 'Samples are relatively sparse. Straight lines between them may miss route bends.',
    samplingSimilar: 'Average sampling intervals are similar. The comparison interpolates onto a common set of samples.',
    samplingDifferent: 'Average sampling intervals differ by more than a factor of two. Interpolation avoids comparing mismatched point indexes.',
    pauseUnknown: 'Pause duration cannot be estimated without both elapsed and moving time.',
    pauseShort: 'Elapsed and moving time are close. This does not rule out stationary GPS movement.',
    pauseLong: 'Elapsed time exceeds moving time by over a minute. Inspect stops; a pause alone is not proof of ghost distance.',
    pauseSimilar: 'The elapsed-minus-moving time estimates are similar.',
    pauseDifferent: 'The elapsed-minus-moving estimates differ by over 30 seconds. Pause settings and recording gaps may contribute.',
    elevationUnknown: 'There are too few elevation samples to estimate ascent.',
    elevationLow: 'Smoothed elevation gain is modest. It does not establish whether the device applied a slope correction.',
    elevationHigh: 'Smoothed elevation gain exceeds 100 m. Elevation noise and real climbing can both contribute.',
    spatialUnknown: 'No positions could be matched across the available samples.',
    spatialClose: 'Matched samples are within 25 m. This is agreement between files, not a ground-truth accuracy measurement.',
    spatialDifferent: 'Some matched samples are over 25 m apart. Inspect the map and alignment mode before attributing this to GPS drift.',
  },
  units: { km: 'km', m: 'm', seconds: 's', pace: '/km' },
};

export const zhTrackAnalysis: TrackAnalysisLocale = {
  loading: '正在本机读取并分析…',
  failed: '文件未能完成分析，请检查文件，或刷新页面后重试。',
  unsupported: '请选择 FIT、GPX 或 TCX 文件。',
  noCoordinates: '至少需要两个有效 GPS 点。室内运动或已抹除坐标的记录无法进行地图比对。',
  alignmentError: '两条轨迹的时间范围没有交集，请选择自动对齐或按路线进度对齐。',
  uploadOther: '已载入轨迹 {track}，再添加另一份记录即可比对。',
  alignment: '对齐方式',
  comparisonAlignment: '指标、分段与诊断的对齐方式',
  autoAlignment: '自动（优先按共同时间戳）',
  timeAlignment: '共同时间戳',
  progressAlignment: '相对路线进度',
  alignedTime: '按重叠时间戳对齐；超过 60 秒的记录空缺不进行插值。',
  alignedProgress: '按相对路线进度对齐，并非同一时刻。点位间距也可能来自配速或路线差异。',
  noMatch: '此位置没有可配对的采样点。',
  recorded: '记录里程',
  raw: '原始 GPS 里程',
  time: '用时',
  points: '个点',
  rawPointsZoom: '当前视野内超过 {limit} 个 GPS 点，请放大地图查看原始点位。目前仅显示路线轮廓，未对采样点进行抽稀。',
  rawPointsVisible: '显示当前地图视野内的全部 {count} 个原始 GPS 点，未进行抽稀。',
  rawPointsEmpty: '当前视野内没有原始 GPS 点，请移回路线所在区域查看。',
  progress: '进度',
  separation: '点位间距',
  delta: '差值',
  paceDelta: '配速差',
  maxGap: '采样最大间距',
  interval: '平均采样间隔',
  splitTitle: '逐公里分段比对',
  splitTime: '按轨迹 A 的 GPS 公里节点插值，与轨迹 B 同一时刻比对；记录空缺不作估算。',
  splitProgress: '按轨迹 A 的 GPS 公里节点与相同路线进度比对。完整公里行的差值按总里程比例生成，并非测得的局部漂移。',
  splitSingle: '在插值后的公里节点，比对记录里程与原始 GPS 累加里程。',
  summaryEstimate: '文件仅提供汇总里程，分段数据为按比例分配的估算值，不能用于判断局部漂移。',
  gpsOnly: '文件没有独立记录的里程，仅凭 GPS 累加值无法确定设备漂移。',
  trackA: '轨迹 A',
  trackB: '轨迹 B',
  kilometer: '第 {value} 公里',
  finish: '终点',
  possibleDrift: '疑似静止时的 GPS 位移：{meters}；速度突变候选：{count} 处。这些只是线索，并非已确认的误差。',
  diagnostics: {
    noReference: '文件没有独立的设备里程，无法据此判断记录里程与 GPS 的偏差。',
    distanceClose: '记录里程与原始 GPS 累加值较接近，但二者一致不等于已经验证定位精度。',
    distanceDifferent: '记录里程与原始 GPS 累加值相差超过 50 米，可能与传感器处理、记录缺口或定位噪声有关，单凭文件无法确定原因。',
    samplingUnknown: '有效时间戳不足，无法计算采样间隔。',
    samplingDense: '采样相对密集，但采样频率本身不能证明定位准确。',
    samplingSparse: '采样相对稀疏，相邻点间的直线可能省略弯道路段。',
    samplingSimilar: '平均采样间隔相近，比对时仍会插值到共同采样位置。',
    samplingDifferent: '平均采样间隔相差超过两倍，已通过插值避免直接比较不对应的点序号。',
    pauseUnknown: '缺少总用时或移动用时，无法估算暂停时长。',
    pauseShort: '总用时与移动用时较接近，但不能据此排除静止时的 GPS 位移。',
    pauseLong: '总用时比移动用时多出一分钟以上，可重点查看停留路段；暂停本身并不能证明产生了幽灵里程。',
    pauseSimilar: '两份记录的总用时与移动用时之差较接近。',
    pauseDifferent: '两份记录的暂停估算相差超过 30 秒，可能与暂停设置或记录缺口有关。',
    elevationUnknown: '海拔点不足，无法估算累计爬升。',
    elevationLow: '平滑后的累计爬升较小，不能据此判断设备是否进行了坡度修正。',
    elevationHigh: '平滑后的累计爬升超过 100 米，真实爬坡与海拔噪声都可能影响结果。',
    spatialUnknown: '现有采样中没有可配对的点位。',
    spatialClose: '配对点位间距均在 25 米内，这是两份记录的一致程度，并非对真实定位精度的测量。',
    spatialDifferent: '部分配对点位间距超过 25 米，请结合地图和对齐方式查看，不宜直接归因于 GPS 漂移。',
  },
  units: { km: '公里', m: '米', seconds: '秒', pace: '/公里' },
};
