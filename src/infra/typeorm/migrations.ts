import { InitialSetup1710770000000 } from '../migrations/1710770000000-InitialSetup';
import { CreateGroups1713700000000 } from '../migrations/1713700000000-CreateGroups';
import { CreateMessages1714000000000 } from '../migrations/1714000000000-CreateMessages';
import { AddGroupAnchorCoordinates1714500000000 } from '../migrations/1714500000000-AddGroupAnchorCoordinates';

export const migrations = [
  InitialSetup1710770000000,
  CreateGroups1713700000000,
  CreateMessages1714000000000,
  AddGroupAnchorCoordinates1714500000000,
];
