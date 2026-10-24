import { confirm, getPendingConfirm, resolveConfirm, subscribeConfirm, resetConfirmForTests } from '@/utils/confirm';

beforeEach(() => resetConfirmForTests());

const answer = (result: boolean) => resolveConfirm(getPendingConfirm()!.id, result);

it('resolves true on confirm and false on cancel', async () => {
  const yes = confirm({ title: 'delete album?', confirmLabel: 'delete' });
  answer(true);
  await expect(yes).resolves.toBe(true);
  const no = confirm({ title: 'delete photo?', confirmLabel: 'delete' });
  answer(false);
  await expect(no).resolves.toBe(false);
});

it('queues a second confirm until the first resolves', async () => {
  const first = confirm({ title: 'a', confirmLabel: 'ok' });
  const second = confirm({ title: 'b', confirmLabel: 'ok' });
  expect(getPendingConfirm()?.title).toBe('a');
  answer(true);
  expect(getPendingConfirm()?.title).toBe('b');
  answer(false);
  expect(getPendingConfirm()).toBeNull();
  await expect(first).resolves.toBe(true);
  await expect(second).resolves.toBe(false);
});

it('ignores an answer for a question that is not showing', async () => {
  const first = confirm({ title: 'a', confirmLabel: 'ok' });
  confirm({ title: 'b', confirmLabel: 'ok' });
  const queuedId = 'not-the-head';
  resolveConfirm(queuedId, true);
  expect(getPendingConfirm()?.title).toBe('a');
  answer(false);
  await expect(first).resolves.toBe(false);
});

it('defaults the cancel label to "cancel"', () => {
  confirm({ title: 'a', confirmLabel: 'ok' });
  expect(getPendingConfirm()?.cancelLabel).toBe('cancel');
});

it('subscribers hear new questions and answers', () => {
  const listener = jest.fn();
  const unsubscribe = subscribeConfirm(listener);
  confirm({ title: 'a', confirmLabel: 'ok' });
  expect(listener).toHaveBeenCalledTimes(1);
  answer(true);
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
});

it('keeps the same pending object until something changes', () => {
  confirm({ title: 'a', confirmLabel: 'ok' });
  expect(getPendingConfirm()).toBe(getPendingConfirm());
});
