// __tests__/splitShareReceipt.test.ts
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { shareSplitMessage } from '../src/lib/shareText';
import {
  generateDeterministicReceipt,
  generateGroupSplitReceipt,
  groupReceiptCanvasInput,
  type GroupSplitPersonInput,
} from '../src/lib/receiptGenerator';
import { SELF } from '../src/lib/split';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('Split receipt sharing without clipboard copying', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shareSplitMessage shares image without calling Clipboard.setStringAsync', async () => {
    const outcome = await shareSplitMessage('Some breakdown text', 'file:///tmp/pip_receipt.png');

    expect(outcome).toBe('shared');
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/pip_receipt.png', {
      mimeType: 'image/png',
      UTI: 'public.png',
    });
    // Clipboard must NOT be touched
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  test('non-itemized group split receipt includes payer and friends reconciling 100% of bill', () => {
    const gross = 120;
    const ownShare = 40;
    const friendsShares = [
      { personId: 'friend1', name: 'Alice', owed: 40 },
      { personId: 'friend2', name: 'Bob', owed: 40 },
    ];

    const groupPeople: GroupSplitPersonInput[] = [
      {
        personId: SELF,
        name: 'You',
        items: [{ label: 'Food & Drinks', amount: ownShare, sharedBy: 1 }],
        itemsSubtotal: ownShare,
        surcharge: 0,
        total: ownShare,
      },
      ...friendsShares.map((f) => ({
        personId: f.personId,
        name: f.name,
        items: [{ label: 'Food & Drinks', amount: f.owed, sharedBy: 1 }],
        itemsSubtotal: f.owed,
        surcharge: 0,
        total: f.owed,
      })),
    ];

    const groupReceipt = generateGroupSplitReceipt({
      merchant: 'Sushi King',
      billTotal: gross,
      currency: 'MYR',
      billDate: '2026-09-11',
      categoryName: 'Food & Drinks',
      people: groupPeople,
      seedId: 'split-123',
      isZh: false,
    });

    const canvasInput = groupReceiptCanvasInput(groupReceipt, 'group');

    expect(canvasInput.key).toBe('group');
    expect(canvasInput.total).toBe(120);
    expect(canvasInput.sectionLabels).toEqual(['You', 'Alice', 'Bob']);
    expect(canvasInput.receipts).toHaveLength(3);

    const summed = groupReceipt.people.reduce((s, p) => s + p.total, 0);
    expect(summed).toBe(gross);
  });

  test('individual split receipt is correctly generated for a single debtor', () => {
    const receipt = generateDeterministicReceipt({
      merchant: 'Sushi King',
      total: 40,
      currency: 'MYR',
      personName: 'Alice',
      billDate: '2026-09-11',
      seedId: 'share-alice',
      categoryName: 'Food & Drinks',
      gross: 120,
      owed: 40,
      paid: 0,
      splitMethod: 'even',
      participantCount: 3,
      isZh: false,
    });

    expect(receipt.merchant).toBe('Sushi King');
    expect(receipt.personName).toBe('Alice');
    expect(receipt.total).toBe(40);
  });
});
