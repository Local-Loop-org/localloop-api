import { Repository } from 'typeorm';

import { MessageTypeORMRepository } from './message.typeorm.repository';
import { MessageOrmEntity } from './message.entity';

describe('MessageTypeORMRepository — tombstone mapping (C10 history)', () => {
  let messagesRepo: jest.Mocked<Repository<MessageOrmEntity>>;
  let repo: MessageTypeORMRepository;

  beforeEach(() => {
    messagesRepo = {
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<MessageOrmEntity>>;
    repo = new MessageTypeORMRepository(messagesRepo);
  });

  it('maps a soft-deleted row to a tombstone, stripping content + media', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        m_id: 'msg-deleted',
        m_group_id: 'group-1',
        m_sender_id: 'sender-1',
        m_content: 'secret content',
        m_media_url: 'https://cdn/secret.jpg',
        m_media_type: 'IMAGE',
        m_is_deleted: true,
        m_edited_at: null,
        m_reply_to_message_id: null,
        m_created_at: new Date('2026-05-20T00:00:00Z'),
        u_display_name: 'Alice',
        u_avatar_url: null,
        reply_sender_id: null,
        reply_content: null,
        reply_is_deleted: null,
      }),
    };
    (messagesRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const row = await repo.findByIdWithSender('msg-deleted');

    expect(row).toMatchObject({
      id: 'msg-deleted',
      isDeleted: true,
      content: null,
      mediaUrl: null,
      mediaType: null,
    });
  });

  it('passes content + media through for a live row', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        m_id: 'msg-live',
        m_group_id: 'group-1',
        m_sender_id: 'sender-1',
        m_content: 'hello',
        m_media_url: null,
        m_media_type: null,
        m_is_deleted: false,
        m_edited_at: null,
        m_reply_to_message_id: null,
        m_created_at: new Date('2026-05-20T00:00:00Z'),
        u_display_name: 'Alice',
        u_avatar_url: null,
        reply_sender_id: null,
        reply_content: null,
        reply_is_deleted: null,
      }),
    };
    (messagesRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const row = await repo.findByIdWithSender('msg-live');

    expect(row).toMatchObject({
      id: 'msg-live',
      isDeleted: false,
      content: 'hello',
    });
  });
});
