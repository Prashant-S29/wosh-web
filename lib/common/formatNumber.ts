export const formatNumber = (num: number) => {
  if (num <= 9) return `0${num}`;
  return num;
};
