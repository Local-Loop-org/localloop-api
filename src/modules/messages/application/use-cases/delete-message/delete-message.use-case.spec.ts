import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MemberRole, MemberStatus } from '@localloop/shared-types';

import { GroupMember } from '@/modules/groups/domain/entities/group-member.entity';
import { Message } from '@/modules/messages/domain/entities/message.entity';
import { IMessageRepository } from '@/modules/messages/domain/repositories/i-message.repository';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';
import { DeleteMessageUseCase } from './delete-message.use-case';

describe('DeleteMessageUseCase', () => {
  let useCase: DeleteMessageUseCase;
  let messageRepo: jest.Mocked<IMessageRepository>;
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
    useCase = new DeleteMessageUseCase(messageRepo, groupRepo);
  });

  it('soft-deletes when the caller is the author (regular MEMBER)', async () => {
    messageRepo.findById.mockResolvedValue(
      buildMessage({ senderId: 'caller-1' }),
    );
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    const result = await useCase.execute('caller-1', 'msg-1');

    expect(messageRepo.markAsDeleted).toHaveBeenCalledWith('msg-1');
    expect(result).toEqual({
      id: 'msg-1',
      groupId: 'group-1',
      deletedBy: 'caller-1',
    });
  });

  it('allows OWNER to delete someone else’s message', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage({ senderId: 'other' }));
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.OWNER));

    await useCase.execute('caller-1', 'msg-1');

    expect(messageRepo.markAsDeleted).toHaveBeenCalledWith('msg-1');
  });

  it('allows MODERATOR to delete someone else’s message', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage({ senderId: 'other' }));
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MODERATOR));

    await useCase.execute('caller-1', 'msg-1');

    expect(messageRepo.markAsDeleted).toHaveBeenCalledWith('msg-1');
  });

  it('rejects regular MEMBER deleting someone else’s message', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage({ senderId: 'other' }));
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    await expect(useCase.execute('caller-1', 'msg-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(messageRepo.markAsDeleted).not.toHaveBeenCalled();
  });

  it('rejects when caller is not an ACTIVE member of the group', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage());
    groupRepo.findMember.mockResolvedValue(null);

    await expect(useCase.execute('caller-1', 'msg-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(messageRepo.markAsDeleted).not.toHaveBeenCalled();
  });

  it('rejects when caller is banned even if author', async () => {
    messageRepo.findById.mockResolvedValue(
      buildMessage({ senderId: 'caller-1' }),
    );
    groupRepo.findMember.mockResolvedValue(
      buildMember(MemberRole.MEMBER, MemberStatus.BANNED),
    );

    await expect(useCase.execute('caller-1', 'msg-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws 404 when the message does not exist', async () => {
    messageRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('caller-1', 'msg-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(groupRepo.findMember).not.toHaveBeenCalled();
  });

  it('throws 404 when the message is already soft-deleted', async () => {
    messageRepo.findById.mockResolvedValue(buildMessage({ isDeleted: true }));

    await expect(useCase.execute('caller-1', 'msg-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(messageRepo.markAsDeleted).not.toHaveBeenCalled();
  });
});

function buildMessageRepoMock(): jest.Mocked<IMessageRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdWithSender: jest.fn(),
    listByGroup: jest.fn(),
    markAsDeleted: jest.fn(),
  };
}
