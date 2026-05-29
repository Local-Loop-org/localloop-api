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
      leftJoin: jest.fn().mockReturnThis(),
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

describe('DirectMessageTypeORMRepository.listExceptionCandidates', () => {
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

  it('base SQL filters active co-members and excludes already-excepted peers', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

    await repo.listExceptionCandidates('user-1', undefined, undefined, 20);

    const [sql, params] = (dataSource.query as jest.Mock).mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('FROM users u');
    expect(sql).toContain('u.is_active = true');
    expect(sql).toContain('u.id <> $1');
    expect(sql).toContain('FROM group_members gm_self');
    expect(sql).toContain('JOIN group_members gm_peer');
    expect(sql).toContain("gm_self.status = 'active'");
    expect(sql).toContain("gm_peer.status = 'active'");
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('FROM dm_permission_exceptions e');
    expect(sql).toContain('ORDER BY LOWER(u.display_name) ASC, u.id ASC');
    expect(params).toEqual(['user-1', 21]);
  });

  it('adds a LOWER LIKE clause and binds q as a wildcard parameter when provided', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

    await repo.listExceptionCandidates('user-1', 'Ali', undefined, 20);

    const [sql, params] = (dataSource.query as jest.Mock).mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('AND LOWER(u.display_name) LIKE $3');
    expect(params).toEqual(['user-1', 21, '%ali%']);
  });

  it('adds a keyset cursor clause comparing LOWER(display_name), id ASC when cursor is provided', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

    await repo.listExceptionCandidates(
      'user-1',
      undefined,
      { displayName: 'Mallory', userId: 'peer-9' },
      20,
    );

    const [sql, params] = (dataSource.query as jest.Mock).mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('AND (LOWER(u.display_name), u.id) > ($3, $4::uuid)');
    expect(params).toEqual(['user-1', 21, 'mallory', 'peer-9']);
  });

  it('combines q and cursor parameters in the correct order', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

    await repo.listExceptionCandidates(
      'user-1',
      'Bob',
      { displayName: 'Bob', userId: 'peer-2' },
      10,
    );

    const [sql, params] = (dataSource.query as jest.Mock).mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('AND LOWER(u.display_name) LIKE $3');
    expect(sql).toContain('AND (LOWER(u.display_name), u.id) > ($4, $5::uuid)');
    expect(params).toEqual(['user-1', 11, '%bob%', 'bob', 'peer-2']);
  });

  it('maps rows and returns null nextCursor when result size <= limit', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([
      { user_id: 'peer-1', display_name: 'Alice', avatar_url: 'a.png' },
      { user_id: 'peer-2', display_name: 'Bob', avatar_url: null },
    ]);

    const result = await repo.listExceptionCandidates(
      'user-1',
      undefined,
      undefined,
      20,
    );

    expect(result.rows).toEqual([
      { userId: 'peer-1', displayName: 'Alice', avatarUrl: 'a.png' },
      { userId: 'peer-2', displayName: 'Bob', avatarUrl: null },
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('returns nextCursor from the last row of the page when result overflows limit', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([
      { user_id: 'peer-1', display_name: 'Alice', avatar_url: null },
      { user_id: 'peer-2', display_name: 'Bob', avatar_url: null },
      { user_id: 'peer-3', display_name: 'Carol', avatar_url: null },
    ]);

    const result = await repo.listExceptionCandidates(
      'user-1',
      undefined,
      undefined,
      2,
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]).toEqual({
      userId: 'peer-2',
      displayName: 'Bob',
      avatarUrl: null,
    });
    expect(result.nextCursor).toEqual({
      displayName: 'Bob',
      userId: 'peer-2',
    });
  });
});

describe('DirectMessageTypeORMRepository.getConversationReadState', () => {
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

  it('reads caller and peer last_read_at only when a delivered thread exists', async () => {
    const lastReadAt = new Date('2026-05-16T10:02:00Z');
    const peerLastReadAt = new Date('2026-05-16T10:03:00Z');
    (dataSource.query as jest.Mock).mockResolvedValueOnce([
      {
        last_read_at: lastReadAt,
        peer_last_read_at: peerLastReadAt,
      },
    ]);

    const result = await repo.getConversationReadState('user-1', 'peer-1');

    const [sql, params] = (dataSource.query as jest.Mock).mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('WITH thread AS');
    expect(sql).toContain('FROM direct_messages m');
    expect(sql).toContain('m.is_deleted = false');
    expect(sql).toContain('cs.user_id = $1 AND cs.peer_id = $2');
    expect(sql).toContain('peer_cs.user_id = $2 AND peer_cs.peer_id = $1');
    expect(params).toEqual(['user-1', 'peer-1']);
    expect(result).toEqual({
      lastReadAt,
      peerLastReadAt,
    });
  });

  it('returns null when no non-deleted direct message exists for the pair', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

    await expect(
      repo.getConversationReadState('user-1', 'peer-1'),
    ).resolves.toBeNull();
  });
});
