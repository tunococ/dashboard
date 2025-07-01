function randUintString(numBits: number) {
  return Math.floor(Math.random() * (1 << numBits))
    .toString(16)
    .padStart(Math.ceil(numBits / 4), "0");
}

export const randomUUID =
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID
    : () =>
        randUintString(32) +
        "-" +
        randUintString(16) +
        "-" +
        randUintString(16) +
        "-" +
        randUintString(16) +
        "-" +
        randUintString(48);
