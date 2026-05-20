import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  DEACTIVATED_PEER_NAME,
  DirectMessageTypeORMRepository,
} from './direct-message.typeorm.repository';
import { DirectMessageOrmEntity } from './direct-message.entity';

describe('DirectMessageTypeORMRepository — deactivated-peer placeholder substitution (DM-TASK-G)', () => {
  let messagesRepo: jest.Mocked<Repository<DirectMessageOrmEntity>>;
  let dataSource: jest.Mocked<DataSource>;
  let repo: DirectMessageTypeORMRepository;

  beforeEach(() => {
    messagesRepo = {
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<DirectMessageOrmEntity>>;
    dataSource = {
      query: jest.fn(),
      transaction: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;
    repo = new DirectMessageTypeORMRepository(messagesRepo, dataSource);
  });

  it('listInbox SQL substitutes peer_name + peer_avatar_url + last_sender_name on is_active=false', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

    await repo.listInbox('user-1', 20);

    const sql = (dataSource.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain(
      `CASE WHEN up.is_active = false THEN '${DEACTIVATED_PEER_NAME}' ELSE up.display_name END AS peer_name`,
    );
    expect(sql).toContain(
      'CASE WHEN up.is_active = false THEN NULL ELSE up.avatar_url END',
    );
    expect(sql).toContain(
      `CASE WHEN us.is_active = false THEN '${DEACTIVATED_PEER_NAME}' ELSE us.display_name END AS last_sender_name`,
    );
  });

  it('getDmSummary SQL substitutes last_sender_name on is_active=false', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

    await repo.getDmSummary('user-1', 'peer-1');

    const sql = (dataSource.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain(
      `CASE WHEN us.is_active = false THEN '${DEACTIVATED_PEER_NAME}' ELSE us.display_name END AS last_sender_name`,
    );
  });

  it('listRequests SQL substitutes sender display_name + avatar_url on is_active=false', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

    await repo.listRequests('user-1', 20);

    const sql = (dataSource.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain(
      `CASE WHEN u.is_active = false THEN '${DEACTIVATED_PEER_NAME}' ELSE u.display_name END AS u_display_name`,
    );
    expect(sql).toContain(
      'CASE WHEN u.is_active = false THEN NULL ELSE u.avatar_url END',
    );
  });

  it('baseQuery (findByIdWithSender / listConversation) selects substituted sender columns', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(null),
    };
    (messagesRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await repo.findByIdWithSender('msg-1');

    expect(messagesRepo.createQueryBuilder).toHaveBeenCalledWith('m');
    const selectArg = (qb.select as jest.Mock).mock.calls[0][0] as string[];
    expect(selectArg).toContain(
      `CASE WHEN u.is_active = false THEN '${DEACTIVATED_PEER_NAME}' ELSE u.display_name END AS u_display_name`,
    );
    expect(selectArg).toContain(
      'CASE WHEN u.is_active = false THEN NULL ELSE u.avatar_url END AS u_avatar_url',
    );
  });

  it('acceptRequestAtomic final SELECT substitutes sender display_name + avatar_url on is_active=false', async () => {
    const manager = {
      query: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    // Sequence inside the transaction:
    //   1) SELECT … FOR UPDATE on dm_requests
    //   2) INSERT into direct_messages RETURNING id
    //   3) INSERT into dm_permission_exceptions
    //   4) INSERT into dm_conversation_state
    //   5) DELETE FROM dm_requests
    //   6) Final SELECT JOIN users
    (manager.query as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'req-1',
          sender_id: 'sender-1',
          recipient_id: 'recipient-1',
          content: 'hi',
          created_at: new Date('2026-05-20T00:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([{ id: 'msg-new' }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          m_id: 'msg-new',
          m_sender_id: 'sender-1',
          m_recipient_id: 'recipient-1',
          m_content: 'hi',
          m_media_url: null,
          m_media_type: null,
          m_created_at: new Date('2026-05-20T00:00:00Z'),
          u_display_name: 'Alice',
          u_avatar_url: null,
        },
      ]);

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
    );

    await repo.acceptRequestAtomic('req-1');

    const finalSelectSql = (manager.query as jest.Mock).mock
      .calls[5][0] as string;
    expect(finalSelectSql).toContain('FROM direct_messages m');
    expect(finalSelectSql).toContain(
      `CASE WHEN u.is_active = false THEN '${DEACTIVATED_PEER_NAME}' ELSE u.display_name END AS u_display_name`,
    );
    expect(finalSelectSql).toContain(
      'CASE WHEN u.is_active = false THEN NULL ELSE u.avatar_url END AS u_avatar_url',
    );
  });
});
