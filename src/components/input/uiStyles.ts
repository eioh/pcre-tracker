export const panelClass =
  "rounded-[18px] border border-white/30 bg-linear-to-br from-[#131a27cc] to-[#0d1421f2] p-5 shadow-panel";
export const inputToolbarClass = "grid grid-cols-1 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]";
export const sectionLabelClass = "mb-2 text-sm font-semibold text-[#c8d8f6]";
export const fieldGroupClass = "grid gap-1.5 text-sm text-muted";
export const resetButtonClass =
  "cursor-pointer rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-main transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";
export const controlClass =
  "w-full rounded-[12px] border border-white/20 bg-[#090e17d9] px-3 py-2.5 text-sm text-main outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40";
export const multiSelectSummaryClass = `${controlClass} cursor-pointer list-none select-none overflow-hidden text-ellipsis whitespace-nowrap [&::-webkit-details-marker]:hidden`;
export const multiSelectPanelClass =
  "absolute left-0 top-[calc(100%+6px)] z-10 grid max-h-60 w-full gap-2 overflow-auto rounded-[12px] border border-white/20 bg-[#090e17f5] px-2.5 py-2 shadow-panel";
export const multiSelectItemClass = "inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-main";
export const filterSeparatorClass = "my-3 h-px bg-[#7a94c547]";
export const tableSeparatorClass = "mt-4 mb-1 h-px bg-[#7a94c547]";
export const memoryCalcSectionClass = "mt-0.5 pt-1";
export const memoryCalcGridClass = "grid grid-cols-1 gap-3 md:grid-cols-3";
export const tableWrapClass =
  "max-h-[70vh] overflow-auto rounded-[14px] border border-[#7a94c53d] bg-[#0b111bcc] [scrollbar-gutter:stable_both-edges]";
export const tableClass = "w-full min-w-[1980px] border-collapse";
export const tableHeadCellClass =
  "sticky top-0 z-[1] whitespace-nowrap border-b border-[#7a94c533] bg-[#101825f5] px-3 py-2.5 align-middle text-xs tracking-[0.04em] text-[#c8d8f6]";
export const tableBodyCellClass = "border-b border-[#7a94c533] px-3 py-2.5 align-middle";
export const sortButtonClass =
  "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-0 bg-transparent p-0 text-inherit hover:text-[#dff8ff]";
export const sortIndicatorClass = "min-w-[0.85em] text-[0.72rem] text-accent";
export const tableSwitchClass = "inline-flex items-center gap-2 whitespace-nowrap text-sm";
export const tableCheckClass = "h-4 w-4 accent-accent";
export const tableSelectClass = `${controlClass} min-w-32 px-2.5 py-2`;
export const disabledTableSelectClass =
  "w-full min-w-32 cursor-default appearance-none rounded-[12px] border border-[#788aad38] bg-[#070b12bf] px-2.5 py-2 text-sm text-[#9fb0cf] opacity-100 outline-none [box-shadow:inset_0_0_0_1px_rgba(9,14,23,0.35)]";
export const normalBadgeClass = "rounded-full border border-[#67b8ffa6] bg-[#1c4e7a4f] px-2 py-0.5 text-[0.7rem] text-[#a9ddff]";
export const limitedBadgeClass = "rounded-full border border-[#ff7e63b3] bg-[#7b2c2552] px-2 py-0.5 text-[0.7rem] text-[#ffb19f]";
export const sourceChipBaseClass = "rounded-full border px-2 py-0.5 text-[0.72rem]";
export const sourceChipEmptyClass = `${sourceChipBaseClass} border-white/20 text-muted`;
export const characterTagBaseClass = "inline-flex rounded-md border px-1.5 py-0.5 text-[0.67rem] font-semibold leading-none";
export const characterNameCellLayoutClass = "grid grid-cols-[84px_1fr] items-center gap-2";
export const characterTagStackClass = "grid gap-1 justify-items-start";
