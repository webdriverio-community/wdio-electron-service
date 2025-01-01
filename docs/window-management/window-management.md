# Window management

If your electron application has multiple windows and switch between them, this service will automatically target the new window after switching.

## Support use case

- splash screen

## Notes

After switching windows, if your application has over 2 windows, This service will target the window opened early.

If you cannot correctly identify the window to test, please specify the window explicitly in the test suite.

```ts
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it('some test with switching windows', async () => {
  // do some test what your want before switching the window

  await sleep(1000); // switch event for example time driven.

  // switch window
  const handles = await browser.getWindowHandles();
  if (handles.length === 2) {
    await browser.switchToWindow(handles[1]);
  } else {
    throw new Error(`unexpected`);
  }

  // do some test what your want
  // expect(...
});
```
