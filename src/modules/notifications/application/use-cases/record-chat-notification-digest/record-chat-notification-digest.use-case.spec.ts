import { AnchorType } from '@localloop/shared-types';
import {
  ChatNotificationDigestState,
  IChatNotificationDigestRepository,
  RecordChatNotificationDigestInput as RepositoryInput,
} from '@/modules/notifications/domain/repositories/i-chat-notification-digest.repository';
import { RecordChatNotificationDigestUseCase } from '@/modules/notifications/application/use-cases/record-chat-notification-digest/record-chat-notification-digest.use-case';

describe('RecordChatNotificationDigestUseCase', () => {
  let useCase: RecordChatNotificationDigestUseCase;
  let digestRepo: jest.Mocked<IChatNotificationDigestRepository>;

  const groupData = {
    type: 'group_message',
    conversationKey: 'group:group-1',
    groupId: 'group-1',
    groupName: 'Morumbi Runners',
    anchorType: AnchorType.NEIGHBORHOOD,
    messageId: 'msg-1',
    senderId: 'user-1',
    senderName: 'Alice',
    senderAvatarUrl: null,
  } as const;

  beforeEach(() => {
    digestRepo = {
      recordMessage: jest.fn(),
      clear: jest.fn(),
    };
    useCase = new RecordChatNotificationDigestUseCase(digestRepo);
  });

  it('builds an immediate first notification with replacement keys and sound', async () => {
    digestRepo.recordMessage.mockImplementation(async (input) =>
      stateFromInput(input, {
        totalCount: 1,
        isReplacement: false,
        snippets: [input.snippet],
      }),
    );

    const result = await useCase.execute({
      recipientUserId: 'user-2',
      conversationKey: 'group:group-1',
      type: 'group_message',
      title: 'Morumbi Runners',
      data: groupData,
      messageId: 'msg-1',
      senderId: 'user-1',
      senderName: 'Alice',
      content: '  hello   local loop  ',
      now: new Date('2026-05-24T12:00:00.000Z'),
    });

    expect(result).toEqual({
      title: 'Morumbi Runners',
      body: 'Alice: hello local loop',
      data: groupData,
      collapseId: 'chat:user-2:group:group-1',
      tag: 'chat:user-2:group:group-1',
      sound: 'default',
      isReplacement: false,
      totalCount: 1,
    });
  });

  it('builds a silent replacement digest when the conversation already has messages', async () => {
    digestRepo.recordMessage.mockImplementation(async (input) =>
      stateFromInput(input, {
        totalCount: 2,
        isReplacement: true,
        snippets: [
          {
            messageId: 'msg-1',
            senderName: 'Joao',
            preview: 'ola',
            createdAt: '2026-05-24T12:00:00.000Z',
          },
          input.snippet,
        ],
      }),
    );

    const result = await useCase.execute({
      recipientUserId: 'user-2',
      conversationKey: 'group:group-1',
      type: 'group_message',
      title: 'Morumbi Runners',
      data: { ...groupData, messageId: 'msg-2', senderName: 'Maria' },
      messageId: 'msg-2',
      senderId: 'user-3',
      senderName: 'Maria',
      content: 'boa noite',
    });

    expect(result).toMatchObject({
      body: 'Joao: ola\nMaria: boa noite',
      collapseId: 'chat:user-2:group:group-1',
      tag: 'chat:user-2:group:group-1',
      sound: null,
      isReplacement: true,
      totalCount: 2,
    });
  });

  it('summarizes older messages when more than four snippets are pending', async () => {
    digestRepo.recordMessage.mockImplementation(async (input) =>
      stateFromInput(input, {
        totalCount: 6,
        isReplacement: true,
        snippets: [
          snippet('msg-3', 'Carlos', 'ja estou indo'),
          snippet('msg-4', 'Maria', 'chego em 5'),
          snippet('msg-5', 'Joao', 'beleza'),
          input.snippet,
        ],
      }),
    );

    const result = await useCase.execute({
      recipientUserId: 'user-2',
      conversationKey: 'group:group-1',
      type: 'group_message',
      title: 'Morumbi Runners',
      data: { ...groupData, messageId: 'msg-6', senderName: 'Ana' },
      messageId: 'msg-6',
      senderId: 'user-4',
      senderName: 'Ana',
      content: 'estou na portaria',
    });

    expect(result.body).toBe(
      [
        'Carlos: ja estou indo',
        'Maria: chego em 5',
        'Joao: beleza',
        'Ana: estou na portaria',
        '+2 mensagens',
      ].join('\n'),
    );
  });

  it('uses DM preview lines without sender prefixes', async () => {
    const dmData = {
      type: 'direct_message',
      conversationKey: 'dm:user-1',
      peerId: 'user-1',
      peerName: 'Alice',
      peerAvatarUrl: null,
      messageId: 'dm-1',
    } as const;
    digestRepo.recordMessage.mockImplementation(async (input) =>
      stateFromInput(input, {
        totalCount: 2,
        isReplacement: true,
        snippets: [
          snippet('dm-1', 'Alice', 'ola'),
          {
            messageId: 'dm-2',
            senderName: 'Alice',
            preview: 'boa noite',
            createdAt: '2026-05-24T12:00:10.000Z',
          },
        ],
      }),
    );

    const result = await useCase.execute({
      recipientUserId: 'user-2',
      conversationKey: 'dm:user-1',
      type: 'direct_message',
      title: 'Alice',
      data: dmData,
      messageId: 'dm-2',
      senderId: 'user-1',
      senderName: 'Alice',
      content: 'boa noite',
    });

    expect(result.body).toBe('ola\nboa noite');
  });

  it('normalizes blank and long previews before recording', async () => {
    digestRepo.recordMessage.mockImplementation(async (input) =>
      stateFromInput(input, {
        totalCount: 1,
        isReplacement: false,
        snippets: [input.snippet],
      }),
    );

    await useCase.execute({
      recipientUserId: 'user-2',
      conversationKey: 'group:group-1',
      type: 'group_message',
      title: 'Morumbi Runners',
      data: groupData,
      messageId: 'msg-1',
      senderId: 'user-1',
      senderName: 'Alice',
      content: '   ',
    });

    expect(digestRepo.recordMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snippet: expect.objectContaining({ preview: 'Nova mensagem' }),
      }),
    );

    await useCase.execute({
      recipientUserId: 'user-2',
      conversationKey: 'group:group-1',
      type: 'group_message',
      title: 'Morumbi Runners',
      data: groupData,
      messageId: 'msg-2',
      senderId: 'user-1',
      senderName: 'Alice',
      content: 'a'.repeat(150),
    });

    const recorded = digestRepo.recordMessage.mock.calls[1][0];
    expect(recorded.snippet.preview).toHaveLength(120);
    expect(recorded.snippet.preview.endsWith('...')).toBe(true);
  });
});

function stateFromInput(
  input: RepositoryInput,
  overrides: Pick<
    ChatNotificationDigestState,
    'totalCount' | 'isReplacement' | 'snippets'
  >,
): ChatNotificationDigestState {
  return {
    recipientUserId: input.recipientUserId,
    conversationKey: input.conversationKey,
    type: input.type,
    title: input.title,
    routeData: input.routeData,
    totalCount: overrides.totalCount,
    snippets: overrides.snippets,
    lastMessageAt: input.now,
    isReplacement: overrides.isReplacement,
  };
}

function snippet(
  messageId: string,
  senderName: string,
  preview: string,
): {
  messageId: string;
  senderName: string;
  preview: string;
  createdAt: string;
} {
  return {
    messageId,
    senderName,
    preview,
    createdAt: '2026-05-24T12:00:00.000Z',
  };
}
