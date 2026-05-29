import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '@localloop/shared-types';

import { GroupMember } from '@/modules/groups/domain/entities/group-member.entity';
import { Message } from '@/modules/messages/domain/entities/message.entity';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';
import { buildMessageRepoMock } from '@/modules/messages/test/message-repo.mock';
import { EditMessageUseCase } from './edit-message.use-case';

describe('EditMessageUseCase', () => {
  let useCase: EditMessageUseCase;
  let messageRepo: ReturnType<typeof buildMessageRepoMock>;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;

  const buildMember = (
    role: MemberRole,
    status: MemberStatus = MemberStatus.ACTIVE,
  ): GroupMember =>
    new GroupMember('mem-1', 'group-1', 'caller-1', role, status, new Date());

  const buildMessage = (
    overrides: Partial<{ senderId: string; isDeleted: boolean }> = {},
  ): Message =>
    new Message({
      id: 'msg-1',
      groupId: 'group-1',
      senderId: overrides.senderId ?? 'caller-1',
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      isDeleted: overrides.isDeleted ?? false,
      replyToMessageId: null,
      editedAt: null,
      createdAt: new Date('2026-04-24T10:00:00Z'),
    });

  beforeEach(() => {
    messageRepo = buildMessageRepoMock();
    groupRepo = buildGroupRepoMock();
    useCase = new EditMessageUseCase(messageRepo, groupRepo);
  });

  it('updates content and sets editedAt when the caller is the author (regular MEMBER)', async () => {
    messageRepo.findById.mockResolvedValue(
      buildMessage({ senderId: 'caller-1' }),
    );
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    const result = await useCase.execute('caller-1', 'msg-1', {
      content: 'edited content',
    });

    expect(messageRepo.markAsEdited).toHaveBeenCalledWith(
      'msg-1',
      'edited content',
      expect.any(Date),
    );
    expect(result).toEqual({
      id: 'msg-1',
      groupId: 'group-1',
      content: 'edited content',
      editedAt: expect.any(Date),
      editedBy: 'caller-1',
    });
  });

  it('allows the author to edit when their role is OWNER', async () => {
    messageRepo.findById.mockResolvedValue(
      buildMessage({ senderId: 'caller-1' }),
    );
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.OWNER));

    await useCase.execute('caller-1', 'msg-1', { content: 'edited' });

    expect(messageRepo.markAsEdited).toHaveBeenCalled();
  });

  it('allows the author to edit when their role is MODERATOR', async () => {
    messageRepo.findById.mockResolvedValue(
      buildMessage({ senderId: 'caller-1' }),
    );
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MODERATOR));

    await useCase.execute('caller-1', 'msg-1', { content: 'edited' });

    expect(messageRepo.markAsEdited).toHaveBeenCalled();
  });

  it('rejects OWNER editing someone else’s message — edit is author-only', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage({ senderId: 'other' }));
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.OWNER));

    await expect(
      useCase.execute('caller-1', 'msg-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('rejects MODERATOR editing someone else’s message — edit is author-only', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage({ senderId: 'other' }));
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MODERATOR));

    await expect(
      useCase.execute('caller-1', 'msg-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('rejects regular MEMBER editing someone else’s message', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage({ senderId: 'other' }));
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    await expect(
      useCase.execute('caller-1', 'msg-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('rejects when caller is not a member of the group', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage());
    groupRepo.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute('caller-1', 'msg-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('rejects when caller is BANNED even if author', async () => {
    messageRepo.findById.mockResolvedValue(
      buildMessage({ senderId: 'caller-1' }),
    );
    groupRepo.findMember.mockResolvedValue(
      buildMember(MemberRole.MEMBER, MemberStatus.BANNED),
    );

    await expect(
      useCase.execute('caller-1', 'msg-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('throws 404 when the message does not exist', async () => {
    messageRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('caller-1', 'msg-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(groupRepo.findMember).not.toHaveBeenCalled();
    expect(messageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('throws 404 when the message is already soft-deleted', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage({ isDeleted: true }));

    await expect(
      useCase.execute('caller-1', 'msg-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(messageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('throws 400 EMPTY_MESSAGE when content is an empty string', async () => {
    messageRepo.findById.mockResolvedValue(
      buildMessage({ senderId: 'caller-1' }),
    );
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    await expect(
      useCase.execute('caller-1', 'msg-1', { content: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(messageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('throws 400 EMPTY_MESSAGE when content is whitespace-only', async () => {
    messageRepo.findById.mockResolvedValue(
      buildMessage({ senderId: 'caller-1' }),
    );
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    await expect(
      useCase.execute('caller-1', 'msg-1', { content: '   \n\t  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(messageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from content before persisting', async () => {
    messageRepo.findById.mockResolvedValue(
      buildMessage({ senderId: 'caller-1' }),
    );
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    const result = await useCase.execute('caller-1', 'msg-1', {
      content: '  hello world  ',
    });

    expect(messageRepo.markAsEdited).toHaveBeenCalledWith(
      'msg-1',
      'hello world',
      expect.any(Date),
    );
    expect(result.content).toBe('hello world');
  });
});
