export const UE1_LEVEL_VALUES = [
  0, 30, 50, 70, 90, 110, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220,
  230, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 340, 350, 360, 370,
] as const;

export const UE2_LEVEL_VALUES = [0, 1, 2, 3, 4, 5] as const;

export type Ue1LevelValue = (typeof UE1_LEVEL_VALUES)[number];
export type Ue2LevelValue = (typeof UE2_LEVEL_VALUES)[number];

export type Ue1Level = Ue1LevelValue | null;
export type Ue2Level = Ue2LevelValue | null;
