// Named z-index scale — replaces the ad hoc z-[50]/z-[70]/z-[80] literals
// each modal/dropdown used to invent independently. Higher layers are for
// things that must always sit above whatever's already open (a confirm
// dialog stacked on top of another modal, say).
export const Z = {
  dropdown: 50,
  modal: 70,
  confirmDialog: 80,
};
