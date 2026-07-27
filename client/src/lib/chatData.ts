// ============================================
// client/src/lib/chatData.ts
// Data Model & Categories for Apex Messenger
// ============================================

export type CategoryId =
  | 'all'
  | 'channels'
  | 'direct'
  | 'starred'
  | 'archive';

export type TagCode = 'CH' | 'DM' | 'SEC' | 'AP';

export const CATEGORY_NAMES: Record<CategoryId, string> = {
  all: 'All Inboxes',
  channels: 'Channels',
  direct: 'Direct Messages',
  starred: 'Starred & Pinned',
  archive: 'Archived Chats',
};
