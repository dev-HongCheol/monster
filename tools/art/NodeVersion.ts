/**
 * `.ts` 도구를 그대로 돌리기 위한 Node 최소 버전 확인.
 *
 * `tools/art/`의 실행기들은 `--experimental-strip-types`로 `.ts`를 컴파일 없이 돌린다. 그 플래그가
 * 22.6에 들어왔고 업로드에 쓰는 `File` 전역도 20부터다. **이 프로젝트는 장비 둘을 오간다** —
 * 낮은 Node가 깔린 쪽에서 돌리면 스트립이 문법 오류로 죽거나 `File is not defined`가 뜨는데,
 * 둘 다 원인이 Node 버전이라는 것이 메시지에 안 드러난다.
 *
 * 실행기마다 이 확인을 복사해 두지 않고 여기 모은 이유는 **버전이 오를 때 한 곳만 고치기**
 * 위해서다. 복사본이 갈리면 한 실행기는 막고 다른 실행기는 통과시켜, 같은 장비에서 도구마다
 * 다른 실패를 보게 된다.
 */

/** 이 도구들이 요구하는 Node 최소 버전. */
const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 6;

/** @throws 돌고 있는 Node가 최소 버전보다 낮으면 */
export function assertNodeVersion(): void {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR)) return;
  throw new Error(
    `Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} 이상이 필요하다 (지금 ${process.versions.node}) — ` +
      '`--experimental-strip-types`가 그 버전부터 있다.',
  );
}
