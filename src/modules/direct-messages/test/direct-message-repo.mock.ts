import { IDirectMessageRepository } from '../domain/repositories/i-direct-message.repository';

export function buildDirectMessageRepoMock(): jest.Mocked<IDirectMessageRepository> {
  return {
    createDirectDeliveryAtomic: jest.fn(),
    findByIdWithSender: jest.fn(),
    listConversation: jest.fn(),
    hasPermissionException: jest.fn(),
    createRequest: jest.fn(),
    findRequestById: jest.fn(),
    acceptRequestAtomic: jest.fn(),
    declineRequest: jest.fn(),
    listInbox: jest.fn(),
    listRequests: jest.fn(),
    listExceptions: jest.fn(),
    listExceptionCandidates: jest.fn(),
    addException: jest.fn(),
    removeException: jest.fn(),
    markRead: jest.fn(),
    setArchived: jest.fn(),
    getDmSummary: jest.fn(),
  };
}
