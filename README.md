# 🏃 Runner Tools

> Pure client-side exercise science algorithms, running pace formulas, and track utilities. Built for runners, coaches, and sports data hackers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)]()

---

## Live Demo

Experience these algorithms live in action on the web:
- **[VDOT & Training Pace Calculator (Live Web Demo)](https://apexrun.app/tools/vdot-calculator/)**
- **[VDOT 配速计算器 (中文在线版)](https://apexrun.app/zh/tools/vdot-calculator/)**

---

## Highlights

- **Pure & Zero Dependencies**: 100% pure TypeScript formulas with zero runtime dependencies. Runs anywhere: Node.js, browsers, Bun, Deno, Cloudflare Workers.
- **Scientifically Grounded**: Implements Daniels & Gilbert's oxygen consumption models, Riegel's endurance power laws, and Karvonen heart rate reserve frameworks.
- **Built-in i18n**: First-class multilingual support (`en`, `zh`), easily extendable to new languages.
- **100% Tested**: Rigorously benchmarked against standard racing and physiology datasets.

---

## Installation

```bash
# npm
npm install @slowbloom/runner-tools

# pnpm
pnpm add @slowbloom/runner-tools

# yarn
yarn add @slowbloom/runner-tools
```

Or directly via CDN in HTML:
```html
<script src="https://cdn.jsdelivr.net/npm/@slowbloom/runner-tools/dist/runner-tools.global.js"></script>
<script>
  const result = RunnerTools.calculateVDOT({ distanceMeters: 5000, timeSeconds: 1200 });
  console.log('VDOT:', result.vdotFormatted);
</script>
```

---

## Modules

### 1. VDOT & Training Paces (`vdot`)

Implements the classic **Jack Daniels' Running Formula** via the Daniels-Gilbert nonlinear equations.

#### Mathematical Foundation

1. **Oxygen Cost ($VO_2$) as a function of velocity ($v$, in meters/min):**
   $$VO_2 = -4.60 + 0.182258 \cdot v + 0.000104 \cdot v^2$$

2. **Fractional Utilization ($p$) sustainable over duration ($t$, in minutes):**
   $$p(t) = 0.80 + 0.1894393 \cdot e^{-0.012778 \cdot t} + 0.2989558 \cdot e^{-0.1932605 \cdot t}$$

3. **VDOT Score:**
   $$VDOT = \frac{VO_2(v)}{p(t)}$$

4. **Training Zones:**
   - **E (Easy)**: $57.76\% \sim 71.42\%$ VDOT
   - **M (Marathon)**: $78.64\% \sim 82.68\%$ VDOT
   - **T (Threshold)**: $85.03\% \sim 89.30\%$ VDOT
   - **I (Interval)**: $95.71\% \sim 100.51\%$ VDOT
   - **R (Repetition)**: $101.45\% \sim 104.32\%$ VDOT

#### Usage

```typescript
import { calculateVDOT } from '@slowbloom/runner-tools';

// Calculate from a 5K race in 20 minutes (1200 seconds)
const res = calculateVDOT({
  distanceMeters: 5000,
  timeSeconds: 1200,
  unit: 'km', // 'km' or 'mi'
  lang: 'en', // 'en' or 'zh'
});

console.log('VDOT:', res.vdotFormatted); // "49.8"
console.log('Easy Pace:', `${res.zones.E.lowPaceFormatted} - ${res.zones.E.highPaceFormatted} /km`);
// e.g. "5'05" - 5'41" /km"

console.log('Predicted Marathon Time:', res.equivalentPerformances.find(p => p.distanceMeters === 42195)?.timeFormatted);
// e.g. "3:13:42"
```

---

## Roadmap

- [x] Jack Daniels VDOT & Training Paces Engine
- [ ] Riegel Race Performance Predictor
- [ ] Karvonen Heart Rate Reserve Zones
- [ ] Age-Graded Scoring (WMA Tables)
- [ ] Running Efficiency & Heart Rate Decoupling (EF / Pw:Hr)
- [ ] Browser-based FIT / GPX / TCX Parser & Converter (Zero Server Uploads)
- [ ] GPS Drift & Ghost Mileage Analyzer

---

## Contributing

Contributions, bug reports, and discussions regarding endurance sports algorithms are warmly welcomed! Please feel free to submit a pull request or open an issue.

---

## License

[MIT License](./LICENSE) © 2026 Slowbloom Studio
