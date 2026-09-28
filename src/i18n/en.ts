export interface VDOTZoneI18n {
  name: string;
  shortName: string;
  description: string;
}

export interface HeartRateZoneI18n {
  name: string;
  category: string;
  description: string;
}

export interface HeartRateMethodInfoI18n {
  title: string;
  description: string;
}

export interface AgeGradingLevelsI18n {
  worldClass: string;
  nationalClass: string;
  regionalClass: string;
  localClass: string;
  activeRunner: string;
  recreationalRunner: string;
}

export interface AgeGradingI18n {
  levels: AgeGradingLevelsI18n;
  errors: {
    ageOutOfRange: string;
    invalidTime: string;
    standardNotFound: string;
  };
}

export interface RunningEfficiencyI18n {
  verticalRatio: {
    elite: { label: string; desc: string };
    advanced: { label: string; desc: string };
    average: { label: string; desc: string };
    needsImprovement: { label: string; desc: string };
  };
  dutyFactor: {
    elite: string;
    advanced: string;
    recreational: string;
  };
  efficiencyFactor: {
    developing: string;
    solid: string;
    advanced: string;
    elite: string;
    unitLabel: string;
    metersPerBeat: string;
  };
  speed: {
    metersPerSec: string;
    kmPerHour: string;
  };
}

export interface RunnerToolsLocale {
  locale: string;
  vdot: {
    zones: {
      E: VDOTZoneI18n;
      M: VDOTZoneI18n;
      T: VDOTZoneI18n;
      I: VDOTZoneI18n;
      R: VDOTZoneI18n;
    };
    standardDistances: {
      k5: string;
      k10: string;
      halfMarathon: string;
      marathon: string;
    };
    units: {
      km: string;
      mi: string;
      paceKm: string;
      paceMi: string;
    };
  };
  racePredictor: {
    distances: {
      k5: string;
      k10: string;
      halfMarathon: string;
      marathon: string;
    };
    exponents: {
      elite: string;
      recreational: string;
      beginner: string;
    };
  };
  heartRateZones: {
    zones: {
      z1: HeartRateZoneI18n;
      z2: HeartRateZoneI18n;
      z3: HeartRateZoneI18n;
      z4: HeartRateZoneI18n;
      z5: HeartRateZoneI18n;
    };
    basis: {
      maxhr: string;
      karvonen: string;
      lthr: string;
    };
    methods: {
      maxhr: HeartRateMethodInfoI18n;
      karvonen: HeartRateMethodInfoI18n;
      lthr: HeartRateMethodInfoI18n;
    };
  };
  ageGrading: AgeGradingI18n;
  runningEfficiency: RunningEfficiencyI18n;
  pace: {
    units: {
      minPerKm: string;
      minPerMi: string;
      kmPerHour: string;
      milesPerHour: string;
      metersPerSec: string;
      km: string;
      mi: string;
    };
    labels: {
      distance: string;
      pace: string;
      time: string;
      finishTime: string;
      speed: string;
      targetPace: string;
    };
    distances: {
      k5: string;
      k10: string;
      halfMarathon: string;
      marathon: string;
    };
  };
  weeklyMileage: {
    units: {
      km: string;
      mi: string;
    };
    status: {
      base: string;
      build: string;
      deload: string;
      target: string;
    };
    labels: {
      week: string;
      weeks: string;
      distance: string;
      status: string;
      change: string;
    };
  };
}

export const enLocale: RunnerToolsLocale = {
  locale: 'en',
  vdot: {
    zones: {
      E: {
        name: 'Easy Pace (E)',
        shortName: 'Easy',
        description: 'Builds aerobic base and promotes recovery.',
      },
      M: {
        name: 'Marathon Pace (M)',
        shortName: 'Marathon',
        description: 'Develops cardiovascular endurance and race-pace confidence.',
      },
      T: {
        name: 'Threshold Pace (T)',
        shortName: 'Threshold',
        description: 'Comfortably hard effort. Improves lactate clearance capacity.',
      },
      I: {
        name: 'Interval Pace (I)',
        shortName: 'Interval',
        description: 'Hard effort. Direct stimulus to expand aerobic capacity (VO₂ Max).',
      },
      R: {
        name: 'Repetition Pace (R)',
        shortName: 'Repetition',
        description: 'Very fast speed repeats. Improves running economy and speed mechanics.',
      },
    },
    standardDistances: {
      k5: '5K',
      k10: '10K',
      halfMarathon: 'Half Marathon',
      marathon: 'Marathon',
    },
    units: {
      km: 'km',
      mi: 'mi',
      paceKm: '/km',
      paceMi: '/mi',
    },
  },
  racePredictor: {
    distances: {
      k5: '5K',
      k10: '10K',
      halfMarathon: 'Half Marathon',
      marathon: 'Marathon',
    },
    exponents: {
      elite: '1.06 - Riegel Standard (High aerobic endurance / Elite)',
      recreational: '1.08 - Recreational Runner (Moderate mileage)',
      beginner: '1.10 - Beginner / Low Mileage (<30 km/week)',
    },
  },
  heartRateZones: {
    zones: {
      z1: {
        name: 'Zone 1',
        category: 'Recovery',
        description: 'Warms up and aids recovery.',
      },
      z2: {
        name: 'Zone 2',
        category: 'Easy / Aerobic',
        description: 'Improves basic endurance and burns fat.',
      },
      z3: {
        name: 'Zone 3',
        category: 'Tempo',
        description: 'Improves aerobic fitness and blood circulation.',
      },
      z4: {
        name: 'Zone 4',
        category: 'Threshold',
        description: 'Increases maximum performance capacity.',
      },
      z5: {
        name: 'Zone 5',
        category: 'Maximum',
        description: 'Develops maximum performance and speed.',
      },
    },
    basis: {
      maxhr: 'of Max HR',
      karvonen: 'of HRR',
      lthr: 'of LTHR',
    },
    methods: {
      maxhr: {
        title: 'Max HR Inputs',
        description: 'Enter your details to calculate zones based on Max HR percentages.',
      },
      karvonen: {
        title: 'Karvonen Inputs',
        description: 'Enter Max HR and Resting HR to compute Heart Rate Reserve (HRR) zones.',
      },
      lthr: {
        title: 'LTHR Inputs',
        description: 'Enter your Lactate Threshold Heart Rate (LTHR) to calculate Joe Friel running zones.',
      },
    },
  },
  ageGrading: {
    levels: {
      worldClass: 'World Class',
      nationalClass: 'National Class',
      regionalClass: 'Regional Class',
      localClass: 'Local Class',
      activeRunner: 'Active Runner',
      recreationalRunner: 'Recreational Runner',
    },
    errors: {
      ageOutOfRange: 'Age must be between 5 and 100.',
      invalidTime: 'Please enter a valid finish time.',
      standardNotFound: 'Age standard not found for this age and distance.',
    },
  },
  runningEfficiency: {
    verticalRatio: {
      elite: {
        label: 'Elite (< 6.0%)',
        desc: 'Exceptional efficiency. Almost zero wasted upward vertical bounce.',
      },
      advanced: {
        label: 'Good / Advanced (6.0% – 8.0%)',
        desc: 'Very economical stride. Typical of well-conditioned distance runners.',
      },
      average: {
        label: 'Average (8.1% – 10.0%)',
        desc: 'Moderate energy leak. Nudging cadence upward 5 spm can tighten your bounce.',
      },
      needsImprovement: {
        label: 'Needs Improvement (> 10.0%)',
        desc: 'Excessive vertical bounce or short overstriding. Wasting forward drive.',
      },
    },
    dutyFactor: {
      elite: 'Elite Elastic Recoil (< 30%)',
      advanced: 'Advanced Flight Phase (30% – 39%)',
      recreational: 'Recreational Level (40% – 50%)',
    },
    efficiencyFactor: {
      developing: 'Developing Base (< 1.10)',
      solid: 'Solid Aerobic Base (1.10 – 1.35)',
      advanced: 'Advanced Aerobic Engine (1.36 – 1.60)',
      elite: 'Elite Aerobic Capacity (> 1.60)',
      unitLabel: 'm/beat',
      metersPerBeat: 'meters per heartbeat',
    },
    speed: {
      metersPerSec: 'm/s',
      kmPerHour: 'km/h',
    },
  },
  pace: {
    units: {
      minPerKm: 'min/km',
      minPerMi: 'min/mi',
      kmPerHour: 'km/h',
      milesPerHour: 'mph',
      metersPerSec: 'm/s',
      km: 'km',
      mi: 'mi',
    },
    labels: {
      distance: 'Distance',
      pace: 'Pace',
      time: 'Time',
      finishTime: 'Finish Time',
      speed: 'Speed',
      targetPace: 'Target Pace',
    },
    distances: {
      k5: '5K',
      k10: '10K',
      halfMarathon: 'Half Marathon',
      marathon: 'Marathon',
    },
  },
  weeklyMileage: {
    units: {
      km: 'km',
      mi: 'mi',
    },
    status: {
      base: 'Baseline',
      build: 'Build',
      deload: 'Recovery Deload',
      target: 'Target Achieved',
    },
    labels: {
      week: 'Week',
      weeks: 'Weeks',
      distance: 'Weekly Distance',
      status: 'Status',
      change: 'Change',
    },
  },
};
