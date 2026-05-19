import { ToastMessageItem } from '../components/ToastMessage';

export const appendToastMessage = (
  currentMessages: ToastMessageItem[],
  nextMessage: Omit<ToastMessageItem, 'id'>,
  maxVisible = 3,
): ToastMessageItem[] => {
  const hasDuplicateVisible = currentMessages.some((message) =>
    message.message === nextMessage.message && (message.variant ?? 'standard') === (nextMessage.variant ?? 'standard'),
  );

  if (hasDuplicateVisible) {
    return currentMessages;
  }

  return [
    ...currentMessages.slice(-(maxVisible - 1)),
    {
      ...nextMessage,
      id: Date.now() + Math.floor(Math.random() * 1000),
    },
  ];
};
