import { IMessageRepository } from '../domain/repositories/i-message.repository';

export function buildMessageRepoMock(): jest.Mocked<IMessageRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdWithSender: jest.fn(),
    listByGroup: jest.fn(),
    markAsDeleted: jest.fn(),
    markAsEdited: jest.fn(),
  };
}
