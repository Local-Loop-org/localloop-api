import { EntityManager } from 'typeorm';
import { AnchorType } from '@localloop/shared-types';
import { RecordChatNotificationDigestInput } from '@/modules/notifications/domain/repositories/i-chat-notification-digest.repository';
import { ChatNotificationDigestOrmEntity } from '@/modules/notifications/infra/repositories/chat-notification-digest.entity';
import { ChatNotificationDigestTypeORMRepository } from '@/modules/notifications/infra/repositories/chat-notification-digest.typeorm.repository';

describe('ChatNotificationDigestTypeORMRepository', () => {
  let manager: {
    query: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let deleteMock: jest.Mock;
  let repository: ChatNotificationDigestTypeORMRepository;

  beforeEach(() => {
    manager = {
      query: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    deleteMock = jest.fn();
    repository = new ChatNotificationDigestTypeORMRepository({
      transaction: jest.fn(async (fn: (manager: EntityManager) => unknown) =>
        fn(manager as unknown as EntityManager),
      ),
      getRepository: jest.fn(() => ({ delete: deleteMock })),
    } as never);
  });

  it('returns a fresh state when inserting the first digest row', async () => {
    const input = buildInput({
      messageId: '00000000-0000-0000-0000-000000000001',
    });
    manager.query.mockResolvedValue([{ id: 'digest-1' }]);
    manager.findOne.mockResolvedValue(buildRow(input, 1));

    const result = await repository.recordMessage(input);

    expect(manager.save).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      recipientUserId: 'user-2',
      conversationKey: 'group:group-1',
      totalCount: 1,
      isReplacement: false,
    });
  });

  it('appends a same-conversation message within the digest ttl', async () => {
    const input = buildInput({
      messageId: '00000000-0000-0000-0000-000000000002',
      now: new Date('2026-05-24T12:00:20.000Z'),
      snippetPreview: 'boa noite',
    });
    const row = buildRow(input, 1, {
      latestMessageId: '00000000-0000-0000-0000-000000000001',
      totalCount: 1,
      snippets: [
        {
          messageId: '00000000-0000-0000-0000-000000000001',
          senderName: 'Joao',
          preview: 'ola',
          createdAt: '2026-05-24T12:00:00.000Z',
        },
      ],
      lastMessageAt: new Date('2026-05-24T12:00:00.000Z'),
    });
    manager.query.mockResolvedValue([]);
    manager.findOne.mockResolvedValue(row);
    manager.save.mockImplementation(async (_entity, digest) => digest);

    const result = await repository.recordMessage(input);

    expect(manager.save).toHaveBeenCalledWith(
      ChatNotificationDigestOrmEntity,
      expect.objectContaining({
        totalCount: 2,
        latestMessageId: '00000000-0000-0000-0000-000000000002',
      }),
    );
    expect(result.isReplacement).toBe(true);
    expect(result.snippets.map((snippet) => snippet.preview)).toEqual([
      'ola',
      'boa noite',
    ]);
  });

  it('resets stale digest state after the ttl expires', async () => {
    const input = buildInput({
      messageId: '00000000-0000-0000-0000-000000000003',
      now: new Date('2026-05-24T12:31:00.000Z'),
      snippetPreview: 'nova conversa',
    });
    const row = buildRow(input, 4, {
      latestMessageId: '00000000-0000-0000-0000-000000000002',
      totalCount: 4,
      snippets: [
        {
          messageId: '00000000-0000-0000-0000-000000000002',
          senderName: 'Maria',
          preview: 'mensagem antiga',
          createdAt: '2026-05-24T12:00:00.000Z',
        },
      ],
      lastMessageAt: new Date('2026-05-24T12:00:00.000Z'),
    });
    manager.query.mockResolvedValue([]);
    manager.findOne.mockResolvedValue(row);
    manager.save.mockImplementation(async (_entity, digest) => digest);

    const result = await repository.recordMessage(input);

    expect(manager.save).toHaveBeenCalledWith(
      ChatNotificationDigestOrmEntity,
      expect.objectContaining({
        totalCount: 1,
        snippets: [input.snippet],
        lastMessageAt: input.now,
      }),
    );
    expect(result).toMatchObject({
      totalCount: 1,
      snippets: [input.snippet],
      isReplacement: false,
    });
  });

  it('clears digest state for one recipient conversation', async () => {
    await repository.clear('user-2', 'group:group-1');

    expect(deleteMock).toHaveBeenCalledWith({
      recipientUserId: 'user-2',
      conversationKey: 'group:group-1',
    });
  });
});

function buildInput(
  overrides: Partial<{
    messageId: string;
    now: Date;
    snippetPreview: string;
  }> = {},
): RecordChatNotificationDigestInput {
  const messageId =
    overrides.messageId ?? '00000000-0000-0000-0000-000000000001';
  const now = overrides.now ?? new Date('2026-05-24T12:00:00.000Z');
  return {
    recipientUserId: 'user-2',
    conversationKey: 'group:group-1',
    type: 'group_message',
    title: 'Morumbi Runners',
    routeData: {
      type: 'group_message',
      conversationKey: 'group:group-1',
      groupId: 'group-1',
      groupName: 'Morumbi Runners',
      anchorType: AnchorType.NEIGHBORHOOD,
      messageId,
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
    },
    messageId,
    senderId: 'user-1',
    senderName: 'Alice',
    snippet: {
      messageId,
      senderName: 'Alice',
      preview: overrides.snippetPreview ?? 'ola',
      createdAt: now.toISOString(),
    },
    now,
    staleAfterMs: 30 * 60 * 1000,
    maxSnippets: 4,
  };
}

function buildRow(
  input: RecordChatNotificationDigestInput,
  totalCount: number,
  overrides: Partial<ChatNotificationDigestOrmEntity> = {},
): ChatNotificationDigestOrmEntity {
  return Object.assign(new ChatNotificationDigestOrmEntity(), {
    id: 'digest-1',
    recipientUserId: input.recipientUserId,
    conversationKey: input.conversationKey,
    type: input.type,
    title: input.title,
    routeData: input.routeData,
    latestMessageId: input.messageId,
    latestSenderId: input.senderId,
    latestSenderName: input.senderName,
    totalCount,
    snippets: [input.snippet],
    lastMessageAt: input.now,
    createdAt: input.now,
    updatedAt: input.now,
    ...overrides,
  });
}
