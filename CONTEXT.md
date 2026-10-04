# Activity Distance Analysis

Distance analysis distinguishes recorded workout measurements from distances reconstructed from route coordinates. Agreement does not establish which measurement is accurate.

## Language

**Recorded workout total**:
The overall distance reported for an activity, distinct from the distance values attached to individual samples.
_Avoid_: True distance

**Recorded lap**:
A lap reported in the activity, with its own distance and time boundaries. Laps need not be one kilometer long or cover the entire workout.
_Avoid_: GPS kilometer split

**GPS distance**:
Distance calculated along the recorded coordinate sequence, either for the whole route or within a specified time interval.
_Avoid_: Ground-truth distance, raw satellite measurement

**Point distance counter**:
The cumulative distance attached to an individual activity sample. It may originate from a device or an exporter and need not agree with the workout total.
_Avoid_: Original watch distance

**Lap GPS coverage**:
The portions of a recorded lap's time interval supported by usable coordinate samples. Partial coverage cannot establish a full-lap distance difference.

**Lap-end checkpoint**:
The confirmed end of a recorded lap, where recorded lap distances and GPS distances over those same laps can be compared cumulatively. It does not establish the watch distance or distance difference at points inside a lap.
_Avoid_: Continuous watch distance
