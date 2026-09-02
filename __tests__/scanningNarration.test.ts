// __tests__/scanningNarration.test.ts
import { getScanProgress, getScanStage } from '../src/lib/scanningNarration';

describe('scanningNarration', () => {
  describe('receipt scanning', () => {
    it('returns the initial stage at 0s', () => {
      const stageEn = getScanStage('receipt', 0, false);
      expect(stageEn.expr).toBe('think');
      expect(stageEn.idea).toBe(false);
      expect(stageEn.text).toBe('Scanning store name, date & layout…');
      expect(stageEn.progress).toBe(15);

      const stageZh = getScanStage('receipt', 0, true);
      expect(stageZh.text).toBe('正在识别商家名称、日期与排版…');
      expect(stageZh.progress).toBe(15);
    });

    it('progresses to line items stage around 4s', () => {
      const stageEn = getScanStage('receipt', 4, false);
      expect(stageEn.expr).toBe('think');
      expect(stageEn.idea).toBe(false);
      expect(stageEn.text).toBe('Reading every item and price line by line…');
      expect(stageEn.progress).toBeGreaterThanOrEqual(40);

      const stageZh = getScanStage('receipt', 4, true);
      expect(stageZh.text).toBe('正在逐行提取商品明细与单价…');
    });

    it('progresses to curious taxes & discount stage around 7s', () => {
      const stageEn = getScanStage('receipt', 7, false);
      expect(stageEn.expr).toBe('curious');
      expect(stageEn.idea).toBe(false);
      expect(stageEn.text).toBe('Checking for service charge, taxes & discounts…');
      expect(stageEn.progress).toBeGreaterThanOrEqual(65);
    });

    it('activates idea bulb during double-checking math stage around 10s', () => {
      const stageEn = getScanStage('receipt', 10, false);
      expect(stageEn.expr).toBe('think');
      expect(stageEn.idea).toBe(true);
      expect(stageEn.text).toBe("Pip is double-checking the math so you don't have to…");
      expect(stageEn.progress).toBeGreaterThanOrEqual(85);

      const stageZh = getScanStage('receipt', 10, true);
      expect(stageZh.text).toBe('Pip 正在仔细复核金额，省去您的心算功夫…');
    });

    it('includes live seconds in late stage (13s+)', () => {
      const stageEn = getScanStage('receipt', 15, false);
      expect(stageEn.expr).toBe('curious');
      expect(stageEn.idea).toBe(true);
      expect(stageEn.text).toBe('Deciphering small print… almost there! (15s)');
      expect(stageEn.progress).toBeGreaterThanOrEqual(95);

      const stageZh = getScanStage('receipt', 15, true);
      expect(stageZh.text).toBe('正在解析小字与格式… 马上就好！（已用时 15 秒）');
    });
  });

  describe('statement / e-wallet scanning', () => {
    it('provides distinct stages tailored to statement & transaction lists', () => {
      const s0 = getScanStage('statement', 1, false);
      expect(s0.text).toBe('Scanning transaction lines and amounts…');
      expect(s0.progress).toBeGreaterThanOrEqual(15);

      const s4 = getScanStage('statement', 4, false);
      expect(s4.text).toBe('Identifying merchants and payment methods…');

      const s7 = getScanStage('statement', 7, false);
      expect(s7.text).toBe('Matching with your learned spending categories…');

      const s10 = getScanStage('statement', 10, false);
      expect(s10.text).toBe('Pip is organizing everything into clean rows…');
      expect(s10.idea).toBe(true);
      expect(s10.progress).toBeGreaterThanOrEqual(85);

      const s18 = getScanStage('statement', 18, false);
      expect(s18.text).toBe('Wrapping up the details… almost ready! (18s)');
      expect(s18.idea).toBe(true);
      expect(s18.progress).toBeGreaterThanOrEqual(95);
    });
  });

  describe('balance screenshot scanning', () => {
    it('provides balance and account recognition stages', () => {
      const s0 = getScanStage('balance', 0, false);
      expect(s0.text).toBe('Reading account and provider details…');
      expect(s0.progress).toBe(15);

      const s4 = getScanStage('balance', 4, false);
      expect(s4.text).toBe('Detecting balances, currencies and assets…');

      const s7 = getScanStage('balance', 7, false);
      expect(s7.text).toBe('Pip is matching against your existing accounts…');
      expect(s7.idea).toBe(true);

      const s12 = getScanStage('balance', 12, false);
      expect(s12.text).toBe('Finalizing the balance snapshot… (12s)');
      expect(s12.progress).toBeGreaterThanOrEqual(90);
    });
  });

  describe('getScanProgress calculation', () => {
    it('provides expected progress percentages across time milestones', () => {
      expect(getScanProgress(0)).toBe(15);
      expect(getScanProgress(3)).toBe(40);
      expect(getScanProgress(6)).toBe(65);
      expect(getScanProgress(9)).toBe(85);
      expect(getScanProgress(13)).toBe(95);
    });

    it('monotonically increases with elapsed seconds', () => {
      let prev = getScanProgress(0);
      for (let sec = 1; sec <= 25; sec++) {
        const curr = getScanProgress(sec);
        expect(curr).toBeGreaterThanOrEqual(prev);
        prev = curr;
      }
    });

    it('stays strictly bounded within [0, 99]', () => {
      expect(getScanProgress(0)).toBeGreaterThanOrEqual(0);
      expect(getScanProgress(100)).toBeLessThanOrEqual(99);
      expect(getScanProgress(-5)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('handles negative or invalid elapsed seconds safely', () => {
      const stage = getScanStage('receipt', -5, false);
      expect(stage.expr).toBe('think');
      expect(stage.text).toBe('Scanning store name, date & layout…');
      expect(stage.progress).toBe(15);
    });
  });
});
