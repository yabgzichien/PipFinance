import { composeWidgetPreview } from '../src/widget/mascot/previewCompose';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';
import { QuickRecordWidget } from '../src/widget/QuickRecordWidget';

const cfg = (over = {}) => ({ ...DEFAULT_WIDGET_MASCOT_CONFIG, ...over });

describe('scratch inspection', () => {
  it('inspects slot1=streak, slot2=none', () => {
    const preview = composeWidgetPreview(cfg({ slot1: 'streak', slot2: 'none' }), 7, [true,true,true,true,true,true,true]);
    console.log('PREVIEW SVG:\n', preview.svg);
    const widget = QuickRecordWidget({ streak: 7, dots: [true,true,true,true,true,true,true], config: cfg({ slot1: 'streak', slot2: 'none' }) });
    console.log('WIDGET JSON:\n', JSON.stringify(widget, null, 2));
  });

  it('inspects slot1=none, slot2=streak', () => {
    const preview = composeWidgetPreview(cfg({ slot1: 'none', slot2: 'streak' }), 7, [true,true,true,true,true,true,true]);
    console.log('PREVIEW SVG (slot2=streak):\n', preview.svg);
    const widget = QuickRecordWidget({ streak: 7, dots: [true,true,true,true,true,true,true], config: cfg({ slot1: 'none', slot2: 'streak' }) });
    console.log('WIDGET JSON (slot2=streak):\n', JSON.stringify(widget, null, 2));
  });

  it('inspects slot1=income, slot2=streak', () => {
    const preview = composeWidgetPreview(cfg({ slot1: 'income', slot2: 'streak' }), 7, [true,true,true,true,true,true,true]);
    console.log('PREVIEW SVG (slot1=income, slot2=streak):\n', preview.svg);
    const widget = QuickRecordWidget({ streak: 7, dots: [true,true,true,true,true,true,true], config: cfg({ slot1: 'income', slot2: 'streak' }) });
    console.log('WIDGET JSON (slot1=income, slot2=streak):\n', JSON.stringify(widget, null, 2));
  });

  it('inspects slot1=none, slot2=none', () => {
    const preview = composeWidgetPreview(cfg({ slot1: 'none', slot2: 'none' }), 7, [true,true,true,true,true,true,true]);
    console.log('PREVIEW SVG (both none):\n', preview.svg);
    const widget = QuickRecordWidget({ streak: 7, dots: [true,true,true,true,true,true,true], config: cfg({ slot1: 'none', slot2: 'none' }) });
    console.log('WIDGET JSON (both none):\n', JSON.stringify(widget, null, 2));
  });
});
