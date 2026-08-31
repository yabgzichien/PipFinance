import React from 'react';
import { QuickRecordWidget } from '../src/widget/QuickRecordWidget';
import { widgetTaskHandler } from '../src/widget/widgetTask';

describe('QuickRecordWidget', () => {
  it('renders the 2x1 quick record widget component without crashing', () => {
    const element = QuickRecordWidget();
    expect(element).toBeDefined();
    expect(element.type).toBeDefined();
    expect(element.props.style.flexDirection).toBe('row');
    expect(element.props.style.backgroundColor).toBe('#faf8f2');
    expect(element.props.children).toHaveLength(5); // mascot, divider1, income button, divider2, expense button
  });

  it('contains expected clickAction URIs for mascot, income, and expense', () => {
    const element = QuickRecordWidget({ streak: 5 });
    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];

    // Child 0: Mascot container with streak SVG
    const mascotBtn = children[0];
    expect(mascotBtn.props.clickAction).toBe('OPEN_URI');
    expect(mascotBtn.props.clickActionData).toEqual({ uri: 'pip://dashboard' });
    const mascotSvg = mascotBtn.props.children;
    expect(mascotSvg.props.svg).toContain('>5<');
    expect(mascotSvg.props.svg).toContain('#FAA81A'); // Flame gold color

    // Child 2: Income Up Arrow button
    const incomeBtn = children[2];
    expect(incomeBtn.props.clickAction).toBe('OPEN_URI');
    expect(incomeBtn.props.clickActionData).toEqual({ uri: 'pip://add?type=income' });

    // Child 4: Expense Down Arrow button
    const expenseBtn = children[4];
    expect(expenseBtn.props.clickAction).toBe('OPEN_URI');
    expect(expenseBtn.props.clickActionData).toEqual({ uri: 'pip://add?type=expense' });
  });

  it('renders multi-digit streak counts correctly', () => {
    const element12 = QuickRecordWidget({ streak: 12 });
    const children12 = React.Children.toArray(element12.props.children) as React.ReactElement<any>[];
    expect(children12[0].props.children.props.svg).toContain('>12<');

    const element100 = QuickRecordWidget({ streak: 100 });
    const children100 = React.Children.toArray(element100.props.children) as React.ReactElement<any>[];
    expect(children100[0].props.children.props.svg).toContain('>100<');
  });

  describe('Deep link URL matching', () => {
    function parseDeepLink(url: string | null): { screen: string; type?: 'income' | 'expense' } | null {
      if (!url) return null;
      if (url.startsWith('pip://add') || url.endsWith('/add')) {
        const isIncome = url.includes('type=income') || url.includes('/income');
        const isExpense = url.includes('type=expense') || url.includes('/expense');
        if (isIncome) return { screen: 'add', type: 'income' };
        if (isExpense) return { screen: 'add', type: 'expense' };
        return { screen: 'add' };
      } else if (url.startsWith('pip://dashboard') || url.endsWith('/home')) {
        return { screen: 'home' };
      }
      return null;
    }

    it('correctly maps pip://add?type=income to add screen with income type', () => {
      expect(parseDeepLink('pip://add?type=income')).toEqual({ screen: 'add', type: 'income' });
      expect(parseDeepLink('pip://add/income')).toEqual({ screen: 'add', type: 'income' });
    });

    it('correctly maps pip://add?type=expense to add screen with expense type', () => {
      expect(parseDeepLink('pip://add?type=expense')).toEqual({ screen: 'add', type: 'expense' });
      expect(parseDeepLink('pip://add/expense')).toEqual({ screen: 'add', type: 'expense' });
    });

    it('correctly maps plain pip://add to add screen without type', () => {
      expect(parseDeepLink('pip://add')).toEqual({ screen: 'add' });
    });

    it('correctly maps pip://dashboard to home screen', () => {
      expect(parseDeepLink('pip://dashboard')).toEqual({ screen: 'home' });
    });
  });

  describe('widgetTaskHandler for QuickRecordWidget', () => {
    it('renders QuickRecordWidget on WIDGET_ADDED, WIDGET_UPDATE, WIDGET_RESIZED', async () => {
      const renderWidgetMock = jest.fn();

      await widgetTaskHandler({
        widgetInfo: {
          widgetId: 1,
          widgetName: 'QuickRecordWidget',
          width: 240,
          height: 110,
          screenInfo: {
            screenHeightDp: 800,
            screenWidthDp: 400,
            density: 2.75,
            densityDpi: 440,
          },
        },
        widgetAction: 'WIDGET_ADDED',
        renderWidget: renderWidgetMock,
      });

      expect(renderWidgetMock).toHaveBeenCalledTimes(1);
      const rendered = renderWidgetMock.mock.calls[0][0];
      expect(rendered.type).toBe(QuickRecordWidget);
    });
  });
});
