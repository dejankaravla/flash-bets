export interface LeaderboardEntry {
  rank: number;
  walletHandle: string;
  roiPercent: number;
  hotstreak: number;
}

export const LEADERBOARD_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, walletHandle: "0x7a3f...8f2", roiPercent: 142.5, hotstreak: 8 },
  { rank: 2, walletHandle: "0x2b1c...4e9", roiPercent: 118.3, hotstreak: 5 },
  { rank: 3, walletHandle: "0x9d4e...1a7", roiPercent: 97.6, hotstreak: 4 },
  { rank: 4, walletHandle: "0x5f8a...3c2", roiPercent: 86.2, hotstreak: 3 },
  { rank: 5, walletHandle: "0x1e6b...7d4", roiPercent: 74.8, hotstreak: 6 },
  { rank: 6, walletHandle: "0x8c2d...9f1", roiPercent: 62.1, hotstreak: 2 },
  { rank: 7, walletHandle: "0x4a9e...5b8", roiPercent: 51.4, hotstreak: 0 },
  { rank: 8, walletHandle: "0x3d7f...2e6", roiPercent: 38.9, hotstreak: 1 },
  { rank: 9, walletHandle: "0x6b1a...8c3", roiPercent: -12.4, hotstreak: 0 },
  { rank: 10, walletHandle: "0x0f5c...4a9", roiPercent: -28.7, hotstreak: 0 },
];
