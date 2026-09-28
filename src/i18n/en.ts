export interface VDOTZoneI18n {
  name: string;
  shortName: string;
  description: string;
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
};
