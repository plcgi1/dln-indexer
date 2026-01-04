export function delayTimeout(delayms: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, delayms);
  });
}
